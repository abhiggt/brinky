// Shared by the background, popup and walkthrough. ES module.

export const DEFAULTS = {
  on: true,
  name: "",
  theme: "auto",           // auto | light | dark
  sound: true,
  eyes: { on: true, every: 20, mode: "guided", blink: true, blinkEvery: 10, blinkCount: 3 },   // mode: guided | quick
  water: { on: true, goal: 8, ml: 250, every: 45, style: "wave" },              // style: wave | tumbler | card
  stretch: { on: true, every: 45, move: "mix" },          // move: mix | stretch | walk | ball
  recap: true,             // a short look back when your day ends
  hours: { on: false, from: "09:00", to: "19:00" },
  pausedUntil: 0,
  superbrink: false,       // SuperBrink: the advanced values below are used only while this is on
  adv: null,               // filled from ADV
};

// SuperBrink's advanced settings, with the values everyone gets by default.
export const ADV = {
  // eyes
  prerollBlinks: 3,        // cursor blinks before an eye break (0 = none)
  breakScale: 1,           // multiply every exercise's length
  order: "sequence",       // sequence | shuffle
  exOff: [],               // exercise ids left out of the rotation
  eyeSnoozeMin: 5,
  sipWithBreak: true,      // ask for water at the end of a break when it's due soon
  // blink & stretch
  blinkCount: 3,
  blinkText: "blink slowly with me",
  stretchSecs: 9,
  stretchText: "stretch a little :)",
  // water
  laterMin: 7,
  waterTimeout: 24,        // seconds before an unanswered reminder leaves by itself
  waveHeight: 38,          // % of the window
  waveSpeed: 1,
  waveOpacity: 100,        // %
  waveAllWindows: true,
  followTabs: true,
  tumblerPx: 3,            // glass size step: 3 makes the glass about three times the cursor
  // quiet rules
  typingWaitSec: 20,       // 0 = don't wait for typing
  quietFullscreen: true,
  quietCalls: true,
  callHosts: "meet.google.com, zoom.us, teams.microsoft.com, teams.live.com, whereby.com, discord.com, webex.com, gather.town, around.co",
  idleMin: 3,
  awayCountsAsRest: true,
  // look & sound
  volume: 60,              // %
  iconBlink: true,
  badge: "none",           // none | glasses | eye
};
DEFAULTS.adv = { ...ADV };
export const adv = (s) => (s?.superbrink ? merge(ADV, s.adv || {}) : ADV);

// Built-in starting points for SuperBrink presets.
export const BUILTIN_PRESETS = [
  { id: "gentle", name: "Gentle", note: "The recommended defaults.", patch: { eyes: { every: 20, mode: "guided", blink: true, blinkEvery: 10 }, water: { every: 45, style: "wave" }, stretch: { on: true, every: 45 }, superbrink: false } },
  { id: "focus", name: "Deep focus", note: "Fewer, quieter interruptions: eye breaks every 30 min, cards for water, no blink nudges.", patch: { eyes: { every: 30, blink: false }, water: { every: 60, style: "card" }, stretch: { every: 60 }, superbrink: true, adv: { prerollBlinks: 2, typingWaitSec: 45, iconBlink: false } } },
  { id: "dry", name: "Dry eyes", note: "Shorter gaps and more blinking: breaks every 15 min, blink nudges every 5.", patch: { eyes: { every: 15, blink: true, blinkEvery: 5 }, superbrink: true, adv: { blinkCount: 5, order: "sequence" } } },
  { id: "hydrate", name: "Hydration first", note: "Ten glasses, a wave every 30 minutes.", patch: { water: { on: true, goal: 10, every: 30, style: "wave" }, superbrink: true, adv: { laterMin: 7 } } },
];

// Stats for nerds: one small record per day, kept for 90 days.
export const blankDay = () => ({
  glasses: 0, goal: 8,
  eye: { shown: 0, done: 0, skipped: 0, snoozed: 0, secs: 0, ex: {} },
  water: { shown: 0, drank: 0, later: 0, ignored: 0, respMs: 0, respN: 0, style: {} },
  blink: 0, stretch: 0, defer: {}, inject: { n: 0, fail: 0, ms: 0 },
});
export async function getLog() {
  const { log } = await chrome.storage.local.get("log");
  return log || { since: Date.now(), days: {} };
}

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
export function merge(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch || {})) out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
  return out;
}

export async function getSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return merge(DEFAULTS, settings);
}
export async function saveSettings(patch) {
  const next = merge(await getSettings(), patch);
  await chrome.storage.local.set({ settings: next });
  return next;
}

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
export async function getToday() {
  const { today } = await chrome.storage.local.get("today");
  if (!today || today.day !== dayKey()) return { day: dayKey(), glasses: 0, breaks: 0, stretches: 0, lastEx: today?.lastEx ?? -1, ignored: 0 };
  return today;
}
export async function setToday(t) { await chrome.storage.local.set({ today: t }); return t; }

const toH = (s) => { const [h, m] = String(s).split(":").map(Number); return h + (m || 0) / 60; };

// Water prompts: short, specific, and never scolding. The pixel tumbler speaks in lower case.
export function waterPrompt(n, goal, ml, hours, d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60, next = n + 1;
  const from = hours?.on ? toH(hours.from) : 9, to = hours?.on ? toH(hours.to) : 19;
  const pace = Math.max(0, Math.min(1, (h - from) / Math.max(1, to - from)));
  const behind = Math.floor(goal * pace) - n;
  const px = { pxTitle: `psst… glass ${next} of ${goal}?`, pxBody: `${ml} ml. slow sips.` };
  if (n === 0 && h < 12) return { title: "First glass of the day", body: `You've been dry all night. ${ml} ml, then back to it.`, pxTitle: "psst. first glass?", pxBody: `${ml} ml to wake up.` };
  if (n === 0) return { title: "No water yet today", body: `Let's start now: one full glass, about ${ml} ml.`, pxTitle: "zero glasses so far…", pxBody: "let's fix that. one glass." };
  if (next === goal) return { title: "Last glass for today", body: `Glass ${next} of ${goal}, and today's goal is done.`, pxTitle: "last one! you got this", pxBody: `glass ${next} of ${goal}.` };
  if (behind >= 2) return { title: "A little behind", body: `You're ${behind} glasses behind for this time of day. Just this one for now.`, ...px };
  if (h >= 14 && h < 16.5) return { title: "The 3 pm dip", body: `Afternoon fog is often thirst. Glass ${next} of ${goal}, slowly.`, pxTitle: "3 pm fog? try water", pxBody: `glass ${next} of ${goal}.` };
  if (h >= 12.5 && h < 14) return { title: "After lunch", body: `A glass now helps lunch settle. Glass ${next} of ${goal}, ${ml} ml.`, ...px };
  if (h >= 17) return { title: "Before the day winds down", body: `Glass ${next} of ${goal}. Earlier is better than a late-night top-up.`, ...px };
  const rot = [
    { title: `Glass ${next} of ${goal}`, body: `About ${ml} ml. Small, slow sips.` },
    { title: "Time for a glass", body: `Glass ${next} of ${goal}, about ${ml} ml. No rush.` },
    { title: "Refill time", body: `If your glass is empty, that's your sign. Glass ${next} of ${goal}.` },
  ];
  return { ...rot[n % rot.length], ...px };
}

export function send(msg) { return chrome.runtime.sendMessage(msg).catch(() => null); }
