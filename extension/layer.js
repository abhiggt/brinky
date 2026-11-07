// Brinky's in-page layer. Injected only when something is about to appear, never kept on idle pages.
// Everything here animates with transform and opacity only, so the compositor does the work and the page's
// main thread stays free. Every overlay removes itself on a timer, even if the extension stops answering.
// Classic script → globalThis.BrinkyLayer. Works in web pages, extension pages and the website demo.
(() => {
  if (globalThis.BrinkyLayer) return;

  const ENV = globalThis.BrinkyEnv || {
    asset: (p) => { try { return chrome.runtime.getURL(p); } catch { return p; } },
    send: (m) => { try { return chrome.runtime.sendMessage(m).catch(() => {}); } catch { return Promise.resolve(); } },
  };
  const EYES = globalThis.BrinkyEyes;
  const P = () => globalThis.__brinkyPtr || { x: -1, y: -1, k: 0 };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowEnd = (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2; // only genuinely weak machines get the lighter version
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
  const decode = (srcs) => Promise.all(srcs.map((s) => { const i = new Image(); i.src = s; return (i.decode?.() || Promise.resolve()).catch(() => {}); }));

  // ───────────────────────── styles (scoped in a closed shadow root) ─────────────────────────
  // Brinky's brand: paper and ink, one blue, one calm, round typeface (Figtree). No gradients; Brinky is the only rendered thing.
  const CSS = `
  :host{all:initial;
    --paper:#F7F6F2;--card:#FFFFFF;--ink:#15171B;--ink2:#4A4D55;--ink3:#8A8C92;--line:rgba(21,23,27,.1);--line2:rgba(21,23,27,.18);
    --blue:#1E8FF2;--veil:rgba(247,246,242,.88);--shadow:0 24px 60px -24px rgba(21,23,27,.35),0 0 0 1px rgba(21,23,27,.08);
    --pxline:#15171B;--pxpaper:#FBFAF7;--pxglass:rgba(205,232,255,.75);
    --serif:"Brinky Sans","Figtree",-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
    --sans:"Brinky Sans","Figtree",-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
  :host([data-t="dark"]){--paper:#121316;--card:#1D1E23;--ink:#F1EEE7;--ink2:#B3B0A9;--ink3:#7E7C77;--line:rgba(241,238,231,.1);--line2:rgba(241,238,231,.2);
    --blue:#3EA2FF;--veil:rgba(18,19,22,.88);--shadow:0 24px 60px -24px rgba(0,0,0,.7),0 0 0 1px rgba(241,238,231,.1);--pxline:#F1EEE7;--pxpaper:#1D1E23;--pxglass:rgba(120,160,210,.35)}
  @media (prefers-color-scheme:dark){:host(:not([data-t="light"])){--paper:#121316;--card:#1D1E23;--ink:#F1EEE7;--ink2:#B3B0A9;--ink3:#7E7C77;--line:rgba(241,238,231,.1);--line2:rgba(241,238,231,.2);
    --blue:#3EA2FF;--veil:rgba(18,19,22,.88);--shadow:0 24px 60px -24px rgba(0,0,0,.7),0 0 0 1px rgba(241,238,231,.1);--pxline:#F1EEE7;--pxpaper:#1D1E23;--pxglass:rgba(120,160,210,.35)}}
  *{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;font-family:var(--sans);letter-spacing:-.006em}
  img{display:block;user-select:none;-webkit-user-drag:none}
  .paper{background:var(--card);color:var(--ink);box-shadow:var(--shadow)}
  button{all:unset;box-sizing:border-box;cursor:pointer}
  .b{font:500 13.5px/1 var(--sans);padding:10px 15px;border-radius:999px;box-shadow:inset 0 0 0 1px var(--line2);color:var(--ink);
    text-align:center;white-space:nowrap;transition:transform .2s ease,box-shadow .2s ease}
  .b:hover{box-shadow:inset 0 0 0 1px var(--ink)}
  .b:active{transform:scale(.97)}
  .b.p{background:var(--ink);color:var(--paper);box-shadow:none}
  .b:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
  .row{display:flex;gap:8px;flex-wrap:wrap}
  .out{opacity:0!important;transition:opacity .45s ease!important}
  .serif{font-family:var(--sans);font-weight:600;letter-spacing:-.03em}
  .k{font:500 11px/1 var(--sans);letter-spacing:.12em;text-transform:uppercase;color:var(--ink3)}

  /* the note beside your cursor */
  .chip{position:fixed;left:0;top:0;display:flex;align-items:center;gap:7px;padding:8px 13px;border-radius:999px;background:var(--card);color:var(--ink);
    font:500 13px/1 var(--sans);white-space:nowrap;pointer-events:none;will-change:transform;box-shadow:0 10px 24px -10px rgba(21,23,27,.4),0 0 0 1px var(--line);
    animation:pop .35s cubic-bezier(.2,.9,.3,1.2)}
  .chip b{font-variant-numeric:tabular-nums;color:var(--blue);font-weight:600}
  @keyframes pop{from{opacity:0;scale:.9}}

  /* a note in the corner */
  .note{position:fixed;top:16px;right:16px;width:350px;max-width:calc(100vw - 32px);border-radius:24px;padding:18px 18px 18px 16px;
    display:flex;gap:14px;pointer-events:auto;animation:slidein .7s cubic-bezier(.2,1.1,.3,1)}
  .note .me{width:58px;flex:none;margin-top:4px}
  .note .ttl{font:600 19px/1.15 var(--sans);letter-spacing:-.03em;margin-top:6px}
  .note .drops{margin:0 0 14px}
  .note p{font-size:13.5px;color:var(--ink2);line-height:1.45;margin:4px 0 13px}
  .note.bye{animation:slideout .45s ease-in forwards}
  .recap{width:360px}
  .recap .ttl{margin-top:6px}
  .nums{display:flex;gap:18px;margin:12px 0 2px}
  .nums span{font-size:12.5px;color:var(--ink3)}
  .nums b{display:block;font:600 24px/1.1 var(--sans);letter-spacing:-.03em;color:var(--ink);font-variant-numeric:tabular-nums}
  @keyframes slidein{from{transform:translateX(calc(100% + 24px));opacity:.6}}
  @keyframes slideout{to{transform:translateX(calc(100% + 24px));opacity:.4}}

  /* the little glass that lands on your cursor */
  .tum{position:fixed;left:0;top:0;pointer-events:none;will-change:transform}
  .tg{position:relative;width:calc(14px * var(--p,2));height:calc(18px * var(--p,2));transform-origin:50% 100%;filter:drop-shadow(0 4px 6px rgba(21,23,27,.18))}
  .tg svg{display:block;width:100%;height:100%;overflow:visible}
  .tg .wat{transform-box:fill-box;transform-origin:50% 100%;transition:transform 1.4s cubic-bezier(.5,0,.5,1)}
  .tum.drain .tg .wat{transform:scaleY(0)}
  .tg .surf{animation:slosh 2.2s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:center}
  @keyframes slosh{from{transform:rotate(-4deg)}to{transform:rotate(4deg)}}
  .px{position:absolute;left:calc(14px * var(--p,2) + 14px);top:-22px;width:max-content;max-width:230px;padding:12px 14px 13px;border-radius:16px;
    pointer-events:none;opacity:0;transform:translateY(6px) scale(.97);transform-origin:0 50%;transition:opacity .35s ease,transform .45s cubic-bezier(.2,.9,.3,1.2)}
  .tum.left .px{left:auto;right:calc(14px * var(--p,2) + 14px);transform-origin:100% 50%}
  .tum.landed .px{opacity:1;transform:none;pointer-events:auto}
  .px p{font:600 14px/1.25 var(--sans);letter-spacing:-.02em}
  .px small{display:block;font-size:12.5px;color:var(--ink2);margin:3px 0 10px;line-height:1.4}
  .px .b{font-size:12.5px;padding:8px 12px}
  .spl{position:absolute;width:5px;height:5px;border-radius:50%;background:#5BB6FF;left:calc(7px * var(--p,2) - 2.5px);top:2px;animation:spl .75s cubic-bezier(.2,.7,.4,1) forwards}
  @keyframes spl{0%{transform:translate(0,0) scale(1)}50%{transform:translate(var(--dx),var(--dy)) scale(1)}100%{transform:translate(calc(var(--dx) * 1.4),22px) scale(.4);opacity:0}}

  /* the wave: a live ocean swell drawn on two canvases, far water behind Brinky and near water in front */
  .wave{position:fixed;inset:0;pointer-events:none;overflow:hidden;contain:strict}
  .wave canvas{position:absolute;left:0;bottom:0;width:100%;display:block}
  .ride{position:absolute;left:0;top:0;width:112px;will-change:transform}
  .flat{display:none}
  .is-flat .flat{display:block;position:absolute;left:0;right:0;bottom:0;height:var(--sh,38vh);background:linear-gradient(rgba(92,186,249,.5),rgba(20,110,200,.6));
    box-shadow:inset 0 2px 0 rgba(255,255,255,.75);transform:translateY(105%);transition:transform 1.6s cubic-bezier(.2,.8,.3,1)}
  .is-flat .ride{opacity:0;transition:opacity .6s .9s}
  .is-flat.up .flat{transform:none}
  .is-flat.up .ride{opacity:1}
  .wcard{position:absolute;bottom:var(--cb,50vh);left:calc(clamp(18px,20vw,340px) + 132px);width:310px;max-width:calc(100vw - 32px);
    border-radius:22px;padding:18px 18px 18px;pointer-events:none;opacity:0;transform:translateY(10px);transition:opacity .45s ease,transform .5s cubic-bezier(.2,.9,.3,1.1)}
  .wcard.on{opacity:1;transform:none;pointer-events:auto}
  .wcard .ttl{font:600 23px/1.05 var(--sans);letter-spacing:-.03em;margin-top:8px}
  .wcard p{font-size:13.5px;line-height:1.45;color:var(--ink2);margin:5px 0 12px}
  .drops{display:flex;gap:3px;margin:0 0 14px}
  .drops i{flex:1;max-width:26px;height:14px;border-radius:3px 3px 5px 5px;box-shadow:inset 0 0 0 1px var(--line2)}
  .drops i.f{background:var(--blue);box-shadow:none}
  @media (max-width:620px){.wcard{left:16px;right:16px;width:auto}}

  /* eye break: the page stays softly visible behind a paper-coloured veil */
  .eb{position:fixed;inset:0;pointer-events:auto;color:var(--ink);display:grid;grid-template-rows:auto 1fr auto;justify-items:center;
    padding:clamp(32px,8vh,80px) 24px clamp(28px,6vh,56px);text-align:center;opacity:0;transition:opacity .8s ease;
    -webkit-backdrop-filter:blur(20px) saturate(105%);backdrop-filter:blur(20px) saturate(105%)}
  .eb.on{opacity:1}
  .scrim{position:absolute;inset:0;background:var(--veil)}
  .eb.lite{-webkit-backdrop-filter:none;backdrop-filter:none}
  .lite .scrim{background:var(--paper);opacity:.96}
  .scrim::after{content:"";position:absolute;inset:0;background:#07080A;opacity:0;transition:opacity 2.6s ease}
  .eb.dark .scrim::after{opacity:.9}
  .eb.dark{color:#F1EEE7;transition:color 2s ease,opacity .8s ease}
  .eb.dark .top,.eb.dark .bot{opacity:.5;transition:opacity 2s ease}
  .eb.dark .k,.eb.dark .step,.eb.dark .why,.eb.dark .t small{color:rgba(241,238,231,.6)}
  .eb.dark .b{color:#F1EEE7;box-shadow:inset 0 0 0 1px rgba(241,238,231,.25)}
  .eb.dark .prog{background:rgba(241,238,231,.15)}.eb.dark .prog i{background:#F1EEE7}
  .eb.away .top{opacity:.75}
  .eb.away .bot{opacity:.18}
  .top,.bot,.stage{position:relative}
  .top h1{font:600 clamp(34px,5vw,54px)/1 var(--sans);letter-spacing:-.03em;margin-top:14px}
  .step{font:600 clamp(17px,2vw,22px)/1.3 var(--sans);color:var(--ink2);margin-top:14px;min-height:1.3em;max-width:26em;transition:opacity .5s ease}
  .step.fade{opacity:0}
  .stage{width:min(76vw,860px);height:100%;min-height:200px;max-height:440px;align-self:center}
  .mv{position:absolute;left:50%;top:50%;width:150px;margin:-70px 0 0 -75px;will-change:transform}
  .bot{display:flex;flex-direction:column;align-items:center;gap:16px}
  .t{display:flex;align-items:baseline;gap:8px}
  .t b{font:600 40px/1 var(--sans);font-variant-numeric:tabular-nums;letter-spacing:-.03em}
  .t small{font-size:12.5px;color:var(--ink3)}
  .prog{width:220px;height:2px;border-radius:2px;background:var(--line);overflow:hidden}
  .prog i{display:block;height:100%;background:var(--ink);transform-origin:left}
  .why{font-size:13px;color:var(--ink3);max-width:34em}
  .done{position:absolute;inset:0;display:grid;place-items:center;align-content:center;gap:12px;opacity:0;transition:opacity .6s ease;pointer-events:none}
  .done .me{width:150px;margin:0 auto 6px}
  .done h2{font:600 37px/1.05 var(--sans);letter-spacing:-.03em}
  .done p{color:var(--ink2);font-size:16px}
  .done .row{justify-content:center;margin-top:8px;pointer-events:auto}
  .eb.fin .done{opacity:1}
  .eb.fin .top,.eb.fin .stage,.eb.fin .bot{opacity:0;transition:opacity .5s ease}
  @media (prefers-reduced-motion:reduce){.bob,.surf{animation:none}.note{animation:none}}
  `;
  // Brinky's typefaces, loaded into the page once (the shadow root can't load fonts itself)
  let fontsIn = false;
  function fonts() {
    if (fontsIn || ENV.fonts === false) return; fontsIn = true;
    try {
      const st = document.createElement("style"); st.setAttribute("data-brinky-fonts", "");
      st.textContent = `@font-face{font-family:"Brinky Sans";src:url("${ENV.asset("fonts/figtree.woff2")}") format("woff2");font-weight:300 900;font-display:swap}`;
      document.documentElement.appendChild(st);
    } catch {}
  }
  // a live Brinky (blank drop + drawn face) inside the shadow root
  function brinky(host, mood = "neutral") {
    const F = globalThis.BrinkyFace; if (!F) return null;
    if (!R().querySelector("style[data-bf]")) F.style(R());
    return F.mount(host, { src: ENV.asset("mascot/blank.webp"), mood });
  }

  // ───────────────────────── root ─────────────────────────
  let host, root;
  function R(theme) {
    if (!root || !host.isConnected) {
      host = document.createElement("brinky-root");
      host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:block";
      root = host.attachShadow({ mode: "closed" });
      const st = document.createElement("style");
      st.textContent = CSS;
      root.appendChild(st);
      document.documentElement.appendChild(host);
    }
    if (theme && theme !== "auto") host.setAttribute("data-t", theme); else host?.removeAttribute("data-t");
    fonts();
    return root;
  }
  const add = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); const n = t.content.firstElementChild; R().appendChild(n); return n; };
  function tidy() { if (root && root.childElementCount <= 1) { host.remove(); host = root = null; } }

  // ───────────────────────── sound (opened only when needed, closed right after) ─────────────────────────
  // Sounds are soft and watery, never beeps: a few droplets (a rising "plip", the way real drops ring),
  // one white-noise whoosh for the wave, and a quiet bell when a break ends.
  let actx, actxT;
  function ac(hold = 5000) {
    try { actx ||= new AudioContext(); if (actx.state === "suspended") actx.resume(); } catch { return null; }
    clearTimeout(actxT);
    actxT = setTimeout(() => { try { actx?.close(); } catch {} actx = null; }, Math.max(5000, hold));
    return actx;
  }
  let volMul = 1;
  const V = (v) => Math.min(0.25, v * volMul);
  const bufs = {};
  function noise(c, kind) { // two seconds of brown (deep, like surf) or white (bright, like foam) noise, made once
    if (bufs[kind] && bufs[kind].sampleRate === c.sampleRate) return bufs[kind];
    const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (kind === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return (bufs[kind] = b);
  }
  function env(g, t, peak, a, hold, rel) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  }
  function drop(at, vol, f0 = 950) { // a single water drop
    const c = ac(); if (!c || V(vol) <= 0) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 2.4, t + 0.055);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(V(vol), t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.14);
  }
  function bell(f, at, dur, vol) { // a soft bell: a pure tone and a quiet overtone, slow to fade
    const c = ac(); if (!c || V(vol) <= 0) return;
    for (const [m, k] of [[1, 1], [2.76, 0.18]]) {
      const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = f * m;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(V(vol * k), t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * (m > 1 ? 0.4 : 1));
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  // the wave's only sound: one soft white-noise whoosh, like a swell rolling in. No droplets, no rumble.
  function whoosh(at, dur, vol) {
    const c = ac((at + dur) * 1000 + 600); if (!c || V(vol) <= 0) return;
    const t = c.currentTime + at, src = c.createBufferSource(); src.buffer = noise(c, "white"); src.loop = true;
    const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 380; hp.Q.value = 0.5;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.4;
    const N = 64, shape = new Float32Array(N), sweep = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = i / (N - 1), k = Math.pow(Math.sin(Math.PI * Math.pow(x, 0.8)), 1.6); shape[i] = Math.max(0.0001, V(vol) * k); sweep[i] = 700 + 2300 * k; }
    lp.frequency.setValueCurveAtTime(sweep, t, dur);
    const g = c.createGain(); g.gain.setValueCurveAtTime(shape, t, dur);
    let out = g;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.setValueAtTime(-0.35, t); p.pan.linearRampToValueAtTime(0.35, t + dur); g.connect(p); out = p; }
    src.connect(hp).connect(lp).connect(g); out.connect(c.destination); src.start(t); src.stop(t + dur + 0.05);
  }
  const SND = {
    chime: () => { bell(659.25, 0, 2.4, 0.06); bell(987.77, 0.22, 2.6, 0.04); },
    wave: () => whoosh(0, 2.8, 0.03),
    ebb: () => whoosh(0, 3.6, 0.016),
    splash: () => { drop(0, 0.05, 520); drop(0.12, 0.03, 900); drop(0.24, 0.022, 1150); },
    drip: () => { drop(0, 0.04, 820); drop(0.2, 0.028, 1040); },
    gulp: () => { drop(0, 0.04, 600); drop(0.22, 0.035, 520); drop(0.44, 0.03, 460); },
    tick: () => drop(0, 0.02, 1300),
  };

  let soundOn = true;
  const play = (k) => { if (soundOn) try { SND[k](); } catch {} };

  // ───────────────────────── the cursor: blink, stretch ─────────────────────────
  // Cursor art on a 64 px canvas: the arrow keeps its normal size (hotspot 3,2), and what rides with it is
  // sized against the pointer: the stretching figure is about twice the arrow's height, the eye a little wider.
  const svg = (inner) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${inner}</svg>`)}`;
  const ARROW = (o = 1) => `<path opacity="${o}" d="M3 2.5v19.2l4.9-4.6 3.2 7.3 3.3-1.4-3.1-7.1h6.6z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>`;
  const EYE_OPEN = `<g transform="translate(18 20)"><path d="M1 12q13-13 26 0q-13 13-26 0z" fill="#fff" stroke="#fff" stroke-width="4"/><path d="M1 12q13-13 26 0q-13 13-26 0z" fill="#fff" stroke="#1E8FF2" stroke-width="2"/><circle cx="14" cy="12" r="5" fill="#1E8FF2"/><circle cx="15.8" cy="10.2" r="1.5" fill="#fff"/></g>`;
  const EYE_SHUT = `<g transform="translate(18 20)"><path d="M1 11q13 11 26 0" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M1 11q13 11 26 0" fill="none" stroke="#1E8FF2" stroke-width="2.4" stroke-linecap="round"/><path d="M6 16.5l-1.6 2.6M14 18.6v3M22 16.5l1.6 2.6" stroke="#1E8FF2" stroke-width="2" stroke-linecap="round"/></g>`;
  // The stretch: the arrow reaches up from its tip, bends to one side and the other, and settles.
  // Drawn 10 px lower on the canvas (hotspot 3,12) so there's room for two little "reach" marks above the tip.
  // [scaleX, scaleY, lean in degrees, marks]
  const STRETCH = [[1, 1, 0, 0], [0.96, 1.14, 0, 0], [0.92, 1.3, 0, 1], [0.88, 1.46, 0, 1], [0.88, 1.46, -9, 1], [0.88, 1.46, 9, 1], [1.05, 0.93, 0, 0]];
  const TALL = ([sx, sy, lean, marks]) => {
    const base = 2.5 + 22 * sy; // where the arrow's tail ends, after stretching
    return `<g transform="translate(0 10)"><g transform="rotate(${lean} 8 ${base.toFixed(1)})">`
      + `<path transform="translate(3 2.5) scale(${sx} ${sy}) translate(-3 -2.5)" vector-effect="non-scaling-stroke" d="M3 2.5v19.2l4.9-4.6 3.2 7.3 3.3-1.4-3.1-7.1h6.6z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>`
      + (marks ? `<g fill="none" stroke-linecap="round"><path d="M-.5 -1.5l-2.2-3.4M3 -2.4v-4.6M6.5 -1.5l2.2-3.4" stroke="#fff" stroke-width="3.2"/><path d="M-.5 -1.5l-2.2-3.4M3 -2.4v-4.6M6.5 -1.5l2.2-3.4" stroke="#1E8FF2" stroke-width="1.6"/></g>` : "")
      + `</g></g>`;
  };
  // A brisk walk: little legs under the arrow, stepping, with speed marks behind (drawn 10 px lower: hotspot 3,12)
  const LEG = (a1, a2) => { const leg = (x, a) => `<path transform="rotate(${a} 8 20.5)" d="M${x} 20.5l${x < 8 ? -2 : 2} 6.6h${x < 8 ? -2.2 : 2.2}"/>`; return leg(7, a1) + leg(9, a2); };
  const WALK = (a1, a2, bob, dash) => `<g transform="translate(0 ${10 + bob})"><g transform="rotate(5 8 24)">`
    + `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#fff" stroke-width="3.6">${LEG(a1, a2)}</g><g stroke="#111" stroke-width="1.8">${LEG(a1, a2)}</g></g>`
    + `<path d="M3 2.5v19.2l4.9-4.6 3.2 7.3 3.3-1.4-3.1-7.1h6.6z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></g>`
    + `<g stroke-linecap="round" stroke-width="1.5" stroke="#1E8FF2" opacity="${dash}"><path d="M${-2 - dash * 2} 8h-4M${-1 - dash * 2} 13h-5M${-2 - dash * 2} 18h-3"/></g></g>`;
  // A kickabout: a little ball bounces off the arrow's tip (drawn 20 px lower: hotspot 3,22)
  const BALL = (y, rot, squash) => `<g transform="translate(4 20)"><g transform="translate(3 24) scale(${squash ? "1.06 .9" : "1 1"}) translate(-3 -24)">`
    + `<path d="M3 2.5v19.2l4.9-4.6 3.2 7.3 3.3-1.4-3.1-7.1h6.6z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></g>`
    + `<g transform="translate(4.2 ${y}) rotate(${rot})"><circle r="4.4" fill="#fff" stroke="#111" stroke-width="1"/><path d="M0-1.7l1.6 1.1-.6 1.9h-2l-.6-1.9z" fill="#111"/>`
    + `<path d="M0-1.7V-4.2M1.6-.6l2.4-.8M1 1.3l1.4 2M-1 1.3l-1.4 2M-1.6-.6l-2.4-.8" stroke="#111" stroke-width=".6"/></g></g>`;
  const CUR = {
    open: svg(ARROW(1) + EYE_OPEN), shut: svg(ARROW(0.55) + EYE_SHUT),
    tall: STRETCH.map((f) => svg(TALL(f))),
    walk: [[-24, 24, 0, 1], [0, 0, -1, 0.6], [24, -24, 0, 1], [0, 0, -1, 0.6]].map(([a, b, y, d]) => svg(WALK(a, b, y, d))),
    ball: [[-3, 0, 1], [-8, 50, 0], [-11.5, 110, 0], [-13.5, 170, 0], [-11.5, 230, 0], [-8, 290, 0]].map(([y, r, q]) => svg(BALL(y, r, q))),
  };

  let curEl = null;
  function cursorSet(a, b) {
    if (!curEl) { curEl = document.createElement("style"); curEl.setAttribute("data-brinky", ""); }
    curEl.textContent = `html.brinky-ca,html.brinky-ca *{cursor:url("${a}") 3 2,auto!important}html.brinky-cb,html.brinky-cb *{cursor:url("${b}") 3 2,auto!important}`;
    if (!curEl.isConnected) document.documentElement.appendChild(curEl);
  }
  function cursorFrame(f) { const c = document.documentElement.classList; c.toggle("brinky-ca", f === "a"); c.toggle("brinky-cb", f === "b"); }
  function cursorOff() { cursorFrame(null); curEl?.remove(); }
  // many frames: html.brinky-c0 … brinky-cN
  function cursorFrames(list, hx = 3, hy = 2) {
    if (!curEl) { curEl = document.createElement("style"); curEl.setAttribute("data-brinky", ""); }
    curEl.textContent = list.map((u, i) => `html.brinky-c${i},html.brinky-c${i} *{cursor:url("${u}") ${hx} ${hy},auto!important}`).join("");
    if (!curEl.isConnected) document.documentElement.appendChild(curEl);
  }
  let shown = -1;
  function cursorShow(i) { const c = document.documentElement.classList; if (shown >= 0) c.remove(`brinky-c${shown}`); if (i >= 0) c.add(`brinky-c${i}`); shown = i; }

  // a small label that follows the pointer (rAF-throttled, transform only)
  function follower(html) {
    const el = add(`<div class="chip" role="status">${html}</div>`);
    let raf = 0, w = el.offsetWidth, h = el.offsetHeight;
    const place = () => {
      raf = 0;
      const p = P(), px = p.x < 0 ? innerWidth / 2 : p.x, py = p.y < 0 ? innerHeight / 2 : p.y;
      let x = px + 54, y = py + 22; // just past the cursor art
      if (x + w > innerWidth - 8) x = px - w - 14;
      if (y + h > innerHeight - 8) y = py - h - 12;
      el.style.transform = `translate3d(${Math.round(Math.max(8, x))}px,${Math.round(Math.max(8, y))}px,0)`;
    };
    const mv = () => { if (!raf) raf = requestAnimationFrame(place); };
    addEventListener("pointermove", mv, { passive: true, capture: true });
    place();
    return {
      set(html2) { el.innerHTML = html2; w = el.offsetWidth; h = el.offsetHeight; place(); },
      done() { removeEventListener("pointermove", mv, true); cancelAnimationFrame(raf); el.classList.add("out"); setTimeout(() => { el.remove(); tidy(); }, 480); },
    };
  }

  let nudging = false;
  // the cursor blinks `n` times; `label(i)` gives the chip text before blink i
  async function blinkCursor(n, label, mood = "blink") {
    nudging = true;
    cursorSet(CUR.open, CUR.shut);
    const chip = follower(label(0));
    try {
      for (let i = 0; i < n; i++) {
        cursorFrame("a"); chip.set(label(i));
        await sleep(i ? 620 : 520);
        cursorFrame("b");
        await sleep(210);
      }
      cursorFrame("a"); await sleep(320);
    } finally { cursorOff(); chip.done(); nudging = false; }
  }

  // the cursor gets moving for a few seconds: a stretch (reach up, bend left, bend right, settle),
  // a brisk walk, or a little kickabout with a ball
  async function stretchCursor(ms = 9000, text = "stretch a little :)", move = "stretch") {
    nudging = true;
    const kind = CUR[{ walk: "walk", ball: "ball" }[move] || "tall"];
    cursorFrames(kind, 3, move === "ball" ? 22 : 12);
    const chip = follower(`<span>${esc(text)}</span>`);
    const end = Date.now() + ms;
    const seq = move === "walk" ? [[0, 150], [1, 150], [2, 150], [3, 150]]
      : move === "ball" ? [[0, 120], [1, 95], [2, 95], [3, 150], [4, 95], [5, 95]]
      : [[0, 450], [1, 110], [2, 110], [3, 650], [4, 700], [3, 220], [5, 700], [3, 380], [2, 80], [1, 80], [6, 160], [0, 700]];
    try {
      while (Date.now() < end) for (const [f, t] of seq) { cursorShow(f); await sleep(t); }
    } finally { cursorShow(-1); cursorOff(); chip.done(); nudging = false; }
  }

  // ───────────────────────── when to wait ─────────────────────────
  function busy(m) {
    if (m && m.quietFs === false) return "";
    if (document.fullscreenElement) return "fullscreen";
    const area = innerWidth * innerHeight;
    for (const v of document.querySelectorAll("video")) {
      if (!v.paused && !v.ended && v.readyState > 2 && v.offsetWidth * v.offsetHeight > area * 0.3) return "video";
    }
    return "";
  }
  async function afterTyping(maxMs = 20000) {
    const t0 = Date.now(), until = t0 + maxMs;
    while (maxMs > 0 && Date.now() - P().k < 1800 && Date.now() < until) await sleep(500);
    return Date.now() - t0 > 400 ? Date.now() - t0 : 0;
  }

  // ───────────────────────── water: simple card ─────────────────────────
  const live = { water: null, eye: null };

  function dropsRow(n, goal) {
    let s = ""; for (let i = 0; i < Math.min(goal, 16); i++) s += `<i class="${i < n ? "f" : ""}"></i>`;
    return `<div class="drops" aria-hidden="true">${s}</div>`;
  }
  function waterButtons(m) { return `<div class="row"><button class="b p" data-r="drank">I drank a glass</button><button class="b" data-r="later">In ${m.laterMin || 7} min</button></div>`; }

  function card(m, ctl) {
    const el = add(`<div class="note paper" role="dialog" aria-label="Water reminder">
      <div class="me"></div>
      <div style="flex:1;min-width:0"><div class="k">Water</div><div class="ttl">${esc(m.title)}</div><p>${esc(m.body)}</p>${dropsRow(m.glasses || 0, m.goal || 8)}${waterButtons(m)}</div></div>`);
    const me = brinky(el.querySelector(".me"), "neutral"); me?.autoBlink(); play("drip");
    el.addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (b) ctl.answer(b.dataset.r); });
    return {
      thanks(t) { me?.mood("happy"); el.querySelector(".ttl").textContent = t; el.querySelector("p").textContent = "Nice. Back to it."; el.querySelector(".row").remove(); },
      leave() { el.classList.add("bye"); return sleep(460).then(() => { me?.destroy(); el.remove(); }); },
    };
  }

  // ───────────────────────── water: pixel tumbler ─────────────────────────
  // a small glass of water, drawn smooth: rim, a soft highlight, and water that sloshes and drains
  function glassArt() {
    return `<svg viewBox="0 0 28 36" aria-hidden="true"><defs><clipPath id="gq"><path d="M3.4 2.6h21.2l-2.5 29.8q-.3 2.8-3.1 2.8H9q-2.8 0-3.1-2.8z"/></clipPath></defs>
      <path d="M3.4 2.6h21.2l-2.5 29.8q-.3 2.8-3.1 2.8H9q-2.8 0-3.1-2.8z" fill="#FFFFFF" fill-opacity=".72"/>
      <g clip-path="url(#gq)"><g class="wat"><rect x="0" y="12" width="28" height="26" fill="#2F96F5" fill-opacity=".88"/><ellipse class="surf" cx="14" cy="12.2" rx="12" ry="1.8" fill="#8CCBFF"/></g></g>
      <path d="M3.4 2.6h21.2l-2.5 29.8q-.3 2.8-3.1 2.8H9q-2.8 0-3.1-2.8z" fill="none" stroke="#15171B" stroke-opacity=".5" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M7.4 6l1.4 23" stroke="#FFFFFF" stroke-opacity=".9" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  }

  async function tumbler(m, ctl) {
    // land on the cursor; if we don't know where it is yet, wait a moment for it to move
    let p = P();
    if (p.x < 0) { const t = Date.now() + 1500; while (P().x < 0 && Date.now() < t) await sleep(100); p = P(); }
    const px = p.x < 0 ? innerWidth * 0.66 : p.x, py = p.y < 0 ? innerHeight * 0.6 : p.y;
    const k = Math.max(2, Math.min(4, m.px || 3)); // glass scale: 14 x 18 px per step
    const X = Math.round(Math.min(innerWidth - 36, Math.max(36, px)) - 7 * k);
    const Y = Math.round(Math.min(innerHeight - 20, Math.max(120, py)) - 18 * k - 2);
    const el = add(`<div class="tum" style="--p:${k};transform:translate3d(${X}px,${Y}px,0)" role="dialog" aria-label="Water reminder">
      <div class="tg">${glassArt()}</div>
      <div class="px paper"><p>${esc(m.title)}</p><small>${esc(m.body)}</small>
        <div class="row"><button class="b p" data-r="drank">I drank it</button><button class="b" data-r="later">Later</button></div></div></div>`);
    if (X > innerWidth - 280) el.classList.add("left");
    el.addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (b) ctl.answer(b.dataset.r); });
    const g = el.querySelector(".tg");
    if (!reduced()) {
      const fall = g.animate([{ transform: `translateY(${-Y - 90}px)` }, { transform: "translateY(0)" }], { duration: 640, easing: "cubic-bezier(.55,0,.95,.45)" });
      await fall.finished.catch(() => {});
      g.animate([{ transform: "scale(1.16,.82)" }, { transform: "scale(.95,1.06)" }, { transform: "scale(1.02,.98)" }, { transform: "none" }], { duration: 520, easing: "ease-out" });
      for (const [dx, dy] of [[-11, -14], [-6, -20], [7, -21], [12, -13]]) {
        const s = document.createElement("i"); s.className = "spl"; s.style.cssText = `--dx:${dx}px;--dy:${dy}px`; g.appendChild(s); setTimeout(() => s.remove(), 800);
      }
      play("splash");
    }
    el.classList.add("landed");
    return {
      thanks(t) { el.querySelector(".px p").textContent = t; el.querySelector(".px small").textContent = "Lovely. Back to it."; el.querySelector(".px .row").remove(); el.classList.add("drain"); },
      async leave() {
        await sleep(el.classList.contains("drain") ? 1500 : 0);
        const a = g.animate([{ transform: "none", opacity: 1 }, { transform: "translateY(-12px) scale(.9)", opacity: 0 }], { duration: 420, easing: "ease-in", fill: "forwards" });
        el.querySelector(".px").style.opacity = "0";
        await a.finished.catch(() => {});
        el.remove();
      },
    };
  }

  // ───────────────────────── water: the wave ─────────────────────────
  // The screen is a beach. One sheet of sea washes up from the bottom, slows, lingers with its foam edge
  // breathing back and forth, then slides back down slowly, leaving a little foam that melts away.
  // One translucent layer, drawn on one canvas: light enough for any machine, and it lightens itself further
  // if frames run slow. Brinky floats in the shallow water just behind the foam line.
  const RISE = 2800, EBB = 3800, HEAD = 120; // HEAD: room above the water line for the foam edge
  const ease = { out: (x) => 1 - Math.pow(1 - x, 3), inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2) };
  const SHAPE = [[1100, 22, 0.13, 0.7], [520, 13, -0.21, 2.4], [250, 6, 0.34, 4.1], [130, 2.4, -0.5, 1.3]]; // the shore line: [length, height, drift, phase]

  function ocean(cv, o) {
    let cx = null;
    try { cx = cv.getContext("2d"); } catch {}
    if (!cx) return null; // no canvas here: the caller shows a simple version instead
    let lite = lowEnd, dpr = lite ? 1 : Math.min(devicePixelRatio || 1, 1.25), STEP = lite ? 10 : 6;
    let W = 0, H = 0, seaPx = 0;
    const size = () => {
      W = innerWidth; seaPx = Math.round(innerHeight * o.h); H = seaPx + HEAD;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + "px";
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const goLite = () => { if (lite) return; lite = true; dpr = 1; STEP = 10; size(); };
    const shape = SHAPE.map(([len, amp, drift, ph]) => ({ k: (Math.PI * 2) / len, amp, w: drift, ph: ph + o.offset }));
    // the water line at x: a long irregular shore, its scallops slowly shifting
    const line = (x, t, level) => { let y = 0; for (const s of shape) y += s.amp * Math.sin(s.k * x + s.w * t + s.ph); return y * (0.4 + 0.6 * level); };
    // lace: bubbles and thin foam threads that sit at fixed spots behind the water line and travel with it
    const rnd = (a, b) => a + Math.random() * (b - a);
    const bubbles = Array.from({ length: lite ? 70 : 180 }, () => ({ x: rnd(-20, 1.05) , d: Math.pow(Math.random(), 1.8) * 34 + 2, r: rnd(1, 4.2), a: rnd(0.35, 0.9), j: rnd(0, 6.28) }));
    bubbles.forEach((b) => { b.x = rnd(-20, (innerWidth || 1400) + 20); });
    const threads = lite ? [] : Array.from({ length: 22 }, () => ({ x: rnd(-60, (innerWidth || 1400)), len: rnd(60, 220), d: rnd(22, 80), a: rnd(0.18, 0.4), wob: rnd(0, 6.28) }));
    let t0 = performance.now(), last = t0, level = 0, raf = 0, frames = 0, slow = 0, tilt = 0, high = 0;
    const state = { target: 1, from: 0, start: t0, dur: RISE, easing: ease.out };
    function frame(now) {
      const raw = (now - last) / 1000; last = now;
      if (++frames > 20 && raw < 0.5) { slow = slow * 0.9 + (raw > 0.032 ? 0.1 : 0); if (slow > 0.5) goLite(); }
      try { draw(now); } catch (e) { cancelAnimationFrame(raf); o.onfail?.(); return; }
      if (o.still && Math.min(1, (now - state.start) / state.dur) >= 1) return;
      raf = requestAnimationFrame(frame);
    }
    function draw(now) {
      const t = ((now - t0) / 1000) * o.speed;
      const k = Math.min(1, (now - state.start) / state.dur);
      level = state.from + (state.target - state.from) * state.easing(k);
      // once it has arrived, the edge keeps breathing a little, up and back, like the sea at rest
      const breathe = state.target === 1 && k >= 1 ? Math.sin((now - state.start) / 1000 * 1.1) * 7 : 0;
      const base = H + 30 - (H + 30 - HEAD + 26) * level + breathe;
      high = Math.max(high, level);
      cx.clearRect(0, 0, W, H);
      const n = Math.ceil((W + 40) / STEP) + 1, ys = new Float32Array(n);
      for (let i = 0; i < n; i++) ys[i] = base + line(-20 + i * STEP, t, level);
      const yAt = (x) => { const f = (x + 20) / STEP, i = Math.max(0, Math.min(n - 2, Math.floor(f))), r = Math.max(0, Math.min(1, f - i)); return ys[i] + (ys[i + 1] - ys[i]) * r; };
      const op = o.op;
      // the water: thin and clear at the edge, a little deeper and bluer further down
      cx.beginPath(); cx.moveTo(-20, ys[0]);
      for (let i = 1; i < n; i++) cx.lineTo(-20 + i * STEP, ys[i]);
      cx.lineTo(W + 20, H); cx.lineTo(-20, H); cx.closePath();
      const g = cx.createLinearGradient(0, base - 24, 0, H);
      g.addColorStop(0, `rgba(150,222,246,${0.34 * op})`);
      g.addColorStop(0.18, `rgba(84,182,240,${0.44 * op})`);
      g.addColorStop(1, `rgba(22,112,206,${0.6 * op})`);
      cx.fillStyle = g; cx.fill();
      // threads of foam lace drifting just behind the edge
      cx.lineCap = "round";
      for (const th of threads) {
        cx.strokeStyle = `rgba(255,255,255,${th.a * op * Math.min(1, level * 1.4)})`; cx.lineWidth = 1.3;
        cx.beginPath();
        for (let x = th.x, j = 0; x <= th.x + th.len; x += 12, j++) { const y = yAt(x) + th.d + Math.sin(x * 0.03 + th.wob + t * 0.6) * 5; j ? cx.lineTo(x, y) : cx.moveTo(x, y); }
        cx.stroke();
      }
      // bubbles of foam gathered at the edge
      cx.fillStyle = "#fff";
      for (const b of bubbles) {
        const y = yAt(b.x) + b.d + Math.sin(t * 1.3 + b.j) * 1.2;
        cx.globalAlpha = b.a * op * (1 - b.d / 40) * Math.min(1, level * 1.6);
        cx.beginPath(); cx.arc(b.x + Math.sin(t * 0.7 + b.j) * 1.5, y, b.r, 0, 6.283); cx.fill();
      }
      cx.globalAlpha = 1;
      // the foam line itself: a bright, soft edge
      cx.beginPath(); cx.moveTo(-20, ys[0]); for (let i = 1; i < n; i++) cx.lineTo(-20 + i * STEP, ys[i]);
      if (!lite) { cx.strokeStyle = `rgba(255,255,255,${0.28 * op})`; cx.lineWidth = 12; cx.stroke(); }
      cx.strokeStyle = `rgba(255,255,255,${0.95 * op})`; cx.lineWidth = 3.2; cx.stroke();
      // as it slides back, a faint wet line stays where the sea reached, then fades
      if (state.target === 0 && high > 0.3) {
        const wet = H + 30 - (H + 30 - HEAD + 26) * high, fade = Math.max(0, 1 - k * 1.3);
        if (fade > 0) {
          cx.beginPath(); for (let i = 0; i < n; i += 2) { const x = -20 + i * STEP, y = wet + line(x, t * 0.2, high) + 4; i ? cx.lineTo(x, y) : cx.moveTo(x, y); }
          cx.strokeStyle = `rgba(255,255,255,${0.5 * fade * op})`; cx.lineWidth = 2; cx.setLineDash([2, 7]); cx.stroke(); cx.setLineDash([]);
        }
      }
      // Brinky floats in the shallows just behind the foam, rocking with the water
      if (o.rider) {
        const rx = Math.max(18, Math.min(340, W * 0.2)) + 56, y = yAt(rx) + 30 + Math.sin(t * 1.6) * 3;
        const slope = (yAt(rx + 30) - yAt(rx - 30)) / 60;
        tilt += (Math.atan(slope) * 0.8 + Math.sin(t * 1.2) * 0.04 - tilt) * 0.12;
        o.rider.style.transform = `translate(${rx - 56}px,${innerHeight - H + y - 92}px) rotate(${tilt}rad)`;
        o.rider.style.opacity = Math.min(1, level * 2.5).toFixed(2);
        cx.fillStyle = `rgba(255,255,255,${0.45 * op * Math.min(1, level * 2)})`;
        cx.beginPath(); cx.ellipse(rx, y + 2, 46, 6, tilt, 0, 6.283); cx.fill();
      }
    }
    const onResize = () => size();
    addEventListener("resize", onResize);
    raf = requestAnimationFrame(frame);
    return {
      get seaPx() { return seaPx; },
      jump(ms) { state.start -= ms; t0 -= ms; },
      ebb(dur) {
        state.from = level; state.target = 0; state.start = performance.now(); state.dur = dur; state.easing = ease.inOut;
        if (o.still) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
        play("ebb");
        return sleep(dur + 60);
      },
      stop() { cancelAnimationFrame(raf); removeEventListener("resize", onResize); },
    };
  }

  async function wave(m, ctl) {
    const elapsed = Math.max(0, m.elapsed || 0);
    const rm = reduced();
    const el = add(`<div class="wave" role="dialog" aria-label="Water reminder">
      <canvas class="w-sea" aria-hidden="true"></canvas><div class="flat" aria-hidden="true"></div><div class="ride"></div>
      <div class="wcard paper"><div class="k">Water</div><div class="ttl">${esc(m.title)}</div><p>${esc(m.body)}</p>${dropsRow(m.glasses || 0, m.goal || 8)}${waterButtons(m)}</div>
      </div>`);
    const rideEl = el.querySelector(".ride"), cardEl = el.querySelector(".wcard");
    const rider = brinky(rideEl, "happy");
    const h = Math.max(20, Math.min(70, m.waveH || 38)) / 100;
    // the simple wave: used only where the live one can't be drawn
    const flat = () => {
      el.classList.add("is-flat"); el.querySelectorAll("canvas").forEach((c) => c.remove());
      const f = el.querySelector(".flat"); f.style.setProperty("--sh", `${Math.round(innerHeight * h)}px`);
      rideEl.style.transform = `translate(${Math.max(18, Math.min(340, innerWidth * 0.2))}px,${innerHeight * (1 - h) - 92}px)`;
      requestAnimationFrame(() => el.classList.add("up"));
      return { seaPx: Math.round(innerHeight * h), jump() {}, ebb(d) { el.classList.remove("up"); return sleep(Math.min(d, 1600)); }, stop() {} };
    };
    let sea = ocean(el.querySelector(".w-sea"), {
      h, speed: Math.max(0.4, Math.min(2.5, m.waveSpeed || 1)),
      op: m.waveOpacity && m.waveOpacity < 1 ? Math.max(0.5, m.waveOpacity) : 1, rider: rideEl, still: rm, offset: Math.random() * 40,
      onfail: () => { sea = flat(); },
    }) || flat();
    if (elapsed) sea.jump(Math.min(elapsed, RISE));
    const place = () => { const ch = cardEl.offsetHeight || 220; cardEl.style.setProperty("--cb", `${Math.min(innerHeight - ch - 16, sea.seaPx + (innerWidth < 620 ? 150 : 110))}px`); };
    place(); addEventListener("resize", place);
    el.addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (b) ctl.answer(b.dataset.r); });
    if (!elapsed) play("wave");
    setTimeout(() => { place(); cardEl.classList.add("on"); }, Math.max(0, (rm ? 600 : RISE) - elapsed));
    // when the tab is hidden the browser pauses the drawing by itself; nothing runs in the background
    return {
      thanks(t) { rider?.mood("laugh"); cardEl.querySelector(".ttl").textContent = t; cardEl.querySelector("p").textContent = "Lovely. The wave can go now."; cardEl.querySelector(".row")?.remove(); cardEl.querySelector(".drops")?.remove(); },
      async leave(fast) {
        cardEl.classList.remove("on");
        await sleep(fast ? 0 : 900);
        await sea.ebb(rm ? 400 : EBB);
        sea.stop(); removeEventListener("resize", place);
        rider?.destroy(); el.remove();
      },
    };
  }

  async function water(m) {
    if (live.water) { if (live.water.id === m.id) return { ok: true }; live.water.end(); }
    if (busy(m) === "fullscreen") return { busy: "fullscreen" };
    const waited = m.elapsed ? 0 : await afterTyping(Math.min(m.typingMax ?? 20000, m.style === "wave" ? 6000 : 15000));
    R(m.theme); soundOn = m.sound !== false;
    if (m.vol != null) volMul = m.vol / 0.6;
    await decode([ENV.asset("mascot/blank.webp")]);
    let ui, done = false, timer, shownAt = Date.now();
    const ctl = {
      id: m.id,
      answer(r) {
        if (done) return; done = true; clearTimeout(timer);
        if (r === "drank") { play("gulp"); const n = (m.glasses || 0) + 1; ui?.thanks(n >= (m.goal || 8) ? `That's ${n} of ${m.goal}. Goal reached!` : `Glass ${n} of ${m.goal || 8}. Lovely.`); setTimeout(() => finish(), 1700); }
        else finish();
        ENV.send({ t: "result", id: m.id, kind: "water", r, ms: Date.now() - shownAt });
      },
      end() { if (done) return; done = true; clearTimeout(timer); finish(true); },
    };
    const finish = async (fast) => { await ui?.leave(fast); if (live.water === ctl) live.water = null; tidy(); };
    live.water = ctl;
    ui = m.style === "tumbler" ? await tumbler(m, ctl) : m.style === "card" ? card(m, ctl) : await wave(m, ctl);
    // nobody answered: ebb away quietly, and ask again later
    shownAt = Date.now();
    timer = setTimeout(() => ctl.answer("ignored"), Math.max(4000, (m.timeout || (m.style === "wave" ? 24000 : 30000)) - (m.elapsed || 0)));
    return { ok: true, waited };
  }

  // ───────────────────────── eye break ─────────────────────────
  // How Brinky moves while you follow him, and what his face does: his eyes look where he's going,
  // close when yours should, and blink in rhythm. `me` is a live BrinkyFace on the moving element.
  function guide(mv, me, ex, stage, scrimHost) {
    const W = stage.clientWidth / 2 - 80, H = stage.clientHeight / 2 - 70, per = ex.period * 1000, anims = [];
    const T = (x, y, s = 1) => ({ transform: `translate(${(x * W).toFixed(1)}px,${(y * H).toFixed(1)}px) scale(${s})` });
    const loop = (frames, o = {}) => anims.push(mv.animate(frames, { duration: per, iterations: Infinity, easing: "linear", ...o }));
    const io = "cubic-bezier(.45,0,.55,1)";
    const N = 48, pts = (f) => Array.from({ length: N + 1 }, (_, i) => f((i / N) * Math.PI * 2));
    // a timed face change, wrapped so it can be cancelled and seeked like an Animation
    const rhythm = (fn, ms = 100) => {
      const t0 = performance.now(); let off = 0;
      const id = setInterval(() => fn((performance.now() - t0 + off) % per, per), ms);
      anims.push({ cancel: () => clearInterval(id), set currentTime(v) { off = v; }, get currentTime() { return off; }, effect: { getTiming: () => ({ duration: per }) } });
    };
    // eyes follow the direction Brinky is moving in
    const lookAlong = () => {
      let px = 0, py = 0;
      rhythm(() => {
        const m = new DOMMatrixReadOnly(getComputedStyle(mv).transform), x = m.m41 / (W || 1), y = m.m42 / (H || 1);
        me?.look((x - px) * 6 + x * 0.6, (y - py) * 6 + y * 0.6); px = x; py = y;
      }, 120);
    };
    switch (ex.guide) {
      case "eight": loop(pts((t) => T(Math.sin(t), Math.sin(2 * t) * 0.55))); lookAlong(); break;
      case "circle": anims.push(mv.animate([...pts((t) => T(Math.cos(t), Math.sin(t) * 0.9)), ...pts((t) => T(Math.cos(-t), Math.sin(-t) * 0.9)).slice(1)], { duration: per * 2, iterations: Infinity })); lookAlong(); break;
      case "sweepX": loop([T(-1, 0), T(1, 0), T(-1, 0)], { easing: io }); lookAlong(); break;
      case "sweepY": loop([T(0, -1), T(0, 1), T(0, -1)], { easing: io }); lookAlong(); break;
      case "diag": loop([T(-1, -1), T(1, 1), T(-1, -1), T(1, -1), T(-1, 1), T(1, -1)], { easing: io }); lookAlong(); break;
      case "clock": {
        const c = [[0, -1], [1, 0], [0, 1], [-1, 0], [0, -1]], f = [{ ...T(0, -1), offset: 0, easing: io }];
        for (let i = 1; i < 5; i++) { f.push({ ...T(...c[i]), offset: (i - 1) / 4 + 0.08, easing: io }); f.push({ ...T(...c[i]), offset: i / 4, easing: io }); }
        loop(f); lookAlong(); break;
      }
      case "zoom": loop([T(0, 0, 1.8), T(0, 0, 0.45), T(0, 0, 1.8)], { easing: io }); break;
      case "breathe": loop([{ ...T(0, 0, 1), offset: 0 }, { ...T(0, 0, 1.4), offset: 0.4, easing: io }, { ...T(0, 0, 1), offset: 1 }], { easing: io }); me?.mood("calm"); break;
      case "squeeze":
        loop([{ transform: "scale(1)", offset: 0 }, { transform: "scale(1.12,.78)", offset: 0.1 }, { transform: "scale(1.12,.78)", offset: 0.48 }, { transform: "scale(.94,1.1)", offset: 0.58 }, { transform: "scale(1)", offset: 1 }], { easing: io });
        rhythm((t, p) => me?.mood(t > p * 0.08 && t < p * 0.5 ? "calm" : "surprised")); break;
      case "blink": rhythm((t, p) => me?.mood(t > p * 0.25 && t < p * 0.66 ? "calm" : "neutral"), 60); break;
      case "far": anims.push(mv.animate([T(0, 0, 1.2), { transform: `translate(0,${-H * 0.5}px) scale(.32)`, opacity: 0.75 }], { duration: ex.dur * 1000, easing: "cubic-bezier(.2,.6,.3,1)", fill: "forwards" })); break;
      case "dim": me?.mood("calm"); loop([T(0, 0, 1), T(0, 0, 1.06), T(0, 0, 1)], { easing: io }); setTimeout(() => scrimHost.classList.add("dark"), 3500); break;
      // look away: Brinky closes his eyes and fades, and the screen goes quiet, so there's nothing on it to stare at
      case "away":
        setTimeout(() => me?.mood("calm"), 900);
        anims.push(mv.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 1, transform: "scale(1)", offset: 0.45 }, { opacity: 0, transform: "scale(.7)" }], { duration: 3400, easing: "ease-in", fill: "forwards" }));
        setTimeout(() => scrimHost.classList.add("dark", "away"), 2400); break;
    }
    return anims;
  }

  async function eye(m) {
    if (live.eye) return { ok: true };
    const b = busy(m); if (b && !m.force) return { busy: b };
    const ex = EYES.get(m.ex), dur = (m.dur || ex.dur) * 1000;
    let elapsed = Math.max(0, m.elapsed || 0);
    const ctl = { id: m.id };
    live.eye = ctl;
    R(m.theme); soundOn = m.sound !== false;
    const imgs = [ENV.asset("mascot/blank.webp")];
    if (m.vol != null) volMul = m.vol / 0.6;
    const pre = Math.max(0, Math.min(8, m.preroll ?? 3));
    let waited = 0;
    // a few blinks of the cursor first, so the break never arrives out of nowhere
    if (!elapsed && !m.noPreroll) {
      waited = await afterTyping(m.typingMax ?? 20000);
      if (live.eye !== ctl) return { ok: true };
      const pre = decode(imgs);
      if (pre) await blinkCursor(pre, (i) => `<span>eye break in <b>${pre - i}</b></span>`);
      await pre;
    } else await decode(imgs);
    if (live.eye !== ctl) return { ok: true };

    const el = add(`<div class="eb${lowEnd ? " lite" : ""}" role="dialog" aria-modal="true" aria-label="Eye break: ${esc(ex.name)}">
      <div class="scrim"></div>
      <div class="top"><div class="k">${esc(m.kicker || `Eye break · ${Math.round(dur / 1000)} seconds`)}</div><h1>${esc(ex.name)}</h1><p class="step">${esc(ex.steps[0])}</p></div>
      <div class="stage"><div class="mv"></div></div>
      <div class="bot"><div class="t"><b>${Math.ceil((dur - elapsed) / 1000)}</b><small>seconds</small></div><div class="prog"><i></i></div>
        <div class="row"><button class="b" data-r="snooze">${m.snoozeMin || 5} more minutes</button><button class="b" data-r="skip">Skip · esc</button></div><p class="why">${esc(ex.why)}</p></div>
      <div class="done"><div class="me"></div><h2>Nicely done${m.name ? `, ${esc(m.name)}` : ""}.</h2><p>Your eyes thank you.</p><div class="row sip"></div></div>
    </div>`);
    const stepEl = el.querySelector(".step"), tEl = el.querySelector(".t b"), bar = el.querySelector(".prog i");
    const me = brinky(el.querySelector(".mv"), "neutral");
    const prevFocus = document.activeElement;
    try { prevFocus?.blur?.(); } catch {}
    requestAnimationFrame(() => el.classList.add("on"));
    const anims = guide(el.querySelector(".mv"), me, ex, el.querySelector(".stage"), el);
    anims.forEach((a) => { a.currentTime = ["far", "away"].includes(ex.guide) ? elapsed : elapsed % (a.effect.getTiming().duration || 1); });
    const ringA = bar.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: dur, easing: "linear", fill: "forwards" });
    ringA.currentTime = elapsed;
    if (ex.guide === "dim" && elapsed > 3500) el.classList.add("dark");
    if (ex.guide === "away" && elapsed > 2400) el.classList.add("dark", "away");

    const start = performance.now() - elapsed;
    let step = -1, finished = false, tick, doneMe = null;
    const per = dur / ex.steps.length;
    const update = () => {
      const t = performance.now() - start, left = Math.max(0, Math.ceil((dur - t) / 1000));
      tEl.textContent = left;
      const s = Math.min(ex.steps.length - 1, Math.floor(t / per));
      if (s !== step) {
        if (step >= 0) { stepEl.classList.add("fade"); setTimeout(() => { stepEl.textContent = ex.steps[s]; stepEl.classList.remove("fade"); }, 450); if (ex.guide === "dim" || ex.guide === "away") play("tick"); }
        step = s;
      }
      if (t >= dur) complete();
    };
    tick = setInterval(update, 250);

    const keys = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts alone
      if (e.key === "Escape") answer("skip");
      e.stopImmediatePropagation(); if (e.key !== "Tab") e.preventDefault();
    };
    addEventListener("keydown", keys, true);
    el.addEventListener("click", (e) => { const b2 = e.target.closest("[data-r]"); if (b2) answer(b2.dataset.r); });
    el.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });

    let closed = false;
    const close = async (fast) => {
      if (closed) return; closed = true;
      clearInterval(tick); removeEventListener("keydown", keys, true);
      el.classList.remove("on");
      await sleep(fast ? 250 : 700);
      anims.forEach((a) => a.cancel()); ringA.cancel(); me?.destroy(); doneMe?.destroy(); el.remove();
      if (live.eye === ctl) live.eye = null;
      try { prevFocus?.focus?.({ preventScroll: true }); } catch {}
      tidy();
    };
    function answer(r) {
      if (finished) return; finished = true;
      ENV.send({ t: "result", id: m.id, kind: "eye", r, ex: ex.id });
      close();
    }
    function complete() {
      if (finished) return; finished = true;
      clearInterval(tick);
      play("chime");
      anims.forEach((a) => a.cancel());
      doneMe = brinky(el.querySelector(".done .me"), "happy"); setTimeout(() => doneMe?.mood("neutral"), 1600); doneMe?.autoBlink();
      el.classList.remove("dark", "away"); el.classList.add("fin");
      ENV.send({ t: "result", id: m.id, kind: "eye", r: "done", ex: ex.id, secs: Math.round(dur / 1000) });
      if (m.sip) {
        const row = el.querySelector(".done .sip");
        el.querySelector(".done p").textContent = `And a sip? Glass ${m.sip.n + 1} of ${m.sip.goal}.`;
        row.innerHTML = `<button class="b p" data-s="drank">I drank a glass</button><button class="b" data-s="later">Not now</button>`;
        row.addEventListener("click", (e) => { const b2 = e.target.closest("[data-s]"); if (!b2) return; ENV.send({ t: "result", id: m.id + ":sip", kind: "water", r: b2.dataset.s }); close(); });
        setTimeout(close, 9000);
      } else setTimeout(close, 2200);
    }
    ctl.end = () => { finished = true; close(true); };
    // safety net: the overlay can never outlive its break by much
    setTimeout(() => close(true), dur - elapsed + 20000);
    update();
    return { ok: true, waited };
  }

  // ───────────────────────── the evening recap ─────────────────────────
  async function recapCard(m) {
    R(m.theme); soundOn = m.sound !== false; if (m.vol != null) volMul = m.vol / 0.6;
    await decode([ENV.asset("mascot/blank.webp")]);
    const goal = m.water && m.glasses >= m.goal, good = goal || m.breaks >= 6;
    const line = goal && m.breaks >= 6 ? "A lovely, kind day. Same again tomorrow?" : goal ? "Water goal done. Tomorrow, a few more eye breaks?" : m.water ? `Tomorrow, ${Math.max(1, m.goal - m.glasses)} more glass${m.goal - m.glasses === 1 ? "" : "es"} would be lovely.` : "Rest well. See you tomorrow.";
    const el = add(`<div class="note paper recap" role="dialog" aria-label="Today with Brinky">
      <div class="me"></div><div style="flex:1;min-width:0"><div class="k">Today</div><div class="ttl">That's a wrap${m.name ? `, ${esc(m.name)}` : ""}.</div>
      <div class="nums"><span><b>${m.breaks}</b>eye break${m.breaks === 1 ? "" : "s"}</span>${m.water ? `<span><b>${m.glasses}/${m.goal}</b>glasses</span>` : ""}<span><b>${m.moves}</b>moves</span></div>
      <p>${esc(line)}</p><div class="row"><button class="b p" data-r="ok">Goodnight</button></div></div></div>`);
    const me = brinky(el.querySelector(".me"), good ? "laugh" : "happy"); setTimeout(() => me?.mood("neutral"), 1800); me?.autoBlink();
    play("chime");
    const close = () => { el.classList.add("bye"); setTimeout(() => { me?.destroy(); el.remove(); tidy(); }, 460); };
    el.addEventListener("click", (e) => { if (e.target.closest("[data-r]")) close(); });
    setTimeout(close, 25000);
    return { ok: true };
  }

  // ───────────────────────── nudges ─────────────────────────
  async function blinkNudge(m) {
    if (nudging || live.eye) return { ok: true };
    if (busy(m) && !m.force) return { busy: busy(m) };
    R(m.theme);
    await blinkCursor(Math.max(1, Math.min(8, m.count || 3)), () => `<span>${esc(m.text || "blink slowly with me")}</span>`);
    tidy();
    return { ok: true };
  }
  async function stretch(m) {
    if (nudging || live.eye) return { ok: true };
    if (busy(m) && !m.force) return { busy: busy(m) };
    R(m.theme);
    await stretchCursor(m.ms || 9000, m.text || "stretch a little :)", m.move || "stretch");
    tidy();
    return { ok: true };
  }

  globalThis.BrinkyLayer = {
    run(m) {
      try {
        if (m.t === "water") return water(m);
        if (m.t === "eye") return eye(m);
        if (m.t === "blink") return blinkNudge(m);
        if (m.t === "stretch") return stretch(m);
        if (m.t === "recap") return recapCard(m);
      } catch (e) { return { error: String(e) }; }
      return { ok: false };
    },
    end(kind) { if (kind === "water" || !kind) live.water?.end(); if (kind === "eye" || !kind) live.eye?.end?.(); return true; },
    active: () => ({ water: !!live.water, eye: !!live.eye, nudge: nudging }),
    guide, // the exact eye-exercise motion
  };
})();
