// scale-data.mjs — make the site's data layer N times the town it is.
//
// The site's page count, build wall and payload are functions of the DATA LAYER
// (src/data/postmark/*.json + the same files under public/atelier/postmark/data),
// not of the town checkout. This script multiplies that layer by cloning the
// whole town into K cohorts, each with every handle, letter id, thread key and
// household slug suffixed `-cN`. Referential integrity holds inside a cohort —
// a cloned letter is from a cloned resident to a cloned resident, a cloned
// thread names cloned letters — which is what the page templates fold over.
//
// What is deliberately NOT multiplied, and why:
//   media.json — cloned residents point at the ORIGINAL avatar/home images, so
//     the image FILES on disk stay 1x. A 10x town has 10x faces to fetch but the
//     bytes-per-face do not change, and inventing 10x PNGs would measure the
//     disk, not the site. Every avatar fetch a cloned resident causes is still
//     counted; it just hits a warm URL.
//   docs / economy / meeps / pots / renditions / deeds — town-wide singletons.
//     They do not grow with residents, so multiplying them would be a lie.
//
// Usage: node harness/scale-data.mjs --tree <site tree> --factor 10
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const TREE = arg("--tree");
const FACTOR = Number(arg("--factor", "10"));
if (!TREE) { console.error("need --tree"); process.exit(2); }

const SRC = join(TREE, "src", "data", "postmark");
const PUB = join(TREE, "public", "atelier", "postmark", "data");
const BAK = join(TREE, ".data-1x-backup");
mkdirSync(BAK, { recursive: true });

const NAMES = ["residents", "letters", "threads", "ledger", "households", "friendships", "bulletin", "stats"];
const read = (n) => JSON.parse(readFileSync(join(SRC, n + ".json"), "utf8"));
function backupOnce(n) {
  const b = join(BAK, n + ".json");
  if (!existsSync(b)) copyFileSync(join(SRC, n + ".json"), b);
  return JSON.parse(readFileSync(b, "utf8"));   // always scale from the 1x original
}
function write(n, v) {
  const text = JSON.stringify(v);
  writeFileSync(join(SRC, n + ".json"), text);
  if (existsSync(PUB)) writeFileSync(join(PUB, n + ".json"), text);
  return text.length;
}

const sfx = (s, k) => (typeof s === "string" && s ? `${s}-c${k}` : s);
const clone = (o) => JSON.parse(JSON.stringify(o));

const report = {};
for (const name of NAMES) if (existsSync(join(SRC, name + ".json"))) report[name] = { before: null, after: null, rows_before: null, rows_after: null };

// ── residents ──────────────────────────────────────────────────────────────
{
  const base = backupOnce("residents");
  const out = [...base];
  for (let k = 1; k < FACTOR; k++) for (const r of base) {
    const c = clone(r);
    c.handle = sfx(r.handle, k);
    if (c.address?.agent) c.address.agent = `${c.address.agent} ${k}`;
    out.push(c);
  }
  report.residents = { rows_before: base.length, rows_after: out.length, after: write("residents", out) };
}
// ── letters ────────────────────────────────────────────────────────────────
{
  const base = backupOnce("letters");
  const out = [...base];
  for (let k = 1; k < FACTOR; k++) for (const l of base) {
    const c = clone(l);
    c.id = sfx(l.id, k); c.from = sfx(l.from, k); c.to = sfx(l.to, k);
    if (Array.isArray(c.toList)) c.toList = c.toList.map((t) => sfx(t, k));
    if (c.thread) c.thread = sfx(c.thread, k);
    out.push(c);
  }
  report.letters = { rows_before: base.length, rows_after: out.length, after: write("letters", out) };
}
// ── threads ────────────────────────────────────────────────────────────────
{
  const base = backupOnce("threads");
  const out = [...base];
  for (let k = 1; k < FACTOR; k++) for (const t of base) {
    const c = clone(t);
    c.key = sfx(t.key, k);
    if (Array.isArray(c.participants)) c.participants = c.participants.map((p) => sfx(p, k));
    if (Array.isArray(c.letterIds)) c.letterIds = c.letterIds.map((i) => sfx(i, k));
    out.push(c);
  }
  report.threads = { rows_before: base.length, rows_after: out.length, after: write("threads", out) };
}
// ── ledger ─────────────────────────────────────────────────────────────────
{
  const base = backupOnce("ledger");
  const out = [...base];
  for (let k = 1; k < FACTOR; k++) for (const e of base) {
    const c = clone(e);
    if (c.id) c.id = sfx(e.id, k);
    if (c.from) c.from = sfx(e.from, k);
    if (c.to) c.to = sfx(e.to, k);
    if (c.thread) c.thread = sfx(e.thread, k);
    out.push(c);
  }
  report.ledger = { rows_before: base.length, rows_after: out.length, after: write("ledger", out) };
}
// ── households ─────────────────────────────────────────────────────────────
{
  const base = backupOnce("households");
  const out = clone(base);
  const src = base.households ?? {};
  for (let k = 1; k < FACTOR; k++) for (const [slug, dec] of Object.entries(src)) {
    const c = clone(dec);
    if (Array.isArray(c.residents)) c.residents = c.residents.map((h) => sfx(h, k));
    out.households[sfx(slug, k)] = c;
  }
  report.households = { rows_before: Object.keys(src).length, rows_after: Object.keys(out.households).length, after: write("households", out) };
}
// ── friendships ────────────────────────────────────────────────────────────
{
  const base = backupOnce("friendships");
  const out = clone(base);
  const src = base.pairs ?? [];
  const pairs = [...src];
  for (let k = 1; k < FACTOR; k++) for (const p of src) {
    const c = clone(p); c.a = sfx(p.a, k); c.b = sfx(p.b, k); pairs.push(c);
  }
  out.pairs = pairs;
  report.friendships = { rows_before: src.length, rows_after: pairs.length, after: write("friendships", out) };
}
// ── bulletin ───────────────────────────────────────────────────────────────
{
  const base = backupOnce("bulletin");
  const out = [...base];
  for (let k = 1; k < FACTOR; k++) for (const b of base) {
    const c = clone(b); c.slug = sfx(b.slug, k); if (c.path) c.path = `${c.path}.c${k}`; out.push(c);
  }
  report.bulletin = { rows_before: base.length, rows_after: out.length, after: write("bulletin", out) };
}
// ── stats (the town's own totals, kept honest) ─────────────────────────────
{
  const base = backupOnce("stats");
  const out = clone(base);
  for (const k of ["residents", "letters", "deliveries", "bounces", "threads"])
    if (typeof out[k] === "number") out[k] *= FACTOR;
  report.stats = { rows_before: base.residents, rows_after: out.residents, after: write("stats", out) };
}

console.log(JSON.stringify({ tree: TREE, factor: FACTOR, stamped: new Date().toISOString(), report }, null, 2));
