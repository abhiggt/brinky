// The break: a frosted layer over the page with Brinky breathing in the middle.
// Short breaks fade to near-black after a moment (there's nothing to watch; a chime marks the end).
// Movement breaks guide off-screen exercises. Classic script → globalThis.BrinkyBreak.
(() => {
  if (globalThis.BrinkyBreak) return; // loaded on demand; never twice
  const CSS = `
  .bl{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;gap:32px;padding:24px;
    font-family:ui-rounded,ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Rounded","Segoe UI",Inter,sans-serif;
    --fg:#fff;--mut:rgba(255,255,255,.8);--line:rgba(255,255,255,.34);--hover:rgba(255,255,255,.14);--track:rgba(255,255,255,.2);--card:rgba(17,22,32,.78);
    background:rgba(8,11,18,.68);backdrop-filter:blur(10px) saturate(105%);-webkit-backdrop-filter:blur(10px) saturate(105%);
    color:var(--fg);opacity:1;animation:bl-in .2s ease-out;transition:opacity .3s ease,background 1.4s ease;pointer-events:auto;cursor:default;user-select:none;outline:none}
  /* modest machines: a solid scrim instead of a live blur, so the first frame is never slow */
  .bl.lite{backdrop-filter:none;-webkit-backdrop-filter:none;background:rgba(8,11,18,.88)}
  .bl.lite[data-look="light"]{background:rgba(248,249,251,.96)}
  .bl.lite.away{background:rgba(4,6,10,.96)}
  .sipline{display:flex;align-items:center;gap:6px;justify-content:center;font-size:13px;font-weight:650;color:var(--mut);margin:-8px 0 16px}
  .sipline[hidden]{display:none}
  .sipline svg{width:14px;height:14px}
  .bl[data-look="light"]{--fg:#0f172a;--mut:rgba(15,23,42,.74);--line:rgba(15,23,42,.24);--hover:rgba(15,23,42,.07);--track:rgba(15,23,42,.13);--card:rgba(255,255,255,.88);
    background:rgba(248,249,251,.82)}
  .bl.away,.bl[data-look="light"].away{--fg:rgba(255,255,255,.9);--mut:rgba(255,255,255,.72);--line:rgba(255,255,255,.26);--hover:rgba(255,255,255,.12);--track:rgba(255,255,255,.14);--card:rgba(20,24,32,.7);background:rgba(4,6,10,.94)}
  .bl.gone{opacity:0}
  @keyframes bl-in{from{opacity:.45}} /* visible on its very first frame */
  .bl *{box-sizing:border-box;margin:0}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .col{display:flex;flex-direction:column;align-items:center;text-align:center;max-width:460px}
  .kind{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--mut);font-weight:650;margin-bottom:14px}
  .ring{position:relative;width:204px;height:204px;transition:opacity 1.2s}
  .ring svg{position:absolute;inset:0;transform:rotate(-90deg)}
  .ring circle{fill:none;stroke-width:3}
  .ring .tr{stroke:var(--track)}
  .ring .br{stroke:var(--fg);stroke-linecap:round;transition:stroke-dashoffset .3s linear}
  .ring .me{position:absolute;inset:0;display:grid;place-items:center}
  .ring .me img{width:116px;height:auto;transform-origin:50% 85%;transition:transform 4s ease-in-out;filter:drop-shadow(0 10px 18px rgba(0,0,0,.2))}
  .time{font-size:52px;font-weight:300;letter-spacing:-1px;font-variant-numeric:tabular-nums;margin-top:10px;line-height:1.1;transition:opacity 1.2s}
  .hint{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);height:18px;font-weight:600}
  .msg{font-size:18px;line-height:1.45;margin:18px 0 22px;min-height:52px;transition:opacity .4s,font-size 1s;font-weight:500}
  .away .ring,.away .time{opacity:.22}
  .away .msg{font-size:21px}
  .away .btns{opacity:.4;transition:opacity .4s}
  .away .btns:hover,.away .btns:focus-within{opacity:1}
  .btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;transition:opacity 1s}
  .btns button{all:unset;position:relative;overflow:hidden;cursor:pointer;padding:10px 16px;border-radius:999px;border:1px solid var(--line);font-size:13.5px;font-weight:650;color:var(--fg);transition:background .15s}
  .btns button:hover{background:var(--hover)}
  .btns button:focus-visible{outline:2px solid var(--fg);outline-offset:2px}
  .btns button.pri{background:var(--fg);color:#0b1220;border-color:transparent}
  .bl[data-look="light"]:not(.away) .btns button.pri{color:#fff}
  .btns button.ok{border-color:transparent;background:var(--hover);cursor:default;color:var(--fg)}
  .btns button i{position:absolute;inset:0;background:var(--hover);transform:scaleX(var(--p,0));transform-origin:left;pointer-events:none}
  .btns button span{position:relative}
  .btns.gone{visibility:hidden}
  /* movement breaks: Brinky in the ring shows each exercise, with big type underneath */
  .exinfo{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:16px;width:min(560px,100%)}
  .exinfo[hidden]{display:none}
  .segs{display:flex;gap:6px;margin-bottom:8px}
  .segs i{width:26px;height:4px;border-radius:9px;background:var(--track);overflow:hidden}
  .segs b{display:block;height:100%;width:0;background:var(--fg);border-radius:inherit}
  .extitle{font-size:clamp(26px,3.6vw,36px);font-weight:700;letter-spacing:-.5px;line-height:1.15;transition:opacity .35s}
  .exhow{font-size:clamp(15.5px,1.9vw,18.5px);color:var(--mut);line-height:1.5;max-width:44ch;min-height:3em;transition:opacity .35s}
  .exnext{font-size:12.5px;color:var(--mut);font-weight:600;letter-spacing:.02em;transition:opacity .35s}
  .swap .extitle,.swap .exhow,.swap .exnext{opacity:0}
  .bl.move{overflow:auto;align-items:safe center}
  .move .col{max-width:none;width:min(640px,100%);margin:auto 0}
  .move .ring{width:248px;height:248px}
  .move .ring .me img{width:146px}
  .move .time{font-size:22px;font-weight:500;margin-top:14px;color:var(--mut);letter-spacing:0}
  .move .hint{height:16px}
  .move .msg{font-size:14.5px;color:var(--mut);margin:20px 0 22px;min-height:0}
  .move.over .msg{font-size:19px;color:var(--fg)}
  /* Brinky acts out each exercise */
  .me{transform-origin:50% 72%}
  .move .me.a-far{animation:bk-drift 6s ease-in-out infinite}
  .move .me.a-nearfar{animation:bk-focus 4s ease-in-out infinite}
  .move .me.a-neck{animation:bk-tilt 5s ease-in-out infinite}
  .move .me.a-shoulders{animation:bk-shrug 3s ease-in-out infinite}
  .move .me.a-wrist{animation:bk-sway 3.5s ease-in-out infinite}
  .move .me.a-reach{animation:bk-reach 4s ease-in-out infinite}
  .move .me.a-walk{animation:bk-walk 1s ease-in-out infinite}
  @keyframes bk-drift{0%,100%{transform:translateX(-12px)}50%{transform:translateX(12px)}}
  @keyframes bk-focus{0%,40%,100%{transform:scale(1)}50%,90%{transform:scale(.82)}}
  @keyframes bk-tilt{0%,100%{transform:rotate(-13deg)}50%{transform:rotate(13deg)}}
  @keyframes bk-shrug{0%,100%{transform:translateY(0)}35%{transform:translateY(-12px)}65%{transform:translateY(4px)}}
  @keyframes bk-sway{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
  @keyframes bk-reach{0%,100%{transform:scale(1,1)}50%{transform:scale(.94,1.14)}}
  @keyframes bk-walk{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
  @media (max-width:760px){.bl{flex-direction:column;overflow:auto;justify-content:flex-start;padding-top:32px}}
  @media (max-height:740px){.move .ring{width:178px;height:178px}.move .ring .me img{width:104px}.move .time{margin-top:10px;font-size:20px}
    .exinfo{gap:6px;margin-top:6px}.exhow{min-height:0}.move .msg{margin:12px 0 14px}}
  @media (prefers-reduced-motion: reduce){.ring .me img{transition:none}.move .me{animation:none!important}.bl{transition:opacity .2s}}
  `;

  // guided exercises: Brinky acts each one out in the ring (a = motion, m = face)
  const EX = [
    { t: "Look far away", h: "Find the farthest thing you can see, out of a window if you can, and let your eyes rest on it.", a: "far", m: "happy" },
    { t: "Near, then far", h: "Hold up your thumb about 25 cm away. Focus on it, then on something across the room. Swap every few seconds.", a: "nearfar", m: "surprised" },
    { t: "Neck tilt", h: "Ear toward shoulder for a slow breath, then the other side. I'll chime at halfway.", a: "neck", m: "calm", sides: true },
    { t: "Slow blinks", h: "Close your eyes gently for two seconds, then blink slowly ten times.", a: "blink", m: "calm" },
    { t: "Shoulder rolls", h: "Lift your shoulders to your ears, roll them back and let them drop. Slow and big.", a: "shoulders", m: "proud" },
    { t: "Palming", h: "Rub your palms warm, cup them over closed eyes and breathe. I'll tick when it's time to open them.", a: "palming", m: "calm" },
    { t: "Wrist stretch", h: "Arm out, palm up, gently pull your fingers back. Switch hands at the chime.", a: "wrist", m: "wink", sides: true },
    { t: "Stand and reach", h: "Stand up, reach both arms overhead and lengthen your spine.", a: "reach", m: "excited" },
    { t: "Walk and sip", h: "Walk to refill your glass and take a few sips on the way back.", a: "walk", m: "happy" },
  ];
  const PATTERNS = {
    calm: [["breathe in", 4, 1], ["breathe out", 4, 0]],
    box: [["breathe in", 4, 1], ["hold", 4, 1], ["breathe out", 4, 0], ["hold", 4, 0]],
    478: [["breathe in", 4, 1], ["hold", 7, 1], ["breathe out", 8, 0]],
  };

  // sounds (synthesized; no files)
  let ctx;
  const ac = () => { try { ctx ||= new AudioContext(); if (ctx.state === "suspended") ctx.resume(); return ctx; } catch { return null; } };
  function tone(freq, start, dur, vol, type = "sine") {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, c.currentTime + start);
    g.gain.linearRampToValueAtTime(vol, c.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
  }
  function chime(kind, volume, end) {
    const v = volume * 0.2;
    if (kind === "chime") (end ? [784, 1046.5] : [523.25, 659.25, 784]).forEach((f, i) => tone(f, i * 0.14, 1.4, v));
    if (kind === "bowl") [220, 440.6, 661.8, 883.2].forEach((f, i) => tone(f, 0, 4 - i * 0.6, v / (i + 1)));
    if (kind === "bell") [880, 1760, 2637].forEach((f, i) => tone(f, end ? 0.2 : 0, 2.2 - i * 0.5, v / (i + 1.5), "triangle"));
  }
  const tick = (volume) => tone(1320, 0, 0.18, volume * 0.08, "triangle");
  function ambient(kind, volume) {
    const c = kind && kind !== "none" && ac(); if (!c) return () => {};
    const len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (kind === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = c.createBiquadFilter(), g = c.createGain();
    f.type = kind === "rain" ? "highpass" : "lowpass"; f.frequency.value = kind === "rain" ? 1200 : kind === "ocean" ? 500 : 900;
    g.gain.value = 0; g.gain.linearRampToValueAtTime(volume * (kind === "rain" ? 0.1 : 0.25), c.currentTime + 2);
    src.connect(f).connect(g).connect(c.destination);
    if (kind === "ocean") { const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.09; lg.gain.value = volume * 0.15; lfo.connect(lg).connect(g.gain); lfo.start(); }
    src.start();
    return () => { g.gain.linearRampToValueAtTime(0, c.currentTime + 0.8); setTimeout(() => src.stop(), 900); };
  }

  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`; };

  const kindOf = (o) => ({ short: "Look away", long: "Movement break", planned: o.label || "Break" }[o.kind] || "Break");
  function markup(o) {
    const M = globalThis.BrinkyMascot, kindLabel = kindOf(o), hold = o.holdToSkip !== false;
    const t = document.createElement("template");
    t.innerHTML = `<div class="bl" data-look="${o.look === "light" ? "light" : "dark"}" role="dialog" aria-modal="true" aria-label="${kindLabel}" tabindex="-1">
      <div class="sr" aria-live="polite"></div>
      <div class="col">
        <div class="kind">${kindLabel}</div>
        <div class="ring"><svg viewBox="0 0 204 204"><circle class="tr" cx="102" cy="102" r="98"/><circle class="br" cx="102" cy="102" r="98"/></svg>
          <div class="me">${M ? M.html({ mood: "calm", size: 116 }) : ""}</div></div>
        <div class="time">${fmt(o.endsAt - Date.now())}</div>
        <div class="hint"></div>
        <div class="exinfo" hidden><div class="segs" aria-hidden="true"></div><div class="extitle"></div><div class="exhow"></div><div class="exnext"></div></div>
        <p class="msg"></p>
        <div class="sipline" hidden><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5c2.6 3.7 6.5 7.9 6.5 12A6.5 6.5 0 0 1 5.5 14.5c0-4.1 3.9-8.3 6.5-12z"/></svg><span></span></div>
        <div class="btns">
          <button data-a="water" class="${o.sip ? "pri" : ""}"><span>${o.sip ? "I had a glass" : "I had some water"}</span></button>
          ${o.noSnooze ? "" : `<button data-a="postpone"><span>5 more minutes</span></button>`}
          <button data-a="skip" title="${hold ? "Hold to skip" : "Skip"}"><i></i><span>Skip</span></button>
        </div>
      </div>
    </div>`;
    const el = t.content.firstElementChild;
    if ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4) el.classList.add("lite");
    return el;
  }

  function start(root, o, onAction = () => {}) {
    const M = globalThis.BrinkyMascot;
    prepare(root);
    const total = Math.max(1000, o.endsAt - o.startedAt);
    const short = o.kind === "short";
    const kindLabel = kindOf(o), hold = o.holdToSkip !== false;
    const el = markup(o);
    root.appendChild(el);
    const q = (s) => el.querySelector(s);
    const me = q(".me img"), bar = q(".br"), C = 2 * Math.PI * 98, live = q(".sr");
    bar.style.strokeDasharray = C;
    const timers = [];
    const every = (fn, ms) => { const id = setInterval(fn, ms); timers.push(id); return id; };
    const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
    const sound = !!(o.primary && o.volume && o.sound !== "none");

    // keep the keyboard away from the page underneath; restore focus afterwards
    const prevFocus = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    try { prevFocus?.blur?.(); el.focus({ preventScroll: true }); } catch {}
    const hostEl = root.host || el;

    // messages
    const pool = (o.messages || []).filter(Boolean);
    let mi = Math.floor(Math.random() * Math.max(1, pool.length)), msgTimer = 0;
    const nextMsg = () => pool[mi++ % pool.length] || "Rest your eyes.";
    const nm = String(o.name || "").trim(), you = nm ? `, ${nm}` : "";
    const firstMsg = o.postCall ? `That was a ${o.postCall}-minute call${you}. Look out of a window for a moment.`
      : o.sip ? (short ? `Look away${you}, and take a sip of water.` : `Stand up and stretch${you}. Refill your water too.`)
      : short ? nextMsg() : `Stand up and stretch${you}. Refill your water too.`;
    q(".msg").textContent = firstMsg;
    live.textContent = `${kindLabel}. ${fmt(total)}.`;
    if (pool.length > 1 && !o.sip && !o.postCall) msgTimer = every(() => { if (done || away) return; const m = q(".msg"); m.style.opacity = 0; later(() => { if (!done) { m.textContent = nextMsg(); m.style.opacity = 1; } }, 400); }, 9000);

    // look-away: nothing to watch on a short break
    let away = false, holdHint = false, moving = false, curMood = "calm";
    if (short && o.lookAway !== false) later(() => { if (done) return; away = true; el.classList.add("away"); if (!o.sip && !o.postCall) q(".msg").textContent = `Look out of a window${you}. I'll chime when it's time.`; M?.set(me, "sleepy"); }, 2500);

    // Brinky breathes with you
    const pattern = PATTERNS[o.breath] || PATTERNS.calm;
    let bi = 0, done = false;
    (function breathe() {
      if (done) return;
      const [label, sec, inn] = pattern[bi++ % pattern.length];
      if (!holdHint && !moving) q(".hint").textContent = label;
      me.style.transitionDuration = `${sec}s`;
      me.style.transform = inn ? "scale(1.1, 1.08)" : "scale(.94, .95)";
      later(breathe, sec * 1000);
    })();

    // guided exercises on movement breaks: Brinky shows each one in the ring
    if (o.exercises && !short && total >= 20e3) {
      // at most 8 guided moves (about 4 minutes); a longer break ends in free time
      const per = o.stepMs || 30e3, steps = Math.min(8, Math.max(1, Math.round(total / per))), stepMs = steps === 8 && total > 8 * per ? per : total / steps;
      const freeTime = total - steps * stepMs > 20e3;
      const info = q(".exinfo"), segs = q(".segs"), box = q(".me");
      moving = true;
      info.hidden = false;
      el.classList.add("move");
      q(".hint").textContent = "";
      segs.innerHTML = Array.from({ length: steps }, () => "<i><b></b></i>").join("");
      let i = 0, blinkT = 0;
      const show = () => {
        if (done) return;
        if (i >= steps) {
          if (!freeTime || i > steps) return;
          i++; // after the moves: free time until the chime
          info.classList.add("swap");
          later(() => {
            if (done) return;
            q(".extitle").textContent = "Free time";
            q(".exhow").textContent = "Walk around, refill your water, look out of a window. I'll chime when it's time.";
            q(".exnext").textContent = "That's all the moves";
            info.classList.remove("swap");
          }, 350);
          box.className = "me"; clearInterval(blinkT); curMood = "happy"; M?.set(me, curMood);
          [...segs.children].forEach((x) => { const b = x.firstChild; b.style.transition = "none"; b.style.width = "100%"; });
          if (sound) tick(o.volume);
          return;
        }
        const k = i, ex = EX[((o.exStart || 0) + k) % EX.length], nx = EX[((o.exStart || 0) + k + 1) % EX.length];
        const paint = () => {
          if (done) return;
          q(".extitle").textContent = ex.t;
          q(".exhow").textContent = ex.h;
          q(".exnext").textContent = `Exercise ${k + 1} of ${steps} · ${k + 1 < steps ? `Up next: ${nx.t}` : "Last one"}`;
          info.classList.remove("swap");
        };
        if (k > 0) { info.classList.add("swap"); later(paint, 350); } else paint();
        live.textContent = `${ex.t}. ${ex.h}`;
        box.className = `me a-${ex.a}`;
        curMood = ex.m; M?.set(me, curMood);
        clearInterval(blinkT);
        if (ex.a === "blink") { let shut = true; blinkT = every(() => { if (!done) M?.set(me, (shut = !shut) ? "calm" : "happy"); }, 1600); }
        [...segs.children].forEach((s, n) => { const b = s.firstChild; b.style.transition = "none"; b.style.width = n < k ? "100%" : "0"; });
        const b = segs.children[k].firstChild;
        requestAnimationFrame(() => requestAnimationFrame(() => { b.style.transition = `width ${Math.max(0, stepMs - 300)}ms linear`; b.style.width = "100%"; }));
        if (sound && k > 0) tick(o.volume);
        if (ex.sides && sound) later(() => !done && chime("chime", o.volume * 0.5, true), stepMs / 2);
        i++;
      };
      show(); every(show, stepMs);
    }

    // buttons (Skip is press-and-hold, so a reflex click or Esc doesn't throw the break away)
    let holdTimer = 0, holdStart = 0, holdRaf = 0;
    const skipBtn = q('button[data-a="skip"]');
    const showHint = (text) => { holdHint = true; q(".hint").textContent = text; later(() => { holdHint = false; }, 1600); };
    const holdBegin = () => {
      if (done) return;
      if (!hold) return onAction("skip");
      holdStart = performance.now();
      const fill = () => { const p = Math.min(1, (performance.now() - holdStart) / 600); skipBtn.style.setProperty("--p", p); if (p < 1 && holdStart) holdRaf = requestAnimationFrame(fill); };
      fill();
      holdTimer = setTimeout(() => { holdStart = 0; onAction("skip"); }, 600);
    };
    const holdCancel = (hint = true) => {
      if (!holdStart) return;
      const quick = performance.now() - holdStart < 600;
      clearTimeout(holdTimer); cancelAnimationFrame(holdRaf); holdStart = 0; skipBtn.style.setProperty("--p", 0);
      if (quick && hint) showHint("hold to skip");
    };
    skipBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); holdBegin(); });
    skipBtn.addEventListener("pointerup", () => holdCancel());
    skipBtn.addEventListener("pointerleave", () => holdCancel(false));
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-a]"); if (!b || done) return;
      const a = b.dataset.a;
      if (a === "skip") { if (e.detail === 0) holdBegin(); return; } // keyboard activation
      if (a === "water") {
        if (b.classList.contains("ok")) return;
        b.classList.remove("pri"); b.classList.add("ok"); b.querySelector("span").textContent = "Logged, thank you";
        M?.set(me, "proud"); later(() => !done && M?.set(me, away ? "sleepy" : curMood), 2500);
        onAction("water");
      } else onAction(a);
    });
    el.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });

    const keyTrap = (e) => {
      if (ended) return;
      const path = e.composedPath ? e.composedPath() : [];
      const inside = path.includes(el) || path.includes(hostEl);
      if (e.key === "Escape") {
        e.preventDefault(); e.stopImmediatePropagation();
        if (done) return;
        if (e.type === "keydown" && !e.repeat) holdBegin();
        if (e.type === "keyup") holdCancel();
        return;
      }
      if (inside && (e.key === "Tab" || e.key === "Enter" || e.key === " ")) return; // our own buttons
      if (e.key === "Tab" && e.type === "keydown") { try { el.querySelector("button")?.focus(); } catch {} }
      e.preventDefault(); e.stopImmediatePropagation();
    };
    for (const type of ["keydown", "keyup", "keypress"]) addEventListener(type, keyTrap, true);
    const inputTrap = (e) => { if (!ended) { e.preventDefault(); e.stopImmediatePropagation(); } };
    addEventListener("beforeinput", inputTrap, true);

    // sound only in the tab you're looking at
    let stopAmbient = () => {};
    // sound starts just after the first frame is on screen (opening the audio device takes a moment)
    if (sound) requestAnimationFrame(() => later(() => { if (done) return; try { chime(o.sound, o.volume); stopAmbient = ambient(o.ambient, o.volume); } catch {} }, 0));

    // countdown, and how long this layer was actually visible
    let seenMs = 0, lastTick = Date.now();
    const tickFn = () => {
      const now = Date.now(), left = o.endsAt - now;
      if (document.visibilityState === "visible") seenMs += Math.min(1000, now - lastTick);
      lastTick = now;
      q(".time").textContent = left > 0 ? fmt(left) : "0:00";
      bar.style.strokeDashoffset = C * (1 - Math.max(0, left) / total);
      if (left <= 0 && !done) {
        done = true;
        clearInterval(msgTimer);
        el.classList.remove("away");
        q(".msg").textContent = `Nice${you}. Your eyes thank you.`;
        if (moving) { q(".me").className = "me"; q(".exinfo").hidden = true; el.classList.add("over"); }
        q(".hint").textContent = "back to it";
        q(".btns").classList.add("gone");
        live.textContent = "Break over.";
        M?.set(me, "proud"); me.style.transform = "scale(1)";
        stopAmbient();
        if (sound) try { chime(o.sound, o.volume, true); } catch {}
        later(() => onAction("done", { seenMs: Math.min(seenMs, total) }), 1400);
      }
    };
    tickFn(); every(tickFn, 250);

    let ended = false;
    function end() {
      if (ended) return;
      ended = true; done = true;
      timers.forEach((x) => { clearInterval(x); clearTimeout(x); });
      clearTimeout(holdTimer); cancelAnimationFrame(holdRaf);
      for (const type of ["keydown", "keyup", "keypress"]) removeEventListener(type, keyTrap, true);
      removeEventListener("beforeinput", inputTrap, true);
      stopAmbient();
      el.classList.add("gone");
      setTimeout(() => el.remove(), 600);
      try { if (prevFocus?.isConnected) prevFocus.focus({ preventScroll: true }); } catch {}
    }
    // water joins the break: the glass becomes part of this moment
    function sip({ glass, goal } = {}) {
      if (done) return;
      const line = q(".sipline"), b = q('button[data-a="water"]');
      if (glass && goal) { line.querySelector("span").textContent = `Glass ${glass} of ${goal} today`; line.hidden = false; }
      if (b && !b.classList.contains("ok")) { b.classList.add("pri"); b.querySelector("span").textContent = "I had a glass"; }
    }
    if (o.sip) sip(o);
    return { end, sip, get seenMs() { return seenMs; } };
  }

  // styles in place ahead of time (called while a break is armed), so the first frame costs nothing extra
  function prepare(root, o) {
    if (!root.querySelector?.("style[data-bl]")) { const st = document.createElement("style"); st.dataset.bl = "1"; st.textContent = CSS; root.appendChild(st); }
    if (!o) return;
    // lay the break out once, invisibly, so styles, fonts and images are resolved before it's real
    const el = markup({ ...o, startedAt: Date.now(), endsAt: Date.now() + (o.dur || 20000) });
    el.style.cssText = "visibility:hidden;animation:none;transition:none";
    if (o.kind !== "short") { el.classList.add("move"); el.querySelector(".exinfo").hidden = false; el.querySelector(".extitle").textContent = "Neck tilt"; el.querySelector(".exhow").textContent = "Ear toward shoulder for a slow breath."; }
    el.querySelector(".time").textContent = "0:20"; el.querySelector(".msg").textContent = "Look away.";
    root.appendChild(el);
    el.getBoundingClientRect();
    el.remove();
  }

  globalThis.BrinkyBreak = { start, prepare };
})();
