// world-lenses.mjs — the readings the /ops/graph/ lenses paint with.
//
// Every function here takes the office's `GET /world/graph` node data and
// returns a reading of it. Nothing fetches, nothing draws, nothing caches: the
// page owns the canvas and the office owns the world, and what lives here is
// only the arithmetic between them — which is the part worth testing without a
// browser.
//
// PORTED, NOT INVENTED. These are the graph-views hub's own derivations
// (jetto/graph-views, tools/graph-views.mjs), carried over when the founder
// ruled that the hub's CONTENT pours into this page and its six-tab chrome
// retires. The hub computed them in Node against a world clone on disk; here
// they run in the browser against the payload, which is the whole difference
// the ruling asked for — the hub's numbers were a snapshot of whatever clone
// the operator had, and these are a reading of the store the office is serving
// right now.
//
// THE ONE THING THAT MADE THE PORT POSSIBLE. The hub could re-read every
// mark.md through the world's own parser, so it could ask "what did the AUTHOR
// write". The payload could not be asked that at all: `loadMarks` defaults
// `tier` to "market" and synthesizes half the identity, so by the time a record
// reaches a reader "the author wrote market" and "the loader supplied it" are
// the same string. The office now ships the author's own key list on each mark
// node (`keys`), which is what these readings stand on — and every one of them
// degrades to a stated "the office has not sent this yet" rather than a wrong
// number when it is absent.

// ═══════════════════════════════════════════════════════════════════════════
// THE SERIALIZATION MAP — the machine-readable form of the trichotomy that
// LOGOS/kinds.md § the node holds as prose.
//
// PORTED VERBATIM from tools/graph-views.mjs (world repo, branch
// jetto/graph-views), where it landed as a tracked artifact under founder ruling
// 2026-08-12 (WRITE-REGISTRY.md row "the serialization mapping (field →
// predicate star)").
//
// IT IS A TABLE, NOT A READING, which is why it may live in the site's tree at
// all: this page bakes no world data, and a founder-authored table of what a
// field MEANS is not world data. The counts against it are computed live from
// the payload every time the page opens.
//
// It is a WAY STATION. The destination is `payload schemas on class-nodes`
// (LOGOS/classes.md names payload schema as a class param), at which point this
// literal is deleted and the map is read from the graph like everything else.
//
// Read it per class: for each node class, what its frontmatter keys serialize.
//   identity   — an identity atom (kinds.md: "identity is two atoms, a slug and
//                a class"); the slug is the directory name, so on disk identity
//                is one key.
//   relational — NOT a property. Each entry names THE EDGE IT SERIALIZES, as
//                `[edge-type, what the edge relates]` (kinds.md: "`by:` is the
//                create-edge, not a field").
//   derived    — belongs NOWHERE (the-north-star.md § the placement discipline).
//                A key here on disk is TRUE RESIDUE: the map deliberately maps
//                it to nothing, which is a violation, not a gap in this table.
//   log        — belongs to the citing action's record, not to the node.
//   property   — a genuine authored property, given as `[predicate-slot, gloss]`.
//
// `*` applies to every class; a class block adds to it. A key on disk that this
// table does not place is MAPPING DEBT — rendered loudly as this table's own
// unfinished business, never silently bucketed, because an unrecognised field is
// exactly the shape a shadow grammar arrives in.
// ═══════════════════════════════════════════════════════════════════════════
export const SERIALIZATION_MAP = {
  version: "0.1.0",
  authored: "2026-08-12",
  cites: "LOGOS/kinds.md § the node · LOGOS/the-north-star.md § the placement discipline",
  destination: "payload schemas on class-nodes (LOGOS/classes.md § params)",

  // EVERY CLASS
  "*": {
    identity: { kind: "the class atom, in the four-word vocabulary the tree speaks today" },
    relational: {
      by: ["create", "author → node — the create-edge, stored as a field"],
      derived_from: ["provenance", "node → the source it was seeded from"],
    },
    derived: {
      tier: "standing — decided by the one walk over the ground; not the author's to assert",
      household: "the grain — resolvable from `by` through households.json",
    },
    log: { date: "the create-action's stamp; a fact about the action, not the node" },
    property: {
      pre: ["pre", "seeded before the world opened, rather than authored in play"],
      source: ["source", "the document this record renders"],
    },
  },

  // A SITED MARK — a thing standing somewhere in the world.
  sited: {
    identity: { class: "the registered class name, on a class-node" },
    relational: {
      at: ["containment", "an offset from the container's centre — meaningless without the edge"],
      extent: ["containment", "the footprint that offset governs"],
      points: ["containment", "a ring of positions; rides the same frame as `at`"],
      coords: ["containment", "which frame the numbers are written in"],
      anchor: ["containment", "where the offset is measured from"],
      implements: ["implements", "class → the machinery that honours it"],
      extends: ["extends", "class → the class it specialises"],
    },
    property: {
      mechanic: ["mechanic", "the machinery that keeps this mark true"],
      feature: ["feature", "the two-precision survey link"],
      version: ["version", "the class's revision"],
      dials: ["dials", "the class's response boundaries — destined to BE class params"],
      affordances: ["affordances", "what the class offers a resident"],
      mobility: ["mobility", "whether the mark moves, and how"],
      far: ["far", "visible from outside its own reach"],
      propagation: ["propagation", "what becomes of what is attached when this moves"],
      exempt: ["exempt", "held out of a rule, by name"],
      ambient: ["ambient", "present without being stood upon"],
      timetable: ["timetable", "the schedule a `mechanic: timetable` mark carries"],
      top_m: ["top_m", "vertical prominence"],
      ask: ["ask", "a bounty's one request"],
      reward: ["reward", "a bounty's stamps"],
      status: ["status", "a bounty's open/done"],
      threshold: ["threshold", "the bar a bounty is met at"],
      consent: ["consent", "the ground-holder's welcome word about what stands on them"],
    },
  },

  // A PARCEL — the ground a household holds.
  parcel: {
    relational: {
      at: ["containment", "an offset from the container's centre"],
      extent: ["containment", "the footprint that offset governs"],
    },
    property: { consent: ["consent", "the ground-holder's welcome word"] },
  },

  // A PREDICATED MARK — already a predicate. Its (slot, value) pair IS its
  // identity payload: "predicates are the atoms of authorship" (kinds.md). The
  // only two keys on disk already in lawful shape.
  predicated: {
    predicate: { slot: "the predicate's slot", value: "the predicate's value" },
    relational: { parent: ["containment", "the node this predicates — its parent continued"] },
    property: {
      mechanic: ["mechanic", "the machinery that keeps this true"],
      mechanic_draft: ["mechanic_draft", "a mechanic proposed but not registered"],
    },
  },

  // A NAMING — a predicate whose slot is implied by the act of naming.
  naming: {
    predicate: { value: "the name given" },
    relational: { parent: ["containment", "the node this names"] },
  },
};

const ROWS = ["identity", "relational", "derived", "log", "predicate", "property"];

/**
 * Resolve one (class, key) pair through the map. Returns the row it serializes
 * into, the note explaining why, and — for a relation — the edge it becomes.
 * `unmapped` is the honest answer for a key the table does not place, and the
 * lens renders it as this table's own debt rather than as a property.
 */
export function serializes(kind, key) {
  for (const scope of [SERIALIZATION_MAP[kind], SERIALIZATION_MAP["*"]]) {
    if (!scope) continue;
    for (const row of ROWS) {
      const hit = scope[row]?.[key];
      if (hit === undefined) continue;
      if (row === "relational") return { row: "edge", edge: hit[0], note: hit[1] };
      if (row === "property") return { row: "property", slot: hit[0], note: hit[1] };
      return { row, note: hit };
    }
  }
  return { row: "unmapped", note: "this table does not place this key — mapping debt" };
}

// ── the tier census ──────────────────────────────────────────────────────────
//
// The tier field's three populations, ported from the hub's model. The walk
// reads the field in exactly ONE case — the town's own constitution, read below
// the walk because the town is speaking about the town's own ground
// (mark-standing.mjs § the one exception). Every other carrier states nothing,
// which is what "inert" means here.
//
// The fourth population is this page's own: a node whose key list the office
// never sent. It is not "clean" and it is not a carrier; it is UNREAD, and the
// legend says so rather than counting it into either answer.

export const CENSUS_CLASSES = ["read", "inert", "clean", "unread"];

/** Which census population one node datum belongs to. */
export function censusClassOf(d) {
  if (!d || d.kind !== "mark") return "unread";
  if (!Array.isArray(d.keys)) return "unread";
  if (!d.keys.includes("tier")) return "clean";
  return (d.by === "the-town" && d.tier === "constitution") ? "read" : "inert";
}

/**
 * The tier census over a payload's nodes.
 *
 * `sent` is the honest gate on the whole reading: with no key lists in the
 * payload every mark lands in `unread`, and a caller must say the office has not
 * shipped them rather than report 0 carriers, which is the same number a
 * finished cutover would produce and the opposite finding.
 */
export function tierCensus(nodes) {
  const counts = { read: 0, inert: 0, clean: 0, unread: 0 };
  let marks = 0;
  const inert = [];
  for (const d of nodes) {
    if (d.kind !== "mark") continue;
    marks++;
    const c = censusClassOf(d);
    counts[c]++;
    if (c === "inert") inert.push(d);
  }
  return {
    marks,
    ...counts,
    carriers: counts.read + counts.inert,
    sent: counts.unread < marks,
    // The carriers whose asserted word is the same one the loader defaults to.
    // These are the ones no reading without `keys` can see at all, which is the
    // argument for the field: on the store of 2026-08-13 they were 91 of 94.
    invisible_without_keys: inert.filter((d) => d.tier === "market").length,
    inert_ids: inert.map((d) => d.id),
  };
}

// ── the field census ─────────────────────────────────────────────────────────
//
// Every (class, key) pair on disk, run through the serialization map. Three
// outcomes are deliberately kept apart, because they are three different kinds
// of problem and collapsing them would hide the one that is nobody's fault but
// ours:
//   derived   → TRUE RESIDUE. The map places it nowhere on purpose; the field on
//               disk is a violation of the law.
//   unmapped  → MAPPING DEBT. The map has not placed it yet; that is a gap in
//               SERIALIZATION_MAP, this table's own unfinished business.
//   the rest  → placed, lawfully or awaiting the cutover that moves them.

export function fieldCensus(nodes) {
  const rows = { identity: 0, edge: 0, derived: 0, log: 0, predicate: 0, property: 0, unmapped: 0 };
  const unmappedKeys = new Map();
  const residueKeys = new Map();
  const propertyKeys = new Map();
  let total = 0, read = 0;
  for (const d of nodes) {
    if (d.kind !== "mark" || !Array.isArray(d.keys)) continue;
    read++;
    for (const k of d.keys) {
      const { row } = serializes(d.subkind, k);
      rows[row]++; total++;
      if (row === "unmapped") bump(unmappedKeys, `${d.subkind}.${k}`);
      if (row === "derived") bump(residueKeys, k);
      if (row === "property") bump(propertyKeys, k);
    }
  }
  return {
    rows, total, read,
    placed: total - rows.unmapped,
    unmappedKeys: sortedPairs(unmappedKeys),
    residueKeys: sortedPairs(residueKeys),
    propertyKeys: sortedPairs(propertyKeys),
  };
}

const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
const sortedPairs = (m) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

// ── the record's law ─────────────────────────────────────────────────────────
//
// The piecewise LOGOS: the constitution written as real predicated marks under
// `let-there-be-light/the-record`, each one a clause whose body IS the law's
// sentence. The hub counted them ("nodes under the-record", WRITE-REGISTRY row
// "the-record renderings"); this reads the same subtree out of the payload so
// the lens can light it on the graph and list it beside.
//
// NO LAW IS INVENTED HERE. The subtree is found by the path the store already
// carries, and a store whose marks have no `path` — or a world where the record
// has not been written — yields an empty tree, which the panel says plainly.
// A lens that drew law nodes the store does not hold would be the one failure
// this page cannot survive.

export const RECORD_SEGMENT = "/the-record";

/** Is this node datum a clause of the written record? */
export const isRecordNode = (d) =>
  d?.kind === "mark" && typeof d.path === "string" && (d.path.includes(RECORD_SEGMENT + "/") || d.path.endsWith(RECORD_SEGMENT));

/**
 * The record subtree, as a list in reading order with each clause's depth.
 *
 * Depth is counted from the record's own root, so the root itself is 0 and its
 * clauses are 1. Sorted by path, which is the order the tree is written in and
 * therefore the order the law reads in — the store hands them back in whatever
 * order it walked.
 */
export function recordTree(nodes) {
  const clauses = nodes.filter(isRecordNode).map((d) => {
    const p = d.path.replace(/\\/g, "/");
    const after = p.slice(p.indexOf(RECORD_SEGMENT) + RECORD_SEGMENT.length);
    const depth = after.split("/").filter(Boolean).length;
    return { id: d.id, path: p, depth, tier: d.tier ?? null, body: d.body ?? null, sort: p };
  });
  clauses.sort((a, b) => a.sort.localeCompare(b.sort));
  return {
    clauses,
    total: clauses.length,
    with_body: clauses.filter((c) => c.body).length,
    // The two standings a clause lands in. A clause that asserted no tier reads
    // as the loader's default, so this is a count of what the RECORD SAYS about
    // itself, not a verdict on what the walk would derive.
    by_tier: clauses.reduce((acc, c) => { acc[c.tier ?? "—"] = (acc[c.tier ?? "—"] ?? 0) + 1; return acc; }, {}),
  };
}
