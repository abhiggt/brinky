// Shared settings, state and helpers (ES module: background, popup, settings pages, welcome).
export const VERSION = "3.1.0";

// Everything Brinky can do. The popup shows the core; SuperBrink settings (a page of their own) hold
// the rest, and they only take effect while SuperBrink mode is on. Off = Brinky's recommended defaults.
export const DEFAULTS = {
  // ── core ──
  enabled: true,
  name: "",                 // what Brinky calls you (optional)
  workMode: { on: false, everyMin: 50, breakMin: 5 }, // one switch: fewer, longer breaks for deep work
  movement: true,           // every third eye break is a 2-minute movement break
  quiet: true,              // stay quiet during calls, screen sharing, videos and fullscreen
  muted: false,             // no chimes, no wave sounds
  water: { on: true, goal: 8, glassMl: 250, style: "wave", paced: true, everyMin: 30, holdSec: 20, sound: true, size: "medium", stopAtGoal: true },
  posture: { on: true, everyMin: 45 },
  blink: { on: true, everyMin: 15, style: "icon" },   // icon = the toolbar Brinky blinks; pill = small note
  activeHours: { on: true, start: "09:00", end: "19:00", days: [1, 2, 3, 4, 5] },
  superBrink: false,        // SuperBrink mode: the options below apply only while this is on

  // ── SuperBrink ──
  workMin: 20,              // minutes between eye breaks (20-20-20)
  breakSec: 20,             // short look-away break
  longEvery: 3,             // every Nth break is a movement break
  longMin: 2,               // movement break length, minutes
  exercises: true,          // guided exercises during movement breaks
  headsUpSec: 15,           // small pill before a break (0 = none)
  cursorCountdown: true,    // the last 10 seconds before a break, a countdown next to your pointer
  nudgeAt: "cursor",        // posture & blink notes: by your pointer (cursor) or at the bottom of the page
  maxSnoozes: 2,            // "5 more minutes" in a row, then the break happens
  typingAware: true,        // wait for a pause in typing (up to 30 s)
  fadeBefore: false,        // gently dim the page before a break (no blur)
  idleReset: true,          // 3+ minutes away counts as a break
  dnd: { calls: true, video: true, fullscreen: true, focusSites: true },
  focusSites: "",           // one host per line; breaks wait while you're on these
  meetingHosts: "meet.google.com\nzoom.us\nteams.microsoft.com\nteams.live.com\nwhereby.com\nmeet.jit.si\napp.slack.com\ndiscord.com",
  postCallBreak: true,      // offer a break right after a call of 30+ minutes
  budgetMin: 8,             // at most one reminder every N minutes (eye breaks excepted)
  sound: "chime",           // none | chime | bowl | bell
  ambient: "none",          // none | rain | brown | ocean
  volume: 0.6,
  messages: "Look at something 6 metres (20 feet) away.\nLet your shoulders drop.\nTake a slow, deep breath.\nBlink slowly a few times.\nUnclench your jaw.",
  planned: [{ time: "13:00", min: 45, label: "Lunch" }], // quiet time: reminders pause, nothing covers the page
  pauseMedia: true,         // pause the video you're watching during a break (never music or calls)
  breath: "calm",           // calm | box | 478
  breakLook: "auto",        // auto (matches the page) | dark | light
  lookAway: true,           // short breaks fade to near-black so there's nothing to watch
  holdToSkip: true,         // hold Skip or Esc for half a second to skip
  tint: { on: false, start: "19:00", end: "07:00", strength: 0.35 },
  units: "auto",            // auto (from your browser's language) | metric | imperial
};

// settings that belong to SuperBrink mode (dotted paths)
export const SUPER = [
  "workMin", "breakSec", "longEvery", "longMin", "exercises", "headsUpSec", "cursorCountdown", "nudgeAt", "maxSnoozes",
  "typingAware", "fadeBefore", "idleReset", "dnd", "focusSites", "meetingHosts", "postCallBreak", "budgetMin",
  "sound", "ambient", "volume", "messages", "planned", "pauseMedia", "breath", "breakLook", "lookAway", "holdToSkip", "tint", "units",
  "water.paced", "water.everyMin", "water.holdSec", "water.sound", "water.size", "water.stopAtGoal",
  "blink.everyMin", "blink.style", "posture.everyMin",
];

export const DEFAULT_STATE = {
  phase: "work",            // work | headsup | break
  nextBreakAt: 0,
  breakEndsAt: 0, breakStartedAt: 0, breakKind: "short", breakLabel: "", breakSeenMs: 0, breakSip: false, breakManual: false,
  breakCount: 0,
  armedTab: 0,              // the tab that will start the next break on its own, exactly on time
  snoozesInRow: 0,
  pausedUntil: 0,           // 0 = running, -1 = until resumed
  skipNext: false,
  quietUntil: 0, quietLabel: "", lastPlanned: "",
  blockedBy: "",            // call | sharing | video | fullscreen | focus | away | elsewhere
  blockedSince: 0,
  breakWins: [],
  nextWaterAt: 0, waterIgnores: 0, waterShownAt: 0,
  lastBlink: 0, lastPosture: 0, lastLook: 0, lastShown: 0,
  idleSince: 0,
  lastRestAt: 0,            // last real rest: a break you saw, or 3+ minutes away
  callSince: 0,
  callTabs: {},             // tabId -> { call, share, at }
  meetingAudibleAt: 0,
  exIndex: 0,
  notified: 0,              // when we last sent a "look away" notification for the current due break
};

const merge = (base, over) => {
  const out = { ...base };
  for (const k in over || {}) {
    if (!(k in base)) continue; // drop settings that no longer exist
    out[k] = base[k] && typeof base[k] === "object" && !Array.isArray(base[k]) ? { ...base[k], ...over[k] } : over[k];
  }
  return out;
};
export const withDefaults = (o) => merge(DEFAULTS, o);
const clone = (v) => (typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
const getPath = (o, p) => p.split(".").reduce((x, k) => x?.[k], o);
const setPath = (o, p, v) => { const ks = p.split("."), last = ks.pop(); ks.reduce((x, k) => x[k], o)[last] = v; };

// What Brinky actually runs with: SuperBrink off → recommended defaults; Work mode → your rhythm.
export function effective(raw) {
  const s = clone(raw);
  if (!s.superBrink) for (const p of SUPER) setPath(s, p, clone(getPath(DEFAULTS, p)));
  if (s.muted) { s.sound = "none"; s.ambient = "none"; s.water.sound = false; }
  if (!s.quiet) s.dnd = { calls: false, video: false, fullscreen: false, focusSites: false };
  if (!s.movement) s.longEvery = 0;
  if (s.workMode?.on) { s.workMin = s.workMode.everyMin; s.longEvery = 1; s.longMin = s.workMode.breakMin; s.exercises = true; }
  if (s.units !== "metric" && s.units !== "imperial") s.units = /^en-(US|LR|MM)\b/i.test(globalThis.navigator?.language || "") ? "imperial" : "metric";
  // water: paced to your goal across your day (sooner when you fall behind), unless SuperBrink sets a fixed interval
  if (s.water.paced) {
    const a = s.activeHours, span = a?.on ? ((toMin(a.end) - toMin(a.start) + 1440) % 1440 || 1440) : 600;
    s.water.everyMin = Math.round(Math.min(120, Math.max(30, span / Math.max(1, s.water.goal))));
  }
  return s;
}
const toMin = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };

// A small in-memory cache: the background reads settings and state many times a minute.
let rawCache = null, stateCache = null;
try {
  chrome.storage.onChanged.addListener((c, area) => {
    if (area === "sync" && c.settings) rawCache = null;
    if (area === "local" && c.state) stateCache = null;
  });
} catch {}

export async function getRaw() {
  if (!rawCache) { const { settings } = await chrome.storage.sync.get("settings"); rawCache = merge(DEFAULTS, settings); }
  return clone(rawCache);
}
export async function getSettings() { return effective(await getRaw()); }
export async function saveSettings(patch) {
  const s = merge(await getRaw(), patch);
  rawCache = s;
  await chrome.storage.sync.set({ settings: s });
  return clone(s);
}
export async function resetSettings() {
  rawCache = clone(DEFAULTS);
  await chrome.storage.sync.set({ settings: DEFAULTS });
  return clone(DEFAULTS);
}
export async function getState() {
  if (!stateCache) { const { state } = await chrome.storage.local.get("state"); stateCache = { ...DEFAULT_STATE, ...state }; }
  return clone(stateCache);
}
export async function setState(patch) {
  const s = { ...(await getState()), ...patch };
  stateCache = s;
  await chrome.storage.local.set({ state: s });
  return clone(s);
}

// Settings saved by Blinky 2.x or Brinky 3.0: move values still at old defaults to the new ones.
export async function migrate() {
  const { settings: old } = await chrome.storage.sync.get("settings");
  if (!old) return;
  const s = { ...old };
  const was = (k, v) => s[k] === v;
  if (was("focusSites", "figma.com")) s.focusSites = "";
  if (was("breakLook", "dark")) s.breakLook = "auto";
  if (was("headsUpSec", 60)) s.headsUpSec = 15;
  if (was("longMin", 5)) s.longMin = 2;
  if (was("fadeBefore", true)) s.fadeBefore = false;
  if (s.posture?.everyMin === 30) s.posture = { ...s.posture, everyMin: 45 };
  if (s.blink?.everyMin === 10) s.blink = { ...s.blink, everyMin: 15, style: "icon" };
  if (s.water?.holdSec === 12) s.water = { ...s.water, holdSec: 20 };
  if (s.autoPause) { s.dnd = { calls: !!s.autoPause.meetings, video: !!s.autoPause.video, fullscreen: !!s.autoPause.fullscreen, focusSites: !!s.autoPause.focusSites }; }
  if (Array.isArray(s.planned)) s.planned = s.planned.map((p) => (p.label === "Lunch" && p.min === 30 ? { ...p, min: 45 } : p));
  if (typeof s.messages === "string") s.messages = s.messages.replace("Look at something 20 feet away.", "Look at something 6 metres (20 feet) away.");
  if (s.longEvery === 0) s.movement = false;
  if (s.sound === "none") s.muted = true;
  // anyone who had customised the details keeps them: SuperBrink mode on
  const custom = (s.focusSites || "").trim() || (s.workMin && s.workMin !== 20) || (s.breakSec && s.breakSec !== 20) || s.tint?.on || (s.ambient && s.ambient !== "none");
  if (custom && s.superBrink === undefined) s.superBrink = true;
  rawCache = null;
  await chrome.storage.sync.set({ settings: merge(DEFAULTS, s) });
}

export const today = (d = new Date()) => d.toLocaleDateString("en-CA");
const blankDay = () => ({ taken: 0, missed: 0, skipped: 0, snoozed: 0, nudges: 0, restSec: 0, water: 0, longestMin: 0 });
export async function bumpStat(key, n = 1) {
  const d = today();
  const { stats = {} } = await chrome.storage.local.get("stats");
  stats[d] = { ...blankDay(), ...(stats[d] || {}) };
  stats[d][key] = Math.max(0, (stats[d][key] || 0) + n);
  if (["taken", "skipped", "snoozed", "missed"].includes(key)) { // per-hour log, used for tips
    const h = new Date().getHours();
    stats[d].hours = stats[d].hours || {};
    stats[d].hours[h] = { taken: 0, skipped: 0, snoozed: 0, missed: 0, ...(stats[d].hours[h] || {}) };
    stats[d].hours[h][key] += n;
  }
  const keys = Object.keys(stats).sort();
  while (keys.length > 90) delete stats[keys.shift()];
  await chrome.storage.local.set({ stats });
}
export async function setStatMax(key, v) {
  const d = today();
  const { stats = {} } = await chrome.storage.local.get("stats");
  stats[d] = { ...blankDay(), ...(stats[d] || {}) };
  if (v > (stats[d][key] || 0)) { stats[d][key] = v; await chrome.storage.local.set({ stats }); }
}
export async function getStats() {
  const { stats = {} } = await chrome.storage.local.get("stats");
  return stats;
}

// One short, kind tip from the last 14 days (computed locally).
export function usageTip(stats, s) {
  const recent = Object.keys(stats).sort().slice(-14).map((k) => stats[k]);
  const sum = (k) => recent.reduce((a, d) => a + (d[k] || 0), 0);
  const taken = sum("taken"), skipped = sum("skipped"), snoozed = sum("snoozed");
  const hrs = {};
  recent.forEach((d) => Object.entries(d.hours || {}).forEach(([h, v]) => { hrs[h] = hrs[h] || { t: 0, m: 0 }; hrs[h].t += v.taken || 0; hrs[h].m += (v.skipped || 0) + (v.snoozed || 0); }));
  const worst = Object.entries(hrs).filter(([, v]) => v.m >= 4 && v.m > v.t).sort((a, b) => b[1].m - a[1].m)[0];
  const lab = (x) => `${((x + 11) % 12) + 1} ${x < 12 ? "am" : "pm"}`;
  if (worst) return `Breaks around ${lab(+worst[0])} rarely stick. A quiet time then might suit you better.`;
  if (taken + skipped >= 10 && skipped / (taken + skipped) > 0.4) return `You skip ${Math.round((skipped / (taken + skipped)) * 100)}% of breaks. Shorter breaks could be easier to keep.`;
  if (taken >= 10 && snoozed / taken > 0.6) return `Lots of snoozes lately. Try breaks every ${s.workMin + 10} minutes.`;
  return "";
}

export const lines = (txt) => (txt || "").split("\n").map((x) => x.trim()).filter(Boolean);
export const fmt = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};
export const hm = (d = new Date()) => d.toTimeString().slice(0, 5);
export const clock12 = (t) => new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

// active hours, with weekdays
export function inHours(s, d = new Date()) {
  const a = s.activeHours;
  if (!a?.on) return true;
  const t = hm(d);
  if (a.start <= a.end) return (a.days || [0, 1, 2, 3, 4, 5, 6]).includes(d.getDay()) && t >= a.start && t < a.end;
  // overnight span: the day it started counts
  if (t >= a.start) return (a.days || []).includes(d.getDay());
  if (t < a.end) { const y = new Date(d); y.setDate(y.getDate() - 1); return (a.days || []).includes(y.getDay()); }
  return false;
}
// when active hours next begin (for "off duty until …")
export function nextStart(s, from = new Date()) {
  const a = s.activeHours; if (!a?.on) return null;
  const [h, m] = a.start.split(":").map(Number);
  for (let i = 0; i < 8; i++) {
    const d = new Date(from); d.setDate(d.getDate() + i); d.setHours(h, m, 0, 0);
    if (d > from && (a.days || [0, 1, 2, 3, 4, 5, 6]).includes(d.getDay())) return d.getTime();
  }
  return null;
}
// "until tomorrow morning": the next wake time that is still ahead (07:00, or the start of active hours)
export function nextMorning(s, from = new Date()) {
  const [h, m] = (s.activeHours?.on ? s.activeHours.start : "07:00").split(":").map(Number);
  const d = new Date(from); d.setHours(h, m, 0, 0);
  if (d <= from) d.setDate(d.getDate() + 1);
  return d.getTime();
}
// consecutive days hitting the water goal; also says whether today is one of them
export function streak(stats, goal) {
  let n = 0; const d = new Date();
  const todayHit = (stats[today()]?.water || 0) >= goal;
  if (!todayHit) d.setDate(d.getDate() - 1);
  for (;;) { const k = today(d); if ((stats[k]?.water || 0) >= goal) { n++; d.setDate(d.getDate() - 1); } else return { n, todayHit }; }
}
export const isPaused = (st) => st.pausedUntil === -1 || st.pausedUntil > Date.now();
export const isQuiet = (st) => st.quietUntil > Date.now();

// host matching: "figma.com" matches figma.com and *.figma.com; "app.slack.com/huddle" also checks the path
export function hostMatches(url, list) {
  let u; try { u = new URL(url); } catch { return false; }
  return lines(list).some((entry) => {
    const [h, ...p] = entry.replace(/^[a-z]+:\/\//i, "").split("/");
    const path = p.length ? "/" + p.join("/") : "";
    const okHost = u.hostname === h || u.hostname.endsWith("." + h);
    return okHost && (!path || u.pathname.startsWith(path));
  });
}
export const ml = (s, glasses) => glasses * (s.water?.glassMl || 250);
export const volume = (s, mlv) => (s.units === "imperial" ? `${Math.round(mlv / 29.574)} oz` : mlv >= 1000 ? `${(mlv / 1000).toFixed(1)} L` : `${mlv} ml`);
