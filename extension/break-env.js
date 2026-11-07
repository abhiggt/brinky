// The break window: read the break from the address, report back, close when done.
globalThis.BrinkyMsg = (() => { try { return JSON.parse(decodeURIComponent(location.hash.slice(1))); } catch { return { t: "eye", id: "w", ex: "far" }; } })();
globalThis.BrinkyEnv = {
  asset: (p) => p,
  send: (m) => {
    chrome.runtime.sendMessage(m).catch(() => {});
    const sip = BrinkyMsg.sip && m.kind === "eye" && m.r === "done";
    setTimeout(() => window.close(), sip ? 9800 : m.kind === "water" ? 400 : 2800);
    return Promise.resolve();
  },
};
