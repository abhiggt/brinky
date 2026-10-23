// The full settings page (opens in a tab): Basics, and SuperBrink mode with every detail.
import { getRaw, saveSettings } from "./common.js";
import { mountSettings } from "./settings.js";

const $ = (id) => document.getElementById(id);
const send = (m) => chrome.runtime.sendMessage(m).catch(() => {});
let S = await getRaw(), page = location.hash === "#basics" ? "basics" : "super", ownSave = 0;

$("buddy").innerHTML = globalThis.BrinkyMascot?.html({ mood: "happy", size: 58 }) || "";
globalThis.BrinkyMascot?.blink(document);

async function setK(k, v) {
  const [a, b] = k.split(".");
  ownSave = Date.now();
  S = await saveSettings(b ? { [a]: { ...S[a], [b]: v } } : { [a]: v });
  await send({ t: "settingsChanged" });
}
const ctx = {
  get S() { return S; }, set S(x) { S = x; }, setK, send, go: () => {},
  openSuper: () => show("super"), remount: () => show(page), savedEl: $("saved"),
};
function show(p) {
  page = p;
  try { history.replaceState(null, "", `#${p}`); } catch {}
  document.querySelectorAll("[data-page]").forEach((b) => b.setAttribute("aria-current", b.dataset.page === p ? "page" : "false"));
  mountSettings($("main"), p === "basics" ? "basics" : "super", ctx);
}
document.querySelectorAll("[data-page]").forEach((b) => (b.onclick = () => { show(b.dataset.page); scrollTo(0, 0); }));

// changes made elsewhere (the popup, the welcome tour) show up here too
chrome.storage.onChanged.addListener(async (c, area) => {
  if (area !== "sync" || !c.settings || Date.now() - ownSave < 800 || document.activeElement?.matches("input,textarea,select")) return;
  S = await getRaw();
  const y = scrollY; show(page); scrollTo(0, y);
});
show(page);
