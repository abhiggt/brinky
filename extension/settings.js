// Settings, in two places:
//  • "settings": the core, inside the toolbar popup (and at the top of the full settings page)
//  • "super":    SuperBrink mode, on its own page. Everything there applies only while SuperBrink is on;
//                off means Brinky's recommended defaults.
import { chime } from "./sound.js";
import { resetSettings, VERSION } from "./common.js";

const cap = (o) => o[0].toUpperCase() + o.slice(1);
const esc = (s) => String(s ?? "").replace(/[&"<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" }[c]));
const lb = (label, hint) => `<div class="lb"><b>${label}</b>${hint ? `<small>${hint}</small>` : ""}</div>`;
const toggle = (k, label, hint, { cls = "", invert = false, dep = "" } = {}) =>
  `<label class="f" ${dep ? `data-dep="${dep}"` : ""}>${lb(label, hint)}<span class="sw ${cls}"><input type="checkbox" data-k="${k}" ${invert ? "data-invert" : ""}><span></span></span></label>`;
const stepper = (k, label, hint, { min, max, step = 1, unit, dep = "" }) =>
  `<div class="f" data-row="${k}" ${dep ? `data-dep="${dep}"` : ""}>${lb(label, hint)}<div class="step" data-step="${k}" data-min="${min}" data-max="${max}" data-inc="${step}">
    <button type="button" data-d="-1" aria-label="Less">−</button><input inputmode="numeric" data-k="${k}" data-num aria-label="${label}"><span class="u">${unit}</span><button type="button" data-d="1" aria-label="More">+</button></div></div>`;
const select = (k, label, hint, opts, num = false) => `<div class="f">${lb(label, hint)}<select data-k="${k}" ${num ? "data-numsel" : ""}>${opts.map(([v, n]) => `<option value="${v}">${n}</option>`).join("")}</select></div>`;
const seg = (k, label, hint, opts, dep = "") => `<div class="f" ${dep ? `data-dep="${dep}"` : ""}>${lb(label, hint)}<div class="seg" data-seg="${k}" role="radiogroup" aria-label="${label}">${opts.map(([v, n]) => `<button type="button" data-v="${v}" role="radio">${n}</button>`).join("")}</div></div>`;
const section = (title, desc, rows, dep = "") => `<div class="sec" ${dep ? `data-dep="${dep}"` : ""}><h2>${title}</h2>${desc ? `<p class="desc">${desc}</p>` : ""}<div class="list">${rows}</div></div>`;
const nav = (title, back) => `<header class="nav"><button class="back" data-go="${back}" aria-label="Back">‹</button><h1>${title}</h1><span class="saved" aria-live="polite">Saved</span></header>`;
const DAYS = [[1, "M"], [2, "T"], [3, "W"], [4, "T"], [5, "F"], [6, "S"], [0, "S"]];
const DAYNAMES = { 0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday" };
const PRESETS = [["25/5", "25 / 5"], ["50/5", "50 / 5"], ["50/10", "50 / 10"], ["90/15", "90 / 15"]];

// ── the core: what most people ever touch ──
const CORE = () => `
  ${section("You", "",
    toggle("enabled", "Brinky is on", "Turn off to stop every reminder for now") +
    `<div class="f">${lb("Your name", "So I can say hi properly")}<input type="text" class="namein" data-k="name" maxlength="24" placeholder="Optional" autocomplete="given-name" aria-label="Your name"></div>`)}

  ${section("Breaks", "Normally a 20-second look-away every 20 minutes (the 20-20-20 rule).",
    toggle("workMode.on", "Work mode", "Fewer, longer breaks for deep work, plus a quick look-away note by your cursor every 20 minutes") +
    `<div class="f" data-dep="workMode.on"><div class="seg wide" data-seg="workPreset" role="radiogroup" aria-label="Focus and break minutes">${PRESETS.map(([v, n]) => `<button type="button" data-v="${v}" role="radio">${n}</button>`).join("")}</div></div>` +
    stepper("workMode.everyMin", "Break every", "", { min: 10, max: 180, step: 5, unit: "min", dep: "workMode.on" }) +
    stepper("workMode.breakMin", "Break length", "Brinky shows you a few moves", { min: 1, max: 30, unit: "min", dep: "workMode.on" }) +
    toggle("movement", "Movement breaks", "Every third break: 2 minutes of moves, Brinky shows you how", { dep: "!workMode.on" }))}

  ${section("Drink", "Reminders are paced to your goal across your day. If one is due near a break, the break asks for the sip.",
    toggle("water.on", "Water reminders", "", { cls: "water" }) +
    stepper("water.goal", "Daily goal", "", { min: 1, max: 20, unit: "glasses", dep: "water.on" }) +
    select("water.glassMl", "Glass size", "Used for your daily total", [[150, "150 ml · 5 oz"], [200, "200 ml · 7 oz"], [250, "250 ml · 8 oz"], [300, "300 ml · 10 oz"], [350, "350 ml · 12 oz"], [500, "500 ml · 17 oz"], [750, "750 ml bottle"], [1000, "1 L bottle"]], true) +
    seg("water.style", "Reminder style", "", [["wave", "Wave"], ["card", "Sip card"]], "water.on") +
    `<div class="f" data-dep="water.on">${lb("See it now", "On the tab you're on")}<div class="row2"><button class="btn sm" id="tryWave">Wave</button><button class="btn sm" id="tryCard">Sip card</button></div></div>`)}

  ${section("Little nudges", "They appear right by your cursor, where your eyes already are.",
    toggle("blink.on", "Blink reminder", "The toolbar Brinky blinks every 15 minutes") +
    toggle("posture.on", "Posture checks", "A small note every 45 minutes"))}

  ${section("When you're busy", "",
    toggle("quiet", "Stay quiet in calls and videos", "Also while you share your screen or go fullscreen") +
    toggle("muted", "Sounds", "Chimes and wave sounds", { invert: true }) +
    toggle("activeHours.on", "Only during working hours", "") +
    `<div class="f stack" data-dep="activeHours.on"><div class="row2">${lb("Days", "")}<div class="daychips">${DAYS.map(([d, l]) => `<button type="button" class="daychip" data-day="${d}" aria-label="${DAYNAMES[d]}">${l}</button>`).join("")}</div></div>
      <div class="times"><input type="time" data-k="activeHours.start" aria-label="Start"><span class="mut">to</span><input type="time" data-k="activeHours.end" aria-label="End"></div></div>`)}
`;

const SETTINGS = (inPopup) => (inPopup ? nav("Settings", "home") + `<div class="scroll">` : `<div class="page">`) + CORE() + `
  <button class="link super" data-super><div class="lb"><b>SuperBrink settings</b><small>Every detail: timing, sounds, focus sites, quiet times, evening tint, your data</small></div><span class="chev">${inPopup ? "↗" : "↓"}</span></button>
  <p class="foot"><b>Keyboard shortcuts</b><br><kbd>Alt+Shift+B</kbd> break now · <kbd>Alt+Shift+P</kbd> pause<br><kbd>Alt+Shift+S</kbd> snooze · <kbd>Alt+Shift+W</kbd> log a glass<br>Brinky ${VERSION}</p>
</div>`;

// ── SuperBrink: everything else, for people who like to tune ──
const SUPER = () => `<div class="page">
  <div class="sec superhead"><div class="list">
    ${toggle("superBrink", "SuperBrink mode", "Fine-tune everything below. While it's off, Brinky uses its recommended settings for all of it.", { cls: "super" })}
  </div></div>

  ${section("Rhythm", "Used when Work mode is off.",
    stepper("workMin", "Eye break every", "", { min: 5, max: 180, step: 5, unit: "min" }) +
    stepper("breakSec", "Look-away length", "", { min: 10, max: 300, step: 5, unit: "sec" }) +
    stepper("longEvery", "Movement break every", "0 = never", { min: 0, max: 12, unit: "breaks" }) +
    stepper("longMin", "Movement break length", "", { min: 1, max: 15, unit: "min" }) +
    toggle("exercises", "Guided exercises", "Brinky acts out each move during movement breaks") +
    stepper("maxSnoozes", "Snoozes in a row", "After this many, the break happens", { min: 0, max: 5, unit: "max" }), "superBrink")}

  ${section("Heads-up and nudges", "",
    stepper("headsUpSec", "Heads-up before a break", "A small pill in the corner (0 = none)", { min: 0, max: 120, step: 5, unit: "sec" }) +
    toggle("cursorCountdown", "Countdown by my cursor", "The last 10 seconds before a break") +
    seg("nudgeAt", "Show nudges", "", [["cursor", "By my cursor"], ["bottom", "At the bottom"]]) +
    seg("blink.style", "Blink reminder", "", [["icon", "Toolbar blink"], ["pill", "A note"]]) +
    stepper("blink.everyMin", "Blink reminder every", "", { min: 5, max: 120, step: 5, unit: "min" }) +
    stepper("posture.everyMin", "Posture check every", "", { min: 15, max: 240, step: 5, unit: "min" }) +
    stepper("budgetMin", "At most one reminder every", "Eye breaks always get through", { min: 0, max: 30, unit: "min" }) +
    toggle("fadeBefore", "Dim the page before a break", "A gentle dim in the last seconds, never a blur"), "superBrink")}

  ${section("Don't disturb", "",
    toggle("dnd.calls", "During calls and screen sharing", "Any tab using your camera, mic or sharing your screen") +
    toggle("dnd.video", "While I watch a video", "") +
    toggle("dnd.fullscreen", "In fullscreen", "") +
    toggle("typingAware", "Mid-sentence", "Waits for a pause in typing, up to 30 seconds") +
    toggle("postCallBreak", "Break after long calls", "Offer one right after a call of 30+ minutes") +
    toggle("idleReset", "Time away counts as a break", "Only after 3+ minutes, so reading pauses don't") +
    toggle("dnd.focusSites", "On my focus sites", "Breaks wait; water shows as a quiet card") +
    `<div class="f stack" data-dep="dnd.focusSites"><textarea data-k="focusSites" placeholder="figma.com&#10;docs.google.com" aria-label="Focus sites, one per line"></textarea><span class="note">One site per line. Subdomains count too.</span></div>` +
    `<div class="f stack">${lb("Call sites", "If one of these is playing sound, I treat it as a call for 3 minutes")}<textarea data-k="meetingHosts" aria-label="Call sites, one per line"></textarea></div>`, "superBrink")}

  ${section("Quiet times", "Like lunch: reminders pause, nothing covers the page.",
    `<div class="f stack"><div id="plans"></div><button class="btn sm" id="addPlan" style="align-self:flex-start;margin-top:8px">+ Add a quiet time</button></div>`, "superBrink")}

  ${section("Break screen", "",
    seg("breakLook", "Look", "Auto matches the page", [["auto", "Auto"], ["dark", "Dark"], ["light", "Light"]]) +
    toggle("lookAway", "Look-away mode", "Short breaks fade to dark, so there's nothing to watch") +
    toggle("holdToSkip", "Hold to skip", "Hold Skip or Esc for half a second") +
    toggle("pauseMedia", "Pause the video I'm watching", "Never music, never calls") +
    select("breath", "Breathing guide", "", [["calm", "Calm (4-4)"], ["box", "Box (4-4-4-4)"], ["478", "Relax (4-7-8)"]]) +
    `<div class="f">${lb("Chime", "At the start and end of a break")}<select data-k="sound">${["none", "chime", "bowl", "bell"].map((o) => `<option value="${o}">${cap(o)}</option>`).join("")}</select><button class="x" id="preview" title="Play" aria-label="Play chime">▶</button></div>` +
    select("ambient", "Background sound", "", [["none", "None"], ["rain", "Rain"], ["brown", "Brown noise"], ["ocean", "Ocean"]]) +
    `<div class="f">${lb("Volume", "")}<input type="range" min="0" max="1" step="0.05" data-k="volume" aria-label="Volume"></div>` +
    `<div class="f stack">${lb("Break messages", "One per line, shown during breaks")}<textarea data-k="messages"></textarea></div>`, "superBrink")}

  ${section("Water", "",
    toggle("water.paced", "Pace reminders to my goal", "About one glass per (working day ÷ goal), sooner if I fall behind") +
    stepper("water.everyMin", "Remind me every", "", { min: 10, max: 240, step: 5, unit: "min", dep: "!water.paced" }) +
    stepper("water.holdSec", "Reminder stays for", "Unanswered reminders back off and try later", { min: 10, max: 60, step: 5, unit: "sec" }) +
    seg("water.size", "Wave height", "", [["small", "Low"], ["medium", "Medium"], ["large", "High"]]) +
    toggle("water.sound", "Wave sounds", "A soft whoosh, only in the tab you're on") +
    toggle("water.stopAtGoal", "Rest after my goal", "No more reminders once I've hit it") +
    seg("units", "Amounts in", "", [["auto", "Auto"], ["metric", "ml · L"], ["imperial", "oz"]]), "superBrink")}

  ${section("Evening tint", "Warms web pages at night without washing out text.",
    toggle("tint.on", "Warm tint", "") +
    `<div class="f stack" data-dep="tint.on">${lb("Hours", "")}<div class="times"><input type="time" data-k="tint.start" aria-label="Start"><span class="mut">to</span><input type="time" data-k="tint.end" aria-label="End"></div></div>` +
    `<div class="f" data-dep="tint.on">${lb("Warmth", "")}<input type="range" min="0.1" max="0.7" step="0.05" data-k="tint.strength" aria-label="Tint warmth"></div>`, "superBrink")}

  ${section("Your data", "Everything stays in your browser.",
    `<div class="f">${lb("Welcome tour", "Meet Brinky again")}<button class="btn sm" id="tour">Open</button></div>` +
    `<div class="f">${lb("Export stats", "Daily breaks and water as a CSV file")}<button class="btn sm" id="export">Download</button></div>` +
    `<div class="f">${lb("Reset today", "Clears today's breaks and glasses")}<button class="btn sm" id="resetToday">Reset</button></div>` +
    `<div class="f">${lb("Reset all settings", "Back to Brinky's defaults")}<button class="btn sm danger" id="resetAll">Reset</button></div>`)}
</div>`;

export function mountSettings(root, page, ctx) {
  const S = () => ctx.S;
  const getK = (k) => k.split(".").reduce((o, p) => o?.[p], S());
  const inPopup = page === "settings";
  root.innerHTML = page === "super" ? SUPER() : SETTINGS(inPopup);
  const $ = (id) => root.querySelector("#" + id);
  const savedEl = root.querySelector(".saved") || ctx.savedEl;
  let savedT;
  const flash = () => { if (!savedEl) return; savedEl.classList.add("on"); clearTimeout(savedT); savedT = setTimeout(() => savedEl.classList.remove("on"), 1200); };
  const save = async (k, v) => { await ctx.setK(k, v); flash(); deps(); };
  const deps = () => root.querySelectorAll("[data-dep]").forEach((r) => {
    const d = r.dataset.dep, neg = d.startsWith("!"), v = !!getK(neg ? d.slice(1) : d);
    r.classList.toggle("dis", neg ? v : !v);
  });

  root.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => ctx.go(b.dataset.go)));
  root.querySelector("[data-super]")?.addEventListener("click", () => ctx.openSuper());

  root.querySelectorAll("[data-k]").forEach((el) => {
    const k = el.dataset.k, v = getK(k), inv = el.dataset.invert !== undefined;
    if (el.type === "checkbox") el.checked = inv ? !v : !!v; else el.value = v ?? "";
    if (el.dataset.num !== undefined) return; // steppers handled below
    el.addEventListener("change", () => save(k,
      el.type === "checkbox" ? (inv ? !el.checked : el.checked)
        : el.type === "range" || el.dataset.numsel !== undefined ? +el.value
        : k === "name" ? (el.value = el.value.trim().slice(0, 24)) : el.value));
  });

  // segmented controls
  root.querySelectorAll("[data-seg]").forEach((box) => {
    const k = box.dataset.seg;
    const cur = () => (k === "workPreset" ? `${S().workMode.everyMin}/${S().workMode.breakMin}` : getK(k));
    const mark = () => box.querySelectorAll("button").forEach((b) => { const on = b.dataset.v === String(cur()); b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    mark();
    box.addEventListener("click", async (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (k === "workPreset") {
        const [every, brk] = b.dataset.v.split("/").map(Number);
        await save("workMode", { ...S().workMode, everyMin: every, breakMin: brk });
        root.querySelectorAll('[data-step^="workMode."] input').forEach((i) => (i.value = getK(i.dataset.k)));
      } else await save(k, b.dataset.v);
      mark();
    });
  });

  // steppers: − value +
  root.querySelectorAll("[data-step]").forEach((box) => {
    const k = box.dataset.step, min = +box.dataset.min, max = +box.dataset.max, inc = +box.dataset.inc, input = box.querySelector("input");
    const set = async (v) => {
      v = Math.max(min, Math.min(max, Math.round(v))); input.value = v;
      if (v === getK(k)) return;
      await save(k, v);
      if (k.startsWith("workMode.")) root.querySelectorAll('[data-seg="workPreset"] button').forEach((b) => b.classList.toggle("on", b.dataset.v === `${S().workMode.everyMin}/${S().workMode.breakMin}`));
    };
    box.querySelectorAll("button").forEach((b) => (b.onclick = () => set((+input.value || 0) + inc * +b.dataset.d)));
    input.addEventListener("change", () => set(+input.value || min));
    input.addEventListener("keydown", (e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); set((+input.value || 0) + (e.key === "ArrowUp" ? inc : -inc)); } });
  });
  deps();

  if (page !== "super") {
    // days of the week
    const markDays = () => root.querySelectorAll("[data-day]").forEach((b) => { const on = (S().activeHours.days || []).includes(+b.dataset.day); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    markDays();
    root.querySelectorAll("[data-day]").forEach((b) => (b.onclick = async () => {
      const d = +b.dataset.day, cur = new Set(S().activeHours.days || []);
      cur.has(d) ? cur.delete(d) : cur.add(d);
      await save("activeHours.days", [...cur].sort());
      markDays();
    }));
    $("tryWave").onclick = async () => { await ctx.send({ t: "waterNow", style: "wave" }); if (inPopup) window.close(); };
    $("tryCard").onclick = async () => { await ctx.send({ t: "waterNow", style: "card" }); if (inPopup) window.close(); };
    return;
  }

  // quiet times
  const box = $("plans");
  const drawPlans = () => (box.innerHTML = (S().planned || []).map((p, i) => `<div class="plan" data-i="${i}">
      <div class="pl1"><input type="text" value="${esc(p.label)}" data-f="label" aria-label="Name" placeholder="Name"><button class="x" data-del="${i}" title="Remove" aria-label="Remove">✕</button></div>
      <div class="pl2"><span class="mut">at</span><input type="time" value="${esc(p.time)}" data-f="time" aria-label="Time"><span class="mut">for</span><input type="number" value="${esc(p.min)}" min="5" max="240" data-f="min" aria-label="Minutes"><span class="mut">min</span></div>
    </div>`).join("") || `<span class="mut">No quiet times yet.</span>`);
  drawPlans();
  box.onchange = (e) => {
    const row = e.target.closest("[data-i]"); if (!row) return;
    const l = structuredClone(S().planned), f = e.target.dataset.f;
    l[+row.dataset.i][f] = f === "min" ? +e.target.value : e.target.value;
    save("planned", l);
  };
  box.onclick = async (e) => { const d = e.target.closest("[data-del]"); if (d) { await save("planned", S().planned.filter((_, i) => i !== +d.dataset.del)); drawPlans(); } };
  $("addPlan").onclick = async () => { await save("planned", [...(S().planned || []), { time: "16:00", min: 15, label: "Walk" }]); drawPlans(); };
  $("preview").onclick = () => chime(S().sound === "none" ? "chime" : S().sound, S().volume);
  $("tour").onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  $("export").onclick = async () => {
    const { stats = {} } = await chrome.storage.local.get("stats");
    const rows = [["date", "breaks_taken", "breaks_missed", "skipped", "snoozed", "glasses", "rest_min", "longest_stretch_min"]];
    for (const k of Object.keys(stats).sort()) { const d = stats[k]; rows.push([k, d.taken || 0, d.missed || 0, d.skipped || 0, d.snoozed || 0, d.water || 0, Math.round((d.restSec || 0) / 60), d.longestMin || 0]); }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" }));
    a.download = `brinky-stats-${new Date().toLocaleDateString("en-CA")}.csv`;
    a.click();
  };
  $("resetToday").onclick = async () => {
    if (!confirm("Clear today's breaks and glasses?")) return;
    const { stats = {} } = await chrome.storage.local.get("stats");
    delete stats[new Date().toLocaleDateString("en-CA")];
    await chrome.storage.local.set({ stats });
    $("resetToday").textContent = "Done";
  };
  $("resetAll").onclick = async () => {
    if (!confirm("Reset every setting to Brinky's defaults?")) return;
    ctx.S = await resetSettings();
    await ctx.send({ t: "settingsChanged" });
    ctx.remount?.();
  };
}
