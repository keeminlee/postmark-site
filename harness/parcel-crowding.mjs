// parcel-crowding.mjs — at what N do the town's houses stop having room for
// their own picture?
//
// The viewer draws a parcel's art in a box at least PARCEL_ART_MIN_M = 120
// metres across (postmark-world spectator/viewer.mjs), and that constant is in
// METRES, so it does not shrink when the town gets crowded. Two parcels closer
// together than 120 m have overlapping pictures — the map stops reading as a
// town of houses and starts reading as a pile.
//
// This measures the nearest-neighbour distance between parcels at each scale
// factor, using the same deterministic dense scaling scale-world.mjs applies,
// and reports the fraction under the art box. No browser needed: it is geometry
// over the fold, and the constant is read from the installed viewer rather than
// retyped, so a change to the viewer moves this measurement with it.
//
// Usage: node harness/parcel-crowding.mjs --fold <1x world-state.json> --viewer <viewer.mjs> --factors 1,2,3,5,7,10,15,20
import { readFileSync } from "node:fs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const FOLD = arg("--fold");
const VIEWER = arg("--viewer", null);
const FACTORS = String(arg("--factors", "1,2,3,5,7,10,15,20")).split(",").map(Number);
if (!FOLD) { console.error("need --fold"); process.exit(2); }

// the constant, read from the viewer that is actually installed
let ART_MIN_M = 120;
if (VIEWER) {
  const m = readFileSync(VIEWER, "utf8").match(/PARCEL_ART_MIN_M\s*=\s*(\d+(?:\.\d+)?)/);
  if (m) ART_MIN_M = Number(m[1]);
  else console.error("WARN: PARCEL_ART_MIN_M not found in the viewer; falling back to 120");
}

const base = JSON.parse(readFileSync(FOLD, "utf8"));
const pts = [...base.marks, ...base.parcels].map((m) => m.at).filter((a) => a && Number.isFinite(a.x));
const spanX = Math.max(...pts.map((a) => a.x)) - Math.min(...pts.map((a) => a.x));
const spanY = Math.max(...pts.map((a) => a.y)) - Math.min(...pts.map((a) => a.y));
const rnd = (a) => { let t = (a + 0x6d2b79f5) >>> 0; t = Math.imul(t ^ (t >>> 15), 1 | t); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return (((t ^ (t >>> 14)) >>> 0) / 4294967296) - 0.5; };

const rows = [];
for (const F of FACTORS) {
  const ps = base.parcels.filter((p) => p.at).map((p) => ({ x: p.at.x, y: p.at.y }));
  for (let k = 1; k < F; k++) {
    const jx = (i) => rnd(k * 100003 + i) * spanX * 0.06;
    const jy = (i) => rnd(k * 900007 + i) * spanY * 0.06;
    base.parcels.forEach((p, i) => { if (p.at) ps.push({ x: p.at.x + jx(i + 5e4), y: p.at.y + jy(i + 5e4) }); });
  }
  const d = [];
  for (let i = 0; i < ps.length; i++) {
    let best = Infinity;
    for (let j = 0; j < ps.length; j++) {
      if (i === j) continue;
      const r = Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y);
      if (r < best) best = r;
    }
    d.push(best);
  }
  d.sort((a, b) => a - b);
  const q = (p) => Math.round(d[Math.min(d.length - 1, Math.floor(p * d.length))]);
  const crowded = d.filter((x) => x < ART_MIN_M).length;
  rows.push({ factor: F, parcels: ps.length, p10_m: q(0.1), median_m: q(0.5), p90_m: q(0.9), crowded, crowded_pct: +(100 * crowded / ps.length).toFixed(1) });
}
console.log(JSON.stringify({ fold: FOLD, art_min_m: ART_MIN_M, stamped: new Date().toISOString(), rows }, null, 2));
