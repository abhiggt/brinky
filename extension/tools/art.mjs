// Faces and toolbar icons from your original art: art/<mood>.png → mascot/<mood>.webp, icons/*.png
// Usage (from the brinky folder): node tools/art.mjs   — needs Node and `npm i sharp`
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOODS = ["blank", "blink", "calm", "excited", "happy", "proud", "sleepy", "smug", "surprised", "wink", "worried"];
for (const mood of MOODS) await sharp(`${ROOT}/art/${mood}.png`).webp({ quality: 92, alphaQuality: 100, effort: 6 }).toFile(`${ROOT}/mascot/${mood}.webp`);
// toolbar icons: the drop, centred in a square
const square = async (mood, size) => {
  const crop = await sharp(`${ROOT}/art/${mood}.png`).extract({ left: 4, top: 3, width: 291, height: 244 }).toBuffer();
  const inner = Math.round(size * (size <= 16 ? 1 : 0.96));
  const body = await sharp(crop).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).sharpen(size <= 32 ? { sigma: 0.6 } : undefined).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: body, gravity: "center" }]).png({ compressionLevel: 9 });
};
for (const [mood, prefix] of [["happy", ""], ["blink", "blink-"]]) for (const s of [16, 32, 48, 128]) await (await square(mood, s)).toFile(`${ROOT}/icons/${prefix}${s}.png`);
console.log("faces and icons updated");
