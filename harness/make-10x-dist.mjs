// make-10x-dist.mjs — a 10x WORLD PAGE without a 10x build.
//
// WHY THIS EXISTS. The build and the render fail at different N, and conflating
// them would lose the more interesting number. At 10x the Astro build dies in
// V8's parser zone on a 137 MB letters.json module, so there is no 10x dist-town
// to point a browser at. But the world page's payload and render are functions
// of the WORLD FOLD and the faces record — not of letters.json, which that page
// never imports. So the render measurement is taken on the 1x build with the
// 10x records swapped in: the same HTML, the same viewer, the same CSS, a ten
// times larger world. Every other page's 10x number is a build number, and the
// report says so.
//
// Swaps: world/world-state.json (the fold) and world-engine/residents-meta.json
// (the faces the viewer draws on walkers), the latter cloned with the same
// `-cN` handle suffix scale-data.mjs uses, so a cloned mark's `by` names a face
// that exists.
//
// Usage: node harness/make-10x-dist.mjs --dist <dist-town> --fold <world-state.json> --factor 10
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const DIST = arg("--dist");
const FOLD = arg("--fold");
const FACTOR = Number(arg("--factor", "10"));
if (!DIST || !FOLD) { console.error("need --dist and --fold"); process.exit(2); }

const target = join(DIST, "world", "world-state.json");
const before = existsSync(target) ? readFileSync(target).length : 0;
copyFileSync(FOLD, target);
const after = readFileSync(target).length;

const metaPath = join(DIST, "world-engine", "residents-meta.json");
let meta_before = null, meta_after = null, faces_before = null, faces_after = null;
if (existsSync(metaPath)) {
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  meta_before = readFileSync(metaPath).length;
  faces_before = Object.keys(meta.residents ?? {}).length;
  const out = { ...meta, residents: { ...(meta.residents ?? {}) } };
  for (let k = 1; k < FACTOR; k++)
    for (const [h, v] of Object.entries(meta.residents ?? {})) out.residents[`${h}-c${k}`] = { ...v };
  const text = JSON.stringify(out);
  writeFileSync(metaPath, text);
  meta_after = text.length; faces_after = Object.keys(out.residents).length;
}

console.log(JSON.stringify({
  dist: DIST, factor: FACTOR, stamped: new Date().toISOString(),
  fold_bytes_before: before, fold_bytes_after: after,
  faces_before, faces_after, faces_bytes_before: meta_before, faces_bytes_after: meta_after,
}, null, 2));
