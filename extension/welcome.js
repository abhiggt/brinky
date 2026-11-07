// The walkthrough: five calm steps. Previews run Brinky's real in-page layer right here.
import { STYLE_ART } from "./art.js";
import { send, waterPrompt, DEFAULTS, merge } from "./common.js";

const $ = (s) => document.querySelector(s);
const L = globalThis.BrinkyLayer;
let S = merge(DEFAULTS, {});
let step = 0;
const steps = [...document.querySelectorAll(".step")];

const get = (path) => path.split(".").reduce((o, k) => o?.[k], S);
const patchOf = (path, v) => path.split(".").reverse().reduce((acc, k) => ({ [k]: acc }), v);
async function save(patch) { S = merge(S, patch); const r = await send({ t: "save", patch }); if (r?.settings) S = r.settings; paint(); }
function theme() { if (S.theme === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = S.theme; }

const F = globalThis.BrinkyFace;
F.style();
const me = F.mount($("#me"), { src: "mascot/blank.webp", mood: "neutral" });
me.autoBlink(); me.follow(true);
$("#styles").innerHTML = [["wave", "A wave", "Washes up the page like the sea"], ["tumbler", "A little glass", "Lands by your cursor"], ["card", "A note", "A quiet card in the corner"]]
  .map(([v, l, d]) => `<button class="choice" data-style="${v}">${STYLE_ART[v]}<b>${l}</b><small>${d}</small></button>`).join("");
$("#dots").innerHTML = steps.map(() => "<i></i>").join("");

function paint() {
  theme();
  document.querySelectorAll("[data-set]").forEach((g) => g.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(get(g.dataset.set)) === b.dataset.v)));
  document.querySelectorAll("[data-sw]").forEach((b) => b.setAttribute("aria-checked", !!get(b.dataset.sw)));
  document.querySelectorAll("[data-style]").forEach((b) => b.setAttribute("aria-pressed", S.water.style === b.dataset.style));
  $("#goal").textContent = `${S.water.goal} glasses`;
  $("#wsub").textContent = S.water.on ? "Off still counts the glasses you log" : "Off. Glasses you log still count.";
  const bv = S.eyes.blink ? String(S.eyes.blinkEvery) : "off";
  document.querySelectorAll("#blinkSeg button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.b === bv));
  const mv = S.stretch.on ? S.stretch.move || "mix" : "off";
  document.querySelectorAll("#moveSeg button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mv === mv));
  $("#doneTitle").textContent = S.name ? `You're all set, ${S.name}.` : "You're all set.";
}
function go(n) {
  const rev = n < step;
  step = Math.max(0, Math.min(steps.length - 1, n));
  steps.forEach((s, i) => { s.classList.toggle("on", i === step); s.classList.toggle("rev", rev && i === step); });
  document.querySelectorAll("#dots i").forEach((d, i) => d.classList.toggle("on", i === step));
  $("#back").classList.toggle("hide", step === 0);
  $("#next").textContent = step === 0 ? "Nice to meet you" : step === steps.length - 1 ? "Start Brinky" : "Continue";
  me.mood(["neutral", "neutral", "happy", "neutral", "laugh"][step]); // a laugh at the end
  if (step === 1) setTimeout(() => me.blink(true), 500);
}

document.addEventListener("click", (e) => {
  const seg = e.target.closest("[data-set] button");
  if (seg) { const p = seg.parentElement.dataset.set, v = seg.dataset.v; return save(patchOf(p, /^\d+$/.test(v) ? +v : v)); }
  const bl = e.target.closest("[data-b]");
  if (bl) return save(bl.dataset.b === "off" ? { eyes: { blink: false } } : { eyes: { blink: true, blinkEvery: +bl.dataset.b } });
  const mvb = e.target.closest("[data-mv]");
  if (mvb) return save(mvb.dataset.mv === "off" ? { stretch: { on: false } } : { stretch: { on: true, move: mvb.dataset.mv } });
  const sw = e.target.closest("[data-sw]"); if (sw) return save(patchOf(sw.dataset.sw, !get(sw.dataset.sw)));
  const st = e.target.closest("[data-style]"); if (st) return save({ water: { style: st.dataset.style } });
  const g = e.target.closest("[data-goal]"); if (g) return save({ water: { goal: Math.max(3, Math.min(16, S.water.goal + +g.dataset.goal)) } });
});
$("#name").addEventListener("change", (e) => save({ name: e.target.value.trim().slice(0, 24) }));
$("#back").addEventListener("click", () => go(step - 1));
$("#next").addEventListener("click", async () => {
  if (step === 0) await save({ name: $("#name").value.trim().slice(0, 24) });
  if (step < steps.length - 1) return go(step + 1);
  await send({ t: "save", patch: { on: true } });
  try { const t = await chrome.tabs.getCurrent(); if (t) chrome.tabs.remove(t.id); else window.close(); } catch { window.close(); }
});

// previews: the real thing, on this page
$("#tryBlink").addEventListener("click", () => L.run({ t: "blink", force: true, theme: S.theme }));
$("#tryEye").addEventListener("click", () => L.run({ t: "eye", id: "demo" + Date.now(), ex: "eight", dur: 12, force: true, theme: S.theme, sound: S.sound, name: S.name, kicker: "A little preview · 12 seconds" }));
let mvi = 0;
$("#tryStretch").addEventListener("click", () => { const kinds = ["stretch", "walk", "ball"], m = kinds.includes(S.stretch.move) ? S.stretch.move : kinds[mvi++ % 3];
  L.run({ t: "stretch", move: m, force: true, ms: 7000, theme: S.theme, text: m === "stretch" ? "stretch a little :)" : m === "walk" ? "a brisk walk? :)" : "a little kickabout :)" }); });
$("#tryWater").addEventListener("click", () => L.run({ t: "water", id: "demo" + Date.now(), style: S.water.style, theme: S.theme, sound: S.sound, glasses: 3, goal: S.water.goal, ...waterPrompt(3, S.water.goal, S.water.ml, S.hours) }));
$("#me").addEventListener("click", () => { me.mood("happy"); setTimeout(() => me.mood(step === 4 ? "laugh" : "neutral"), 1100); });

const st = await send({ t: "state" });
if (st?.settings) S = st.settings;
$("#name").value = S.name || "";
paint(); go(0);
