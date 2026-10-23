// Runs in the page's own JavaScript world (MAIN), in every frame, before the page's scripts.
// It notices when a page is using the camera or microphone (a call) or sharing the screen, so Brinky
// can stay out of the way. It also lets typing inside iframes (Google Docs, editors) count as typing.
// Nothing about the media itself is read or sent: only "in a call: yes/no" and "sharing: yes/no".
(() => {
  if (window.__brinkyPW) return;
  window.__brinkyPW = true;
  const isTop = window.top === window;
  const post = (data) => { try { (isTop ? window : window.top).postMessage({ __brinky3: data }, "*"); } catch {} };

  const tracks = new Set();
  let last = "", beat = 0;
  const report = () => {
    let call = false, share = false;
    for (const t of tracks) {
      if (t.readyState !== "live") { tracks.delete(t); continue; }
      if (t.__brinkyShare) share = true; else call = true;
    }
    const key = `${call}|${share}`, now = Date.now();
    // report changes at once, and keep reminding every 30 s while something is live
    if (key !== last || ((call || share) && now - beat > 30e3)) { last = key; beat = now; post({ type: "media", call, share }); }
  };
  const md = navigator.mediaDevices;
  const wrap = (name, share) => {
    const orig = md && md[name];
    if (typeof orig !== "function") return;
    md[name] = function (...args) {
      return orig.apply(this, args).then((stream) => {
        try { for (const t of stream.getTracks()) { if (share) t.__brinkyShare = true; tracks.add(t); t.addEventListener("ended", report); } report(); } catch {}
        return stream;
      });
    };
  };
  wrap("getUserMedia", false);
  wrap("getDisplayMedia", true);
  setInterval(() => { if (tracks.size || last.includes("true")) report(); }, 2000);

  if (!isTop) {
    let lastPing = 0;
    const ping = () => { const n = Date.now(); if (n - lastPing > 800) { lastPing = n; post({ type: "key" }); } };
    addEventListener("keydown", ping, true);
    addEventListener("input", ping, true);
  }
})();
