// scale-world.mjs — make the world fold N times the world it is.
//
// The fold the world page draws is WORLD/world-state.json inside the pinned
// postmark-world package: 1184 marks and 89 parcels tonight. This multiplies it
// by TILING: cohort k is the whole 1x world translated by (k mod g) spans east
// and (k div g) spans south, g = ceil(sqrt(F)). Positions, parcel sizes and
// local density are untouched — a town that grows by taking more land, which is
// what the world's own coordinate frame (metres, 5 m per atlas px) describes.
// The alternative — packing F times the marks into the SAME extent — measures a
// different question (density, not size) and would collide with the viewer's
// own 120 m parcel-art box, which is a constant in metres.
//
// Usage: node harness/scale-world.mjs --tree <site tree> --factor 10
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const TREE = arg("--tree");
const FACTOR = Number(arg("--factor", "10"));
if (!TREE) { console.error("need --tree"); process.exit(2); }

const WORLD = join(TREE, "node_modules", "postmark-world", "WORLD");
const FILE = join(WORLD, "world-state.json");
const BAK = join(WORLD, "world-state.1x.json");
if (!existsSync(BAK)) copyFileSync(FILE, BAK);
const base = JSON.parse(readFileSync(BAK, "utf8"));

const pts = [...base.marks, ...base.parcels].map((m) => m.at).filter((a) => a && Number.isFinite(a.x));
const spanX = Math.max(...pts.map((a) => a.x)) - Math.min(...pts.map((a) => a.x)) || 1000;
const spanY = Math.max(...pts.map((a) => a.y)) - Math.min(...pts.map((a) => a.y)) || 1000;
// TWO SHAPES OF "TEN TIMES THE WORLD", and they do not give the same answer.
//   --mode tiled (default): ten towns' worth of land. Cohorts are translated
//     clear of each other, so the camera at the Town Centre still sees exactly
//     the town it saw before and the viewer's field-of-view clip does the rest.
//   --mode dense: one town with ten times the marks in it. Cohorts are jittered
//     inside the SAME extent, so every clone lands in the field of view of a
//     camera that has not moved. This is the shape that matches how Postmark
//     actually grows — parcels are granted inside the regions that exist — and
//     it is the one that tests the viewer's draw path rather than its clip.
// The jitter is deterministic (seeded from the cohort and the mark's index) so
// two runs of this script produce byte-identical folds.
const MODE = arg("--mode", "tiled");
const g = Math.ceil(Math.sqrt(FACTOR));
const clone = (o) => JSON.parse(JSON.stringify(o));
const sfx = (s, k) => (typeof s === "string" && s ? `${s}-c${k}` : s);
// a small deterministic PRNG — the fold has to be reproducible from the flags alone
const rnd = (a) => { let t = (a + 0x6d2b79f5) >>> 0; t = Math.imul(t ^ (t >>> 15), 1 | t); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return (((t ^ (t >>> 14)) >>> 0) / 4294967296) - 0.5; };

const marks = [...base.marks];
const parcels = [...base.parcels];
for (let k = 1; k < FACTOR; k++) {
  if (MODE === "dense") {
    // jitter each clone within ±3% of the world's span, around its own position
    const jx = (i) => rnd(k * 100003 + i) * spanX * 0.06;
    const jy = (i) => rnd(k * 900007 + i) * spanY * 0.06;
    base.marks.forEach((m, i) => {
      const c = clone(m);
      c.id = sfx(m.id, k); if (c.by) c.by = sfx(m.by, k);
      if (c.household) c.household = sfx(m.household, k);
      if (c.declared_household) c.declared_household = sfx(m.declared_household, k);
      if (c.at) { c.at.x += jx(i); c.at.y += jy(i); }
      marks.push(c);
    });
    base.parcels.forEach((p, i) => {
      const c = clone(p);
      c.id = sfx(p.id, k); if (c.household) c.household = sfx(p.household, k);
      if (c.at) { c.at.x += jx(i + 5e4); c.at.y += jy(i + 5e4); }
      parcels.push(c);
    });
    continue;
  }
  const dx = (k % g) * spanX * 1.05, dy = Math.floor(k / g) * spanY * 1.05;
  for (const m of base.marks) {
    const c = clone(m);
    c.id = sfx(m.id, k); if (c.by) c.by = sfx(m.by, k);
    if (c.household) c.household = sfx(m.household, k);
    if (c.declared_household) c.declared_household = sfx(m.declared_household, k);
    if (c.at) { c.at.x += dx; c.at.y += dy; }
    marks.push(c);
  }
  for (const p of base.parcels) {
    const c = clone(p);
    c.id = sfx(p.id, k); if (c.household) c.household = sfx(p.household, k);
    if (c.at) { c.at.x += dx; c.at.y += dy; }
    parcels.push(c);
  }
}
const out = { ...clone(base), marks, parcels };
const text = JSON.stringify(out);
writeFileSync(FILE, text);

console.log(JSON.stringify({
  tree: TREE, factor: FACTOR, mode: MODE, stamped: new Date().toISOString(),
  marks_before: base.marks.length, marks_after: marks.length,
  parcels_before: base.parcels.length, parcels_after: parcels.length,
  bytes_before: readFileSync(BAK).length, bytes_after: text.length,
  span_before: { x: Math.round(spanX), y: Math.round(spanY) },
  span_after: { x: Math.round(spanX * (1 + (g - 1) * 1.05)), y: Math.round(spanY * (1 + (Math.ceil(FACTOR / g) - 1) * 1.05)) },
}, null, 2));
