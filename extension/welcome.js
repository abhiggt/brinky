import { getRaw, saveSettings, lines } from "./common.js";

const $ = (id) => document.getElementById(id);
const M = globalThis.BrinkyMascot;
const steps = [...document.querySelectorAll(".step")];
const MOODS = ["happy", "curious", "wink", "calm", "smug", "excited"];
const NEXT = ["Nice to meet you", "Next", "Next", "Next", "Next", "Start"];
let i = 0, S = await getRaw();

M.preload(); M.blink(document);
const setBuddy = (mood) => { const img = $("buddy").querySelector("img"); if (img) M.set(img, mood); else $("buddy").innerHTML = M.html({ mood, size: 150 }); };
const jump = () => { const b = $("buddy"); b.classList.remove("jump"); void b.offsetWidth; b.classList.add("jump"); };
$("dots").innerHTML = steps.map(() => "<i></i>").join("");

// your name (optional): Brinky uses it in greetings, breaks and water reminders
const nameIn = $("name");
const name = () => nameIn.value.trim().slice(0, 24);
let nameT;
nameIn.value = S.name || "";
nameIn.addEventListener("input", () => {
  clearTimeout(nameT);
  nameT = setTimeout(async () => { S = await saveSettings({ name: name() }); }, 400);
  label();
});
nameIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); show(i + 1); } });
const label = () => {
  const n = name();
  $("next").textContent = i === 0 && n ? `Nice to meet you, ${n}` : NEXT[i];
  $("doneTitle").textContent = n ? `We're all set, ${n}!` : "We're all set!";
};

function show(n) {
  if (i === 0 && name() !== (S.name || "")) { clearTimeout(nameT); saveSettings({ name: name() }).then((x) => (S = x)); }
  i = Math.max(0, Math.min(steps.length - 1, n));
  steps.forEach((s, k) => s.classList.toggle("on", k === i));
  [...$("dots").children].forEach((d, k) => d.classList.toggle("on", k === i));
  $("back").style.visibility = i ? "visible" : "hidden";
  label();
  setBuddy(MOODS[i]); jump();
  steps[i].querySelector(".chip")?.focus({ preventScroll: true });
}

// reflect current settings in the chips
const hoursKey = (a) => (a.on ? `${a.start}-${a.end}|${(a.days || []).join(",")}` : "any");
const current = {
  rhythm: S.workMode.on ? "work" : "2020", "water.goal": S.water.goal, "water.style": S.water.style,
  "water.on": S.water.on ? "on" : "off", hours: hoursKey(S.activeHours),
};
document.querySelectorAll("[data-set]").forEach((group) => {
  const key = group.dataset.set;
  const mark = (v) => group.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c.dataset.v === String(v)));
  mark(current[key]);
  group.addEventListener("click", async (e) => {
    const c = e.target.closest(".chip"); if (!c) return;
    mark(c.dataset.v);
    const v = c.dataset.v;
    if (key === "rhythm") S = await saveSettings({ workMode: { ...S.workMode, on: v === "work" } });
    else if (key === "water.goal") S = await saveSettings({ water: { ...S.water, goal: +v } });
    else if (key === "water.style") S = await saveSettings({ water: { ...S.water, style: v } });
    else if (key === "water.on") S = await saveSettings({ water: { ...S.water, on: v === "on" } });
    else if (key === "hours") {
      if (v === "any") S = await saveSettings({ activeHours: { ...S.activeHours, on: false } });
      else { const [span, days] = v.split("|"), [a, b] = span.split("-"); S = await saveSettings({ activeHours: { on: true, start: a, end: b, days: days.split(",").map(Number) } }); }
    }
    jump();
  });
});

$("next").onclick = () => (i === steps.length - 1 ? finish() : show(i + 1));
$("back").onclick = () => show(i - 1);
addEventListener("keydown", (e) => { if (brk || e.target.closest?.("input,textarea")) return; if (e.key === "ArrowRight") show(i + 1); if (e.key === "ArrowLeft") show(i - 1); });

// live previews, right on this page
let wave, brk;
$("preview").onclick = () => {
  if (wave) return;
  const host = $("waterHost"), root = host.shadowRoot || host.attachShadow({ mode: "open" });
  wave = BrinkyWater.start(root, { at: Date.now(), hold: 9000, glass: 1, goal: S.water.goal, sound: S.water.sound, volume: S.volume, from: "left", style: S.water.style, size: S.water.size, glassMl: S.water.glassMl, name: name() }, () => {});
  wave.onEnd = () => { wave = null; };
};
$("tryBreak").onclick = () => {
  if (brk) return;
  const now = Date.now();
  brk = BrinkyBreak.start(document.body, { endsAt: now + 10000, startedAt: now, kind: "short", name: name(), messages: lines(S.messages), breath: S.breath, look: "dark", lookAway: S.lookAway, holdToSkip: S.holdToSkip, sound: S.sound, volume: S.volume, primary: true }, () => { brk?.end(); brk = null; });
};

async function finish() {
  if (name() !== (S.name || "")) S = await saveSettings({ name: name() });
  await chrome.storage.sync.set({ welcomed: true });
  try { await chrome.runtime.sendMessage({ t: "resume" }); } catch {} // the first countdown starts now
  setBuddy("proud"); jump();
  setTimeout(() => window.close(), 600);
}

show(0);
