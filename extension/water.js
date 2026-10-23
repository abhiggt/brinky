// The water reminder. "wave": a sea wave rolls in from one side, Brinky floats in on it, then it ebbs away.
// "card": a quiet sip card in the corner (used on focus sites, or if you prefer it).
// Shown only in the tab you're looking at. Canvas 2D only. Classic script → globalThis.BrinkyWater.
(() => {
  if (globalThis.BrinkyWater) return; // loaded on demand; never twice
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  const easeOut = (p) => 1 - Math.pow(1 - p, 2.2);
  const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;

  const CSS = `
  .water{position:fixed;inset:0;z-index:2147483646;pointer-events:none}
  .water canvas{position:absolute;inset:0;width:100%;height:100%}
  .wcard{position:absolute;left:0;top:0;width:292px;max-width:calc(100vw - 24px);border-radius:18px;padding:14px 14px 12px;pointer-events:auto;color:#0f172a;
    background:rgba(255,255,255,.94);backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);
    border:1px solid rgba(255,255,255,.7);box-shadow:0 18px 50px rgba(2,32,64,.28),0 2px 6px rgba(2,32,64,.12);
    transition:opacity .35s, transform .35s ease-out;font-family:ui-rounded,ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Rounded","Segoe UI",Inter,sans-serif}
  .wcard .tail{position:absolute;bottom:-8px;left:var(--tail,50%);width:16px;height:16px;margin-left:-8px;transform:rotate(45deg);
    background:rgba(255,255,255,.94);border-right:1px solid rgba(255,255,255,.7);border-bottom:1px solid rgba(255,255,255,.7);border-radius:0 0 4px 0}
  .wcard[data-tail="none"] .tail{display:none}
  .wcard[data-tail="left"] .tail{left:-8px;bottom:auto;top:var(--tailY,50%);margin:-8px 0 0 0;border:0;border-left:1px solid rgba(255,255,255,.7);border-bottom:1px solid rgba(255,255,255,.7);border-radius:0 0 0 4px}
  .wcard[data-tail="right"] .tail{left:auto;right:-8px;bottom:auto;top:var(--tailY,50%);margin:-8px 0 0 0;border:0;border-right:1px solid rgba(255,255,255,.7);border-top:1px solid rgba(255,255,255,.7);border-radius:0 4px 0 0}
  .wt{font-size:15.5px;font-weight:700;letter-spacing:-.2px;line-height:1.3}
  .ws{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#475569;margin:6px 0 11px;flex-wrap:wrap}
  .dots{display:flex;gap:3px}
  .dots i{width:7px;height:9px;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;background:#cbd5e1}
  .dots i.f{background:#2f8ae0}
  .wbtns{display:flex;gap:6px}
  .wbtns button{all:unset;cursor:pointer;flex:1;text-align:center;font-size:13px;font-weight:650;padding:10px 10px;border-radius:12px;
    background:rgba(15,23,42,.07);color:#0f172a;transition:background .15s, transform .08s}
  .wbtns button:hover{background:rgba(15,23,42,.12)}
  .wbtns button:active{transform:scale(.97)}
  .wbtns button:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
  .wbtns .go{flex:1.4;background:#111827;color:#fff}
  .wbtns .go:hover{background:#1f2937}
  .wcard.done .wbtns{display:none}
  .sip{position:fixed;left:auto;top:auto;right:16px;bottom:16px;transform:none;display:flex;gap:10px;align-items:flex-start;width:330px;max-width:calc(100vw - 32px);animation:sipin .45s cubic-bezier(.2,.9,.3,1.2)}
  .sip img{width:54px;height:auto;flex:none;margin-top:2px}
  .sip .body{flex:1;min-width:0}
  @keyframes sipin{from{opacity:0;transform:translateY(14px) scale(.97)}}
  @media (prefers-color-scheme: dark){.wcard,.wcard .tail{background:rgba(22,27,40,.94);border-color:rgba(255,255,255,.12);color:#f1f5f9}
    .ws{color:#94a3b8}.dots i{background:#334155}.wbtns button{background:rgba(255,255,255,.08);color:#f1f5f9}.wbtns button:hover{background:rgba(255,255,255,.14)}.wbtns .go{background:#f1f5f9;color:#0f172a}.wbtns .go:hover{background:#fff}}
  @media (prefers-reduced-motion: reduce){.sip{animation:none}}
  `;

  // Caustic light pattern, computed once.
  let causticTile;
  function getCaustics() {
    if (causticTile) return causticTile;
    const n = 128, c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d"), img = g.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const p0 = (x / n) * TAU - 250, p1 = (y / n) * TAU - 250;
      let i0 = p0, i1 = p1, cc = 1;
      for (let k = 0; k < 5; k++) {
        const t = 17 * (1 - 3.5 / (k + 1));
        const n0 = p0 + Math.cos(t - i0) + Math.sin(t + i1), n1 = p1 + Math.sin(t - i1) + Math.cos(t + i0);
        i0 = n0; i1 = n1;
        cc += 1 / Math.hypot(p0 / (Math.sin(i0 + t) / 0.005), p1 / (Math.cos(i1 + t) / 0.005));
      }
      cc = 1.17 - Math.pow(cc / 5, 1.4);
      const v = clamp(Math.pow(Math.abs(cc), 8), 0, 1);
      const o = (y * n + x) * 4;
      img.data[o] = 220; img.data[o + 1] = 245; img.data[o + 2] = 255; img.data[o + 3] = v * 255;
    }
    g.putImageData(img, 0, 0);
    return (causticTile = c);
  }

  // Tiny synthesized sounds: a surf whoosh, a softer backwash, and a "glug".
  let actx;
  function audio() { try { actx ||= new AudioContext(); if (actx.state === "suspended") actx.resume(); return actx; } catch { return null; } }
  function noise(c, sec) {
    const b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = w * 0.6 + last * 2.5; }
    return b;
  }
  function whoosh(vol, dur = 3.2, peak = 0.7, from = 300, mid = 1400, to = 250) {
    const c = audio(); if (!c || !vol) return;
    const s = c.createBufferSource(); s.buffer = noise(c, dur);
    const f = c.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 0.7;
    const g = c.createGain(), t = c.currentTime;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(mid, t + peak); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07 * vol, t + peak); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t + dur + 0.1);
  }
  function glug(vol) {
    const c = audio(); if (!c || !vol) return;
    [0, 0.13, 0.26].forEach((d, i) => {
      const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + d;
      o.type = "sine"; o.frequency.setValueAtTime(620 - i * 70, t); o.frequency.exponentialRampToValueAtTime(260 - i * 30, t + 0.11);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12 * vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.15);
    });
  }

  const LINES = { arrive: ["Surf's up. Time for some water", "Sip o'clock", "Your water break is here", "Hey, have a little water"], last: "Last one for today's goal", bonus: "Goal done already. Bonus sip?" };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  // "Sip o'clock, Sam" / "Goal done already. Bonus sip, Sam?"
  const named = (t, n) => { n = String(n || "").trim(); return n ? t.replace(/([?!.]?)$/, `, ${n}$1`) : t; };
  const amount = (o, n) => { const v = n * (o.glassMl || 250); return o.units === "imperial" ? `${Math.round(v / 29.574)} oz` : v >= 1000 ? `${(v / 1000).toFixed(1)} L` : `${v} ml`; };

  function cardHTML(o, title, extraCls = "") {
    const { glass = 1, goal = 8 } = o;
    const dots = (n) => Array.from({ length: Math.min(goal, 12) }, (_, i) => `<i class="${i < n ? "f" : ""}"></i>`).join("");
    return { dots, html: `<div class="wcard ${extraCls}" role="dialog" aria-label="Water reminder" style="opacity:0;pointer-events:none">
        <div class="wt">${esc(title)}</div>
        <div class="ws"><span class="dots">${dots(glass - 1)}</span><span class="sub">Glass ${glass} of ${goal} today${glass > 1 ? ` · ${amount(o, glass - 1)} so far` : ""}</span></div>
        <div class="wbtns"><button class="go" data-w="drank">I drank a glass</button><button data-w="later">In 10 min</button></div>
        <i class="tail"></i>
      </div>` };
  }
  const titleFor = ({ glass = 1, goal = 8, name }) => named(glass === goal ? LINES.last : glass > goal ? LINES.bonus : pick(LINES.arrive), name);

  function injectCSS(root) {
    if (!root.querySelector?.("style[data-water]")) { const st = document.createElement("style"); st.dataset.water = "1"; st.textContent = CSS; root.appendChild(st); }
  }

  // ───────── the quiet sip card ─────────
  function startCard(root, opts, onAction) {
    injectCSS(root);
    const { hold = 20000, sound = true, volume = 0.6 } = opts;
    const M = globalThis.BrinkyMascot;
    const { dots, html } = cardHTML(opts, titleFor(opts), "sip");
    const t = document.createElement("template");
    t.innerHTML = `<div class="water">${html}</div>`;
    const wrap = t.content.firstElementChild;
    root.appendChild(wrap);
    const card = wrap.querySelector(".wcard");
    card.dataset.tail = "none";
    card.insertAdjacentHTML("afterbegin", M ? M.html({ mood: "excited", size: 54 }) : "");
    const bodyWrap = document.createElement("div"); bodyWrap.className = "body";
    [...card.querySelectorAll(".wt,.ws,.wbtns")].forEach((n) => bodyWrap.appendChild(n));
    card.appendChild(bodyWrap);
    const img = card.querySelector("img");
    requestAnimationFrame(() => { card.style.opacity = "1"; card.style.pointerEvents = "auto"; });
    let done = false, timer = setTimeout(() => say("I'll check back soon.", "calm", () => { onAction("ignored"); leave(); }, 900), hold);
    const say = (text, mood, then, ms) => { if (done) return; done = true; clearTimeout(timer); card.classList.add("done"); card.querySelector(".wt").textContent = text; M?.set(img, mood); setTimeout(then, ms); };
    function leave() { done = true; clearTimeout(timer); card.style.opacity = "0"; card.style.pointerEvents = "none"; setTimeout(cleanup, 380); }
    function cleanup() { if (!wrap.isConnected) return; wrap.remove(); removeEventListener("keydown", onKey, true); api.onEnd?.(); }
    card.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b || done) return;
      if (b.dataset.w === "drank") {
        card.querySelector(".dots").innerHTML = dots(opts.glass);
        glug(sound ? volume : 0);
        say(opts.glass >= opts.goal ? "That's your goal for today. Lovely." : "Glug glug. Proud of you.", "proud", () => { onAction("drank"); leave(); }, 1300);
      } else say("Okay, back in 10 minutes.", "wink", () => { onAction("later"); leave(); }, 900);
    });
    const onKey = (e) => { if (e.key === "Escape" && !done) { done = true; onAction("dismissed"); leave(); } };
    addEventListener("keydown", onKey, true);
    const api = { leave: (o = {}) => (o.now ? cleanup() : leave()), onEnd: null };
    return api;
  }

  // ───────── the wave ─────────
  function start(root, opts = {}, onAction = () => {}) {
    if (opts.style === "card") return startCard(root, opts, onAction);
    const { at = Date.now(), hold = 20000, glass = 1, goal = 8, sound = true, volume = 0.6 } = opts;
    const M = globalThis.BrinkyMascot;
    injectCSS(root);
    const { dots, html } = cardHTML(opts, titleFor(opts));
    const t = document.createElement("template");
    t.innerHTML = `<div class="water"><canvas></canvas>${html}</div>`;
    const wrap = t.content.firstElementChild;
    root.appendChild(wrap);
    const cv = wrap.querySelector("canvas"), card = wrap.querySelector(".wcard"), g = cv.getContext("2d");
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const vol = sound ? volume : 0;
    const level = { small: 0.4, medium: 0.55, large: 0.8 }[opts.size] || 0.55;

    const img = {};
    for (const m of ["happy", "blink", "excited", "proud", "calm", "wink"]) { img[m] = new Image(); img[m].src = M ? M.url(m) : ""; }
    let mood = "excited", blinkUntil = 0, nextBlink = 2500;

    let W = 0, H = 0, dpr = 1, full = 0, bodyGrad = null;
    const off = document.createElement("canvas"), og = off.getContext("2d");
    const size = () => {
      dpr = Math.min(lowEnd ? 1 : 1.5, devicePixelRatio || 1);
      W = innerWidth; H = innerHeight; full = H * level;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      off.width = Math.ceil(W / 3); off.height = Math.ceil(H / 3);
      bodyGrad = null; cardPos = null; cardLocked = false;
    };
    let cardPos = null, cardLocked = false;
    size();
    const caustic = lowEnd ? null : getCaustics(), cpat = caustic ? og.createPattern(caustic, "repeat") : null;

    const IN = calm ? 900 : 2400, OUT = calm ? 700 : 3000, CARD_AT = calm ? 300 : IN * 0.65;
    const t0 = performance.now() - clamp(Date.now() - at, 0, 1500);
    const dir = opts.from === "right" ? -1 : opts.from === "left" ? 1 : Math.random() < 0.5 ? 1 : -1;
    let leaveAt = 0, reflected = false, last = performance.now(), acc = 0, raf, done = false, cardShownAt = 0, frameNo = 0;
    if (!calm) whoosh(vol, 3.4, 0.9, 260, 1000, 220);

    const sc = clamp(H / 800, 0.6, 1.4);
    const SW = [[11, 520, 46], [6.5, 300, 36], [3.6, 170, 28], [1.9, 95, 21]].map(([A, L, c]) => ({ A: A * sc * (level / 0.8 + 0.25), k: TAU / L, w: (TAU / L) * c, ph: Math.random() * TAU }));
    const SUMA = SW.reduce((a, s) => a + s.A, 0), Q = 0.85;

    const N = 100, sy = new Float32Array(N), sv = new Float32Array(N);
    const simAt = (x) => { const f = clamp((x / W) * (N - 1), 0, N - 1), i = Math.floor(f), j = Math.min(N - 1, i + 1); return sy[i] + (sy[j] - sy[i]) * (f - i); };
    const kick = (x, amt, spread = 3) => { const c = Math.round((x / W) * (N - 1)); for (let i = c - spread; i <= c + spread; i++) if (i >= 0 && i < N) sv[i] += amt * (1 - Math.abs(i - c) / (spread + 1)); };
    let slope = 0, slopeV = 0, mouse = { x: W / 2, y: H / 2 }, pm = { x: W / 2, y: H / 2 };

    const S = lowEnd ? 90 : 120, PX = new Float32Array(S), PY = new Float32Array(S), PF = new Float32Array(S), PC = new Float32Array(S);
    const heightAt = (x) => {
      let lo = 0, hi = S - 1;
      if (x <= PX[0]) return PY[0];
      if (x >= PX[hi]) return PY[hi];
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (PX[m] < x) lo = m; else hi = m; }
      const f = (x - PX[lo]) / (PX[hi] - PX[lo] || 1);
      return PY[lo] + (PY[hi] - PY[lo]) * f;
    };

    const spray = [], foam = [];
    const FOAM_MAX = lowEnd ? 80 : 160;
    const mascot = { u: -W * 0.3, y: H + 60, v: 0, shown: false, rot: 0 };

    function frontState(ms, now) {
      if (leaveAt) { const q = clamp((now - leaveAt) / OUT, 0, 1); return { mode: "out", q, e: 1 - Math.pow(1 - q, 1.7) }; }
      const p = clamp(ms / IN, 0, 1);
      return { mode: p < 1 ? "in" : "rest", p, F: W * (-0.25 + 1.75 * easeOut(p)), ramp: W * (0.1 + 0.25 * p * p) };
    }
    function profile(u, fs) {
      if (fs.mode === "out") return full * (1 - smooth(fs.e * (1 + 0.55 * (u / W)) * 1.02));
      let L = full * smooth((fs.F - u) / fs.ramp);
      if (fs.mode === "in" && !calm) {
        const crest = full * 0.36 * (1 - 0.6 * fs.p), w = W * 0.07, cx = fs.F - W * 0.07;
        L += crest * Math.exp(-((u - cx) * (u - cx)) / (w * w)) * smooth((fs.F + W * 0.01 - u) / (W * 0.035));
      }
      return L;
    }
    function sample(ms, fs) {
      const tt = ms / 1000;
      for (let j = 0; j < S; j++) {
        const u0 = -60 + (j / (S - 1)) * (W + 120);
        const L = profile(u0, fs);
        const cover = smooth(L / (full * 0.35));
        let dx = 0, y = 0;
        for (const s of SW) { const th = s.k * u0 - s.w * tt + s.ph; dx += Q * s.A * Math.sin(th); y += s.A * Math.cos(th); }
        let U = u0 - dx * cover;
        if (fs.mode === "in" && !calm) { const d = (u0 - (fs.F - W * 0.045)) / (W * 0.03); U += W * 0.018 * Math.exp(-d * d) * (1 - fs.p); }
        const X = dir > 0 ? U : W - U;
        let h = L + y * cover + slope * ((X / W) * 2 - 1) * cover + simAt(X) * cover;
        const crestF = clamp((y / SUMA - 0.42) / 0.5, 0, 1) * cover * (fs.mode === "out" ? 0.5 : 1);
        let frontF = 0;
        if (fs.mode === "in" && !calm) { const d = (u0 - (fs.F - W * 0.09)) / (W * 0.075); frontF = Math.exp(-d * d) * (1 - 0.3 * fs.p) * 1.4; }
        if (fs.mode === "out") { const r = L / full, d = (r - 0.05) / 0.05; frontF = r > 0.002 ? Math.exp(-d * d) * 0.7 : 0; }
        const k = dir > 0 ? j : S - 1 - j;
        PX[k] = X; PY[k] = h; PF[k] = clamp(crestF * 0.6 + frontF, 0, 1); PC[k] = cover;
      }
    }
    function physics(dt, fs) {
      const target = calm || fs.mode !== "rest" ? 0 : ((mouse.x / W) * 2 - 1) * H * 0.06;
      slopeV += ((target - slope) * 14 - slopeV * 4) * dt;
      slope += slopeV * dt;
      for (let i = 0; i < N; i++) { const lap = (i > 0 ? sy[i - 1] : sy[i]) + (i < N - 1 ? sy[i + 1] : sy[i]) - 2 * sy[i]; sv[i] += (-sy[i] * 2.5 - sv[i] * 1.1 + lap * 3200) * dt; }
      for (let i = 0; i < N; i++) sy[i] = clamp(sy[i] + sv[i] * dt, -H * 0.3, H * 0.3);
    }

    function pathSurface(lift = 0, wob = 0, tt = 0) {
      g.beginPath();
      g.moveTo(PX[0], H - PY[0] + lift * PC[0]);
      for (let j = 1; j < S; j++) {
        const yv = H - PY[j] + (lift + (wob ? Math.sin(j * 0.21 + tt * 1.3) * wob : 0)) * PC[j];
        const ypv = H - PY[j - 1] + (lift + (wob ? Math.sin((j - 1) * 0.21 + tt * 1.3) * wob : 0)) * PC[j - 1];
        g.quadraticCurveTo(PX[j - 1], ypv, (PX[j - 1] + PX[j]) / 2, (ypv + yv) / 2);
      }
      g.lineTo(PX[S - 1], H - PY[S - 1] + lift * PC[S - 1]);
    }
    function pathBody(lift = 0, wob = 0, tt = 0) { pathSurface(lift, wob, tt); g.lineTo(PX[S - 1], H + 4); g.lineTo(PX[0], H + 4); g.closePath(); }

    function drawMascot(dt, now, fs) {
      if (!M) return;
      const crestU = fs.F - W * 0.1;
      const targetU = fs.mode === "in" ? Math.min(crestU, W * 0.5) : fs.mode === "rest" ? W * 0.5 : W * (0.5 - 0.68 * fs.e);
      mascot.u += (targetU - mascot.u) * Math.min(1, dt * (fs.mode === "in" ? 14 : 6));
      const x = dir > 0 ? mascot.u : W - mascot.u;
      const surfY = H - heightAt(x);
      mascot.v += ((surfY - mascot.y) * 38 - mascot.v * 7) * dt;
      const prevAbove = mascot.y < surfY - 6;
      mascot.y += mascot.v * dt;
      if (prevAbove && mascot.y >= surfY - 6 && mascot.v > 250) { kick(x, mascot.v * 0.9, 4); for (let i = 0; i < 12; i++) spray.push({ x: x + (Math.random() - 0.5) * 50, y: surfY, vx: (Math.random() - 0.5) * 240, vy: -120 - Math.random() * 260, r: 1 + Math.random() * 2.2, life: 1 }); }
      const sl = (heightAt(x + 24) - heightAt(x - 24)) / 48;
      mascot.rot += (clamp(-Math.atan(sl) * 0.8, -0.35, 0.35) - mascot.rot) * Math.min(1, dt * 8);
      const iw = clamp(Math.min(W, H) * 0.16, 96, 150), ih = iw * (M.RATIO || 0.84), sink = 0.7;
      if (now > nextBlink + t0 && now > blinkUntil) { blinkUntil = now + 140; nextBlink = now - t0 + 2600 + Math.random() * 2400; }
      const frame = now < blinkUntil && (mood === "happy" || mood === "excited") ? img.blink : img[mood] || img.happy;
      if (frame.complete && frame.naturalWidth) {
        g.save();
        g.globalAlpha = fs.mode === "out" ? 1 - smooth((fs.q - 0.6) / 0.35) : 1;
        g.translate(x, mascot.y); g.rotate(mascot.rot);
        g.drawImage(frame, -iw / 2, -ih * sink, iw, ih);
        g.restore();
      }
      Object.assign(mascot, { x, top: mascot.y - ih * sink, iw, ih, shown: x > -iw && x < W + iw });
    }

    function draw(ms, now, fs, dt) {
      const tt = ms / 1000;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      let maxH = 0; for (let j = 0; j < S; j++) if (PY[j] > maxH) maxH = PY[j];
      if (maxH < 1 && fs.mode === "out" && fs.q >= 1) return false;
      const top = H - full * 1.25;

      pathBody(-12, 7, tt + 3);
      g.fillStyle = "rgba(120,190,212,0.22)"; g.fill();
      drawMascot(dt, now, fs);

      pathBody();
      if (!bodyGrad) {
        bodyGrad = g.createLinearGradient(0, top, 0, H);
        bodyGrad.addColorStop(0, "rgba(78,170,200,0.58)"); bodyGrad.addColorStop(0.15, "rgba(46,140,186,0.62)");
        bodyGrad.addColorStop(0.55, "rgba(20,96,150,0.66)"); bodyGrad.addColorStop(1, "rgba(8,46,88,0.7)");
      }
      g.fillStyle = bodyGrad; g.fill();

      g.save(); g.clip();
      pathSurface(10); g.strokeStyle = "rgba(170,228,242,0.20)"; g.lineWidth = 26; g.stroke();
      if (cpat) {
        og.setTransform(1, 0, 0, 1, 0, 0); og.globalCompositeOperation = "source-over"; og.clearRect(0, 0, off.width, off.height);
        og.globalAlpha = 0.9; og.fillStyle = cpat;
        og.setTransform(0.55, 0, 0, 0.55, (tt * 9) % 70, (tt * 5) % 70); og.fillRect(-140, -140, off.width / 0.55 + 280, off.height / 0.55 + 280);
        og.globalCompositeOperation = "lighter"; og.globalAlpha = 0.6;
        og.setTransform(0.8, 0, 0, 0.8, -(tt * 7) % 102, (tt * 8) % 102); og.fillRect(-140, -140, off.width / 0.8 + 280, off.height / 0.8 + 280);
        og.setTransform(1, 0, 0, 1, 0, 0); og.globalAlpha = 1; og.globalCompositeOperation = "destination-in";
        const cg = og.createLinearGradient(0, (H - maxH) / 3, 0, H / 3);
        cg.addColorStop(0, "rgba(0,0,0,0.9)"); cg.addColorStop(0.35, "rgba(0,0,0,0.35)"); cg.addColorStop(1, "rgba(0,0,0,0)");
        og.fillStyle = cg; og.fillRect(0, 0, off.width, off.height);
        g.globalCompositeOperation = "screen"; g.globalAlpha = 0.5; g.drawImage(off, 0, 0, W, H);
        g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
      }
      for (let k = 0; k < 3; k++) {
        const bx = (((k * 0.31 + tt * 0.012 * (k % 2 ? 1 : -1)) % 1) + 1) % 1 * W, wdt = 50 + (k % 3) * 35;
        g.fillStyle = `rgba(200,240,255,${(0.06 + 0.03 * Math.sin(tt * 0.9 + k)).toFixed(3)})`;
        g.beginPath(); g.moveTo(bx, H - maxH - 10); g.lineTo(bx + wdt, H - maxH - 10); g.lineTo(bx + wdt * 2.2 + 120, H); g.lineTo(bx + 90, H); g.closePath(); g.fill();
      }
      g.restore();

      pathSurface(3); g.strokeStyle = "rgba(255,255,255,0.14)"; g.lineWidth = 3; g.stroke();
      pathSurface(); g.strokeStyle = "rgba(232,248,255,0.78)"; g.lineWidth = 1.3; g.stroke();

      g.lineCap = "round";
      for (let j = 1; j < S; j++) {
        const f = (PF[j] + PF[j - 1]) / 2;
        if (f < 0.12) continue;
        g.strokeStyle = `rgba(255,255,255,${(f * 0.8).toFixed(3)})`; g.lineWidth = 1.5 + f * 7;
        g.beginPath(); g.moveTo(PX[j - 1], H - PY[j - 1] + f * 2); g.lineTo(PX[j], H - PY[j] + f * 2); g.stroke();
        if (foam.length < FOAM_MAX && Math.random() < f * 0.35) foam.push({ x: PX[j] + (Math.random() - 0.5) * 8, d: Math.random() * (4 + f * 14), r: 0.8 + Math.random() * (1.4 + f * 2.4), life: 1, decay: 0.25 + Math.random() * 0.45, stuck: 0 });
      }
      g.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = foam.length - 1; i >= 0; i--) {
        const p = foam[i];
        p.life -= p.decay * dt * (p.stuck ? 2.2 : 1);
        if (p.life <= 0) { foam.splice(i, 1); continue; }
        const sy2 = H - heightAt(p.x);
        if (!p.stuck) { p.x += dir * (fs.mode === "in" ? 160 : fs.mode === "out" ? -120 : 6) * dt * (0.3 + Math.random() * 0.7); p.y = sy2 + p.d; if (fs.mode === "out" && sy2 > p.y + 6) p.stuck = 1; }
        else if (sy2 < p.y) p.stuck = 0;
        g.globalAlpha = p.life; g.beginPath(); g.ellipse(p.x, p.y, p.r * 1.6, p.r, 0, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      for (let i = spray.length - 1; i >= 0; i--) {
        const p = spray[i];
        p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.2;
        if (p.life <= 0 || (p.vy > 0 && p.y > H - heightAt(p.x) + 2)) { spray.splice(i, 1); continue; }
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU);
        g.fillStyle = `rgba(236,248,253,${(p.life * 0.85).toFixed(3)})`; g.fill();
      }
      return true;
    }

    // the card appears once and stays put (no chasing a bobbing button), always fully on screen
    function placeCard(fs, now) {
      const ms = now - t0;
      if (!done && !cardShownAt && fs.mode !== "out" && ms > CARD_AT && mascot.shown && mascot.top) { cardShownAt = now; card.style.opacity = "1"; card.style.pointerEvents = "auto"; }
      if (!cardShownAt || cardLocked || !mascot.top) return;
      if (fs.mode === "in") { /* follow until the wave settles, then lock */ } else cardLocked = true;
      const cw = card.offsetWidth || 292, ch = card.offsetHeight || 120, restTop = H - full - (mascot.ih || 100) * 0.75;
      const mTop = fs.mode === "in" ? mascot.top : Math.min(mascot.top, restTop);
      let tx, ty, side = "";
      if (W < 560) { tx = (W - cw) / 2; ty = clamp(mTop - ch - 14, 12, H - ch - 12); side = mTop - ch - 14 >= 12 ? "" : "none"; }
      else if (mTop - ch - 16 >= 12) { tx = clamp(mascot.x - cw / 2, 12, W - cw - 12); ty = mTop - ch - 16; }
      else {
        const cy = mTop + mascot.ih * 0.4;
        side = mascot.x + mascot.iw / 2 + 16 + cw <= W - 12 ? "left" : "right";
        tx = side === "left" ? mascot.x + mascot.iw / 2 + 16 : mascot.x - mascot.iw / 2 - 16 - cw;
        tx = clamp(tx, 12, W - cw - 12);
        ty = clamp(cy - ch / 2, 12, H - ch - 12);
      }
      if (card.dataset.tail !== side) card.dataset.tail = side;
      cardPos = { x: tx, y: ty };
      card.style.transform = `translate(${cardPos.x.toFixed(1)}px, ${cardPos.y.toFixed(1)}px)`;
      card.style.setProperty("--tail", `${clamp(mascot.x - cardPos.x, 22, cw - 22).toFixed(0)}px`);
      card.style.setProperty("--tailY", `${clamp(mTop + mascot.ih * 0.4 - cardPos.y, 20, ch - 20).toFixed(0)}px`);
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const ms = now - t0;
      if (!leaveAt && cardShownAt && now - cardShownAt > hold) say("I'll check back soon.", "calm", () => { onAction("ignored"); leave(); }, 900);
      const fs = frontState(ms, now);
      if (!reflected && fs.mode === "rest") {
        reflected = true; mood = "happy";
        if (!calm) { const wall = dir > 0 ? W : 0; for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * W, d = (x - wall) / (W * 0.1); sy[i] += full * 0.16 * Math.exp(-d * d); } }
      }
      if (fs.mode === "in" && !calm && fs.p < 0.92) {
        const cu = fs.F - W * 0.06, cx = dir > 0 ? cu : W - cu;
        for (let i = 0; i < (lowEnd ? 2 : 4); i++) spray.push({ x: cx + (Math.random() - 0.3) * 40 * dir, y: H - heightAt(cx) - Math.random() * 10, vx: dir * (180 + Math.random() * 380), vy: -(120 + Math.random() * 360), r: 0.8 + Math.random() * 2.2, life: 0.7 + Math.random() * 0.4 });
      }
      const mvy = mouse.y - pm.y; pm = { ...mouse };
      if (!calm && mvy && Math.abs(mouse.y - (H - heightAt(mouse.x))) < 24) kick(mouse.x, clamp(-mvy * 20, -300, 300));
      const dt = Math.min(1 / 30, (now - last) / 1000); last = now; acc += dt;
      while (acc > 1 / 120) { physics(1 / 120, fs); acc -= 1 / 120; }
      frameNo++;
      if (lowEnd && frameNo % 2 && fs.mode === "rest") return placeCard(fs, now); // ~30 fps while it rests
      sample(ms, fs);
      if (!draw(ms, now, fs, dt) || (fs.mode === "out" && fs.q >= 1 && !foam.length && !spray.length)) return cleanup();
      placeCard(fs, now);
    }

    function say(text, m, then, ms = 1100) {
      if (done) return;
      done = true;
      card.classList.add("done");
      card.querySelector(".wt").textContent = text;
      mood = m;
      setTimeout(() => { card.style.opacity = "0"; card.style.pointerEvents = "none"; }, ms - 300);
      setTimeout(then, ms);
    }
    function leave() {
      if (leaveAt) return;
      done = true; leaveAt = performance.now();
      card.style.opacity = "0"; card.style.pointerEvents = "none";
      mood = mood === "proud" ? "proud" : "calm";
      if (!calm) whoosh(vol * 0.5, 3, 1.2, 700, 500, 180);
    }

    card.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b || done) return;
      if (b.dataset.w === "drank") {
        card.querySelector(".dots").innerHTML = dots(glass);
        card.querySelector(".sub").textContent = glass >= goal ? `${glass} of ${goal}, goal reached!` : `${glass} of ${goal} today · ${amount(opts, glass)}`;
        mascot.v = -760;
        glug(vol);
        say(glass >= goal ? "That's your goal for today. Lovely." : "Glug glug. Proud of you.", "proud", () => { onAction("drank"); leave(); }, 1500);
      } else say("Okay, back in 10 minutes.", "wink", () => { onAction("later"); leave(); }, 1000);
    });

    const onMove = (e) => { mouse = { x: e.clientX, y: e.clientY }; };
    const onWheel = (e) => { if (calm) return; const a = Math.min(200, Math.abs(e.deltaY)) * 1.2, p = Math.random() * 6; for (let i = 0; i < N; i++) sv[i] += Math.sin(i * 0.28 + p) * a; };
    const onKey = (e) => { if (e.key === "Escape" && !done) { onAction("dismissed"); leave(); } };
    addEventListener("mousemove", onMove, { passive: true });
    addEventListener("resize", size);
    addEventListener("wheel", onWheel, { passive: true });
    addEventListener("keydown", onKey, true);

    function cleanup() {
      cancelAnimationFrame(raf);
      removeEventListener("mousemove", onMove);
      removeEventListener("resize", size);
      removeEventListener("wheel", onWheel);
      removeEventListener("keydown", onKey, true);
      if (wrap.isConnected) { wrap.remove(); api.onEnd?.(); }
    }

    raf = requestAnimationFrame(frame);
    const api = { leave: (o = {}) => (o.now ? cleanup() : leave()), onEnd: null };
    return api;
  }

  globalThis.BrinkyWater = { start };
})();
