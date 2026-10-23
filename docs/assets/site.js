// Brinky site: two views (home and blink.drink.), the modes explainer, install help and a 20-second break you can try.
(() => {
  // Your GitHub repository, as "your-username/brinky". Leave empty on GitHub Pages: it's worked out from
  // the address (your-username.github.io/brinky). Set it if you use a custom domain.
  const REPO = "";
  const FACE = (m) => `assets/brinky/${m}.webp`;
  const ZIP_HREF = "download/brinky.zip";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── GitHub links ──
  (() => {
    let base = REPO ? `https://github.com/${REPO}` : "";
    if (!base && location.hostname.endsWith(".github.io")) {
      const user = location.hostname.split(".")[0];
      const first = location.pathname.split("/").filter(Boolean)[0];
      base = `https://github.com/${user}/${first && !first.endsWith(".html") ? first : `${user}.github.io`}`;
    }
    if (base) $$("[data-gh]").forEach((a) => (a.href = base + a.dataset.gh));
  })();

  // ── nav hairline once you scroll ──
  const nav = $(".nav");
  const onScroll = () => nav.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // ── two views: home and blink.drink. ──
  const views = $$("[data-view]");
  const TITLES = { home: document.title, "blink-drink": "blink.drink. | Brinky" };
  let current = "home";
  function route(first) {
    const h = decodeURIComponent(location.hash.slice(1));
    const next = h === "blink-drink" ? "blink-drink" : "home";
    const changed = next !== current;
    views.forEach((v) => (v.hidden = v.dataset.view !== next));
    document.body.classList.toggle("on-bd", next === "blink-drink");
    document.title = TITLES[next];
    current = next;
    if (next === "blink-drink") { if (changed || first) { scrollTo(0, 0); if (!first) $(".bd-name").focus({ preventScroll: true }); } return; }
    const target = h && document.getElementById(h);
    if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: first || changed || reduced ? "auto" : "smooth" }));
    else if (changed) scrollTo(0, 0);
  }
  $(".bd-name").tabIndex = -1;
  addEventListener("hashchange", () => route(false));
  $$("[data-home]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    if (location.hash) history.pushState(null, "", location.pathname + location.search);
    route(false); scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }));
  addEventListener("popstate", () => route(false));
  route(true);

  // ── which browser? (install steps and notes adapt) ──
  const ua = navigator.userAgent, brands = (navigator.userAgentData?.brands || []).map((b) => b.brand);
  const mobile = navigator.userAgentData ? navigator.userAgentData.mobile : /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  let browser = "chrome";
  if (/Firefox\//.test(ua)) browser = "firefox";
  else if (brands.includes("Microsoft Edge") || /Edg\//.test(ua)) browser = "edge";
  else if (brands.includes("Opera") || /OPR\//.test(ua)) browser = "opera";
  else if (navigator.brave) browser = "brave";
  else if (/Safari\//.test(ua) && !/Chrome|Chromium|CriOS/.test(ua)) browser = "safari";
  const extUrl = { edge: "edge://extensions", brave: "brave://extensions", opera: "opera://extensions" }[browser] || "chrome://extensions";
  $$("[data-ext-url]").forEach((el) => (el.textContent = extUrl));
  if (browser === "edge") $("[data-devmode]").textContent = "It's the switch in the menu on the left of the Extensions page.";
  const bnote = $("#bnote");
  if (mobile) {
    bnote.textContent = "Brinky runs in Chrome, Edge or Brave on a computer. Send this page to yourself and install it there.";
    bnote.hidden = false;
    // a phone can't install Brinky, so every download button sends the page on instead
    const cta = $("[data-main-cta]");
    cta.querySelector("span").textContent = "Send to my computer";
    cta.querySelector("svg").innerHTML = '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 13v6h14v-6"/>';
    $(".nav .btn.primary").textContent = "Send link";
    $$("[data-download]").forEach((a) => { a.removeAttribute("download"); a.removeAttribute("data-download"); a.dataset.send = ""; a.href = location.href.split("#")[0]; });
    document.addEventListener("click", async (e) => {
      const a = e.target.closest("[data-send]"); if (!a) return;
      e.preventDefault();
      const url = location.href.split("#")[0], label = a.querySelector("span") || a;
      try { if (navigator.share) return await navigator.share({ title: "Brinky", text: "Brinky: eye breaks, water and movement for Chrome", url }); } catch { return; }
      try { await navigator.clipboard.writeText(url); label.textContent = "Link copied"; } catch { label.textContent = "Copy the address bar"; }
    });
  } else if (browser === "firefox" || browser === "safari") {
    bnote.textContent = `You're using ${browser === "firefox" ? "Firefox" : "Safari"}. Brinky works in Chrome, Edge, Brave and Arc, so open this page in one of them to install it.`;
    bnote.hidden = false;
  }

  // ── after a download starts, show what to do next ──
  function started() {
    $("#started").classList.add("on");
    if (current !== "home") { location.hash = "#install"; return; }
    setTimeout(() => $("#install").scrollIntoView({ behavior: reduced ? "auto" : "smooth" }), 250);
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-download]")) started(); });

  // ── copy the extensions address (websites can't open it) ──
  $$("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(extUrl); b.textContent = "Copied"; } catch { b.textContent = "Select it"; }
    setTimeout(() => (b.textContent = "Copy"), 2200);
  }));

  // ── blink.drink.: each line comes up to full light as you reach it ──
  const lines = $$(".bd-move p");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("lit"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -26% 0px" });
    lines.forEach((l) => io.observe(l));
  } else lines.forEach((l) => l.classList.add("lit"));

  // ════════ modes: a working day, 9:00 to 19:00, with a call and lunch ════════
  // Mirrors Brinky's defaults: breaks wait for calls and offer one after a 30+ minute call; quiet time pauses
  // everything and counts as rest; water due within 10 minutes of a break joins it; posture every 45 minutes.
  const D0 = 540, D1 = 1140, SPAN = D1 - D0;
  const CALL = { a: 660, b: 705, name: "Call" }, LUNCH = { a: 780, b: 825, name: "Lunch" };
  const hhmm = (m) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")}`;
  const pct = (m) => ((m - D0) / SPAN) * 100;
  const ORD = ["", "Every", "Every second", "Every third", "Every fourth", "Every fifth", "Every sixth"];
  const state = {
    rec: { every: 20, sec: 20, longEvery: 3, longMin: 2, goal: 8, posture: 45, lunch: true },
    work: { focus: 50, brk: 5, goal: 8, posture: 45, lunch: true },
    super: { every: 30, sec: 20, longEvery: 2, longMin: 2, goal: 10, posture: 60, lunch: true },
  };
  let mode = "rec";

  function plan(m, o) {
    const work = m === "work", bands = o.lunch ? [CALL, LUNCH] : [CALL];
    const inBand = (t) => bands.find((b) => t >= b.a && t < b.b);
    const breaks = [], notes = [];
    const addNotes = (a, b) => { if (!work) return; for (let n = a + 20; n < b - 3; n += 20) notes.push(n); };
    let t = D0, k = 0;
    for (let guard = 0; guard < 200; guard++) {
      const iv = work ? o.focus : o.every, due = t + iv;
      if (due >= D1) { addNotes(t, D1); break; }
      const band = bands.find((b) => b.a < due && b.b > t);
      if (band) {
        addNotes(t, band.a);
        if (band === CALL) { // the break waits for the call, then comes straight after it
          k++; const dur = work ? o.brk : o.longEvery && k % o.longEvery === 0 ? o.longMin : o.sec / 60;
          breaks.push({ t: band.b, kind: work || dur >= 1 ? "move" : "eye", dur, afterCall: true });
          t = band.b + dur;
        } else t = band.b; // quiet time counts as rest
        continue;
      }
      addNotes(t, due);
      k++;
      const move = work || (o.longEvery && k % o.longEvery === 0);
      const dur = work ? o.brk : move ? o.longMin : o.sec / 60;
      breaks.push({ t: due, kind: move ? "move" : "eye", dur });
      t = due + dur;
    }
    // water, paced across the day; due near a break, it joins the break
    const water = [];
    for (let i = 1; i <= o.goal; i++) {
      let w = D0 + ((i - 0.5) * SPAN) / o.goal;
      const b = inBand(w); if (b) w = b.b;
      const brk = breaks.find((x) => x.t - w >= 0 && x.t - w <= 10) || breaks.find((x) => w >= x.t && w <= x.t + x.dur + 2);
      water.push(brk ? { t: brk.t, joined: true } : { t: w, joined: false });
    }
    // posture: every N minutes, never during a call, quiet time or a break, and not right on top of a water reminder
    const posture = [];
    for (let p = D0 + o.posture; p < D1; p += o.posture) {
      let q = p;
      if (inBand(q)) continue;
      const w = water.find((x) => !x.joined && Math.abs(x.t - q) < 8); if (w) q = w.t + 8;
      const br = breaks.find((x) => q >= x.t - 1 && q <= x.t + x.dur + 1); if (br) q = br.t + br.dur + 2;
      if (q < D1 && !inBand(q)) posture.push(q);
    }
    return { bands, breaks, notes, water, posture };
  }

  const mark = (cls, t, w, title) => `<i class="m ${cls}" style="left:${pct(t).toFixed(2)}%${w ? `;width:${((w / SPAN) * 100).toFixed(2)}%` : ""}" title="${title}"></i>`;
  const lane = (name, inner) => `<div class="rb-row"><b>${name}</b><div class="rb-lane">${inner}</div></div>`;

  function render() {
    const o = state[mode], p = plan(mode, o), work = mode === "work";
    const eyes = p.breaks.filter((b) => b.kind === "eye"), moves = p.breaks.filter((b) => b.kind === "move");
    const joined = p.water.filter((w) => w.joined).length;
    let hours = "";
    for (let h = 9; h <= 19; h++) hours += `<span class="${h % 2 ? "" : "odd"}" style="left:${pct(h * 60)}%">${h}:00</span>`;
    let rows = "";
    if (work) {
      // focus is whatever's left between breaks, the call and lunch
      let focus = "", s = D0;
      const busy = [...p.breaks.map((b) => [b.t, b.t + b.dur]), ...p.bands.map((b) => [b.a, b.b])].sort((x, y) => x[0] - y[0]);
      for (const [a, b] of busy) { if (a > s + 1) focus += mark("focus", s, a - s, `Focus, ${hhmm(s)} to ${hhmm(a)}`); s = Math.max(s, b); }
      if (s < D1 - 1) focus += mark("focus", s, D1 - s, `Focus from ${hhmm(s)}`);
      focus += p.breaks.map((b) => mark("move", b.t, b.dur, `${hhmm(b.t)}, a ${o.brk}-minute break with moves${b.afterCall ? ", right after the call" : ""}`)).join("");
      rows += lane("Focus", focus);
      rows += lane("Eyes", p.notes.map((t) => mark("lnote", t, 0, `${hhmm(t)}, a look-away note by your cursor`)).join(""));
    } else {
      rows += lane("Eyes", eyes.map((b) => mark("eye", b.t, 0, `${hhmm(b.t)}, look away for ${o.sec} seconds${b.afterCall ? ", right after the call" : ""}`)).join(""));
      rows += lane("Movement", moves.map((b) => mark("move", b.t, b.dur, `${hhmm(b.t)}, ${b.dur} minutes of moves${b.afterCall ? ", right after the call" : ""}`)).join(""));
    }
    rows += lane("Water", p.water.map((w) => mark(`wtr${w.joined ? " joined" : ""}`, w.t, 0, `${hhmm(w.t)}, a glass of water${w.joined ? ", asked for during a break" : ""}`)).join(""));
    rows += lane("Posture", p.posture.map((t) => mark("pos", t, 0, `${hhmm(t)}, posture note by your cursor`)).join(""));
    const bands = p.bands.map((b) => `<i class="rb-band" style="left:${pct(b.a)}%;width:${pct(b.b) - pct(b.a)}%"></i>`).join("");
    const foot = p.bands.map((b) => `<span style="left:${(pct(b.a) + pct(b.b)) / 2}%">${b.name}</span>`).join("");
    const rb = $("#ribbon");
    rb.innerHTML = `<div class="rb-axis" aria-hidden="true">${hours}</div><div class="rb-rows">${rows}<div class="rb-bands">${bands}</div></div><div class="rb-foot" aria-hidden="true">${foot}</div>`;

    // summary, in words
    const n = (x, one, many) => `${x} ${x === 1 ? one : many}`;
    const quiet = o.lunch ? "Nothing interrupts the call or lunch, and a break comes as soon as the call ends." : "Nothing interrupts the call, and a break comes as soon as it ends.";
    const water = `${n(o.goal, "glass", "glasses")} of water${joined ? ` (${joined} asked for during a break)` : ""}`;
    const sum = work
      ? `Across this day: ${o.focus}-minute stretches of focus with ${n(p.breaks.length, "break", "breaks")} of ${o.brk} minutes for guided moves, ${n(p.notes.length, "look-away note", "look-away notes")} by your cursor, ${water} and ${n(p.posture.length, "posture note", "posture notes")}. ${quiet}`
      : `Across this day: ${n(eyes.length, "look-away", "look-aways")}, ${moves.length ? `${n(moves.length, "movement break", "movement breaks")}, ` : ""}${water} and ${n(p.posture.length, "posture note", "posture notes")}. ${quiet}`;
    $("#rbSum").textContent = sum;
    rb.setAttribute("aria-label", `A working day from 9:00 to 19:00 in ${{ rec: "the recommended rhythm", work: "Work mode", super: "SuperBrink mode" }[mode]}. ${sum}`);

    // what each row means
    const key = (cls, w) => `<span class="key" aria-hidden="true"><i class="m ${cls}"${w ? ' style="width:14px"' : ""}></i></span>`;
    const L = mode === "rec" ? [
      [key("eye"), "Eyes", "A 20-second look-away every 20 minutes. The screen fades to near-black, so there's nothing to read."],
      [key("move", 1), "Movement", "Every third break is 2 minutes of moves, like neck tilts, shoulder rolls or stand and reach. Brinky shows you each one."],
      [key("wtr"), "Water", "8 glasses paced across your working hours, sooner if you fall behind. If one's due near a break, the break asks for it instead (shown outlined)."],
      [key("pos"), "Posture", "Every 45 minutes, a small note by your cursor: sit tall, shoulders down."],
    ] : work ? [
      [key("focus", 1), "Focus", `${o.focus} minutes of focus, then a ${o.brk}-minute break with guided moves and free time until the chime.`],
      [key("lnote"), "Eyes", "Nothing covers your work. Every 20 minutes, a quiet look-away note appears by your cursor instead."],
      [key("wtr joined"), "Water", "Paced to your goal. Water that's due near a break waits for it (shown outlined), so you're interrupted less."],
      [key("pos"), "Posture", `Every ${o.posture} minutes, a small note by your cursor.`],
    ] : [
      [key("eye"), "Eyes", `A ${o.sec}-second look-away every ${o.every} minutes. Its length, sounds and look are yours to set too.`],
      [key("move", 1), "Movement", o.longEvery ? `${ORD[o.longEvery]} break${o.longEvery === 1 ? " is" : " is"} ${o.longMin} minutes of moves, with Brinky's guide or free time.` : "Off. Every break is a short look-away."],
      [key("wtr"), "Water", `${o.goal} glasses a day, paced to your hours. Outlined ones are asked for during a break.`],
      [key("pos"), "Posture", `Every ${o.posture} minutes, by your cursor or at the bottom of the page.`],
    ];
    $("#legend").innerHTML = L.map(([k, t, d]) => `<div><dt>${k}${t}</dt><dd>${d}</dd></div>`).join("");
  }

  const DESC = {
    rec: "Brinky's recommended rhythm, ready the moment you install it. This is a working day from 9:00 to 19:00, with a 45-minute call and lunch.",
    work: "One switch in the popup. Fewer, longer breaks for deep work, and nothing covering your screen in between. Pick a cycle:",
    super: "Turn on SuperBrink mode and every timing is yours, along with quiet times, focus sites where breaks wait, chimes and rain sounds, breathing guides and an evening tint. Try a few:",
  };
  function controls() {
    const box = $("#modeCtrl"), o = state[mode];
    if (mode === "rec") { box.innerHTML = ""; return; }
    if (mode === "work") {
      box.innerHTML = `<div class="seg" role="radiogroup" aria-label="Minutes of focus and break">${[[25, 5], [50, 5], [50, 10], [90, 15]].map(([f, b]) =>
        `<button type="button" role="radio" data-f="${f}" data-b="${b}" aria-checked="${o.focus === f && o.brk === b}" aria-label="${f} minutes of focus, ${b} minute break">${f} / ${b}</button>`).join("")}</div>`;
      box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
        o.focus = +b.dataset.f; o.brk = +b.dataset.b;
        box.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", x === b));
        render();
      }));
      box.querySelector(".seg").addEventListener("keydown", (e) => {
        if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
        const bs = [...box.querySelectorAll("button")], i = bs.indexOf(document.activeElement);
        const nb = bs[(i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length]; nb.focus(); nb.click(); e.preventDefault();
      });
      return;
    }
    const F = {
      every: ["Eye break every", 10, 60, 5, (v) => `${v} min`],
      longEvery: ["Movement break", 0, 6, 1, (v) => (v ? (v === 1 ? "every break" : `every ${["", "", "2nd", "3rd", "4th", "5th", "6th"][v]} break`) : "off")],
      goal: ["Water goal", 4, 14, 1, (v) => `${v} glasses`],
      posture: ["Posture check every", 15, 120, 15, (v) => `${v} min`],
    };
    box.innerHTML = `<div class="sliders">${Object.entries(F).map(([k, [l, mn, mx, st, f]]) =>
      `<label class="sl"><span>${l}<output>${f(o[k])}</output></span><input type="range" min="${mn}" max="${mx}" step="${st}" value="${o[k]}" data-k="${k}"></label>`).join("")}
      <label class="tg"><input type="checkbox" data-k="lunch" ${o.lunch ? "checked" : ""}>Lunch quiet time, 13:00 to 13:45</label></div>`;
    box.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => {
      const k = inp.dataset.k;
      o[k] = inp.type === "checkbox" ? inp.checked : +inp.value;
      if (F[k]) inp.previousElementSibling.querySelector("output").textContent = F[k][4](o[k]);
      render();
    }));
  }
  function setMode(m, focus) {
    mode = m;
    $$(".tabs [role=tab]").forEach((t) => { const on = t.dataset.mode === m; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    $("#mode-panel").setAttribute("aria-labelledby", `tab-${m}`);
    $("#modeDesc").textContent = DESC[m];
    controls(); render();
  }
  const tabs = $$(".tabs [role=tab]");
  tabs.forEach((t) => t.addEventListener("click", () => setMode(t.dataset.mode)));
  $(".tabs").addEventListener("keydown", (e) => {
    const i = tabs.findIndex((t) => t.dataset.mode === mode);
    const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (j === undefined) return;
    e.preventDefault(); setMode(tabs[(j + tabs.length) % tabs.length].dataset.mode, true);
  });
  setMode("rec");

  // ════════ a real 20-second break ════════
  const brk = $("#brk");
  const face = $("#brkFace"), time = $("#brkTime"), msg = $("#brkMsg"), btns = $("#brkBtns"), bar = brk.querySelector(".bar");
  const C = 2 * Math.PI * 100, LEN = 20000;
  bar.style.strokeDasharray = C;
  ["calm", "sleepy", "proud"].forEach((m) => { const i = new Image(); i.src = FACE(m); });
  let t0 = 0, timer = 0, breath = 0, awayT = 0, opener = null, audio;
  function tone(freqs, gap = 0.14) {
    try {
      audio ||= new AudioContext();
      freqs.forEach((f, i) => {
        const o = audio.createOscillator(), g = audio.createGain(), at = audio.currentTime + i * gap;
        o.frequency.value = f; g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.05, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 1.3);
        o.connect(g).connect(audio.destination); o.start(at); o.stop(at + 1.4);
      });
    } catch {}
  }
  const fmt = (ms) => `0:${String(Math.max(0, Math.ceil(ms / 1000))).padStart(2, "0")}`;
  function open() {
    opener = document.activeElement;
    brk.hidden = false; brk.classList.remove("away");
    document.body.style.overflow = "hidden";
    face.src = FACE("calm"); face.style.transform = "translate(-50%,-50%)";
    msg.textContent = "Look at something far away.";
    btns.innerHTML = `<button class="brk-stop" type="button" id="brkStop">Stop the break</button>`;
    $("#brkStop").onclick = close; $("#brkStop").focus();
    t0 = performance.now();
    tone([523.25, 659.25, 784]);
    awayT = setTimeout(() => { brk.classList.add("away"); face.src = FACE("sleepy"); msg.textContent = "Look out of a window, or across the room. I'll chime when it's time."; }, 2500);
    let inhale = true;
    const breathe = () => { if (reduced) return; face.style.transform = `translate(-50%,-50%) scale(${inhale ? 1.06 : 0.96})`; inhale = !inhale; };
    breathe(); breath = setInterval(breathe, 4000);
    tick(); timer = setInterval(tick, 200);
  }
  function tick() {
    const left = LEN - (performance.now() - t0);
    time.textContent = fmt(left);
    bar.style.strokeDashoffset = C * (1 - Math.max(0, left) / LEN);
    if (left > 0) return;
    clearInterval(timer); clearInterval(breath);
    brk.classList.remove("away");
    face.src = FACE("proud"); face.style.transform = "translate(-50%,-50%)";
    msg.textContent = "That was a real break. Brinky finds the right moment for one, all day.";
    btns.innerHTML = mobile
      ? `<a class="brk-go" href="${location.href.split("#")[0]}" data-send>Send to my computer</a><button class="brk-stop" type="button" id="brkClose">Close</button>`
      : `<a class="brk-go" href="${ZIP_HREF}" download="brinky.zip" data-download>Download Brinky</a><button class="brk-stop" type="button" id="brkClose">Close</button>`;
    btns.querySelector("a").addEventListener("click", () => close());
    $("#brkClose").onclick = close;
    btns.querySelector("a").focus();
    tone([784, 1046.5]);
  }
  function close() {
    clearInterval(timer); clearInterval(breath); clearTimeout(awayT);
    brk.hidden = true; document.body.style.overflow = "";
    opener?.focus?.({ preventScroll: true });
  }
  $$("[data-try]").forEach((b) => b.addEventListener("click", open));
  addEventListener("keydown", (e) => {
    if (brk.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "Tab") {
      const f = $$("button,a", brk); if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
})();
