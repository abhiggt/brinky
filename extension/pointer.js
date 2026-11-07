// The only script Brinky keeps on a page: it remembers where your pointer is and when you last typed,
// so a tumbler can land on your cursor and nothing interrupts you mid-sentence. Three assignments per event.
(() => {
  if (globalThis.__brinkyPtr) return;
  const p = (globalThis.__brinkyPtr = { x: -1, y: -1, k: 0 });
  addEventListener("pointermove", (e) => { p.x = e.clientX; p.y = e.clientY; }, { passive: true, capture: true });
  addEventListener("keydown", () => { p.k = Date.now(); }, { passive: true, capture: true });
})();
