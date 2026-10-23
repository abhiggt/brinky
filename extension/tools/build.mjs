// Usage (from the brinky folder): node tools/build.mjs [outDir]   — needs Node and `npm i esbuild`
// Builds the installable, size-optimised Brinky from the readable source:
// minified JS and CSS, WebP sprites, no original art or build tooling.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(fs.readFileSync(`${SRC}/manifest.json`, "utf8")).version;
const OUT = process.argv[2] || path.resolve(SRC, "..", `brinky-${version}-build`);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const MODULES = new Set(["background.js", "common.js", "popup.js", "settings.js", "sound.js", "welcome.js", "options.js", "break.js"]);
let before = 0, after = 0;
const out = (f, data) => { fs.mkdirSync(path.dirname(`${OUT}/${f}`), { recursive: true }); fs.writeFileSync(`${OUT}/${f}`, data); after += Buffer.byteLength(data); };

for (const f of fs.readdirSync(SRC)) {
  const p = `${SRC}/${f}`, stat = fs.statSync(p);
  if (stat.isDirectory()) continue;
  const src = fs.readFileSync(p, "utf8");
  if (f.endsWith(".js")) {
    before += stat.size;
    // leading indentation inside template literals (CSS and HTML) carries no meaning
    const pre = src.replace(/\n[ \t]+/g, "\n");
    const { code } = await transform(pre, { loader: "js", minify: true, target: "chrome130", legalComments: "none", ...(MODULES.has(f) ? { format: "esm" } : {}) });
    out(f, code);
  } else if (f.endsWith(".css")) {
    before += stat.size;
    out(f, (await transform(src, { loader: "css", minify: true })).code);
  } else if (f.endsWith(".html")) {
    before += stat.size;
    out(f, src.replace(/<!--[\s\S]*?-->/g, "").replace(/\n[ \t]+/g, "\n").replace(/\n{2,}/g, "\n"));
  } else if (f === "manifest.json") {
    before += stat.size;
    out(f, JSON.stringify(JSON.parse(src)));
  } else if (/\.(md)$/.test(f)) {
    out(f, src);
  }
}
for (const dir of ["icons", "mascot"]) for (const f of fs.readdirSync(`${SRC}/${dir}`)) { const b = fs.readFileSync(`${SRC}/${dir}/${f}`); before += b.length; out(`${dir}/${f}`, b); }

const perPage = ["mascot.js", "content.js", "pagewatch.js"].reduce((a, f) => a + fs.statSync(`${OUT}/${f}`).size, 0);
const onDemand = ["breaklayer.js", "water.js"].reduce((a, f) => a + fs.statSync(`${OUT}/${f}`).size, 0);
console.log(JSON.stringify({ out: OUT, codeAndArtKB: { before: Math.round(before / 1024), after: Math.round(after / 1024) }, perPageScriptsKB: +(perPage / 1024).toFixed(1), loadedOnlyWhenNeededKB: +(onDemand / 1024).toFixed(1) }));
