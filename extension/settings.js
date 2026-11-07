// Brinky settings: one page, built like a piece of hardware. The SuperBrink key reveals every advanced value
// in place; presets, stats and data work whether it's on or off. Every change saves as you make it.
import { STYLE_ART, I } from "./art.js";
import { send, merge, ADV, waterPrompt, dayKey } from "./common.js";

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const EYES = globalThis.BrinkyEyes, L = globalThis.BrinkyLayer;
let N = null;
const S = () => N.settings;
const A = () => merge(ADV, S().adv || {});
const get = (path) => path.split(".").reduce((o, k) => o?.[k], path.startsWith("adv.") ? { adv: A() } : S());
const patchOf = (path, v) => {
  if (path.startsWith("adv.")) return { adv: { [path.slice(4)]: v } };
  return path.split(".").reverse().reduce((acc, k) => ({ [k]: acc }), v);
};
const PLAY = '<svg viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z" fill="currentColor"/></svg>';

// ───────────── controls ─────────────
const fmtv = (v, unit) => {
  if (unit === "x") return `${(+v).toFixed(2).replace(/\.?0+$/, "")}<i>×</i>`;
  if (unit === "px") return `${v * 14}×${v * 18}<i>px</i>`;
  if (unit === "s" && +v === 0) return `Off`;
  return `${v}<i>${unit || ""}</i>`;
};
const lbl = (o) => `<div class="lbl"><b>${o.label}${o.sb ? '<span class="sbt" title="SuperBrink setting"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg></span>' : ""}</b>${o.hint ? `<small>${o.hint}</small>` : ""}</div>`;
const C = {
  tog: (o) => `<div class="row${o.sb ? " sb" : ""}">${lbl(o)}<button class="tg" data-tog="${o.path}" aria-pressed="${!!get(o.path)}" aria-label="${o.label}"><i class="led"></i><span>${get(o.path) ? "On" : "Off"}</span></button></div>`,
  step: (o) => `<div class="row${o.sb ? " sb" : ""}">${lbl(o)}<div class="st" data-st="${o.path}" data-min="${o.min}" data-max="${o.max}" data-step="${o.step || 1}" data-unit="${o.unit || ""}">
      <button data-d="-1" aria-label="Less">−</button><output aria-label="${o.label}">${fmtv(get(o.path), o.unit)}</output><button data-d="1" aria-label="More">+</button></div></div>`,
  keys: (o) => `<div class="row${o.sb ? " sb" : ""}">${lbl(o)}<div class="ks" role="group" aria-label="${o.label}">${o.opts.map(([v, l]) => `<button data-key="${o.path}" data-v="${v}" aria-pressed="${String(get(o.path)) === String(v)}">${l}</button>`).join("")}</div></div>`,
  text: (o) => `<div class="row${o.sb ? " sb" : ""}">${lbl(o)}<input class="tx" data-text="${o.path}" maxlength="${o.max || 40}" value="${esc(get(o.path))}" placeholder="${o.ph || ""}" aria-label="${o.label}"></div>`,
  area: (o) => `<div class="row full${o.sb ? " sb" : ""}">${lbl(o)}<textarea class="tx" data-text="${o.path}" spellcheck="false" aria-label="${o.label}">${esc(get(o.path))}</textarea></div>`,
  hours: () => S().hours.on ? `<div class="row">${lbl({ label: "From, to", hint: "Outside these hours nothing appears" })}<div class="btns"><input type="time" class="tx" data-time="hours.from" value="${S().hours.from}"><input type="time" class="tx" data-time="hours.to" value="${S().hours.to}"></div></div>` : "",
  pads: (o) => `<div class="row full sb">${lbl(o)}<div class="pads">${EYES.list.map((e, i) =>
    `<button class="pad" data-ex="${e.id}" aria-pressed="${!A().exOff.includes(e.id)}" aria-label="${esc(e.name)}"><i class="led"></i><span class="n">${String(i + 1).padStart(2, "0")}</span><span><span class="nm">${esc(e.name)}</span><br><span class="s">${e.dur}s</span></span></button>`).join("")}</div></div>`,
  styles: () => `<div class="row full">${lbl({ label: "Reminder style", hint: "How water reminders appear" })}<div class="styles">${[["wave", "Wave"], ["tumbler", "Tumbler"], ["card", "Card"]].map(([v, l]) =>
    `<button class="spad" data-key="water.style" data-v="${v}" aria-pressed="${S().water.style === v}">${STYLE_ART[v]}<b><i class="led"></i>${l}</b></button>`).join("")}</div></div>`,
  btns: (o) => `<div class="row${o.sb ? " sb" : ""}">${lbl(o)}<div class="btns">${o.buttons.map(([k, l]) => `<button class="bt" data-try="${k}">${PLAY}${l}</button>`).join("")}</div></div>`,
  note: (o) => `<p class="note${o.sbhide ? " sbhide" : ""}">${o.text}</p>`,
};

// ───────────── modules ─────────────
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICO = { general: I.gear, eyes: I.eye, water: I.drop, stretch: I.stretch, quiet: I.moon,
  presets: svg('<path d="M6 4h12v16l-6-4-6 4z"/>'), stats: svg('<path d="M5 20V11M12 20V5M19 20v-6"/>'), data: svg('<path d="M12 4v10M8 10l4 4 4-4M5 18h14"/>') };
const MODS = [
  { id: "general", no: "01", title: "General", tag: "You, sound and hours", rows: () => [
    { k: "tog", path: "on", label: "Brinky", hint: "Everything on or off. Glasses are still counted when off." },
    { k: "text", path: "name", label: "Your name", hint: "Used in greetings. Optional.", ph: "Optional", max: 24 },
    { k: "keys", path: "theme", label: "Appearance", opts: [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]] },
    { k: "tog", path: "sound", label: "Soft sounds", hint: "A chime when a break ends, a bloop for water" },
    { k: "step", path: "adv.volume", label: "Volume", sb: true, min: 0, max: 100, step: 10, unit: "%" },
    { k: "tog", path: "adv.iconBlink", label: "Blink the toolbar icon", hint: "With every blink nudge", sb: true },
    { k: "keys", path: "adv.badge", label: "Toolbar badge", hint: "A small number on Brinky's icon", sb: true, opts: [["none", "None"], ["glasses", "Glasses"], ["eye", "Next break"]] },
    { k: "tog", path: "recap", label: "Evening recap", hint: "A short look back when your day ends" },
    { k: "tog", path: "hours.on", label: "Working hours only", hint: "Quiet outside the hours you set" },
    { k: "hours" },
  ] },
  { id: "eyes", no: "02", title: "Eyes", tag: "Breaks and blinks", rows: () => [
    { k: "tog", path: "eyes.on", label: "Eye breaks", hint: "Your cursor blinks first, then one short exercise" },
    { k: "step", path: "eyes.every", label: "Break every", min: 5, max: 120, step: 5, unit: "min" },
    { k: "keys", path: "eyes.mode", label: "Each break", opts: [["guided", "Exercise"], ["quick", "Look away"]] },
    { k: "tog", path: "eyes.blink", label: "Blink nudges", hint: "The cursor blinks; blink along" },
    { k: "step", path: "eyes.blinkEvery", label: "Blink every", hint: "How often your cursor reminds you to blink", min: 2, max: 60, unit: "min" },
    { k: "step", path: "eyes.blinkCount", label: "Blinks each time", hint: "How many times the cursor blinks", min: 1, max: 8, unit: "" },
    { k: "step", path: "adv.breakScale", label: "Break length", hint: "Every exercise, shorter or longer", sb: true, min: 0.5, max: 2, step: 0.25, unit: "x" },
    { k: "step", path: "adv.prerollBlinks", label: "Heads-up blinks", hint: "Cursor blinks before a break. 0 means none", sb: true, min: 0, max: 6, unit: "" },
    { k: "step", path: "adv.eyeSnoozeMin", label: "“More minutes” gives", sb: true, min: 1, max: 30, unit: "min" },
    { k: "keys", path: "adv.order", label: "Order", sb: true, opts: [["sequence", "In turn"], ["shuffle", "Shuffle"]] },
    { k: "tog", path: "adv.sipWithBreak", label: "Water at the end of a break", hint: "When a glass is due within ten minutes", sb: true },
    { k: "text", path: "adv.blinkText", label: "Note beside the cursor", sb: true, max: 40 },
    { k: "pads", label: "Exercises in rotation", hint: "Highlighted ones are in. Keep at least one.", sb: true },
    { k: "btns", label: "Preview", hint: "Runs on this page", buttons: [["eye", "Next break"], ["eyeShort", "8 s sample"], ["blink", "Blink"]] },
  ] },
  { id: "water", no: "03", title: "Water", tag: "Glasses and reminders", rows: () => [
    { k: "tog", path: "water.on", label: "Water reminders", hint: "Winter, or drinking less? Switch off. Glasses are still counted." },
    { k: "step", path: "water.goal", label: "Daily goal", min: 1, max: 20, unit: "glasses" },
    { k: "step", path: "water.ml", label: "Glass size", min: 100, max: 750, step: 50, unit: "ml" },
    { k: "step", path: "water.every", label: "Remind every", min: 10, max: 180, step: 5, unit: "min" },
    { k: "styles" },
    { k: "step", path: "adv.laterMin", label: "“Later” means", sb: true, min: 3, max: 30, step: 1, unit: "min" },
    { k: "step", path: "adv.waterTimeout", label: "Leaves by itself after", sb: true, min: 8, max: 120, step: 2, unit: "s" },
    { k: "step", path: "adv.waveHeight", label: "Wave height", sb: true, min: 20, max: 70, step: 2, unit: "%" },
    { k: "step", path: "adv.waveSpeed", label: "Wave speed", sb: true, min: 0.5, max: 2, step: 0.25, unit: "x" },
    { k: "step", path: "adv.waveOpacity", label: "Water opacity", hint: "Lower shows more of the page", sb: true, min: 40, max: 100, step: 5, unit: "%" },
    { k: "tog", path: "adv.waveAllWindows", label: "Wave in every window", sb: true },
    { k: "tog", path: "adv.followTabs", label: "Follow me between tabs", sb: true },
    { k: "step", path: "adv.tumblerPx", label: "Glass size", hint: "The smallest is about twice your cursor", sb: true, min: 2, max: 4, unit: "x" },
    { k: "btns", label: "Preview", hint: "Runs on this page", buttons: [["wave", "Wave"], ["tumbler", "Tumbler"], ["card", "Card"]] },
  ] },
  { id: "stretch", no: "04", title: "Move", tag: "Your cursor gets up, so you do", rows: () => [
    { k: "tog", path: "stretch.on", label: "Move reminders", hint: "Your cursor moves for a few seconds, with a note beside it" },
    { k: "keys", path: "stretch.move", label: "How it moves", opts: [["mix", "Mix it up"], ["stretch", "Stretch"], ["walk", "Walk"], ["ball", "Kickabout"]] },
    { k: "step", path: "stretch.every", label: "Every", min: 10, max: 180, step: 5, unit: "min" },
    { k: "step", path: "adv.stretchSecs", label: "Stays for", sb: true, min: 3, max: 30, unit: "s" },
    { k: "text", path: "adv.stretchText", label: "Note beside the cursor", sb: true, max: 40 },
    { k: "btns", label: "Preview", hint: "Move your pointer after pressing", buttons: [["stretch", "Stretch"], ["walk", "Walk"], ["ball", "Kickabout"]] },
  ] },
  { id: "quiet", no: "05", title: "Quiet", tag: "When Brinky waits", rows: () => [
    { k: "note", sbhide: true, text: "Brinky already waits while you type, during calls, in fullscreen and while you're away. Turn on SuperBrink to tune each rule." },
    { k: "step", path: "adv.typingWaitSec", label: "Wait for typing, up to", hint: "0 turns this off", sb: true, min: 0, max: 90, step: 5, unit: "s" },
    { k: "tog", path: "adv.quietFullscreen", label: "Stay out of fullscreen and big videos", sb: true },
    { k: "tog", path: "adv.quietCalls", label: "Stay quiet during calls", hint: "When one of the sites below is playing sound", sb: true },
    { k: "area", path: "adv.callHosts", label: "Call sites", hint: "Comma separated. Subdomains count too.", sb: true },
    { k: "step", path: "adv.idleMin", label: "Count me away after", sb: true, min: 1, max: 30, unit: "min" },
    { k: "tog", path: "adv.awayCountsAsRest", label: "Time away counts as an eye rest", sb: true },
  ] },
  "-",
  { id: "presets", no: "06", title: "Presets", tag: "Save a setup, switch in one tap", custom: () => presets() },
  { id: "stats", no: "07", title: "Stats", tag: "Kept for 90 days, only in your browser", custom: () => stats() },
  { id: "data", no: "08", title: "Data", tag: "Backup and reset", custom: () => data() },
];

function presets() {
  const mine = N.presets || [];
  return `<div class="rows">${N.builtin.map((p) => `<div class="row">${lbl({ label: p.name, hint: p.note })}<button class="bt" data-apply="b:${p.id}">Apply</button></div>`).join("")}
    ${mine.map((p, i) => `<div class="row">${lbl({ label: esc(p.name), hint: `Yours · saved ${new Date(p.at).toLocaleDateString([], { day: "numeric", month: "short" })}` })}<div class="btns"><button class="bt" data-apply="u:${i}">Apply</button><button class="bt" data-update="${i}">Update</button><button class="bt danger" data-del="${i}">Delete</button></div></div>`).join("")}
    <div class="row">${lbl({ label: "Save what you have now", hint: "Everything except your name and any pause" })}<div class="btns"><input class="tx" id="pname" maxlength="32" placeholder="Late nights" style="width:180px"><button class="bt hot" id="psave">Save</button></div></div></div>`;
}

const daysBack = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return d; });
const mmss = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : `${Math.floor(s / 60)}m ${s % 60}s`);
function stats() {
  const log = N.log, s = S(), t = N.today, td = log.days[dayKey()] || {};
  const days = daysBack(14), rec = days.map((d) => log.days[dayKey(d)] || null);
  const gl = rec.map((r, i) => (i === 13 ? t.glasses : r?.glasses || 0)), goals = rec.map((r, i) => (i === 13 ? s.water.goal : r?.goal || 0));
  const br = rec.map((r) => r?.eye?.done || 0);
  // both matrices are 12 dots tall; breaks scale when a day had more than 12
  const ROWS = 12, gMax = Math.min(ROWS, Math.max(8, ...gl, ...goals)), bUnit = Math.max(1, Math.ceil(Math.max(...br) / ROWS));
  const all = Object.values(log.days), sum = (f) => all.reduce((a, d) => a + (f(d) || 0), 0);
  const tot = { glasses: sum((d) => d.glasses), breaks: sum((d) => d.eye?.done), shown: sum((d) => d.eye?.shown), skipped: sum((d) => d.eye?.skipped), snoozed: sum((d) => d.eye?.snoozed),
    secs: sum((d) => d.eye?.secs), wShown: sum((d) => d.water?.shown), wDrank: sum((d) => d.water?.drank), wLater: sum((d) => d.water?.later), wIgn: sum((d) => d.water?.ignored),
    resp: sum((d) => d.water?.respMs), respN: sum((d) => d.water?.respN), stretch: sum((d) => d.stretch), blink: sum((d) => d.blink), inj: sum((d) => d.inject?.n), injMs: sum((d) => d.inject?.ms) };
  let run = 0, best = 0;
  for (const d of daysBack(90)) { const today = d.toDateString() === new Date().toDateString(); const r = today ? { glasses: t.glasses, goal: s.water.goal } : log.days[dayKey(d)];
    if (r && r.goal && r.glasses >= r.goal) { run++; best = Math.max(best, run); } else if (!today) run = 0; }
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "none");
  const exc = {}; all.forEach((d) => Object.entries(d.eye?.ex || {}).forEach(([id, n]) => { exc[id] = (exc[id] || 0) + n; }));
  const exTop = Object.entries(exc).sort((a, b) => b[1] - a[1]).slice(0, 5), exMax = exTop[0]?.[1] || 1;
  const dfr = {}; all.forEach((d) => Object.entries(d.defer || {}).forEach(([w, n]) => { dfr[w] = (dfr[w] || 0) + n; }));
  const why = { typing: "You were typing", fullscreen: "Fullscreen", video: "A big video", call: "A call", away: "You were away", paused: "Paused", hours: "Outside hours", busy: "Another reminder" };
  const dTop = Object.entries(dfr).sort((a, b) => b[1] - a[1]).slice(0, 5), dMax = dTop[0]?.[1] || 1;
  const col = (n, cap, cls) => Array.from({ length: cap }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("");
  const dayLbl = (d, i) => (i % 2 === 0 ? d.toLocaleDateString([], { weekday: "short" }).slice(0, 2) : "&nbsp;");
  return `<div class="rows"><div class="lcd">
    <div class="hd"><span>Today</span><span>Since ${new Date(log.since || Date.now()).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}</span></div>
    <div class="big">
      <div><small>Glasses</small><b>${t.glasses}<span>/${s.water.goal}</span></b></div>
      <div><small>Breaks</small><b>${td.eye?.done || 0}<span>/${td.eye?.shown || 0}</span></b></div>
      <div><small>Rested</small><b>${mmss(td.eye?.secs || 0)}</b></div>
      <div><small>Goal streak</small><b>${run}<span>d</span></b></div>
      <div><small>Stretches</small><b>${td.stretch || 0}</b></div>
    </div>
    <div class="two">
      <div><div class="dots">${gl.map((g, i) => `<div class="c${goals[i] && g >= goals[i] ? " met" : ""}" title="${g} of ${goals[i] || "none"}"><span>${dayLbl(days[i], i)}</span>${col(Math.min(g, ROWS), ROWS)}</div>`).join("")}</div>
        <div class="legend"><span><i style="background:var(--blue)"></i>Glasses</span><span><i style="background:var(--orange)"></i>Goal met</span><span>14 days</span></div></div>
      <div><div class="dots">${br.map((b, i) => `<div class="c eye" title="${b} breaks"><span>${dayLbl(days[i], i)}</span>${col(Math.ceil(b / bUnit), ROWS)}</div>`).join("")}</div>
        <div class="legend"><span><i style="background:var(--lcdtx)"></i>Breaks finished</span><span>${bUnit > 1 ? `1 dot = ${bUnit}` : "14 days"}</span></div></div>
    </div>
    <div class="kv">
      <div><small>Glasses logged</small><b>${tot.glasses}</b></div><div><small>Water drunk</small><b>${((tot.glasses * s.water.ml) / 1000).toFixed(1)} l</b></div><div><small>Best streak</small><b>${best}d</b></div>
      <div><small>Breaks finished</small><b>${tot.breaks} · ${pct(tot.breaks, tot.shown)}</b></div><div><small>Skipped / snoozed</small><b>${tot.skipped} / ${tot.snoozed}</b></div><div><small>Time resting eyes</small><b>${mmss(tot.secs)}</b></div>
      <div><small>Water answered</small><b>${pct(tot.wDrank + tot.wLater, tot.wShown)}</b></div><div><small>Avg answer time</small><b>${tot.respN ? `${(tot.resp / tot.respN / 1000).toFixed(1)}s` : "none"}</b></div><div><small>Ignored</small><b>${tot.wIgn}</b></div>
      <div><small>Blink nudges</small><b>${tot.blink}</b></div><div><small>Stretches</small><b>${tot.stretch}</b></div><div><small>Overlay load</small><b>${tot.inj ? `${(tot.injMs / tot.inj).toFixed(1)}ms` : "none"}</b></div>
    </div>
    <div class="two" style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.1)">
      <div><div class="hd"><span>Most finished exercises</span></div><div class="bars">${exTop.length ? exTop.map(([id, n]) => `<div><span>${esc(EYES.get(id).name)}</span><i style="width:${(n / exMax) * 100}%"></i><span>${n}</span></div>`).join("") : '<div><span style="color:rgba(234,242,251,.5)">Finish a break to see it here</span></div>'}</div></div>
      <div><div class="hd"><span>Why Brinky waited</span></div><div class="bars">${dTop.length ? dTop.map(([w, n]) => `<div><span>${why[w] || w}</span><i style="width:${(n / dMax) * 100}%"></i><span>${n}</span></div>`).join("") : '<div><span style="color:rgba(234,242,251,.5)">Nothing yet</span></div>'}</div></div>
    </div></div></div>`;
}

function data() {
  const names = { eye: "Eye break", water: "Water", blink: "Blink nudge", stretch: "Stretch", day: "Midnight reset", badge: "Badge refresh" };
  const rows = [...N.alarms].sort((a, b) => a.scheduledTime - b.scheduledTime).map((a) => `<tr><td>${names[a.name] || a.name}</td><td>${new Date(a.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td><td data-due="${a.scheduledTime}"></td></tr>`).join("");
  return `<div class="rows">
    <div class="row">${lbl({ label: "Export", hint: "Settings and presets as a .json file" })}<div class="btns"><button class="bt" id="xstats" aria-pressed="false"><i class="led"></i>With stats</button><button class="bt" id="export">Export</button></div></div>
    <div class="row">${lbl({ label: "Import", hint: "Replaces settings and presets with the file's" })}<input type="file" id="importFile" accept="application/json,.json" hidden><button class="bt" id="import">Choose file</button></div>
    <div class="row">${lbl({ label: "Walkthrough", hint: "Meet Brinky again" })}<button class="bt" id="tour">Open</button></div>
    <div class="row">${lbl({ label: "Shortcuts", hint: "Alt+Shift+B break now · Alt+Shift+W log a glass · Alt+Shift+P pause" })}<span></span></div>
    <div class="row">${lbl({ label: "Clear stats", hint: "Settings and presets stay" })}<button class="bt danger" data-arm="clearStats">Clear</button></div>
    <div class="row">${lbl({ label: "Reset everything", hint: "Back to the recommended settings. Presets and stats are removed." })}<button class="bt danger" data-arm="reset">Reset</button></div>
    <div class="row full sb">${lbl({ label: "Scheduled", hint: "Every rhythm, to the second", sb: true })}<table class="alarms"><thead><tr><th>Rhythm</th><th>At</th><th>In</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Nothing scheduled</td></tr>'}</tbody></table></div>
    <div class="row sb">${lbl({ label: "Background awake for", sb: true })}<span class="mono">${mmss(N.workerUpSec)}</span></div>
    <div class="row sb">${lbl({ label: "Storage used", sb: true })}<span class="mono">${(N.bytes / 1024).toFixed(1)} KB</span></div>
    <div class="row sb">${lbl({ label: "On screen now", sb: true })}<span class="mono">${N.live ? `${N.live.kind} in ${N.live.tabs.length} tab${N.live.tabs.length === 1 ? "" : "s"}` : "Nothing"}</span></div>
    <div class="row full sb"><details><summary>Settings as JSON</summary><pre class="raw">${esc(JSON.stringify(S(), null, 2))}</pre></details><details><summary>Today's log as JSON</summary><pre class="raw">${esc(JSON.stringify(N.log.days[dayKey()] || {}, null, 2))}</pre></details></div>
  </div>`;
}

// ───────────── render ─────────────
let current = "general";
function render() {
  document.body.classList.toggle("sb", !!S().superbrink);
  $("#sbkey").setAttribute("aria-pressed", !!S().superbrink);
  const t = S().theme; if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = t;
  $("#index").innerHTML = MODS.map((m) => m === "-" ? '<div class="sep"></div>' : `<a href="#${m.id}" data-go="${m.id}" class="${current === m.id ? "on" : ""}"><i>${ICO[m.id]}</i><span>${m.title}</span></a>`).join("");
  $("#mods").innerHTML = MODS.filter((m) => m !== "-").map((m) => `<section class="mod" id="${m.id}" aria-labelledby="h-${m.id}"><header><span class="no">${ICO[m.id]}</span><h2 id="h-${m.id}">${m.title}</h2><span class="tag">${m.tag}</span></header>
    ${m.custom ? m.custom() : `<div class="rows">${m.rows().map((o) => C[o.k](o)).join("")}</div>`}</section>`).join("");
  $$(".mod").forEach((x) => spy.observe(x));
  tickDue();
}
function tickDue() { $$("[data-due]").forEach((td) => { const s = Math.max(0, Math.round((+td.dataset.due - Date.now()) / 1000)); td.textContent = s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }); }

let stT;
function status(text = "Saved") { const el = $("#status"); el.querySelector("span").textContent = text; el.classList.add("on"); clearTimeout(stT); stT = setTimeout(() => { el.classList.remove("on"); el.querySelector("span").textContent = "All changes saved"; }, 1400); }
async function load() { N = await send({ t: "nerd" }); }
async function save(path, v, rerender) {
  await send({ t: "save", patch: patchOf(path, v) }); await load(); status();
  if (rerender) { const y = scrollY; render(); scrollTo(0, y); }
}

// steppers save a moment after you stop pressing
const pending = {};
function stepBy(el, d) {
  const min = +el.dataset.min, max = +el.dataset.max, step = +el.dataset.step, path = el.dataset.st;
  const cur = pending[path]?.v ?? +get(path);
  const v = Math.round(Math.max(min, Math.min(max, cur + d * step)) * 100) / 100;
  el.querySelector("output").innerHTML = fmtv(v, el.dataset.unit);
  clearTimeout(pending[path]?.t);
  pending[path] = { v, t: setTimeout(() => { delete pending[path]; save(path, v); }, 350) };
}

// ───────────── events ─────────────
document.addEventListener("click", async (e) => {
  const go = e.target.closest("[data-go]"); if (go) { e.preventDefault(); $(`#${go.dataset.go}`).scrollIntoView({ behavior: "smooth" }); return; }
  const tg = e.target.closest("[data-tog]");
  if (tg) { const on = tg.getAttribute("aria-pressed") !== "true"; tg.setAttribute("aria-pressed", on); tg.querySelector("span").textContent = on ? "On" : "Off"; return save(tg.dataset.tog, on, tg.dataset.tog === "hours.on"); }
  const sb = e.target.closest("[data-d]"); if (sb) return stepBy(sb.closest(".st"), +sb.dataset.d);
  const k = e.target.closest("[data-key]");
  if (k) { $$(`[data-key="${k.dataset.key}"]`).forEach((b) => b.setAttribute("aria-pressed", b === k)); const v = k.dataset.v; return save(k.dataset.key, /^[\d.]+$/.test(v) ? +v : v, k.dataset.key === "theme"); }
  const pad = e.target.closest("[data-ex]");
  if (pad) {
    const on = pad.getAttribute("aria-pressed") !== "true";
    const off = $$("[data-ex]").filter((p) => (p === pad ? !on : p.getAttribute("aria-pressed") !== "true")).map((p) => p.dataset.ex);
    if (off.length === EYES.list.length) return status("Keep at least one");
    pad.setAttribute("aria-pressed", on); return save("adv.exOff", off);
  }
  const tr = e.target.closest("[data-try]"); if (tr) return preview(tr.dataset.try);
  const ap = e.target.closest("[data-apply]"); if (ap) return applyPreset(ap.dataset.apply);
  const up = e.target.closest("[data-update]"); if (up) { const p = [...N.presets]; p[+up.dataset.update] = { ...p[+up.dataset.update], settings: snapshot(), at: Date.now() }; await send({ t: "presets", presets: p }); await load(); rerender(); return status("Updated"); }
  const del = e.target.closest("[data-del]"); if (del) { await send({ t: "presets", presets: N.presets.filter((_, i) => i !== +del.dataset.del) }); await load(); rerender(); return status("Deleted"); }
  if (e.target.closest("#psave")) { const name = $("#pname").value.trim() || `Preset ${(N.presets?.length || 0) + 1}`; await send({ t: "presets", presets: [...(N.presets || []), { name, settings: snapshot(), at: Date.now() }] }); await load(); rerender(); return status("Preset saved"); }
  if (e.target.closest("#xstats")) { const b = $("#xstats"); b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true"); return; }
  if (e.target.closest("#export")) return exportFile();
  if (e.target.closest("#import")) return $("#importFile").click();
  if (e.target.closest("#tour")) return chrome.tabs.create({ url: "welcome.html" });
  const arm = e.target.closest("[data-arm]");
  if (arm) {
    if (!arm.classList.contains("armed")) { arm.classList.add("armed"); const t = arm.textContent; arm.textContent = "Press again"; setTimeout(() => { arm.classList.remove("armed"); arm.textContent = t; }, 3000); return; }
    await send({ t: arm.dataset.arm }); await load(); rerender(); return status(arm.dataset.arm === "reset" ? "Reset" : "Stats cleared");
  }
});
document.addEventListener("change", (e) => {
  const tx = e.target.closest("[data-text]"); if (tx) return save(tx.dataset.text, tx.value.trim() || (tx.dataset.text === "name" ? "" : get(tx.dataset.text)));
  const tm = e.target.closest("[data-time]"); if (tm) return save(tm.dataset.time, tm.value);
  if (e.target.id === "importFile") return importFile(e.target.files[0]);
});
$("#sbkey").addEventListener("click", () => save("superbrink", !S().superbrink, true));
function rerender() { const y = scrollY; render(); scrollTo(0, y); }

// presets
const snapshot = () => { const { name, pausedUntil, ...rest } = S(); return JSON.parse(JSON.stringify(rest)); };
async function applyPreset(ref) {
  const [kind, id] = ref.split(":");
  const src = kind === "b" ? N.builtin.find((p) => p.id === id) : N.presets[+id];
  const next = merge(S(), kind === "b" ? src.patch : src.settings);
  next.name = S().name; next.pausedUntil = S().pausedUntil;
  await send({ t: "replace", settings: next }); await load(); rerender(); status(`${src.name} applied`);
}

// backup
function exportFile() {
  const data = { app: "brinky", at: new Date().toISOString(), settings: S(), presets: N.presets || [] };
  if ($("#xstats").getAttribute("aria-pressed") === "true") data.log = N.log;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = `brinky-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000); status("Exported");
}
async function importFile(f) {
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (d.app !== "brinky" || typeof d.settings !== "object") throw new Error("not a brinky file");
    await send({ t: "replace", settings: d.settings });
    if (Array.isArray(d.presets)) await send({ t: "presets", presets: d.presets });
    if (d.log && typeof d.log === "object") await chrome.storage.local.set({ log: d.log });
    await load(); rerender(); status("Imported");
  } catch (err) { status(err.message === "not a brinky file" ? "That isn't a Brinky file" : "Couldn't read that file"); }
}

// previews run brinky's real layer on this page, with the values on screen
function preview(k) {
  const s = S(), a = A(), base = { theme: s.theme, sound: s.sound, vol: a.volume / 100, force: true };
  if (k === "eye" || k === "eyeShort") {
    const ex = EYES.get(N.nextEx);
    return L.run({ ...base, t: "eye", id: "st" + Date.now(), ex: ex.id, dur: k === "eyeShort" ? 8 : Math.round(ex.dur * a.breakScale), preroll: a.prerollBlinks, snoozeMin: a.eyeSnoozeMin, typingMax: 0, kicker: "Preview" });
  }
  if (k === "blink") return L.run({ ...base, t: "blink", count: s.superbrink ? a.blinkCount : s.eyes.blinkCount || 3, text: a.blinkText });
  if (["stretch", "walk", "ball"].includes(k)) return L.run({ ...base, t: "stretch", move: k, ms: a.stretchSecs * 1000, text: k === "stretch" ? a.stretchText : k === "walk" ? "a brisk walk? :)" : "a little kickabout :)" });
  const p = waterPrompt(N.today.glasses, s.water.goal, s.water.ml, s.hours);
  L.run({ ...base, t: "water", id: "st" + Date.now(), style: k, glasses: N.today.glasses, goal: s.water.goal, ...p, laterMin: a.laterMin, timeout: a.waterTimeout * 1000,
    waveH: a.waveHeight, waveSpeed: a.waveSpeed, waveOpacity: a.waveOpacity / 100, px: a.tumblerPx, typingMax: 0 });
}

const spy = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { current = e.target.id; $$("#index a").forEach((x) => x.classList.toggle("on", x.dataset.go === current)); } }), { rootMargin: "-10% 0px -80% 0px" });
globalThis.BrinkyFace.style();
const mface = globalThis.BrinkyFace.mount(document.getElementById("mface"), { src: "mascot/blank.webp", breathe: false });
mface.autoBlink();
await load();
render();
if (location.hash) $(location.hash)?.scrollIntoView();
setInterval(tickDue, 1000);
setInterval(async () => {
  if (!["stats", "data"].includes(current) || document.activeElement?.matches("input,textarea")) return;
  await load(); rerender();
}, 15000);
