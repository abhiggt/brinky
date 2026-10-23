// In-page layer (top frame), kept small: heads-up pill, chips by your cursor, nudges, toasts, the evening
// tint, media control, the bridge from pagewatch.js, and the armed break. The break screen (breaklayer.js)
// and the water wave (water.js) load into the page only when it needs them.
//
// Never late: 15 s before a break the background "arms" this tab with everything the break needs. When the
// moment comes this tab starts the break itself, on the dot, and only then tells the background.
(() => {
  if (window.__brinky3) return;
  window.__brinky3 = true;

  const M = globalThis.BrinkyMascot;
  let host, root, pill, pillTimer, fadeEl, tintEl, tintTimer, water, brk, brkTimeout, toastEl, lastKey = 0;
  let mouse = null, countChip = null, nudgeChip = null, placeRaf = 0;   // your pointer, and the chips that follow it
  let armed = null, armTimer = 0, typingWait = false, pending = null;   // the armed break; a break waiting for this tab to be seen
  let inCallHere = false;
  const pausedByUs = new Set(), nudgeQueue = [];
  let nudgeBusy = false, dead = false;

  const CSS = `
  :host{all:initial}
  *{box-sizing:border-box;font-family:ui-rounded,ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Rounded","Segoe UI",Inter,sans-serif}
  .card{background:#fff;color:#111827;border:1px solid rgba(17,24,39,.1);box-shadow:0 10px 30px rgba(17,24,39,.16),0 1px 3px rgba(17,24,39,.08)}
  .pill{position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;align-items:center;gap:8px;padding:5px 6px 5px 8px;border-radius:999px;font-size:13px;pointer-events:auto;animation:up .3s ease-out}
  .pill img{width:30px;height:auto;flex:none}
  .pill .t{font-weight:700;font-variant-numeric:tabular-nums}
  .pill .l{color:#4b5563;white-space:nowrap}
  button{all:unset;cursor:pointer;font-size:12px;font-weight:650;padding:6px 10px;border-radius:999px;border:1px solid rgba(17,24,39,.14);color:#111827;text-align:center;transition:background .15s}
  button:hover{background:rgba(17,24,39,.06)}
  button:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
  button.go{background:#111827;color:#fff;border-color:#111827}
  button.go:hover{background:#1f2937}
  button.x{border:0;padding:4px 7px;color:#6b7280;font-size:15px;line-height:1}
  .nudge{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;border-radius:999px;padding:6px 18px 6px 8px;display:flex;align-items:center;gap:10px;font-size:13.5px;animation:up2 .4s ease-out;pointer-events:none;width:max-content;max-width:calc(100vw - 32px)}
  .nudge img{width:36px;height:auto}
  .toast{position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483647;border-radius:16px;padding:8px 8px 8px 10px;display:flex;align-items:center;gap:10px;font-size:13.5px;width:max-content;max-width:min(560px,calc(100vw - 32px));pointer-events:auto;animation:down .35s ease-out}
  .toast img{width:34px;height:auto;flex:none}
  .chip{position:fixed;left:0;top:0;z-index:2147483647;display:flex;align-items:center;gap:7px;border-radius:999px;padding:4px 13px 4px 5px;font-size:12.5px;font-weight:650;
    white-space:nowrap;pointer-events:none;transition:transform .14s ease-out,opacity .35s;will-change:transform;animation:pop .25s ease-out}
  .chip img{width:28px;height:auto;flex:none}
  .chip b,.nudge b{font-variant-numeric:tabular-nums}
  @keyframes pop{from{opacity:0}}
  .fade{position:fixed;inset:0;z-index:2147483646;pointer-events:none;transition:background .3s linear}
  .tint{position:fixed;inset:0;z-index:2147483645;pointer-events:none}
  .out{opacity:0;transition:opacity .35s}
  @keyframes up{from{opacity:0;transform:translateY(10px)}}
  @keyframes up2{from{opacity:0;transform:translate(-50%,12px)}}
  @keyframes down{from{opacity:0;transform:translate(-50%,-10px)}}
  @media (prefers-color-scheme: dark){.card{background:#1c1f26;color:#f3f4f6;border-color:rgba(255,255,255,.12)}.pill .l{color:#9ca3af}
    button{color:#f3f4f6;border-color:rgba(255,255,255,.18)}button:hover{background:rgba(255,255,255,.08)}
    button.go{background:#f3f4f6;color:#111827;border-color:#f3f4f6}button.go:hover{background:#fff}button.x{color:#9ca3af}}
  @media (prefers-reduced-motion: reduce){.pill,.nudge,.toast,.chip{animation:none}.chip{transition:opacity .35s}}
  `;

  const alive = () => { try { return !!chrome.runtime?.id; } catch { return false; } };
  function ensureRoot() {
    if (root) return root;
    if (dead) throw new Error("brinky: torn down");
    host = document.createElement("brinky-layer");
    host.style.cssText = "all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647";
    root = host.attachShadow({ mode: "closed" });
    const st = document.createElement("style");
    st.textContent = CSS;
    root.appendChild(st);
    document.documentElement.appendChild(host);
    return root;
  }
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; };
  const send = (m) => { if (!alive()) { teardown(); return Promise.resolve(); } return chrome.runtime.sendMessage(m).catch(() => {}); };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  const face = (mood, size) => (M ? M.html({ mood, size }) : "");
  const visible = () => document.visibilityState === "visible";
  const need = (what) => send({ t: "need", what }); // load breaklayer.js / water.js into this page

  // ───────── chips by your cursor: your eyes are usually near the pointer ─────────
  function placeChips() {
    placeRaf = 0;
    if (!mouse) return;
    let dy = 0;
    for (const c of [countChip, nudgeChip]) {
      if (!c) continue;
      const w = c.offsetWidth, h = c.offsetHeight;
      let x = mouse.x + 16, y = mouse.y + 20 + dy;
      if (x + w > innerWidth - 8) x = mouse.x - w - 12;
      if (y + h > innerHeight - 8) y = mouse.y - h - 14 - dy;
      x = Math.max(8, Math.min(innerWidth - w - 8, x));
      y = Math.max(8, Math.min(innerHeight - h - 8, y));
      c.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      dy += h + 6;
    }
  }
  const onMouse = (e) => { mouse = { x: e.clientX, y: e.clientY }; if ((countChip || nudgeChip) && !placeRaf) placeRaf = requestAnimationFrame(placeChips); };
  function chipAt(html) { const c = el(`<div class="chip card" role="status">${html}</div>`); ensureRoot().appendChild(c); return c; }

  // ───────── heads-up (and the armed break) ─────────
  function hideHeadsup() {
    clearInterval(pillTimer);
    pill?.remove(); fadeEl?.remove(); countChip?.remove();
    pill = fadeEl = countChip = null;
    disarm();
  }
  function showHeadsup(m) {
    const { at, kind, fade = 0, postCall = 0, follow = true, noSnooze = false } = m;
    hideHeadsup();
    const r = ensureRoot();
    if (m.pill !== false) {
      const label = postCall ? `After ${postCall} min of calls, a break in` : kind === "long" ? "Movement break in" : "Eye break in";
      pill = el(`<div class="pill card" role="status"><span>${face("curious", 30)}</span><span class="l">${label}</span><span class="t">0:00</span>
        <button class="go" data-a="now">Now</button>${noSnooze ? "" : `<button data-s="5" title="Snooze 5 minutes">+5</button>`}<button class="x" data-a="x" title="Hide" aria-label="Hide">×</button></div>`);
      r.appendChild(pill);
      pill.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.dataset.a === "now") { if (armed) { armed.at = Date.now(); fire(); } else send({ t: "breakNow", scheduled: true }); }
        else if (b.dataset.s) send({ t: "snooze", min: +b.dataset.s });
        if (b.dataset.a !== "x" || !armed) hideHeadsup();
        else { pill?.remove(); pill = null; } // × hides the pill; the break still comes on time
      });
    }
    const tick = () => {
      const left = at - Date.now();
      const t = pill?.querySelector(".t"), l = pill?.querySelector(".l");
      if (t) t.textContent = typingWait ? "…" : fmt(left);
      if (l && typingWait) l.textContent = "Break when you pause typing";
      if (follow && mouse && left <= 10000 && left > 0) { // the last seconds, right where you're looking
        if (!countChip) { countChip = chipAt(`${face("surprised", 28)}<span>${kind === "long" ? "Movement break" : "Break"} in <b>${Math.ceil(left / 1000)}s</b></span>`); placeChips(); }
        else countChip.querySelector("b").textContent = `${Math.ceil(left / 1000)}s`;
      }
      if (fade && left < fade * 1000 && left > -2000) { // a gentle dim, never a blur
        if (!fadeEl) { fadeEl = el(`<div class="fade"></div>`); r.insertBefore(fadeEl, r.firstChild.nextSibling); }
        fadeEl.style.background = `rgba(10,14,22,${(0.18 * Math.min(1, 1 - left / (fade * 1000))).toFixed(3)})`;
      }
      if (left <= -3000 && !typingWait) { clearInterval(pillTimer); pill?.remove(); fadeEl?.remove(); countChip?.remove(); pill = fadeEl = countChip = null; }
    };
    tick();
    pillTimer = setInterval(tick, 250);
    if (m.arm && globalThis.BrinkyBreak) { armBreak(at, m.arm); return true; }
    return false;
  }
  let keep = [];
  function armBreak(at, o) {
    // everything the first frame needs is worked out now, not at the moment of the break
    if (o.look === "auto" || !o.look) o = { ...o, look: pageIsDark() ? "dark" : "light" };
    armed = { at, o };
    keep = M?.preload?.(["calm", "sleepy", "proud", "happy", "surprised", "wink", "excited", "blink"]) || []; // decoded before they're needed
    BrinkyBreak.prepare?.(ensureRoot(), o);
    clearTimeout(armTimer);
    armTimer = setTimeout(fire, Math.max(0, at - Date.now()));
  }
  function disarm() { clearTimeout(armTimer); armed = null; typingWait = false; }
  function fire() {
    const a = armed;
    if (!a || brk) return;
    clearTimeout(armTimer);
    // only for someone looking at this tab, and not over a fullscreen video or a call
    if (!visible() || document.fullscreenElement || playing() || inCallHere) { disarm(); send({ t: "armMiss" }); return; }
    if (a.o.typingAware && Date.now() - lastKey < 2500 && Date.now() - a.at < 30000) { typingWait = true; armTimer = setTimeout(fire, 300); return; }
    const now = Date.now(), o = { ...a.o, startedAt: now, endsAt: now + a.o.dur, primary: true };
    armed = null; typingWait = false;
    startBreak(o);
    send({ t: "armStarted", kind: o.kind, startedAt: o.startedAt, endsAt: o.endsAt, sip: !!o.sip }).then((r) => { if (r?.cancel) endBreak(); });
  }

  // ───────── nudges: one at a time ─────────
  function nudge(kind, at, sec = 0) {
    nudgeQueue.push({ kind, at, sec });
    if (!nudgeBusy) nextNudge();
  }
  const NUDGE = {
    blink: ["blink", "Blink slowly a few times", "Blink slowly: a few full, gentle blinks."],
    posture: ["surprised", "Posture: sit tall, shoulders down", "Posture check: sit tall, shoulders down, screen at eye level."],
    look: ["happy", "Look far away", "Look at something far away"],
  };
  function nextNudge() {
    const { kind, at, sec } = nudgeQueue.shift() || {};
    if (!kind) { nudgeBusy = false; return; }
    nudgeBusy = true;
    const [mood, short, long] = NUDGE[kind] || NUDGE.posture;
    const count = sec ? ` <b>${sec}s</b>` : "";
    let n;
    if (at !== "bottom" && mouse) { n = nudgeChip = chipAt(`${face(mood, 28)}<span>${short}${count}</span>`); placeChips(); } // follows your pointer
    else { n = el(`<div class="nudge card" role="status">${face(mood, 36)}<span>${long}${count}</span></div>`); ensureRoot().appendChild(n); }
    const end = Date.now() + (sec ? sec * 1000 : 6000);
    const timer = setInterval(() => {
      const left = end - Date.now(), b = n.querySelector("b");
      if (b) b.textContent = `${Math.max(0, Math.ceil(left / 1000))}s`;
      if (left > 0) return;
      clearInterval(timer);
      n.style.opacity = "0"; n.classList.add("out");
      setTimeout(() => { n.remove(); if (nudgeChip === n) nudgeChip = null; nextNudge(); }, 400);
    }, 250);
  }

  // ───────── toasts (quiet time, gentle notes) ─────────
  function toast({ kind, text, action, ms = 9000 }) {
    toastEl?.remove();
    toastEl = el(`<div class="toast card" role="status">${face(kind === "quiet" ? "calm" : "happy", 34)}<span>${esc(text)}</span>${action ? `<button class="go" data-a="act">${esc(action)}</button>` : ""}<button class="x" data-a="x" aria-label="Close">×</button></div>`);
    ensureRoot().appendChild(toastEl);
    const t = toastEl;
    t.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.a === "act" && kind === "quiet") send({ t: "endQuiet" });
      t.remove();
    });
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, ms);
  }

  // ───────── water: only in the tab you're looking at ─────────
  function startWater(m) {
    if (water || brk || !visible()) return false;
    if (Date.now() - (m.at || 0) > 5000) return false;
    water = BrinkyWater.start(ensureRoot(), m, (a) => {
      if (a === "drank") send({ t: "waterDone" });
      else if (a === "later") send({ t: "waterSnooze", min: 10 });
      else if (a === "ignored") send({ t: "waterIgnored" });
      else if (a === "dismissed") send({ t: "waterDismissed" });
    });
    water.onEnd = () => { water = null; };
    return true;
  }

  // ───────── break layer ─────────
  function pageIsDark() {
    const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const probe = (node) => { for (let n = node; n && n.nodeType === 1; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > 0.5) return lum(c); } return null; };
    const samples = [[0.5, 0.5], [0.3, 0.3], [0.7, 0.7]].map(([x, y]) => probe(document.elementFromPoint(innerWidth * x, innerHeight * y)));
    const vals = samples.filter((v) => v != null);
    const base = probe(document.body) ?? probe(document.documentElement);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : base ?? (matchMedia("(prefers-color-scheme: dark)").matches ? 0.1 : 1);
    return avg < 0.45;
  }
  function startBreak(o) {
    if (brk || Date.now() > o.endsAt + 2000) return;
    pending = null;
    if (!globalThis.BrinkyBreak) { need("break").then(() => globalThis.BrinkyBreak && startBreak(o)); return; }
    hideHeadsup();
    water?.leave({ now: true });
    toastEl?.remove();
    const look = o.look === "auto" || !o.look ? (pageIsDark() ? "dark" : "light") : o.look;
    const b = BrinkyBreak.start(ensureRoot(), { ...o, look }, (a, extra) => {
      if (a === "water") send({ t: "logWater" });
      else if (a === "postpone") send({ t: "endBreak", reason: "postpone", postpone: 5 });
      else if (a === "skip") send({ t: "endBreak", reason: "skip" });
      else if (a === "done") send({ t: "breakDone", seenMs: extra?.seenMs || 0, primary: !!o.primary });
    });
    brk = b;
    if (o.primary && o.pauseMedia) pauseMedia();
    // never leave a finished break on screen, even if the extension stops answering
    clearTimeout(brkTimeout);
    brkTimeout = setTimeout(() => { if (brk === b) endBreak(); }, Math.max(0, o.endsAt - Date.now()) + 8000);
  }
  function endBreak() {
    clearTimeout(brkTimeout); pending = null;
    if (brk) { brk.end(); brk = null; resumeMedia(); }
  }
  // a break that started while this tab was in the background shows up when you come back to it
  const onVisibility = () => {
    if (!visible()) {
      if (water) { const w = water; w.leave({ now: true }); send({ t: "waterHidden" }); }
      if (armed) { disarm(); send({ t: "armMiss" }); } // you switched tabs during the heads-up: arm the new one
      return;
    }
    if (pending && Date.now() < pending.endsAt) startBreak(pending);
  };

  // ───────── typing & the page watcher ─────────
  const onKey = () => { lastKey = Date.now(); };
  const onMessage = (e) => {
    const d = e.data?.__brinky3; if (!d || typeof d !== "object") return;
    if (d.type === "key") lastKey = Date.now();
    if (d.type === "media") { inCallHere = !!(d.call || d.share); if (inCallHere && armed) hideHeadsup(); send({ t: "media", call: !!d.call, share: !!d.share }); }
  };

  // ───────── evening tint (SuperBrink): warms the page without lifting black text ─────────
  const minsNow = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const toMin = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };
  async function applyTint() {
    clearTimeout(tintTimer);
    if (dead) return;
    if (!alive()) return teardown();
    let s; try { s = (await chrome.storage.sync.get("settings")).settings; } catch { return; }
    const t = s?.superBrink ? s.tint : null;
    if (!t?.on) { tintEl?.remove(); tintEl = null; return; }  // off: no timers at all
    const a = toMin(t.start), b = toMin(t.end), n = minsNow();
    const inside = a <= b ? n >= a && n < b : n >= a || n < b;
    if (inside) {
      if (!tintEl) { tintEl = el(`<div class="tint"></div>`); ensureRoot().appendChild(tintEl); }
      const k = Math.max(0, Math.min(1, t.strength ?? 0.35));
      tintEl.style.backdropFilter = tintEl.style.webkitBackdropFilter = `sepia(${k.toFixed(2)}) saturate(${(1 + k * 0.35).toFixed(2)}) brightness(${(1 - k * 0.05).toFixed(3)})`;
    } else { tintEl?.remove(); tintEl = null; }
    const nextEdge = ((inside ? b : a) - n + 1440) % 1440 || 1440; // wake up exactly when it should change
    tintTimer = setTimeout(applyTint, Math.min(nextEdge, 60) * 60e3);
  }

  // ───────── media ─────────
  const videos = () => [...document.querySelectorAll("video")];
  const onScreen = (v) => { const r = v.getBoundingClientRect(); return r.width > 200 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  const isCallMedia = (v) => !!v.srcObject; // live call video (WebRTC) is never paused
  const playing = () => videos().some((v) => !v.paused && !v.ended && v.readyState > 2 && v.videoWidth > 200 && !isCallMedia(v));
  const pauseMedia = () => { if (visible()) videos().forEach((v) => { if (!v.paused && !isCallMedia(v) && onScreen(v)) { v.pause(); pausedByUs.add(v); } }); };
  const resumeMedia = () => { pausedByUs.forEach((v) => v.play().catch(() => {})); pausedByUs.clear(); };

  function onRuntimeMessage(m, _s, reply) {
    if (dead) return;
    switch (m.t) {
      case "headsup": reply({ ok: true, armed: showHeadsup(m) }); return;
      case "hideHeadsup": hideHeadsup(); break;
      case "nudge": nudge(m.kind, m.at, m.sec); break;
      case "toast": toast(m); break;
      case "water":
        if (!globalThis.BrinkyWater) { reply(visible() ? { need: true } : { shown: false }); return; }
        reply({ shown: startWater(m) }); return;
      case "waterEnd": water?.leave(); break;
      case "breakStart":
        if (brk) break;
        if (!visible()) { pending = m; break; }            // shows when you come back to this tab
        if (!globalThis.BrinkyBreak) { reply({ need: true }); return; }
        disarm(); startBreak(m); break;
      case "breakSip": brk?.sip?.(m); break;
      case "breakEnd": hideHeadsup(); endBreak(); break;
      case "lastKey": reply({ ago: Date.now() - lastKey }); return;
      case "isPlaying": reply({ playing: playing() }); return;
      case "pauseMedia": pauseMedia(); break;
      case "resumeMedia": resumeMedia(); break;
    }
    reply({ ok: true });
  }

  function teardown() {
    if (dead) return;
    dead = true;
    clearInterval(aliveTimer); clearTimeout(tintTimer); disarm();
    removeEventListener("keydown", onKey, true);
    removeEventListener("mousemove", onMouse, true);
    removeEventListener("input", onKey, true);
    removeEventListener("message", onMessage);
    document.removeEventListener("visibilitychange", onVisibility);
    try { chrome.runtime.onMessage.removeListener(onRuntimeMessage); } catch {}
    try { brk?.end(); water?.leave({ now: true }); } catch {}
    host?.remove();
    window.__brinky3 = false;
  }

  addEventListener("keydown", onKey, { capture: true, passive: true });
  addEventListener("mousemove", onMouse, { capture: true, passive: true });
  addEventListener("input", onKey, { capture: true, passive: true });
  addEventListener("message", onMessage);
  document.addEventListener("visibilitychange", onVisibility);
  chrome.runtime.onMessage.addListener(onRuntimeMessage);
  chrome.storage.onChanged.addListener((c, area) => area === "sync" && c.settings && applyTint());
  applyTint();
  const aliveTimer = setInterval(() => { if (!alive()) teardown(); }, 30e3); // the extension was updated or removed

  // A tab opened in the middle of a break joins in. Reading storage directly doesn't wake the background.
  chrome.storage.local.get("state").then(({ state: st }) => {
    if (st?.phase === "break" && st.breakEndsAt > Date.now()) send({ t: "breakState" }).then((o) => o?.endsAt && (visible() ? startBreak({ ...o, primary: false }) : (pending = { ...o, primary: false })));
  }, () => {});
})();
