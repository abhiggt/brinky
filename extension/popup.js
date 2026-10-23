import { saveSettings, fmt, isPaused, isQuiet, today, streak, inHours, nextStart, clock12, usageTip, volume } from "./common.js";
import { mountSettings } from "./settings.js";

const $ = (id) => document.getElementById(id);
const send = (m) => chrome.runtime.sendMessage(m);
const M = globalThis.BrinkyMascot;
let S, E, ST, STATS, mood = "", justDrankUntil = 0, chatter = null; // S: your settings as saved; E: what Brinky runs with

const C = 2 * Math.PI * 40;
$("bar").style.strokeDasharray = C;
const WAIT = { call: "Waiting for your call", sharing: "Waiting: you're sharing", video: "Waiting for your video", fullscreen: "Waiting: fullscreen", focus: "Waiting on a focus site", away: "Paused while you're away", elsewhere: "Sent you a notification" };
const mins = (ms) => { const m = Math.max(1, Math.round(ms / 60e3)); return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`; };
const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const dayName = (t) => new Date(t).toLocaleDateString(undefined, { weekday: "short" });

function expectedGlasses() {
  // how many glasses "should" be done by now, spread across your day
  const S = E;
  const a = S.activeHours?.on ? S.activeHours : { start: "09:00", end: "21:00" };
  const d = new Date(), now = d.getHours() * 60 + d.getMinutes(), s0 = toMin(a.start), e0 = toMin(a.end);
  let frac;
  if (e0 > s0) frac = now < s0 ? 0 : now >= e0 ? 1 : (now - s0) / (e0 - s0);
  else { const span = 1440 - s0 + e0, into = now >= s0 ? now - s0 : now < e0 ? 1440 - s0 + now : -1; frac = into < 0 ? 0 : into / span; }
  return Math.floor(S.water.goal * frac);
}

function setMood(m) {
  if (m === mood) return;
  mood = m;
  const img = $("buddy").querySelector("img");
  if (img) M.set(img, m); else $("buddy").innerHTML = M.html({ mood: m, size: 62 });
}
M.preload(); M.blink(document);

function render() {
  const S = E;
  const n = Date.now(), paused = isPaused(ST), quiet = isQuiet(ST), asleep = S.enabled && !paused && !inHours(S);
  const d = STATS[today()] || {}, glasses = d.water || 0, goal = S.water.goal;
  const waiting = ST.phase !== "break" && ST.blockedBy ? ST.blockedBy : "";

  // ── blink card ──
  let t = "--:--", frac = 0, sub = `${S.breakSec} s · look far away`, small = false, waitRing = false;
  const long = S.longEvery > 0 && (ST.breakCount + 1) % S.longEvery === 0;
  if (long) sub = S.workMode.on ? `${S.longMin} min break · work mode` : `${S.longMin} min movement break`;
  if (!S.enabled) { t = "Off"; sub = "Brinky is off"; }
  else if (paused) {
    if (ST.pausedUntil === -1) { t = "∞"; sub = "Paused"; }
    else if (ST.pausedUntil - n > 3600e3) { t = clock12(ST.pausedUntil); small = true; sub = `Paused until ${dayName(ST.pausedUntil)}`; }
    else { t = fmt(ST.pausedUntil - n); sub = "Paused"; }
  }
  else if (quiet) { t = fmt(ST.quietUntil - n); sub = `${ST.quietLabel || "Quiet time"} · reminders resting`; frac = 1; waitRing = true; }
  else if (asleep) { const ns = nextStart(S); t = "Zz"; sub = ns ? `Off duty till ${dayName(ns)} ${clock12(ns)}` : "Off duty"; }
  else if (ST.phase === "break") { t = fmt(ST.breakEndsAt - n); frac = 1; sub = "On a break"; }
  else if (waiting) { t = "wait"; small = true; sub = WAIT[waiting] || "Waiting"; frac = 1; waitRing = true; }
  else {
    const left = ST.nextBreakAt - n;
    t = fmt(left); frac = 1 - left / (S.workMin * 60e3);
    if (ST.skipNext) sub = "Next one skipped";
  }
  $("time").textContent = t;
  $("time").classList.toggle("small", small || t.length > 5);
  $("bar").style.strokeDashoffset = C * (1 - Math.min(1, Math.max(0, frac)));
  $("bar").parentElement.parentElement.classList.toggle("wait", waitRing);
  $("eyeSub").textContent = sub;

  // ── drink card ──
  $("glasses").textContent = glasses;
  $("goal").textContent = `/ ${goal} glasses`;
  const f = Math.min(1, glasses / goal);
  $("gfill").style.transform = `translateY(${(63 - f * 57).toFixed(1)}px)`;
  $("waterSub").textContent = !S.water.on ? "Wave reminders off"
    : !S.enabled || paused ? "Reminders paused"
    : quiet ? "Resting during quiet time"
    : asleep ? "Resting till your next day"
    : S.water.stopAtGoal && glasses >= goal ? "Goal done · waves resting"
    : `Next ${S.water.style === "card" ? "sip card" : "wave"} in ${mins(ST.nextWaterAt - n)}`;
  $("unlog").disabled = glasses === 0;

  // ── controls ──
  $("cards").classList.toggle("dim", !S.enabled);
  $("actions").hidden = !S.enabled;
  $("turnOn").hidden = S.enabled;
  if (!S.enabled) $("pauseMenu").hidden = true;
  $("pauseBtn").textContent = paused || quiet ? "Resume" : "Pause";
  $("workMode").setAttribute("aria-checked", String(!!S.workMode.on));
  $("wmSub").textContent = S.workMode.on ? `${S.workMode.everyMin} min focus · ${S.workMode.breakMin} min break` : "Fewer, longer breaks for deep work";
  $("skipNext").classList.toggle("on", !!ST.skipNext);
  $("skipNext").textContent = ST.skipNext ? "Next break skipped" : "Skip next break";

  // ── week ──
  const days = [];
  for (let i = 6; i >= 0; i--) { const dd = new Date(); dd.setDate(dd.getDate() - i); days.push(dd); }
  $("days").innerHTML = days.map((dd, i) => {
    const k = today(dd), s = STATS[k] || {}, w = s.water || 0, fr = Math.min(1, w / goal), y = 22 - fr * 18;
    const label = dd.toLocaleDateString(undefined, { weekday: "narrow" });
    return `<div class="day ${i === 6 ? "today" : ""}" title="${dd.toLocaleDateString(undefined, { weekday: "long" })}: ${w} glass${w === 1 ? "" : "es"}, ${s.taken || 0} breaks taken${s.missed ? `, ${s.missed} missed` : ""}">
      <svg class="drop" viewBox="0 0 18 22"><defs><clipPath id="dc${i}"><path d="M9 1 C10 4 16 9 16 14 A7 7 0 0 1 2 14 C2 9 8 4 9 1Z"/></clipPath></defs>
        <path d="M9 1 C10 4 16 9 16 14 A7 7 0 0 1 2 14 C2 9 8 4 9 1Z" fill="var(--card2)"/>
        <rect x="0" y="${y.toFixed(1)}" width="18" height="22" fill="${fr >= 1 ? "#2f9bf0" : "#7cc4ff"}" clip-path="url(#dc${i})"/>
      </svg><span>${label}</span></div>`;
  }).join("");
  const stk = streak(STATS, goal);
  $("streak").textContent = stk.n >= 2 ? `${stk.n}-day streak` : stk.n === 1 ? (stk.todayHit ? "Goal hit today" : "Goal hit yesterday") : "";

  const sinceRest = ST.lastRestAt && S.enabled && !paused && !asleep ? Math.round((n - ST.lastRestAt) / 60e3) : 0;
  $("since").textContent = sinceRest >= 1 ? `${sinceRest} min since your last real rest` : "";
  const ml = glasses * S.water.glassMl, taken = d.taken || 0;
  $("today").textContent = `Today: ${taken} break${taken === 1 ? "" : "s"} taken${d.missed ? ` · ${d.missed} missed` : ""} · ${volume(S, ml)} water`;

  // ── what Brinky says ──
  if (chatter && n < chatter.until) { setMood(chatter.mood); $("say").textContent = chatter.text; return; }
  const ln = M.line({
    enabled: S.enabled, paused, asleep, wakeAt: (() => { const ns = nextStart(S); return ns ? `${dayName(ns)} ${clock12(ns)}` : "tomorrow"; })(),
    pausedUntil: paused && ST.pausedUntil > 0 ? clock12(ST.pausedUntil) : "",
    quiet: quiet ? ST.quietLabel || "Quiet time" : "",
    onBreak: ST.phase === "break", waiting,
    breakSoon: S.enabled && ST.phase !== "break" && !waiting && ST.nextBreakAt - n < 60e3,
    glasses, goal, expected: expectedGlasses(), waterOn: S.water.on,
    waterSoonMin: S.water.on ? (ST.nextWaterAt - n) / 60e3 : null,
    justDrank: n < justDrankUntil, streak: stk.n, sinceRest, tip: usageTip(STATS, S), name: S.name,
  });
  setMood(ln.mood);
  $("say").textContent = ln.text;
}

async function load() {
  ({ settings: S, eff: E, state: ST, stats: STATS } = await send({ t: "get" }));
  render();
}
const act = async (m) => { await send(m); await load(); };

// tap Brinky for a little hello
const HI = [
  ["excited", "Hehe, that tickles."], ["wink", "Fun fact: I'm 100% water. You're about 60%."],
  ["curious", "Have you blinked lately? Go on, a few slow ones."], ["proud", "You're doing great. I mean it."],
  ["surprised", "Is it just me or is it dry in here?"], ["smug", "Shoulders down, jaw unclenched. Better?"],
];
$("buddy").onclick = () => {
  const nm = String(S.name || "").trim();
  const [m, text] = nm && Math.random() < 0.4 ? ["happy", `Hi ${nm}! Good to see you.`] : HI[Math.floor(Math.random() * HI.length)];
  chatter = { mood: m, text, until: Date.now() + 4000 };
  $("buddy").classList.remove("jump"); void $("buddy").offsetWidth; $("buddy").classList.add("jump");
  render();
};

$("now").onclick = () => act({ t: "breakNow" }).then(() => window.close());
$("pauseBtn").onclick = () => (isPaused(ST) ? act({ t: "resume" }) : isQuiet(ST) ? act({ t: "endQuiet" }) : ($("pauseMenu").hidden = !$("pauseMenu").hidden));
document.querySelectorAll("[data-pause]").forEach((b) => (b.onclick = () => { const v = b.dataset.pause; act({ t: "pause", min: v === "tomorrow" ? v : +v }); $("pauseMenu").hidden = true; }));
$("skipNext").onclick = () => act({ t: "skipNext" });
$("turnOn").onclick = () => act({ t: "toggle" });
$("log").onclick = async () => {
  justDrankUntil = Date.now() + 4000; chatter = null;
  $("buddy").classList.remove("jump"); void $("buddy").offsetWidth; $("buddy").classList.add("jump");
  await act({ t: "logWater" });
};
$("unlog").onclick = () => act({ t: "logWater", n: -1 });
// one tap: Work mode on or off
$("workMode").onclick = async () => { S = await saveSettings({ workMode: { ...S.workMode, on: !S.workMode.on } }); await send({ t: "settingsChanged" }); await load(); };

// ── settings: Home → Settings (the core); SuperBrink settings open in a tab of their own ──
async function setK(k, v) {
  const [a, b] = k.split(".");
  S = await saveSettings(b ? { [a]: { ...S[a], [b]: v } } : { [a]: v });
  await send({ t: "settingsChanged" });
}
let view = "home";
function go(v) {
  view = v;
  for (const id of ["home", "settings"]) $(id).hidden = id !== v;
  if (v === "home") { mood = ""; load(); }
  else mountSettings($(v), v, { get S() { return S; }, set S(x) { S = x; }, setK, send, go, openSuper, remount: () => go(v) });
}
$("openSettings").onclick = () => go("settings");
const openSuper = () => { chrome.runtime.openOptionsPage(); window.close(); };
addEventListener("keydown", (e) => { if (e.key === "Escape" && view !== "home") { e.preventDefault(); go("home"); } });

await load();
setInterval(() => view === "home" && load(), 1000);
