// Brinky's scheduler. Four gentle rhythms, each a chrome.alarms one-shot:
//   eye      an eye break with one exercise from the library (cursor blinks first)
//   blink    the cursor blinks a few times: "blink slowly with me"
//   water    a wave across every window, a pixel tumbler on your cursor, or a simple card
//   stretch  the cursor turns into a little stretching figure: "stretch a little :)"
// Nothing lives in your tabs until it's needed: layer.js is injected into the tab you're looking at, at the moment.
// Overlays that follow you (the wave and eye breaks) re-appear in whichever tab you switch to, at the right point.
// SuperBrink: advanced values from settings.adv apply only while settings.superbrink is on (see common.js).
import "./exercises.js";
import { getSettings, saveSettings, getToday, setToday, waterPrompt, dayKey, adv, blankDay, getLog, BUILTIN_PRESETS, DEFAULTS } from "./common.js";

const EYES = globalThis.BrinkyEyes;
const INJECTABLE = /^(https?|file):/i;
const FEATURES = ["eye", "blink", "water", "stretch"];
const OFFSET = { eye: 0, blink: 0.5, water: 2, stretch: 5 }; // minutes, so rhythms don't land on top of each other
const BOOT = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);

// ───────────── stats for nerds: a tiny per-day log, written one change at a time ─────────────
let logQ = Promise.resolve();
function bump(fn) {
  logQ = logQ.then(async () => {
    const log = await getLog(), k = dayKey();
    const d = (log.days[k] = Object.assign(blankDay(), log.days[k] || {}));
    fn(d);
    const keys = Object.keys(log.days);
    if (keys.length > 90) for (const old of keys.sort((a, b) => new Date(a) - new Date(b)).slice(0, keys.length - 90)) delete log.days[old];
    await chrome.storage.local.set({ log });
  }).catch(() => {});
  return logQ;
}
const defer = (why) => bump((d) => { d.defer[why] = (d.defer[why] || 0) + 1; });

// ───────────── timing ─────────────
const toMin = (s) => { const [h, m] = String(s).split(":").map(Number); return h * 60 + (m || 0); };
function inHours(t, s) {
  if (!s.hours.on) return t;
  const d = new Date(t), m = d.getHours() * 60 + d.getMinutes(), a = toMin(s.hours.from), b = toMin(s.hours.to);
  if (m >= a && m < b) return t;
  const n = new Date(d); n.setHours(Math.floor(a / 60), a % 60, 0, 0);
  if (m >= b) n.setDate(n.getDate() + 1);
  return n.getTime();
}
const every = (name, s) => ({ eye: s.eyes.every, blink: s.eyes.blinkEvery, water: s.water.every, stretch: s.stretch.every }[name]);
function enabled(name, s, today) {
  if (!s.on) return false;
  if (name === "eye") return s.eyes.on;
  if (name === "blink") return s.eyes.on && s.eyes.blink;
  if (name === "water") return s.water.on && (!today || today.glasses < s.water.goal);
  if (name === "stretch") return s.stretch.on;
  return false;
}
async function schedule(name, minutes, s) {
  s ||= await getSettings();
  const today = await getToday();
  if (!enabled(name, s, today)) {
    await chrome.alarms.clear(name);
    if (name === "water" && s.on && s.water.on) { // water rests after the goal; it wakes again tomorrow
      const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(9, 0, 0, 0);
      await chrome.alarms.create("water", { when: inHours(t.getTime(), s) });
    }
    return badge();
  }
  const base = Math.max(Date.now(), s.pausedUntil || 0);
  await chrome.alarms.create(name, { when: inHours(base + (minutes ?? every(name, s)) * 60e3, s) });
  badge();
}
// the evening recap: when your working hours end, or at six if you haven't set any
async function scheduleRecap(s) {
  if (!s.recap || !s.on) return chrome.alarms.clear("recap");
  const [h, m] = (s.hours.on ? s.hours.to : "18:00").split(":").map(Number);
  const t = new Date(); t.setHours(h, m || 0, 0, 0); if (t.getTime() <= Date.now() + 60e3) t.setDate(t.getDate() + 1);
  await chrome.alarms.create("recap", { when: t.getTime() });
}
async function recap() {
  const s = await getSettings(), t = await getToday(); scheduleRecap(s);
  if (!s.on || !s.recap) return;
  const msg = { t: "recap", id: uid(), name: s.name, glasses: t.glasses, goal: s.water.goal, water: s.water.on, breaks: t.breaks, moves: t.stretches || 0, ...common(s, adv(s)) };
  const { win, tab } = await focusedTab();
  if (win?.focused && canDraw(tab) && !(await getLive())) { const r = await runIn(tab.id, msg); if (r?.ok) return; }
  notify(`recap:${msg.id}`, "That's a wrap for today", `${t.breaks} eye break${t.breaks === 1 ? "" : "s"}${s.water.on ? `, ${t.glasses} of ${s.water.goal} glasses` : ""}, ${t.stretches || 0} time${t.stretches === 1 ? "" : "s"} moving. See you tomorrow.`);
}
// right-click anywhere (or on Brinky's toolbar icon)
function menus() {
  chrome.contextMenus.removeAll(() => {
    const ctx = ["page", "selection", "link", "image", "action"];
    chrome.contextMenus.create({ id: "b-eye", title: "Rest my eyes now", contexts: ctx });
    chrome.contextMenus.create({ id: "b-glass", title: "I just drank a glass", contexts: ctx });
    chrome.contextMenus.create({ id: "b-pause", title: "Pause Brinky for an hour", contexts: ctx });
  });
}
chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === "b-eye") eyeBreak({ manual: true });
  if (info.menuItemId === "b-glass") { const s = await getSettings(), t = await getToday(); await setGlasses(t.glasses + 1, s); schedule("water", null, s); }
  if (info.menuItemId === "b-pause") pause(60);
});
async function scheduleAll() {
  const s = await getSettings();
  for (const f of FEATURES) await schedule(f, every(f, s) + OFFSET[f], s);
  await scheduleRecap(s);
  const mid = new Date(); mid.setHours(24, 0, 30, 0);
  await chrome.alarms.create("day", { when: mid.getTime() });
  await applyIdle(s);
}
async function applyIdle(s) { chrome.idle.setDetectionInterval(Math.max(60, adv(s).idleMin * 60)); }

// ───────────── which exercise comes next ─────────────
function nextExercise(s, today) {
  const a = adv(s), last = today.lastEx ?? -1;
  let pool = EYES.list.map((e, i) => i).filter((i) => !a.exOff.includes(EYES.list[i].id));
  if (s.eyes.mode === "quick") { const q = pool.filter((i) => ["far", "blink"].includes(EYES.list[i].id)); pool = q.length ? q : [0, 1]; }
  if (!pool.length) pool = [0];
  if (a.order === "shuffle" && pool.length > 1) {
    const c = pool.filter((i) => i !== last);
    const seed = (today.breaks * 7919 + (last + 2) * 104729 + new Date().getDate() * 31) % 2147483647; // stable until the next break
    return c[seed % c.length];
  }
  return pool.find((i) => i > last) ?? pool[0];
}

// ───────────── toolbar badge (SuperBrink) ─────────────
async function badge() {
  const s = await getSettings(), a = adv(s);
  if (s.pausedUntil > Date.now()) { chrome.action.setBadgeText({ text: "zz" }); chrome.action.setBadgeBackgroundColor({ color: "#8E8E93" }); return; }
  let text = "";
  if (s.on && a.badge === "glasses") { const t = await getToday(); text = `${t.glasses}/${s.water.goal}`; }
  if (s.on && a.badge === "eye") { const al = await chrome.alarms.get("eye"); if (al) text = `${Math.max(0, Math.ceil((al.scheduledTime - Date.now()) / 60e3))}m`; }
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: "#1F8BF2" });
  if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ color: "#FFFFFF" });
  if (a.badge === "eye" && s.on) chrome.alarms.create("badge", { delayInMinutes: 1 }); else chrome.alarms.clear("badge");
}

// ───────────── live overlay (survives the service worker sleeping) ─────────────
let live;
async function getLive() {
  if (live === undefined) live = (await chrome.storage.session.get("live")).live || null;
  if (live && live.start && Date.now() > live.start + live.max) live = null;
  return live;
}
async function setLive(l) { live = l; await chrome.storage.session.set({ live: l }); }

// ───────────── reaching the page you're looking at ─────────────
async function focusedTab() {
  const win = await chrome.windows.getLastFocused({ populate: true, windowTypes: ["normal"] }).catch(() => null);
  return { win, tab: win?.tabs?.find((t) => t.active) || null };
}
const canDraw = (tab) => tab && INJECTABLE.test(tab.url || "") && !/^https?:\/\/chromewebstore\.google\.com/i.test(tab.url);
async function runIn(tabId, msg) {
  const t0 = performance.now();
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["exercises.js", "face.js", "layer.js"] });
    const ms = performance.now() - t0;
    bump((d) => { d.inject.n++; d.inject.ms += ms; });
    const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: (m) => globalThis.BrinkyLayer?.run(m), args: [msg] });
    const res = r?.result || { ok: false };
    if (res.busy) defer(res.busy);
    if (res.waited) defer("typing");
    return res;
  } catch (e) { bump((d) => { d.inject.fail++; }); return { error: String(e) }; }
}
function endIn(tabId, kind) {
  return chrome.scripting.executeScript({ target: { tabId }, func: (k) => globalThis.BrinkyLayer?.end(k), args: [kind] }).catch(() => {});
}
async function inCall(s) {
  const a = adv(s); if (!a.quietCalls) return false;
  const hosts = a.callHosts.split(/[\s,]+/).map((h) => h.trim().toLowerCase()).filter(Boolean);
  const tabs = await chrome.tabs.query({ audible: true });
  return tabs.some((t) => { try { const h = new URL(t.url).hostname.toLowerCase(); return hosts.some((x) => h === x || h.endsWith("." + x)); } catch { return false; } });
}
async function iconBlink(times = 2) {
  const p = (b) => ({ 16: `icons/${b}16.png`, 32: `icons/${b}32.png`, 48: `icons/${b}48.png`, 128: `icons/${b}128.png` });
  for (let i = 0; i < times; i++) {
    await chrome.action.setIcon({ path: p("blink-") }).catch(() => {});
    await sleep(200);
    await chrome.action.setIcon({ path: p("") }).catch(() => {});
    await sleep(700);
  }
}
function notify(id, title, message, buttons) {
  chrome.notifications.create(id, { type: "basic", iconUrl: "icons/128.png", title, message, buttons, priority: 0, silent: true }).catch(() => {});
}
// what every overlay needs to know about how to behave
const common = (s, a) => ({ theme: s.theme, sound: s.sound, vol: a.volume / 100, typingMax: a.typingWaitSec * 1000, quietFs: a.quietFullscreen });

// ───────────── the four rhythms ─────────────
async function eyeBreak({ manual = false, exId } = {}) {
  const s = await getSettings(), a = adv(s), today = await getToday();
  const l = await getLive();
  if (l && !manual) { defer("busy"); return schedule("eye", 2, s); }
  if (l && manual) { for (const id of l.tabs) endIn(id, l.kind); await setLive(null); }
  // gentle catch-up: after two skipped or snoozed breaks in a row, the next one is just ten seconds of looking away
  const catchUp = !exId && !manual && (today.skipRun || 0) >= 2;
  const pick = catchUp ? EYES.list.findIndex((e) => e.id === "far") : exId ? EYES.list.findIndex((e) => e.id === exId) : -1;
  const idx = pick >= 0 ? pick : nextExercise(s, today), ex = EYES.list[idx];
  const dur = catchUp ? 10 : Math.max(8, Math.round(ex.dur * a.breakScale));
  const msg = { t: "eye", id: uid(), ex: ex.id, dur, name: s.name, preroll: a.prerollBlinks, snoozeMin: a.eyeSnoozeMin, ...common(s, a),
    kicker: catchUp ? "Just ten seconds this time" : `Eye break, ${dur} seconds` };
  // water due within 10 minutes is asked for at the end of the break, not separately
  const w = await chrome.alarms.get("water");
  if (a.sipWithBreak && s.water.on && today.glasses < s.water.goal && w && w.scheduledTime - Date.now() < 10 * 60e3) {
    msg.sip = { n: today.glasses, goal: s.water.goal };
    await schedule("water", s.water.every, s);
  }
  const { win, tab } = await focusedTab();
  if (!win?.focused && !manual) {
    notify(`eye:${msg.id}`, `${ex.name}, ${dur} seconds`, `${ex.steps[0]} Chrome isn't in front, so this one's on the honour system.`);
    bump((d) => { d.eye.shown++; });
    return schedule("eye", null, s);
  }
  if (canDraw(tab)) {
    await setLive({ id: msg.id, kind: "eye", msg, start: 0, max: (dur + 30) * 1000, tabs: [tab.id], idx });
    const r = await runIn(tab.id, { ...msg, force: manual });
    if (r?.ok) {
      const L = await getLive(); if (L?.id === msg.id) { L.start = Date.now(); await setLive(L); }
      bump((d) => { d.eye.shown++; });
      return;
    }
    await setLive(null);
    if (r?.busy && !manual) return schedule("eye", 3, s);
  }
  // a Chrome page (new tab, settings) can't be drawn on: the break gets its own small window
  await setLive({ id: msg.id, kind: "eye", msg, start: Date.now() + 3000, max: (dur + 30) * 1000, tabs: [], idx });
  bump((d) => { d.eye.shown++; });
  const w2 = 560, h2 = 640;
  chrome.windows.create({ url: `break.html#${encodeURIComponent(JSON.stringify(msg))}`, type: "popup", width: w2, height: h2, focused: true,
    left: Math.max(0, Math.round((win?.left ?? 0) + ((win?.width ?? w2) - w2) / 2)), top: Math.max(0, Math.round((win?.top ?? 0) + 80)) }).catch(() => {});
}

async function waterReminder({ style, manual = false } = {}) {
  const s = await getSettings(), a = adv(s), today = await getToday();
  const l = await getLive();
  if (l && !manual) { defer("busy"); return schedule("water", 3, s); }
  const p = waterPrompt(today.glasses, s.water.goal, s.water.ml, s.hours);
  const msg = { t: "water", id: uid(), style: style || s.water.style, glasses: today.glasses, goal: s.water.goal, ...p, ...common(s, a),
    laterMin: a.laterMin, timeout: a.waterTimeout * 1000, waveH: a.waveHeight, waveSpeed: a.waveSpeed, waveOpacity: a.waveOpacity / 100, px: a.tumblerPx };
  const later = { title: `In ${a.laterMin} min` };
  const { win, tab } = await focusedTab();
  if (!win?.focused && !manual) {
    notify(`water:${msg.id}`, p.title, p.body, [{ title: "I drank a glass" }, later]);
    bump((d) => { d.water.shown++; d.water.style.notification = (d.water.style.notification || 0) + 1; });
    return schedule("water", 20, s);
  }
  const tabs = [];
  if (msg.style === "wave" && a.waveAllWindows) {
    // the whole browser: the tab in front of every window, the focused one first
    const all = await chrome.tabs.query({ active: true, windowType: "normal" });
    for (const t of [tab, ...all.filter((x) => x.id !== tab?.id)]) if (canDraw(t)) tabs.push(t.id);
  } else if (canDraw(tab)) tabs.push(tab.id);
  if (!tabs.length) {
    notify(`water:${msg.id}`, p.title, p.body, [{ title: "I drank a glass" }, later]);
    bump((d) => { d.water.shown++; d.water.style.notification = (d.water.style.notification || 0) + 1; });
    return schedule("water", 20, s);
  }
  await setLive({ id: msg.id, kind: "water", msg, start: Date.now(), max: a.waterTimeout * 1000 + 25e3, tabs });
  const [first, ...rest] = tabs;
  const r = await runIn(first, msg);
  if (!r?.ok) { await setLive(null); return schedule("water", r?.busy ? 5 : 15, s); }
  bump((d) => { d.water.shown++; d.water.style[msg.style] = (d.water.style[msg.style] || 0) + 1; });
  for (const id of rest) runIn(id, { ...msg, elapsed: 0 });
}

async function nudge(kind, { manual = false } = {}) {
  const s = await getSettings(), a = adv(s);
  if (kind === "blink" && a.iconBlink) iconBlink(2);
  const { win, tab } = await focusedTab();
  const l = await getLive();
  if ((win?.focused || manual) && canDraw(tab) && !l) {
    let msg;
    if (kind === "blink") msg = { t: "blink", count: s.superbrink ? a.blinkCount : s.eyes.blinkCount || 3, text: a.blinkText };
    else { // a stretch, a brisk walk or a kickabout: one kind, or each in turn
      const t = await getToday(), kinds = ["stretch", "walk", "ball"];
      const move = kinds.includes(s.stretch.move) ? s.stretch.move : kinds[(t.moveIdx || 0) % 3];
      t.moveIdx = (t.moveIdx || 0) + 1; await setToday(t);
      msg = { t: "stretch", move, ms: a.stretchSecs * 1000, text: move === "stretch" ? a.stretchText : move === "walk" ? "a brisk walk? :)" : "a little kickabout :)" };
    }
    const r = await runIn(tab.id, { ...msg, ...common(s, a), force: manual });
    if (r?.ok) bump((d) => { d[kind]++; });
    if (kind === "stretch" && r?.ok) { const t = await getToday(); t.stretches = (t.stretches || 0) + 1; await setToday(t); }
  }
  if (!manual) schedule(kind, null, s);
}

// ───────────── answers from the page ─────────────
const handled = new Set();
async function setGlasses(n, s) {
  const t = await getToday(); t.glasses = Math.max(0, n); await setToday(t);
  bump((d) => { d.glasses = t.glasses; d.goal = s.water.goal; });
  return t;
}
async function result(m, senderTab) {
  if (handled.has(m.id + m.r)) return; handled.add(m.id + m.r);
  const s = await getSettings(), a = adv(s), today = await getToday(), l = await getLive();
  if (l && l.id === m.id) {
    for (const id of l.tabs) if (id !== senderTab) endIn(id, l.kind);
    await setLive(null);
  }
  if (m.kind === "water") {
    bump((d) => { if (m.r in d.water) d.water[m.r]++; if (m.ms && m.r !== "ignored") { d.water.respMs += m.ms; d.water.respN++; } });
    if (m.r === "drank") { const t = await setGlasses(today.glasses + 1, s); t.ignored = 0; await setToday(t); return schedule("water", null, s); }
    if (m.r === "later") return schedule("water", a.laterMin, s);
    today.ignored = (today.ignored || 0) + 1; await setToday(today);           // unanswered: ask less often
    return schedule("water", [20, 30, 45][Math.min(2, today.ignored - 1)], s);
  }
  if (m.kind === "eye") {
    const idx = Math.max(0, EYES.list.findIndex((e) => e.id === m.ex));
    const key = { done: "done", skip: "skipped", snooze: "snoozed" }[m.r];
    bump((d) => { if (key) d.eye[key]++; if (m.r === "done") { d.eye.secs += m.secs || 0; d.eye.ex[m.ex] = (d.eye.ex[m.ex] || 0) + 1; } });
    today.skipRun = m.r === "done" ? 0 : (today.skipRun || 0) + 1;
    if (m.r === "snooze") { await setToday(today); return schedule("eye", a.eyeSnoozeMin, s); }
    today.lastEx = idx;
    if (m.r === "done") today.breaks += 1;
    await setToday(today);
    await schedule("blink", null, s); // no blink nudge right after resting
    return schedule("eye", null, s);
  }
}

// ───────────── follow the person across tabs and windows ─────────────
async function follow(tabId) {
  const l = await getLive();
  if (!l || !l.start || l.tabs.includes(tabId)) return;
  if (l.kind === "water" && l.msg.style !== "wave") return; // card and tumbler stay where they landed
  const s = await getSettings(); if (!adv(s).followTabs) return;
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!canDraw(tab)) return;
  l.tabs.push(tabId); await setLive(l);
  runIn(tabId, { ...l.msg, elapsed: Math.max(1, Date.now() - l.start), force: true, noPreroll: true });
}
chrome.tabs.onActivated.addListener(({ tabId }) => follow(tabId));
// a new tab, or a new page in the same tab: its address is only known once it loads
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete" || !tab.active) return;
  if (live?.tabs?.includes(tabId)) { live.tabs = live.tabs.filter((x) => x !== tabId); }
  follow(tabId);
});
chrome.windows.onFocusChanged.addListener(async (wid) => {
  if (wid === chrome.windows.WINDOW_ID_NONE) return;
  const [t] = await chrome.tabs.query({ active: true, windowId: wid });
  if (t) follow(t.id);
});

// ───────────── events ─────────────
chrome.runtime.onInstalled.addListener(async (d) => {
  menus();
  await scheduleAll();
  if (d.reason === "install") chrome.tabs.create({ url: "welcome.html" });
});
chrome.runtime.onStartup.addListener(() => { menus(); scheduleAll(); });
getSettings().then(applyIdle);
// time away counts as an eye rest: the next break starts counting from your return
chrome.idle.onStateChanged.addListener(async (st) => {
  const s = await getSettings();
  if (st === "active" && adv(s).awayCountsAsRest) schedule("eye", null, s);
});

chrome.alarms.onAlarm.addListener(async (al) => {
  if (al.name === "day") return scheduleAll();
  if (al.name === "badge") return badge();
  if (al.name === "recap") return recap();
  const s = await getSettings(), a = adv(s);
  if (!s.on) return;
  if (s.pausedUntil > Date.now()) { defer("paused"); return schedule(al.name, null, s); }
  if (s.hours.on && inHours(Date.now(), s) !== Date.now()) { defer("hours"); return schedule(al.name, null, s); }
  const st = await chrome.idle.queryState(Math.max(60, a.idleMin * 60));
  if (st !== "active") { defer("away"); return schedule(al.name, al.name === "eye" && a.awayCountsAsRest ? null : 5, s); }
  if (await inCall(s)) { defer("call"); return schedule(al.name, 5, s); }
  if (al.name === "eye") return eyeBreak();
  if (al.name === "water") return waterReminder();
  if (al.name === "blink" || al.name === "stretch") return nudge(al.name);
});

chrome.notifications.onButtonClicked.addListener((nid, i) => {
  const [kind, id] = nid.split(":");
  if (kind === "water") result({ t: "result", kind: "water", id, r: i === 0 ? "drank" : "later" });
  chrome.notifications.clear(nid);
});

chrome.commands.onCommand.addListener(async (c) => {
  if (c === "eye-now") eyeBreak({ manual: true });
  if (c === "log-water") { const s = await getSettings(), t = await getToday(); await setGlasses(t.glasses + 1, s); schedule("water", null, s); }
  if (c === "toggle-pause") { const s = await getSettings(); await pause(s.pausedUntil > Date.now() ? 0 : 60); }
});

async function pause(what) {
  let until = 0;
  if (what === "tomorrow") { const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(8, 30, 0, 0); until = t.getTime(); }
  else if (what) until = Date.now() + what * 60e3;
  const s = await saveSettings({ pausedUntil: until });
  for (const f of FEATURES) await schedule(f, null, s);
  badge();
}

async function state() {
  const s = await getSettings(), today = await getToday();
  const alarms = Object.fromEntries((await chrome.alarms.getAll()).map((x) => [x.name, x.scheduledTime]));
  return { settings: s, today, next: alarms, nextEx: EYES.list[nextExercise(s, today)].id, paused: s.pausedUntil > Date.now() };
}

// everything the SuperBrink page shows under "Stats for nerds"
async function nerd() {
  const [st, log, bytes, all, l] = await Promise.all([state(), getLog(), chrome.storage.local.getBytesInUse(null), chrome.alarms.getAll(), getLive()]);
  const { presets = [] } = await chrome.storage.local.get("presets");
  return { ...st, log, bytes, alarms: all, live: l, presets, builtin: BUILTIN_PRESETS, workerUpSec: Math.round((Date.now() - BOOT) / 1000),
    version: chrome.runtime.getManifest().version, defaults: DEFAULTS };
}

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  (async () => {
    switch (m.t) {
      case "result": await result(m, sender.tab?.id); return { ok: true };
      case "state": return state();
      case "nerd": return nerd();
      case "eyeNow": eyeBreak({ manual: true, exId: m.ex }); return { ok: true };
      case "waterNow": waterReminder({ style: m.style, manual: true }); return { ok: true };
      case "nudgeNow": nudge(m.kind, { manual: true }); return { ok: true };
      case "glass": {
        const s = await getSettings(), t = await getToday();
        await setGlasses(t.glasses + (m.d || 1), s);
        await schedule("water", null, s); return state();
      }
      case "pause": await pause(m.what); return state();
      case "save": {
        const s = await saveSettings(m.patch);
        if (!s.on) { for (const f of FEATURES) await chrome.alarms.clear(f); }
        else for (const f of FEATURES) await schedule(f, null, s);
        await applyIdle(s); badge(); scheduleRecap(s);
        return state();
      }
      case "replace": { // a whole settings object, from a preset or an import
        await chrome.storage.local.set({ settings: m.settings });
        const s = await getSettings();
        for (const f of FEATURES) await schedule(f, null, s);
        await applyIdle(s); badge(); scheduleRecap(s);
        return state();
      }
      case "presets": await chrome.storage.local.set({ presets: m.presets }); return { ok: true };
      case "clearStats": await chrome.storage.local.remove("log"); return { ok: true };
      case "reset": { await chrome.storage.local.clear(); await scheduleAll(); badge(); return state(); }
    }
    return null;
  })().then(reply, () => reply(null));
  return true;
});

// handy from the service worker console: __brinky.water("tumbler"), __brinky.eye("eight"), __brinky.nudge("stretch")
globalThis.__brinky = {
  eye: (ex) => eyeBreak({ manual: true, exId: ex }),
  water: (style) => waterReminder({ style, manual: true }),
  nudge: (k) => nudge(k, { manual: true }),
  state, nerd,
};
