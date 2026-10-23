// Brinky service worker: decides when to show eye breaks, water reminders and nudges.
// Principles: only interrupt someone who is looking; never during calls or screen sharing; one reminder at a
// time; anything that ends a break clears it from every tab; and never late: 15 seconds ahead, the tab you're
// on is armed with everything it needs and starts the break by itself, on the dot, without waiting on
// this worker or on any other tab.
import {
  getSettings, getRaw, effective, withDefaults, getState, setState, bumpStat, setStatMax, getStats, today, lines,
  isPaused, isQuiet, inHours, nextMorning, hostMatches, migrate, clock12,
} from "./common.js";

const MIN = 60e3;
const REST_MIN = 3 * MIN;            // time away that counts as a real break
const ARM_SEC = 15;                  // arm the tab you're on this long before a break
const TAKEOVER = 32e3;               // an armed tab may wait this long for you to finish typing
const RESTRICTED = /^(chrome|edge|brave|about|chrome-extension|devtools|view-source|chrome-search|chrome-untrusted):/i;
const WATER_BACKOFF = [15, 30, 45];  // minutes after 1, 2, 3+ unanswered waves
const you = (s) => (s?.name?.trim() ? `, ${s.name.trim()}` : ""); // "…, Sam" when you've told Brinky your name

// Every state change runs through one queue so two timers can never start two breaks.
let q = Promise.resolve();
const queue = (fn) => (q = q.then(fn).catch((e) => console.warn("[brinky]", e)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// test hook (used by the automated checks; harmless in normal use)
const debug = (globalThis.__brinky = { force: { active: null, focused: null } });

// ───────── tabs: never wait on a slow or frozen tab ─────────
const canMessage = (t) => t?.id != null && !RESTRICTED.test(t.url || "") && !/chromewebstore\.google\.com|chrome\.google\.com\/webstore/.test(t.url || "");
const within = (p, ms, fallback = null) => Promise.race([p, new Promise((r) => setTimeout(() => r(fallback), ms))]);
const send = (tabId, msg, ms = 1500) => within(chrome.tabs.sendMessage(tabId, msg).catch(() => null), ms);
const ask = (tab, msg, ms) => (canMessage(tab) ? send(tab.id, msg, ms) : Promise.resolve(null));
function broadcast(msg, skip = []) { // fire and forget: one busy tab can't hold up the others
  chrome.tabs.query({}).then((tabs) => {
    for (const t of tabs) if (canMessage(t) && !skip.includes(t.id)) chrome.tabs.sendMessage(t.id, msg).catch(() => {});
  }, () => {});
}
// The break screen and the water wave load into a page only when that page needs them.
const inject = (tabId, file, frameId = 0) => chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: [file] }).then(() => true, () => false);
async function deliver(tab, msg, file) {
  let r = await send(tab.id, msg);
  if (r?.need) { if (!(await inject(tab.id, file))) return null; r = await send(tab.id, msg); }
  return r;
}

async function presence() {
  let win = null, tab = null, focused = false, idle = "active";
  try {
    win = await chrome.windows.getLastFocused({ populate: true, windowTypes: ["normal"] });
    tab = win?.tabs?.find((t) => t.active) || null;
    focused = !!win?.focused;
  } catch {}
  try { idle = await chrome.idle.queryState(60); } catch {}
  if (debug.force.focused != null) focused = debug.force.focused;
  if (debug.force.active != null) idle = debug.force.active ? "active" : "idle";
  return { win, tab, focused, active: idle === "active", idle };
}

async function blockedReason(s, pr, st) {
  const now = Date.now(), dnd = s.dnd || {};
  if (dnd.calls) {
    const live = Object.values(st.callTabs || {}).filter((c) => now - c.at < 3 * MIN);
    if (live.some((c) => c.share)) return "sharing";
    if (live.some((c) => c.call)) return "call";
    // a meeting site that has been playing sound in the last 3 minutes also counts as a call
    const tabs = await chrome.tabs.query({ audible: true });
    if (tabs.some((t) => hostMatches(t.url, s.meetingHosts))) { await setState({ meetingAudibleAt: now }); return "call"; }
    if (now - (st.meetingAudibleAt || 0) < 3 * MIN) return "call";
  }
  if (dnd.fullscreen && pr.focused && pr.win?.state === "fullscreen") return "fullscreen";
  if (dnd.focusSites && pr.focused && pr.tab && hostMatches(pr.tab.url, s.focusSites)) return "focus";
  if (dnd.video && pr.tab) { const r = await ask(pr.tab, { t: "isPlaying" }, 800); if (r?.playing) return "video"; }
  return "";
}

// ───────── water pacing ─────────
// how many glasses "should" be done by now, spread across your day
function expected(s, d = new Date()) {
  const a = s.activeHours?.on ? s.activeHours : { start: "09:00", end: "19:00" };
  const m = (t) => { const [h, x] = t.split(":").map(Number); return h * 60 + x; };
  const now = d.getHours() * 60 + d.getMinutes(), s0 = m(a.start), e0 = m(a.end);
  const span = (e0 - s0 + 1440) % 1440 || 1440, into = (now - s0 + 1440) % 1440;
  return into > span ? 0 : Math.floor(s.water.goal * Math.min(1, into / span));
}
// paced: about one glass per (day ÷ goal); sooner while you're 2+ glasses behind
const waterGap = (s, glasses) => (s.water.paced && expected(s) - glasses >= 2 ? Math.min(30, s.water.everyMin) : s.water.everyMin) * MIN;
const glassesToday = async () => (await getStats())[today()]?.water || 0;

// ───────── scheduling ─────────
const armSec = (s) => Math.max(ARM_SEC, s.headsUpSec || 0);
let shortTimer;
async function schedule() {
  const s = await getSettings(), st = await getState(), now = Date.now();
  const times = [];
  if (s.enabled) {
    if (st.pausedUntil > now) times.push(st.pausedUntil);
    else if (!isPaused(st)) {
      if (st.quietUntil > now) times.push(st.quietUntil);
      if (st.phase === "break") times.push(st.breakEndsAt + 2500);
      else if (st.nextBreakAt) {
        times.push(st.nextBreakAt - armSec(s) * 1000, st.nextBreakAt);
        if (st.phase === "headsup" && st.armedTab) times.push(st.nextBreakAt + TAKEOVER);
      }
      if (s.water.on && st.nextWaterAt) times.push(st.nextWaterAt);
    }
  }
  const next = times.filter((t) => t > now).sort((a, b) => a - b)[0];
  await chrome.alarms.clear("at");
  clearTimeout(shortTimer);
  if (next) {
    chrome.alarms.create("at", { when: Math.max(next, now + 1000) });
    if (next - now < 25e3) shortTimer = setTimeout(() => queue(step), Math.max(0, next - now) + 30);
  }
  badge(s, st);
}
const recheck = (ms) => { clearTimeout(shortTimer); shortTimer = setTimeout(() => queue(step), ms); chrome.alarms.create("at", { when: Date.now() + Math.max(ms, 1000) }); };

function badge(s, st) {
  const text = !s.enabled ? "off" : isPaused(st) ? "II" : isQuiet(st) ? "zz" : "";
  chrome.action.setBadgeText({ text }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ color: "#64748b" }).catch(() => {});
}

// ───────── the main loop ─────────
async function step() {
  const s = await getSettings();
  let st = await getState();
  const now = Date.now();
  if (!s.enabled) return schedule();

  if (st.pausedUntil > 0 && st.pausedUntil <= now) st = await setState({ pausedUntil: 0, phase: "work", nextBreakAt: now + s.workMin * MIN, nextWaterAt: now + 10 * MIN });
  if (isPaused(st)) return schedule();

  if (st.quietUntil && st.quietUntil <= now) st = await endQuiet(s);
  if (isQuiet(st)) return schedule();

  if (st.phase === "break") {
    if (now > st.breakEndsAt + 2500) await finalizeBreak();
    else if (s.water.on && st.nextWaterAt && now >= st.nextWaterAt && !st.breakSip) await waterDuringBreak(s, st);
    return schedule();
  }

  // outside active hours Brinky is off duty: keep pushing everything forward
  if (!inHours(s)) {
    if (st.phase === "headsup") broadcast({ t: "hideHeadsup" });
    await setState({ phase: "work", armedTab: 0, blockedBy: "", notified: 0, nextBreakAt: now + s.workMin * MIN, nextWaterAt: now + Math.min(s.water.everyMin, 15) * MIN });
    return schedule();
  }

  if (!st.nextBreakAt) st = await setState({ nextBreakAt: now + s.workMin * MIN });
  if (!st.nextWaterAt) st = await setState({ nextWaterAt: now + s.water.everyMin * MIN });
  if (!st.lastRestAt) st = await setState({ lastRestAt: now });

  const pr = await presence();
  const why = await blockedReason(s, pr, st);

  // planned quiet times (lunch …): reminders pause; nothing covers the page
  const d = new Date(), nowMin = d.getHours() * 60 + d.getMinutes();
  for (const p of s.planned || []) {
    const [h, m] = (p.time || "").split(":").map(Number);
    if (!Number.isFinite(h)) continue;
    const key = `${today()} ${p.time}`, into = nowMin - (h * 60 + m);
    if (st.lastPlanned === key || into < 0) continue;
    if (into >= 30) { await setState({ lastPlanned: key }); continue; } // missed the window today
    if (why === "call" || why === "sharing") continue;                 // wait for the call to end
    await setState({ lastPlanned: key });
    await startQuiet(s, p.label || "Quiet time", p.min || 30, pr);
    return schedule();
  }

  // a block that has ended no longer shows as "waiting" (away/elsewhere clear themselves when you're back)
  if (!why && st.blockedBy && !["away", "elsewhere"].includes(st.blockedBy)) st = await setState({ blockedBy: "", blockedSince: 0 });

  // calls: remember when one started; offer a break after a long one
  const inCall = why === "call" || why === "sharing";
  if (inCall && !st.callSince) st = await setState({ callSince: now });
  if (!inCall && st.callSince) {
    const mins = Math.round((now - st.callSince) / MIN);
    st = await setState({ callSince: 0 });
    if (mins >= 30 && s.postCallBreak && st.phase === "work") st = await setState({ nextBreakAt: Math.min(st.nextBreakAt, now + 20e3), postCallMin: mins });
  }

  // a heads-up in progress stops if you got busy or left Chrome
  if (st.phase === "headsup" && (why || !pr.focused || !pr.active)) {
    broadcast({ t: "hideHeadsup" });
    st = await setState({ phase: "work", armedTab: 0 });
  }

  // longest stretch at the screen without a real rest
  if (pr.active) await setStatMax("longestMin", Math.round((now - st.lastRestAt) / MIN));

  // water first, so a break that is waiting (e.g. on a focus site) never starves it
  if (s.water.on && now >= st.nextWaterAt) { await maybeWater(s, st, pr, why); st = await getState(); }

  const left = st.nextBreakAt - now;

  // break is due
  if (left <= 0) {
    // the armed tab starts it on its own (or is waiting a moment for you to finish typing)
    if (st.phase === "headsup" && st.armedTab) {
      if (pr.tab?.id === st.armedTab && now < st.nextBreakAt + TAKEOVER) return schedule();
      send(st.armedTab, { t: "hideHeadsup" });
      st = await setState({ armedTab: 0 });
    }
    const wait = async (reason, ms = 30e3) => {
      await setState({ blockedBy: reason, blockedSince: st.blockedBy === reason ? st.blockedSince : now, phase: "work", armedTab: 0, nextBreakAt: now + ms });
      if (st.phase === "headsup") broadcast({ t: "hideHeadsup" });
      return schedule();
    };
    if (why) return wait(why);
    if (!pr.active) return wait("away");
    if (!pr.focused) {
      // you're working in another app: a system notification instead of a hidden overlay
      if (!st.notified) { await notifyBreak(s, st); await setState({ notified: now, lastShown: now }); st = await getState(); return wait("elsewhere"); }
      if (now - st.notified > 3 * MIN) {
        chrome.notifications.clear("break");
        await bumpStat("missed");
        await setState({ notified: 0, blockedBy: "", phase: "work", snoozesInRow: 0, nextBreakAt: now + s.workMin * MIN });
        return schedule();
      }
      return wait("elsewhere");
    }
    if (st.blockedBy || st.notified) { // just came back: a 10 s warning instead of jumping in
      chrome.notifications.clear("break");
      st = await setState({ blockedBy: "", notified: 0, phase: "work", nextBreakAt: now + 10e3 });
      if (canMessage(pr.tab)) await arm(s, st, pr, 10);
      return schedule();
    }
    if (s.typingAware) {
      const r = await ask(pr.tab, { t: "lastKey" }, 800);
      if (r && r.ago < 2500 && left > -30e3) return recheck(2500); // wait for a pause, up to 30 s
    }
    if (st.skipNext) {
      await bumpStat("skipped");
      await setState({ skipNext: false, phase: "work", nextBreakAt: now + s.workMin * MIN });
      broadcast({ t: "hideHeadsup" });
      return schedule();
    }
    await startBreak({ pr });
    return schedule();
  }

  // arm the tab you're on (and show the heads-up), only for someone who's looking and free
  const armable = st.phase === "work" || (st.phase === "headsup" && !st.armedTab);
  if (armable && !why && pr.active && pr.focused && !st.skipNext && left <= armSec(s) * 1000 && canMessage(pr.tab)) await arm(s, st, pr, Math.round(left / 1000));

  // nudges: one at a time, inside the reminder budget
  st = await getState();
  if (st.phase === "work" && !why && pr.active && pr.focused && left > 90e3) await maybeNudge(s, st, pr, left);
  return schedule();
}

const nextKind = (s, st) => (s.longEvery > 0 && (st.breakCount + 1) % s.longEvery === 0 ? "long" : "short");
const breakLength = (s, kind) => (kind === "long" ? s.longMin * MIN : s.breakSec * 1000);

// Everything a page needs to draw a break.
async function breakOpts(s, st, { kind, startedAt = 0, endsAt = 0, dur = 0, exStart = st.exIndex || 0 }) {
  const glass = (await glassesToday()) + 1;
  return {
    kind, startedAt, endsAt, dur: dur || endsAt - startedAt, label: st.breakLabel || "",
    messages: lines(s.messages), breath: s.breath, exercises: s.exercises, look: s.breakLook, lookAway: s.lookAway, holdToSkip: s.holdToSkip,
    sound: s.sound, ambient: s.ambient, volume: s.volume, sip: !!st.breakSip && s.water.on, glass, goal: s.water.goal,
    postCall: st.postCallMin || 0, exStart, name: s.name, noSnooze: (st.snoozesInRow || 0) >= s.maxSnoozes,
    pauseMedia: s.pauseMedia, typingAware: s.typingAware,
  };
}

// Arm the tab you're on: it gets the whole break in advance and starts it itself at `at`.
async function arm(s, st, pr, sec) {
  const at = st.nextBreakAt, kind = nextKind(s, st);
  const ready = await inject(pr.tab.id, "breaklayer.js"); // the break screen is in place well before it's needed
  const o = await breakOpts(s, st, { kind, dur: breakLength(s, kind) });
  const r = await send(pr.tab.id, {
    t: "headsup", at, kind, pill: s.headsUpSec > 0, fade: s.fadeBefore ? Math.min(8, sec) : 0, postCall: st.postCallMin || 0,
    follow: s.cursorCountdown, noSnooze: o.noSnooze, arm: ready ? o : null,
  });
  await setState({ phase: "headsup", armedTab: ready && r?.armed ? pr.tab.id : 0 });
}

// ───────── nudges ─────────
const iconSet = (p) => ({ 16: `icons/${p}16.png`, 32: `icons/${p}32.png`, 48: `icons/${p}48.png`, 128: `icons/${p}128.png` });
async function blinkIcon() {
  for (let i = 0; i < 3; i++) {
    await chrome.action.setIcon({ path: iconSet("blink-") }).catch(() => {}); await sleep(170);
    await chrome.action.setIcon({ path: iconSet("") }).catch(() => {}); await sleep(380);
  }
}
async function maybeNudge(s, st, pr, left) {
  const now = Date.now();
  const due = (cfg, last) => cfg?.on && last && now - last >= cfg.everyMin * MIN;
  if (!st.lastBlink || !st.lastPosture || !st.lastLook) return setState({ lastBlink: st.lastBlink || now, lastPosture: st.lastPosture || now, lastLook: st.lastLook || now });
  // work mode has no 20-second break screens, so every 20 minutes a quiet look-away note by your cursor
  if (s.workMode.on && now - st.lastLook >= 20 * MIN && left > 3 * MIN) {
    await setState({ lastLook: now, lastBlink: now });
    if (await ask(pr.tab, { t: "nudge", kind: "look", at: s.nudgeAt, sec: 20 })) await bumpStat("nudges");
    return;
  }
  const budgetOk = now - (st.lastShown || 0) >= s.budgetMin * MIN;
  if (due(s.posture, st.lastPosture) && budgetOk) {
    await setState({ lastPosture: now, lastShown: now, lastBlink: Math.max(st.lastBlink, now - (s.blink.everyMin - 5) * MIN) });
    if (await ask(pr.tab, { t: "nudge", kind: "posture", at: s.nudgeAt })) await bumpStat("nudges");
    return;
  }
  if (due(s.blink, st.lastBlink)) {
    await setState({ lastBlink: now });
    if (s.blink.style === "pill") { if (!budgetOk) return; await setState({ lastShown: now }); if (await ask(pr.tab, { t: "nudge", kind: "blink", at: s.nudgeAt })) await bumpStat("nudges"); }
    else { blinkIcon(); await bumpStat("nudges"); } // the toolbar Brinky blinks: no pop-up at all
  }
}

// ───────── quiet time (planned breaks) ─────────
async function startQuiet(s, label, min, pr) {
  const now = Date.now(), until = now + min * MIN;
  await setState({ quietUntil: until, quietLabel: label, phase: "work", armedTab: 0, blockedBy: "" });
  broadcast({ t: "hideHeadsup" });
  broadcast({ t: "waterEnd" });
  pr = pr || (await presence());
  if (canMessage(pr.tab) && pr.focused && pr.active) send(pr.tab.id, { t: "toast", kind: "quiet", text: `${label}: reminders paused until ${clock12(until)}. Enjoy${you(s)}.`, action: "I'm back" });
}
async function endQuiet(s) {
  const now = Date.now();
  return setState({ quietUntil: 0, quietLabel: "", phase: "work", nextBreakAt: now + s.workMin * MIN, nextWaterAt: now + Math.min(s.water.everyMin, 10) * MIN, lastRestAt: now });
}

// ───────── water ─────────
// When water and an eye break meet, they become one moment: the break asks for the sip.
async function maybeWater(s, st, pr, why) {
  const now = Date.now();
  const later = (ms) => setState({ nextWaterAt: now + ms });
  const g = await glassesToday();
  if (s.water.stopAtGoal && g >= s.water.goal) return later(60 * MIN);
  if (st.phase === "headsup") return setState({ breakSip: true, nextWaterAt: st.nextBreakAt + 15 * MIN }); // seconds away: ask in the break
  if (why && why !== "focus") return later(2 * MIN);         // calls, sharing, video, fullscreen
  if (!pr.active) return later(MIN);                          // away: try again when you're back
  if (!why && !st.blockedBy && st.nextBreakAt - now < 10 * MIN) return setState({ breakSip: true, nextWaterAt: st.nextBreakAt + 15 * MIN });
  const gap = (s.budgetMin * MIN) / 2;
  if (now - (st.lastShown || 0) < gap) return setState({ nextWaterAt: st.lastShown + gap });
  return showWater(s, pr, why === "focus" ? "card" : s.water.style);
}
async function waterDuringBreak(s, st) {
  const g = await glassesToday();
  if (s.water.stopAtGoal && g >= s.water.goal) return setState({ nextWaterAt: Date.now() + 60 * MIN });
  await setState({ breakSip: true, nextWaterAt: st.breakEndsAt + 15 * MIN });
  broadcast({ t: "breakSip", glass: g + 1, goal: s.water.goal });
}

async function showWater(s, pr, style) {
  s = s || (await getSettings());
  pr = pr || (await presence());
  const now = Date.now(), st = await getState();
  if (st.phase === "break") return waterDuringBreak(s, st);  // never on top of a break
  const glass = (await glassesToday()) + 1;
  await setState({ nextWaterAt: now + waterGap(s, glass - 1) });
  let shown = false;
  if (pr.focused && canMessage(pr.tab)) {
    const r = await deliver(pr.tab, {
      t: "water", at: now + 150, hold: (s.water.holdSec || 20) * 1000, glass, goal: s.water.goal, sound: s.water.sound, volume: s.volume,
      style: style || s.water.style, size: s.water.size, glassMl: s.water.glassMl, units: s.units, name: s.name,
    }, "water.js");
    shown = !!r?.shown;
  }
  if (shown) { await setState({ lastShown: now, waterShownAt: now }); return; }
  // Chrome isn't in front, or the page can't show it: a system notification instead
  chrome.notifications.create("water", {
    type: "basic", iconUrl: "icons/128.png", title: `Time for some water${you(s)}`,
    message: `Glass ${glass} of ${s.water.goal} today. A few sips is all it takes.`,
    buttons: [{ title: "I drank some" }, { title: "In 10 min" }], priority: 0,
  });
  await setState({ lastShown: now });
}
async function logWater(n = 1) {
  const s = await getSettings(), st = await getState(), now = Date.now();
  if (n < 0) { const cur = await glassesToday(); if (cur > 0) await bumpStat("water", -1); return; }
  await bumpStat("water", n);
  const patch = { waterIgnores: 0, lastWaterAt: now, waterShownAt: 0, nextWaterAt: now + waterGap(s, await glassesToday()) };
  if (st.nextWaterAt > patch.nextWaterAt) delete patch.nextWaterAt;
  await setState(patch);
  chrome.notifications.clear("water");
  broadcast({ t: "waterEnd" });
  return schedule();
}
async function waterOutcome(kind, min) {
  const st = await getState(), now = Date.now();
  if (kind === "drank") return logWater(1);
  const patch = { waterShownAt: 0 };
  if (kind === "later" || kind === "dismissed") patch.nextWaterAt = now + (min || 10) * MIN;
  if (kind === "hidden") patch.nextWaterAt = now + 5 * MIN;
  if (kind === "ignored") {
    const n = (st.waterIgnores || 0) + 1;
    Object.assign(patch, { waterIgnores: n, nextWaterAt: now + WATER_BACKOFF[Math.min(n, WATER_BACKOFF.length) - 1] * MIN });
  }
  await setState(patch);
  chrome.notifications.clear("water");
  broadcast({ t: "waterEnd" }); // every tab, every outcome: nothing is left frozen in the background
  return schedule();
}

// ───────── breaks ─────────
async function startBreak({ manual = false, pr = null, fromNotification = false } = {}) {
  const s = await getSettings(), st = await getState(), now = Date.now();
  if (st.phase === "break") return;
  const kind = manual ? "short" : nextKind(s, st);
  return beginBreak(s, st, { kind, manual, startedAt: now, endsAt: now + breakLength(s, kind), pr, forceWindow: fromNotification });
}

// A break begins: either an armed tab already started it (`source`), or we show it now in the tab you're on.
// The tab in front goes first; every other tab is told without waiting for an answer.
async function beginBreak(s, st, { kind, manual = false, startedAt, endsAt, pr = null, source = null, sourceSip = false, forceWindow = false }) {
  const now = Date.now();
  const waterOnScreen = st.waterShownAt && now - st.waterShownAt < ((s.water.holdSec || 20) + 8) * 1000;
  const sip = s.water.on && (st.breakSip || !!waterOnScreen); // a water reminder on screen joins the break
  const exStart = st.exIndex || 0;
  st = await setState({
    phase: "break", breakKind: kind, breakLabel: "", breakStartedAt: startedAt, breakEndsAt: endsAt, breakExStart: exStart,
    breakCount: manual ? st.breakCount : st.breakCount + 1, breakManual: manual, breakSeenMs: 0, skipNext: false,
    blockedBy: "", notified: 0, breakWins: [], lastShown: now, armedTab: 0, breakSip: sip, waterShownAt: 0,
    exIndex: kind === "long" ? exStart + Math.max(1, Math.round((endsAt - startedAt) / 30e3)) : exStart,
  });
  chrome.notifications.clear("break");
  chrome.notifications.clear("water");
  const o = { t: "breakStart", ...(await breakOpts(s, st, { kind, startedAt, endsAt, exStart })) };
  if (source != null) {
    if (sip && !sourceSip) send(source, { t: "breakSip", glass: o.glass, goal: o.goal });
    broadcast({ ...o, primary: false }, [source]);
    return;
  }
  pr = pr || (await presence());
  let reached = false;
  if (pr.focused && canMessage(pr.tab)) reached = !!(await deliver(pr.tab, { ...o, primary: true }, "breaklayer.js"))?.ok;
  broadcast({ ...o, primary: false }, [pr.tab?.id]);
  if (reached && !forceWindow) return;
  // The tab in front can't show it (chrome:// pages, New Tab), or you opened it from a notification.
  try {
    const w = pr.win;
    const win = await chrome.windows.create({
      url: chrome.runtime.getURL("break.html?primary=1"), type: "popup", focused: true,
      ...(w ? { left: w.left, top: w.top, width: w.width, height: w.height } : { width: 900, height: 640 }),
    });
    await setState({ breakWins: [win.id] });
  } catch (e) { console.warn("[brinky] break window", e); }
}

// An armed tab started the break on time: make it official.
async function commitArmed(tab, m) {
  const s = await getSettings(), st = await getState();
  if (st.phase === "break") return { ok: true };
  if (!s.enabled || st.phase !== "headsup" || st.armedTab !== tab?.id || isPaused(st) || isQuiet(st)) return { cancel: true };
  await beginBreak(s, st, { kind: m.kind, startedAt: m.startedAt, endsAt: m.endsAt, source: tab.id, sourceSip: !!m.sip });
  await schedule();
  return { ok: true };
}

// Called a moment after the countdown ends. A break counts as taken only if it was actually on screen
// for at least half its length, or you stepped away during it.
async function finalizeBreak() {
  const st = await getState();
  if (st.phase !== "break") return;
  const dur = st.breakEndsAt - st.breakStartedAt;
  let away = false; try { away = (await chrome.idle.queryState(15)) !== "active"; } catch {}
  return endBreak(st.breakSeenMs >= dur * 0.5 || away ? "done" : "missed");
}

async function endBreak(reason, postpone = 5) {
  const s = await getSettings(), st = await getState(), now = Date.now();
  if (st.phase === "break") {
    const patch = { phase: "work", breakEndsAt: 0, breakWins: [], blockedBy: "", breakSip: false, postCallMin: 0, nextBreakAt: now + s.workMin * MIN };
    const dur = Math.round((now - (st.breakStartedAt || now)) / 1000);
    if (reason === "done") {
      await bumpStat("taken");
      await bumpStat("restSec", Math.min(dur, Math.round((st.breakEndsAt - st.breakStartedAt) / 1000) + 5));
      Object.assign(patch, { lastRestAt: now, snoozesInRow: 0 });
    } else if (reason === "missed") { await bumpStat("missed"); patch.snoozesInRow = 0; }
    else if (reason === "postpone") {
      await bumpStat("snoozed");
      patch.nextBreakAt = now + postpone * MIN;
      patch.snoozesInRow = (st.snoozesInRow || 0) + 1;
      if (!st.breakManual) patch.breakCount = Math.max(0, st.breakCount - 1); // same kind of break next time
    } else if (reason === "skip") { await bumpStat("skipped"); patch.snoozesInRow = 0; }
    // pause / off / hours end a break without counting it either way
    if (st.breakSip && !(st.lastWaterAt > st.breakStartedAt)) patch.nextWaterAt = now + 10 * MIN;
    else if (st.nextWaterAt && st.nextWaterAt < now + 5 * MIN) patch.nextWaterAt = now + 5 * MIN; // no splash right after a break
    await setState(patch);
    for (const id of st.breakWins || []) chrome.windows.remove(id).catch(() => {});
  }
  // always tell every tab, even if the engine thought no break was running
  broadcast({ t: "breakEnd" });
  return schedule();
}

async function notifyBreak(s, st) {
  const long = nextKind(s, st) === "long", capped = (st.snoozesInRow || 0) >= s.maxSnoozes;
  chrome.notifications.create("break", {
    type: "basic", iconUrl: "icons/128.png",
    title: long ? `Time for a ${s.longMin}-minute break${you(s)}` : `${s.name?.trim() ? `${s.name.trim()}, look` : "Look"} away for ${s.breakSec} seconds`,
    message: long ? "Stand up, stretch, refill your water." : "Find something far away, out of a window if you can.",
    buttons: [{ title: long ? "I took the break" : "I looked away" }, ...(capped ? [] : [{ title: "In 5 min" }])], priority: 1,
  });
}

// ───────── user actions ─────────
async function snooze(min) {
  const s = await getSettings(), st = await getState();
  if ((st.snoozesInRow || 0) >= s.maxSnoozes) return schedule(); // that was the last snooze: the break comes now
  if (st.phase === "break") return endBreak("postpone", min);
  await bumpStat("snoozed");
  await setState({ phase: "work", armedTab: 0, blockedBy: "", notified: 0, snoozesInRow: (st.snoozesInRow || 0) + 1, nextBreakAt: Date.now() + min * MIN });
  chrome.notifications.clear("break");
  broadcast({ t: "hideHeadsup" });
  return schedule();
}
async function pause(min) {
  const s = await getSettings();
  let until = -1;
  if (min === "tomorrow") until = nextMorning(s);
  else if (min > 0) until = Date.now() + min * MIN;
  const st = await getState();
  if (st.phase === "break") await endBreak("pause");          // clears the overlay in every tab
  await setState({ pausedUntil: until, phase: "work", armedTab: 0, blockedBy: "", notified: 0 });
  broadcast({ t: "hideHeadsup" });
  broadcast({ t: "waterEnd" });
  return schedule();
}
async function resume() {
  const s = await getSettings(), now = Date.now();
  await setState({ pausedUntil: 0, quietUntil: 0, phase: "work", armedTab: 0, blockedBy: "", nextBreakAt: now + s.workMin * MIN, nextWaterAt: now + Math.min(s.water.everyMin, 15) * MIN });
  return schedule();
}
async function setEnabled(on) {
  const st = await getState();
  if (!on && st.phase === "break") await endBreak("off");
  if (on) return resume();
  await setState({ phase: "work", armedTab: 0, blockedBy: "", notified: 0 });
  broadcast({ t: "hideHeadsup" });
  broadcast({ t: "waterEnd" });
  return schedule();
}

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  const run = async () => {
    switch (m.t) {
      case "get": { const raw = await getRaw(); return { settings: raw, eff: effective(raw), state: await getState(), stats: await getStats() }; }
      case "breakState": {
        const s = await getSettings(), st = await getState();
        return st.phase === "break" ? breakOpts(s, st, { kind: st.breakKind, startedAt: st.breakStartedAt, endsAt: st.breakEndsAt, exStart: st.breakExStart }) : { none: true };
      }
      case "need": return { ok: await inject(sender.tab?.id, m.what === "water" ? "water.js" : "breaklayer.js", sender.frameId || 0) };
      case "armStarted": return commitArmed(sender.tab, m);
      case "armMiss": { // the armed tab couldn't start it (hidden, fullscreen, a video): decide again now
        const st = await getState();
        if (st.armedTab === sender.tab?.id) await setState({ armedTab: 0 });
        return step();
      }
      case "breakNow": return startBreak({ manual: !m.scheduled });
      case "endBreak": return endBreak(m.reason, m.postpone);
      case "breakDone": { // a tab finished its countdown; it reports how long it was actually visible
        const st = await getState();
        if (st.phase !== "break") { broadcast({ t: "breakEnd" }); return; }
        const seen = Math.max(st.breakSeenMs || 0, m.seenMs || 0);
        await setState({ breakSeenMs: seen });
        if (m.primary) return finalizeBreak();
        return schedule();
      }
      case "snooze": return snooze(m.min);
      case "skipNext": {
        const st = await getState(), on = !st.skipNext;
        await setState({ skipNext: on, ...(on && st.phase === "headsup" ? { phase: "work", armedTab: 0 } : {}) });
        if (on && st.phase === "headsup") broadcast({ t: "hideHeadsup" });
        return schedule();
      }
      case "pause": return pause(m.min);
      case "resume": return resume();
      case "toggle": { const raw = await getRaw(); await chrome.storage.sync.set({ settings: { ...raw, enabled: !raw.enabled } }); return; }
      case "endQuiet": { await endQuiet(await getSettings()); return schedule(); }
      case "settingsChanged": return step();
      case "waterNow": return showWater(null, null, m.style);
      case "waterDone": return waterOutcome("drank");
      case "waterSnooze": return waterOutcome("later", m.min || 10);
      case "waterIgnored": return waterOutcome("ignored");
      case "waterDismissed": return waterOutcome("dismissed");
      case "waterHidden": return waterOutcome("hidden");
      case "logWater": return logWater(m.n || 1);
      case "media": { // a page started or stopped using the camera/microphone or sharing the screen
        const id = sender.tab?.id; if (id == null) return;
        const st = await getState(), callTabs = { ...(st.callTabs || {}) };
        if (m.call || m.share) callTabs[id] = { call: !!m.call, share: !!m.share, at: Date.now() };
        else delete callTabs[id];
        await setState({ callTabs });
        return step();
      }
    }
  };
  // reads don't change anything, so they skip the queue and answer instantly
  (["get", "breakState", "need"].includes(m.t) ? run() : queue(run)).then((r) => reply(r ?? { ok: true }), () => reply({ ok: false }));
  return true;
});

chrome.commands.onCommand.addListener((c) => queue(async () => {
  if (c === "break-now") return startBreak({ manual: true });
  if (c === "snooze-5") return snooze(5);
  if (c === "log-water") return logWater(1);
  if (c === "toggle-pause") return isPaused(await getState()) ? resume() : pause(-1);
}));

chrome.notifications.onButtonClicked.addListener((id, i) => queue(async () => {
  if (id === "water") return i === 0 ? logWater(1) : waterOutcome("later", 10);
  if (id === "break") {
    chrome.notifications.clear("break");
    if (i === 1) return snooze(5);
    const s = await getSettings(), st = await getState(), now = Date.now();
    const long = nextKind(s, st) === "long";
    await bumpStat("taken");
    await bumpStat("restSec", long ? s.longMin * 60 : s.breakSec);
    await setState({ notified: 0, blockedBy: "", phase: "work", snoozesInRow: 0, lastRestAt: now, nextBreakAt: now + s.workMin * MIN, breakCount: st.breakCount + 1 });
    return schedule();
  }
}));
chrome.notifications.onClicked.addListener((id) => queue(async () => {
  chrome.notifications.clear(id);
  if (id === "break") return startBreak({ fromNotification: true }); // clicking the notification opens the break
}));

chrome.alarms.onAlarm.addListener(() => queue(step));

chrome.tabs.onRemoved.addListener((id) => queue(async () => {
  const st = await getState(), patch = {};
  if (st.callTabs?.[id]) { patch.callTabs = { ...st.callTabs }; delete patch.callTabs[id]; }
  if (st.armedTab === id) patch.armedTab = 0;
  if (Object.keys(patch).length) { await setState(patch); return step(); }
}));
chrome.tabs.onUpdated.addListener((id, info) => {
  if (!info.url) return;
  queue(async () => { const st = await getState(); if (st.callTabs?.[id]) { const callTabs = { ...st.callTabs }; delete callTabs[id]; await setState({ callTabs }); } });
});

// A break window closed by hand counts as skipping the break.
chrome.windows.onRemoved.addListener((id) => queue(async () => {
  const st = await getState();
  if (st.phase !== "break" || !(st.breakWins || []).includes(id)) return;
  const rest = st.breakWins.filter((w) => w !== id);
  await setState({ breakWins: rest });
  if (!rest.length) await endBreak(Date.now() >= st.breakEndsAt - 1500 ? "done" : "skip");
}));

// Time away: 3+ minutes counts as a real break. Shorter pauses (reading, thinking) don't reset anything.
chrome.idle.setDetectionInterval(60);
chrome.idle.onStateChanged.addListener((state) => queue(async () => {
  const s = await getSettings(), st = await getState(), now = Date.now();
  if (state !== "active") { if (!st.idleSince) await setState({ idleSince: now - (state === "idle" ? 60e3 : 0) }); return; }
  if (!st.idleSince) return step();
  const away = now - st.idleSince;
  const patch = { idleSince: 0 };
  if (st.phase === "break") patch.breakSeenMs = st.breakEndsAt - st.breakStartedAt; // stepped away during the break: rested
  else if (s.enabled && !isPaused(st) && s.idleReset && away >= REST_MIN) {
    Object.assign(patch, { phase: "work", armedTab: 0, blockedBy: "", notified: 0, snoozesInRow: 0, nextBreakAt: now + s.workMin * MIN, lastRestAt: now });
    if (away >= 10 * MIN) patch.breakCount = 0;
    if (away < 3 * 60 * MIN && inHours(s)) await bumpStat("restSec", Math.round(Math.min(away, 30 * MIN) / 1000)); // nights don't count
    chrome.notifications.clear("break");
    broadcast({ t: "hideHeadsup" });
  }
  if (st.nextWaterAt && st.nextWaterAt < now + 2 * MIN) patch.nextWaterAt = now + 2 * MIN; // a moment to settle back in
  await setState(patch);
  return step();
}));

// React to settings saved from the popup, the SuperBrink page or the welcome tour.
chrome.storage.onChanged.addListener((c, area) => {
  if (area !== "sync" || !c.settings) return;
  const o = effective(withDefaults(c.settings.oldValue)), n = effective(withDefaults(c.settings.newValue)), now = Date.now();
  queue(async () => {
    const st = await getState(), patch = {};
    if (o.enabled && !n.enabled) return setEnabled(false);
    if (!o.enabled && n.enabled) return setEnabled(true);
    if ((o.workMin !== n.workMin || o.workMode.on !== n.workMode.on) && st.phase !== "break") Object.assign(patch, { phase: "work", armedTab: 0, nextBreakAt: now + n.workMin * MIN });
    if (o.workMode.on !== n.workMode.on) patch.lastLook = now;
    if (o.water.everyMin !== n.water.everyMin || (!o.water.on && n.water.on)) patch.nextWaterAt = now + n.water.everyMin * MIN;
    if (o.water.on && !n.water.on) broadcast({ t: "waterEnd" });
    if (Object.keys(patch).length) await setState(patch);
    if (patch.phase) broadcast({ t: "hideHeadsup" });
    return schedule();
  });
});

// ───────── lifecycle ─────────
async function boot(fresh) {
  const s = await getSettings(), st = await getState(), now = Date.now();
  for (const id of st.breakWins || []) chrome.windows.remove(id).catch(() => {});
  await setState({
    phase: "work", armedTab: 0, blockedBy: "", breakWins: [], breakEndsAt: 0, idleSince: 0, notified: 0, callTabs: {}, callSince: 0, lastRestAt: now,
    nextBreakAt: fresh || !st.nextBreakAt || st.nextBreakAt < now ? now + s.workMin * MIN : st.nextBreakAt,
    nextWaterAt: fresh || !st.nextWaterAt || st.nextWaterAt < now ? now + s.water.everyMin * MIN : st.nextWaterAt,
  });
  chrome.alarms.create("beat", { periodInMinutes: 1 });
  broadcast({ t: "breakEnd" });
  return schedule();
}

chrome.runtime.onInstalled.addListener((details) => queue(async () => {
  if (details.reason === "update" && /^([12]\.|3\.0\.)/.test(details.previousVersion || "")) await migrate();
  await boot(true);
  if (details.reason === "install") {
    const { welcomed } = await chrome.storage.sync.get("welcomed");
    if (!welcomed) { await chrome.storage.sync.set({ welcomed: true }); chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") }); }
  }
  // tabs that were already open don't have the content scripts yet
  const tabs = await chrome.tabs.query({});
  for (const t of tabs.filter(canMessage)) {
    chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["mascot.js", "content.js"] }).catch(() => {});
    chrome.scripting.executeScript({ target: { tabId: t.id, allFrames: true }, files: ["pagewatch.js"], world: "MAIN" }).catch(() => {});
  }
}));
chrome.runtime.onStartup.addListener(() => queue(() => boot(true)));

Object.assign(debug, {
  step: () => queue(step), startBreak: (o) => queue(() => startBreak(o)), showWater: (style) => queue(() => showWater(null, null, style)),
  endBreak: (r) => queue(() => endBreak(r)), pause: (m) => queue(() => pause(m)),
  startQuiet: (l, m) => queue(async () => startQuiet(await getSettings(), l, m)), getState, getSettings, getStats,
});
