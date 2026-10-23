// Synthesized sounds for the settings preview, no audio files needed.
let ctx;
const ac = () => (ctx ||= new AudioContext());
function tone(freq, start, dur, vol, type = "sine") {
  const c = ac(), o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
}
export function chime(kind, volume = 0.6, end = false) {
  const v = volume * 0.2;
  if (kind === "none") return;
  if (kind === "chime") (end ? [784, 1046.5] : [523.25, 659.25, 784]).forEach((f, i) => tone(f, i * 0.14, 1.4, v));
  if (kind === "bowl") [220, 440.6, 661.8, 883.2].forEach((f, i) => tone(f, 0, 4 - i * 0.6, v / (i + 1)));
  if (kind === "bell") [880, 1760, 2637].forEach((f, i) => tone(f, end ? 0.2 : 0, 2.2 - i * 0.5, v / (i + 1.5), "triangle"));
}
