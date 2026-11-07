// The toolbar popup: the next eye break, today's water, and a way to be quiet for a while.
// Cards render from the shared state and update in place every second.
import { I } from "./art.js";
import { send } from "./common.js";

const F = globalThis.BrinkyFace;
const $ = (s, r = document) => r.querySelector(s);
let S = null; // { settings, today, next, nextEx, paused }

const split = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return s >= 3600 ? [`${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`, "h"] : [`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`, "min"]; };
const mins = (ms) => { const m = Math.max(1, Math.round(ms / 60e3)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim() : `${m} min`; };
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function applyTheme(t) { if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = t; }

F.style();
const face = F.mount($("#me"), { src: "mascot/blank.webp", mood: "neutral" });
face.autoBlink();
face.follow(true);

// ───────────── cards ─────────────
function renderHome() {
  const s = S.settings, c = $("#cards");
  let html = "";
  if (!s.on) html += `<div class="card sleep"><div id="sleepy"></div><h2>Brinky is switched off</h2><p>No reminders. Glasses you log still count.</p><button class="btn ink" data-a="wake">Switch on</button></div>`;
  if (s.on && s.eyes.on) html += `<div class="card eye" data-m="eye">
      <div class="ring"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" class="tr"/><circle cx="32" cy="32" r="28" class="pr" data-k="ring" pathLength="100"/></svg><b data-k="t">--:--</b></div>
      <div class="info"><div class="ttl">Next eye break</div><div class="lbl" data-k="u"></div></div>
      <button class="btn ink" data-a="eyeNow">Rest now</button></div>`;
  html += `<div class="card water" data-m="water">
      <div class="top"><div><div class="ttl">Water today</div><div class="lbl" data-k="sub"></div></div><b data-k="h"></b></div>
      <div class="glasses" data-k="g"></div>
      <div class="foot"><button class="round" data-a="unglass" aria-label="Remove a glass" title="Remove a glass">−</button><button class="btn blue" data-a="glass">+ Log a glass</button></div></div>`;
  if (s.on) html += `<div class="quiet"><div class="lbl" data-k="pl"></div><div data-k="pctl"></div></div>`;
  c.innerHTML = html;
  if (!s.on) F.mount($("#sleepy"), { src: "mascot/blank.webp", mood: "sleepy" });
  tick();
}

function tick() {
  if (!S) return;
  const s = S.settings, t = S.today, w = s.water;
  const eye = $('[data-m="eye"]');
  if (eye) {
    const every = s.eyes.every * 60e3, due = S.next.eye, left = due ? due - Date.now() : every, [v] = split(left);
    $("[data-k=t]", eye).textContent = S.paused ? "Paused" : v;
    eye.classList.toggle("paused", !!S.paused);
    $("[data-k=ring]", eye).style.strokeDashoffset = S.paused ? 100 : (100 * (1 - Math.max(0, Math.min(1, left / every)))).toFixed(2);
    $("[data-k=u]", eye).textContent = S.paused ? `Until ${clock(s.pausedUntil)}` : `Every ${s.eyes.every} minutes`;
  }
  const wc = $('[data-m="water"]');
  if (wc) {
    const done = t.glasses >= w.goal;
    $("[data-k=h]", wc).innerHTML = `${t.glasses}<span>/${w.goal}</span>`;
    const g = $("[data-k=g]", wc), n = Math.max(w.goal, t.glasses);
    if (g.children.length !== n) g.innerHTML = Array.from({ length: n }, (_, i) => glass(i)).join("");
    [...g.children].forEach((x, i) => x.classList.toggle("on", i < t.glasses));
    wc.classList.toggle("done", done);
    $("[data-k=sub]", wc).textContent = done ? "Goal reached. Lovely."
      : !w.on ? "Reminders off, still counting"
      : S.paused ? "Reminders paused"
      : S.next.water ? `Next reminder in ${mins(S.next.water - Date.now())}` : `${w.ml} ml a glass`;
  }
  const ctl = $("[data-k=pctl]");
  if (ctl) {
    const key = S.paused ? "p" : "r";
    if (ctl.dataset.v !== key) {
      ctl.dataset.v = key;
      ctl.innerHTML = S.paused ? `<button class="btn line" data-a="resume">Resume</button>`
        : `<div class="seg" role="group" aria-label="Pause for"><button data-p="15">15 min</button><button data-p="60">1 hour</button><button data-p="tomorrow">Today</button></div>`;
    }
    $("[data-k=pl]").innerHTML = S.paused ? `<b>Paused</b>until ${clock(s.pausedUntil)}` : `<b>Pause</b>all reminders`;
  }
  header();
}

// one little glass; it fills with water when logged
const GL = "M3 2h16l-1.9 21.3q-.2 2.2-2.4 2.2H7.3q-2.2 0-2.4-2.2z";
const glass = (i) => `<svg class="gl" viewBox="0 0 22 28" aria-hidden="true"><defs><clipPath id="gc${i}"><path d="${GL}"/></clipPath></defs>
  <g clip-path="url(#gc${i})"><g class="wt"><rect x="0" y="7" width="22" height="22"/><ellipse cx="11" cy="7.2" rx="9" ry="1.4" class="sf"/></g></g>
  <path d="${GL}" class="ol"/><path d="M6.4 5.5l1 14.5" class="hl"/></svg>`;

// ───────────── Brinky says ─────────────
let poked = 0;
function header() {
  const s = S.settings, h = new Date().getHours(), greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const t = S.today, sum = `${t.breaks} eye break${t.breaks === 1 ? "" : "s"} today`;
  let mood = "neutral", small = s.name ? greet : sum, big = s.name || greet;
  if (!s.on || S.paused) mood = "sleepy";
  else if (s.water.on && S.today.glasses >= s.water.goal) mood = "happy";
  else if (S.next.eye && S.next.eye - Date.now() < 60e3) { mood = "surprised"; small = "Eye break in a moment"; }
  $("#hi").textContent = big;
  if (Date.now() - poked > 6000) $("#say").textContent = small;
  if (face.el.dataset.mood !== mood && !face.el.dataset.react) face.mood(mood);
}
const say = (line) => { $("#say").textContent = line; poked = Date.now(); };
const react = (mood, ms = 1300) => { face.el.dataset.react = "1"; face.mood(mood); setTimeout(() => { delete face.el.dataset.react; header(); }, ms); };
// Brinky is interactive: tap him, tickle him (rub back and forth), and he notices what you point at
const REACT = [["happy", "Hi! Blink slowly with me."], ["laugh", "Hehe. I'm a drop. I believe in you."], ["surprised", "Oh! Had some water lately?"], ["thinking", "Hmm. Shoulders down, jaw soft."], ["happy", "Look at something far away."]];
let ri = 0;
$("#me").addEventListener("click", () => {
  const me = $("#me"); me.classList.remove("jump"); void me.offsetWidth; me.classList.add("jump");
  const [mood, line] = REACT[ri++ % REACT.length];
  react(mood, 1600); say(line);
});
let rub = 0, rubT = 0, lastX = null;
$("#me").addEventListener("pointermove", (e) => {
  if (lastX !== null && Math.sign(e.movementX) !== Math.sign(lastX) && Math.abs(e.movementX) > 2) rub++;
  lastX = e.movementX; clearTimeout(rubT); rubT = setTimeout(() => { rub = 0; }, 700);
  if (rub === 6) { react("laugh", 1800); say("Hehe, that tickles!"); }
});
document.addEventListener("pointerover", (e) => {
  if (face.el.dataset.react || !S) return;
  if (e.target.closest('[data-a="eyeNow"]')) { face.mood("calm"); return; }
  if (e.target.closest('[data-a="glass"]')) { face.mood("surprised"); return; }
  if (e.target.closest('[data-p],[data-a="resume"]')) { face.mood("sleepy"); return; }
  if (e.target.closest("#app")) header();
});
// when nothing is happening, he glances around now and then
let idleT = 0;
const idle = () => { clearTimeout(idleT); idleT = setTimeout(() => { if (!face.el.dataset.react) face.look(Math.random() * 1.6 - 0.8, Math.random() * 1 - 0.6); idle(); }, 4000 + Math.random() * 3000); };
addEventListener("pointermove", idle, { passive: true }); idle();

// ───────────── actions ─────────────
async function refresh(st) { S = st || (await send({ t: "state" })); if (!S) return; applyTheme(S.settings.theme); }
async function save(patch) { await refresh(await send({ t: "save", patch })); renderHome(); }

document.addEventListener("click", async (e) => {
  const a = e.target.closest("[data-a]"), p = e.target.closest("[data-p]");
  if (p) { await refresh(await send({ t: "pause", what: p.dataset.p === "tomorrow" ? "tomorrow" : +p.dataset.p })); return renderHome(); }
  if (!a) return;
  const k = a.dataset.a;
  if (k === "eyeNow") { send({ t: "eyeNow" }); window.close(); }
  if (k === "glass" || k === "unglass") {
    await refresh(await send({ t: "glass", d: k === "glass" ? 1 : -1 })); tick();
    if (k === "glass") {
      const me = $("#me"); me.classList.remove("gulp"); void me.offsetWidth; me.classList.add("gulp");
      const done = S.today.glasses >= S.settings.water.goal;
      react(done ? "laugh" : "happy", 1500); say(done ? "That's the goal. You're wonderful." : "Glug. Thank you!");
    }
  }
  if (k === "resume") { await refresh(await send({ t: "pause", what: 0 })); renderHome(); }
  if (k === "wake") save({ on: true });
});
$("#toSettings").innerHTML = I.gear;
$("#toSettings").addEventListener("click", () => { chrome.runtime.openOptionsPage(); window.close(); });

// ───────────── go ─────────────
await refresh();
if (S) renderHome();
setInterval(tick, 1000);                                   // countdowns tick locally
setInterval(async () => { await refresh(); tick(); }, 5000); // and re-sync now and then
