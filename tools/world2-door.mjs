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

const DEFAULT_DOOR = "http://localhost:14382";

export const doorUrl = (env = process.env) => (env.WORLD2_DOOR_URL || DEFAULT_DOOR).replace(/\/+$/, "");

/** every field the composition below could not fill, recorded as it happens */
const gaps = [];
const gap = (field, why) => { if (!gaps.some((g) => g.field === field)) gaps.push({ field, why }); };
export const doorGaps = () => gaps.slice();

// A build that cannot reach the door FAILS, and says how to reach it. There is
// deliberately no fallback to the package's baked world-state: a silent fall
// back to the bake IS the bake, and the branch's whole claim is that the site no
// longer holds one. (Anti-rebake rule 6 — cutover means deletion.)
//
// The 429 branch stays. The door is keyless and the office's bouncer refills
// keyless GETs at 120 a minute (`src/bouncer.mjs` BOUNCER_LIMITS.keyless); this
// module no longer goes anywhere near that ceiling, but a shared budget is not
// ours alone to spend and the bouncer says exactly how long to wait.
async function ask(path, env = process.env) {
  const url = `${doorUrl(env)}${path}`;
  for (let attempt = 0; ; attempt++) {
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
      await new Promise((r) => setTimeout(r, after * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`[world2-door] ${url} → HTTP ${res.status}`);
    return res.json();
  }
}

// THE COMPOSE CACHE IS GONE, and its going is the point. It existed for exactly
// one reason — a build could not afford 846 single-mark reads twice — and every
// line of its justification named the missing bulk read as the thing it was
// waiting on. The read landed (`?full=true`, lab office world-2 @ 9faaa661), so
// the shim died with it rather than outliving its reason as one more piece of
// machinery nobody remembers the need for. (Anti-rebake rule 5: every shim ships
// with its own death.) A digest-keyed memo of a query that is now a single query
// would be pure cost: a second copy of the world, on disk, for nothing.

// ── the law projection ──────────────────────────────────────────────────────
// Law is repo-first and exported (gold §3 rule 2), so the door serves it as a
// projection stamped with the law commit sha. Three of the record's parts live
// here rather than in `marks`: the terrain skeleton, the class marks, and the
// household roster.
async function law(kind) {
  const body = await ask(`/world2/law?kind=${encodeURIComponent(kind)}`);
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

// ── the marks: ONE READ ─────────────────────────────────────────────────────
//
// `/world2/marks?all=true&full=true` returns the whole standing register as
// whole rows — body and `data` (tier rides `data.tier`) and bbox alongside the
// placement columns. Both of this branch's headline findings were about not
// having it, and both are answered by the same query:
//
//   THE BUDGET. The list read used to carry no body, no tier and no `data`, so
//   the record cost one read per standing mark — 846 of them against a keyless
//   budget of 120 a minute, which is 456 seconds measured, paced. It is now one
//   request.
//
//   THE TEAR. Those N+1 reads raced a moving store: the register was observed
//   going 831 → 846 → 831 inside twenty seconds while a sibling lane wrote, and
//   slugs the LIST returned answered "no mark" on the DETAIL read, then answered
//   fine again minutes later. One build shipped 24 marks placed-but-untold
//   because of it. A single query is ATOMIC, so the tear is not mitigated here —
//   it is unrepresentable. The recovery pass that used to sit below is gone with
//   the thing it recovered from.
//
// Counts still move between builds while the replay-parity lane writes to the
// same store. That is the store being alive, not this module being wrong.
const REGISTER = "/world2/marks?all=true&full=true";

/** a door row in the shape `assembleWorld()` and the viewer read */
function toRecordMark(row) {
  const data = row.data ?? {};
  const g = row.geometry ?? null;
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
  if (row.body != null) mark.body = row.body;
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
  const [register, classes, roster, windows] = await Promise.all([
    ask(REGISTER),
    law("class"),
    law("roster"),
    ask("/world2/windows"),
  ]);

  const rows = register.marks ?? [];
  // A row without a body means the STORE has none, not that a read was lost —
  // there is no longer a second read to lose. Reported at its real count so a
  // genuinely untold mark is still visible rather than assumed away.
  const untold = rows.filter((r) => r.body == null).length;
  if (untold) gap("marks[].body", `${untold} of ${rows.length} standing marks carry no body in the store itself ` +
    `(the register's full-row read returned them with body null) — placed but untold, and not a read failure.`);

  const marks = rows.map(toRecordMark);

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
  return ask("/world2/docket");
}
