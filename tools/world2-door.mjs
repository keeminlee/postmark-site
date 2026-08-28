// world2-door.mjs — THE SITE READS THE DOOR (World 2.0, try-out branch).
//
// Gold plan §2: "The site queries the door (MCP-first law finally made
// structurally true)." Until now the world page's record came off a BAKE: the
// pinned postmark-world package carries a committed `WORLD/world-state.json`
// that a fold wrote into the world repo, world-engine-island copies it into the
// build output, and the site's freshness is therefore a PIPELINE — a pin, a
// fold, a sync cron, and a staleness sentinel watching all three. The plan rules
// that whole pipeline a KILL. This module is what replaces it: the same record
// shape, composed at build time out of live queries against the 2.0 door, so
// freshness is a query and the site holds no second copy of the world.
//
// It is a RE-PLUMBING. The viewer's contract is untouched — it still fetches
// `/WORLD/world-state.json` and `/WORLD/skeleton.json` same-origin and still
// gets exactly the keys `assembleWorld()` reads. What changed is who wrote them.
//
// THE ONE RULE HELD HERE (gold §2, MCP-first): where the door does not carry a
// field, this module leaves it ABSENT and says so out loud. It does not reach
// around the door to the repo, to raw.githubusercontent, or to the package's
// baked copy for the missing half — that would rebuild the bake behind a nicer
// name and the site would look correct while the door stayed incomplete. The
// door grows; the page never reaches around it. `doorGaps()` is the honest list.
//
//   WORLD2_DOOR_URL   where the door is (default http://localhost:14382, the
//                     conventional local tunnel: ssh -f -L 14382:localhost:4382
//                     meepo-ec2 sleep 3600)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DOOR = "http://localhost:14382";

export const doorUrl = (env = process.env) => (env.WORLD2_DOOR_URL || DEFAULT_DOOR).replace(/\/+$/, "");

/** every field the composition below could not fill, recorded as it happens */
const gaps = [];
const gap = (field, why) => { if (!gaps.some((g) => g.field === field)) gaps.push({ field, why }); };
export const doorGaps = () => gaps.slice();

// THE BUDGET IS THE FINDING. The door is keyless (its reads are public facts),
// and the office's bouncer refills keyless GETs at 120 a minute with a burst of
// 240 (`src/bouncer.mjs` BOUNCER_LIMITS.keyless). Composing the record needs one
// read per standing mark — 831 of them — so a straight run at width 8 answers
// 429 after the first burst and the build ships a world where most marks have no
// body. That is not a tuning problem: the site's own page cannot be built from
// the door's current read set, and the fix belongs behind the door (the report's
// first finding).
//
// Until the door grows a bulk full-row read, the build PAYS the budget honestly:
// paced under the refill rate, and 429s obeyed rather than raced. Measured at
// 456s for a cold compose of 831 marks — the true cost of the missing read, left
// visible rather than engineered away.
const KEYLESS_PER_MINUTE = 110;   // under the door's 120, so the bucket never empties
const PACE_MS = Math.ceil(60_000 / KEYLESS_PER_MINUTE);
let nextSlot = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function slot() {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + PACE_MS;
  if (at > now) await sleep(at - now);
}

// A build that cannot reach the door FAILS, and says how to reach it. There is
// deliberately no fallback to the package's baked world-state: a silent fall
// back to the bake IS the bake, and the branch's whole claim is that the site no
// longer holds one. (Anti-rebake rule 6 — cutover means deletion.)
async function ask(path, env = process.env) {
  const url = `${doorUrl(env)}${path}`;
  for (let attempt = 0; ; attempt++) {
    await slot();
    let res;
    try {
      res = await fetch(url);
    } catch (e) {
      throw new Error(
        `[world2-door] the door did not answer at ${doorUrl(env)} (${e?.message ?? e}).\n` +
        `  The world page is built FROM the door on this branch — there is no baked copy to fall back to.\n` +
        `  Open the tunnel:  ssh -f -L 14382:localhost:4382 meepo-ec2 sleep 3600\n` +
        `  or point elsewhere: WORLD2_DOOR_URL=https://…`);
    }
    if (res.status === 429 && attempt < 6) {
      // The bouncer says exactly how long to wait; waiting is the whole protocol.
      const after = Number(res.headers.get("retry-after")) || 5;
      nextSlot = Date.now() + after * 1000;
      continue;
    }
    if (!res.ok) throw new Error(`[world2-door] ${url} → HTTP ${res.status}`);
    return { body: await res.json(), asOf: res.headers.get("x-postmark-world-store-as-of") };
  }
}
const askBody = async (path, env) => (await ask(path, env)).body;

// ── the compose cache ───────────────────────────────────────────────────────
//
// NOT A BAKE, and the difference is the key. This memoizes the 831 detail reads
// under a digest of THE LIST READ ITSELF — the one query that is cheap, is taken
// fresh on every compose, and moves whenever any mark's slug, kind, owner,
// geometry, status, locked window or parent moves. There is no cron, no pin, and
// no sentinel, because there is nothing for it to be stale ABOUT: a store that
// has changed shape produces a different key and the memo misses.
//
// The door's own `x-postmark-world-store-as-of` header was the obvious key and
// is the WRONG one: the office sets it from the law projection's sha, so it does
// not move when a clearing locks new marks — which is precisely the moment the
// memo must miss. The list digest does move then.
//
// The hole it does NOT close, stated rather than hidden: a mark whose BODY is
// edited with none of its list columns touched keeps the same key and is served
// from the memo until something else in the register moves. That is the price of
// a bulk read the door does not have, and it disappears with the read.
//
// Untracked (node_modules/.cache) — a clone with a cold cache builds the same
// page, slower. `WORLD2_DOOR_NO_CACHE=1` skips it entirely.
import { createHash } from "node:crypto";
const CACHE_DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), "node_modules", ".cache", "world2-door");
const cacheKey = (listBody) => createHash("sha256").update(JSON.stringify(listBody)).digest("hex").slice(0, 32);
const cachePath = (key) => join(CACHE_DIR, `marks-${key}.json`);
function cacheRead(key) {
  if (process.env.WORLD2_DOOR_NO_CACHE === "1") return null;
  try { return JSON.parse(readFileSync(cachePath(key), "utf8")); } catch { return null; }
}
function cacheWrite(key, value) {
  if (process.env.WORLD2_DOOR_NO_CACHE === "1") return;
  try { mkdirSync(CACHE_DIR, { recursive: true }); writeFileSync(cachePath(key), JSON.stringify(value)); } catch { /* a cache that cannot write is still correct */ }
}

// ── the law projection ──────────────────────────────────────────────────────
// Law is repo-first and exported (gold §3 rule 2), so the door serves it as a
// projection stamped with the law commit sha. Three of the record's parts live
// here rather than in `marks`: the terrain skeleton, the class marks, and the
// household roster.
async function law(kind) {
  const body = await askBody(`/world2/law?kind=${encodeURIComponent(kind)}`);
  return { sha: body.law_sha, rows: body.rows ?? [] };
}

/**
 * `WORLD/skeleton.json`, rebuilt from the law projection.
 * The ingester splits the file into one row per top-level key, so re-keying the
 * rows IS the file — verified key-for-key against the repo's copy.
 */
export async function doorSkeleton() {
  const { sha, rows } = await law("skeleton");
  const skeleton = Object.fromEntries(rows.map((r) => [r.key, r.data]));
  if (!skeleton.elevation || !skeleton.light) {
    throw new Error("[world2-door] the law projection's skeleton is missing elevation/light — the viewer cannot draw terrain without them");
  }
  return { skeleton, law_sha: sha };
}

// ── the marks ───────────────────────────────────────────────────────────────
//
// The list read (`/world2/marks?all=true`) carries the eight columns the map
// needs to PLACE a mark and none of the ones it needs to TELL one: no body, no
// tier, no date, no `data`. Those live only on the single-mark read, so the
// composition below asks the door once per standing mark — 831 times, against a
// keyless budget of 120 a minute. This is the branch's headline finding and the
// pacing above is what paying it costs.

/** a door mark row (+ its detail) in the shape `assembleWorld()` and the viewer read */
function toRecordMark(row, detail) {
  const data = detail?.data ?? {};
  const g = row.geometry ?? detail?.geometry ?? null;
  const mark = {
    id: row.slug,
    kind: row.kind,
    by: row.owner,
    household: row.household,
    parent: row.parent ?? null,
  };
  if (g?.at) mark.at = g.at;
  if (g?.extent) mark.extent = g.extent;
  if (g?.points) mark.points = g.points;
  if (detail?.body != null) mark.body = detail.body;
  // Everything the seed carried through as free-form record fields — tier, date,
  // pre, mechanic, class, dials, image, feature… — rides in `data`. Underscored
  // keys are the importer's own bookkeeping (`_stray`, `_fileAt`, `_origin`,
  // `_parentMarkId`) and are not part of the record the viewer reads.
  for (const [k, v] of Object.entries(data)) if (!k.startsWith("_")) mark[k] = v;
  return mark;
}

/**
 * The whole record the world page used to get off the bake:
 * `{ marks, parcels, households, dials, determined, … }`.
 */
export async function doorWorldState() {
  const register = await ask("/world2/marks?all=true");
  const [classes, roster, windows] = await Promise.all([
    law("class"),
    law("roster"),
    askBody("/world2/windows"),
  ]);

  const rows = register.body.marks ?? [];
  const key = cacheKey(register.body);
  let details = cacheRead(key);
  if (!details || details.length !== rows.length) {
    console.log(`[world2-door] composing ${rows.length} marks one read at a time — the door has no bulk full-row read, ` +
      `so this costs ~${Math.ceil(rows.length / KEYLESS_PER_MINUTE)} min against the keyless budget.`);
    details = [];
    for (const row of rows) {
      details.push(await askBody(`/world2/mark?slug=${encodeURIComponent(row.slug)}`).catch(() => null));
      if (details.length % 100 === 0) console.log(`[world2-door]   ${details.length}/${rows.length}`);
    }
    if (!details.some((d) => d === null)) cacheWrite(key, details);
  }
  // THE READ TEARS, and this is the second half of the missing-bulk-read finding.
  // The compose is N+1 reads against a store that moves: the register was
  // observed going 831 → 846 → 831 rows inside twenty seconds while a sibling
  // lane wrote to it, and a slug the LIST returned answered "no mark" on the
  // DETAIL read minutes later, then answered fine again afterwards. The bake it
  // replaces could not do this — a git commit is a snapshot by construction —
  // and the door offers no as-of or snapshot read to stand in for one.
  //
  // A second pass recovers the slugs that were merely mid-write; whatever is
  // still missing is reported with its real count rather than as "at least one".
  const missed = details.map((d, i) => (d === null ? i : -1)).filter((i) => i >= 0);
  if (missed.length) {
    console.log(`[world2-door] ${missed.length} detail reads tore against a moving store — second pass`);
    for (const i of missed) details[i] = await askBody(`/world2/mark?slug=${encodeURIComponent(rows[i].slug)}`).catch(() => null);
    const still = details.filter((d) => d === null).length;
    if (still) gap("marks[].body", `${still} of ${rows.length} marks came back "no mark" on the detail read though the register listed them — ` +
      `the compose is N+1 reads against a store with no snapshot read, so it tears. Those marks are placed but untold.`);
    else cacheWrite(key, details);
  }

  const marks = rows.map((row, i) => toRecordMark(row, details[i]));

  // CLASS MARKS ARE LAW (the seed's own census says so: 129 of them were not
  // carried into `marks` because the law ingester owns them). The record the
  // viewer reads has always held them alongside the rest — a class mark is what
  // gives a sited mark its tier, its dials, and its tells — so they are folded
  // back in here, from the door's law tier, rather than left out.
  for (const r of classes.rows) {
    const d = r.data ?? {};
    const id = d.id ?? d.slug ?? `the-town/${r.key}`;
    marks.push({ ...Object.fromEntries(Object.entries(d).filter(([k]) => !k.startsWith("_"))), id, kind: d.kind ?? "class" });
  }

  // THE PARCEL IS THE HOME (ruling 7 — world-build.mjs reads `worldState.parcels`
  // as its own list, and without it every resident's home resolution falls back
  // to the quay while looking like ordinary "no ground yet"). The door has no
  // parcels read, so the list is derived from the parcel-kind marks it does
  // serve; that derivation belongs behind the door, not here.
  const parcels = marks
    .filter((m) => m.kind === "parcel" && m.at)
    .map((m) => ({ id: m.id, household: m.household, at: m.at, extent: m.extent }));
  gap("parcels", "no /world2/parcels read; derived here from kind=parcel marks — a view the door should serve");

  const households = Object.fromEntries(roster.rows.map((r) => [r.key, r.data?.household ?? null]));

  const state = {
    marks,
    parcels,
    households,
    // Fold-derived halves of the 1.0 record that the store does not carry, left
    // ABSENT rather than faked. Both gaps are reported at the size they actually
    // are — checked against the readers rather than assumed, because a gap list
    // that overstates is as useless as one that hides.
    determined: {},
    dials: {},
  };
  gap("determined", "the determination map is fold-derived and the store has no equivalent. Its only reader is viewer.mjs " +
    "`resolveMarkName`, which looks for `<mark id>::name` keys — and the 1.0 record carries NONE of those today (its ten " +
    "entries are all non-name slots: ::mouth, ::stance, ::wall-map…). So nothing on the page differs today; it goes visible " +
    "the first time a determination names a mark, and the door has nowhere to put that.");
  gap("dials", "world-level dials (determine_pct, release_pct, parcel_w, parcel_h) are in no law kind the door serves. " +
    "No viewer reader — `state.dials` is the viewer's own constant, not this field — so the page is unaffected. They are " +
    "FOLD input, which is the real hole: the door cannot yet re-derive parcels the way marks-fold does.");

  const open = (windows.windows ?? []).find((w) => w.status === "open") ?? null;
  return {
    state,
    provenance: {
      door: doorUrl(),
      read_at: new Date().toISOString(),
      law_sha: classes.sha,
      window: open ? { id: open.id, closes_at: open.closes_at } : null,
      counts: { marks: marks.length, parcels: parcels.length, households: Object.keys(households).length },
    },
  };
}

/** `/world2/docket` — the public docket, straight through. */
export async function doorDocket() {
  return askBody("/world2/docket");
}
