// Fallback break window: used only when the tab in front can't show the break layer
// (chrome:// pages, the New Tab page), or when you open a break from a notification.
const send = (m) => chrome.runtime.sendMessage(m).catch(() => {});
const o = await send({ t: "breakState" });
if (!o?.endsAt) window.close();
else {
  BrinkyBreak.start(document.body, { ...o, look: "dark", primary: true }, (a, extra) => {
    if (a === "water") send({ t: "logWater" });
    else if (a === "postpone") send({ t: "endBreak", reason: "postpone", postpone: 5 });
    else if (a === "skip") send({ t: "endBreak", reason: "skip" });
    else if (a === "done") send({ t: "breakDone", seenMs: extra?.seenMs || 0, primary: true });
  });
  chrome.runtime.onMessage.addListener((m) => { if (m.t === "breakEnd") window.close(); });
}
