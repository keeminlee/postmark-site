// page-freshness.mjs — what a baked page is allowed to say about its own age.
//
// THE LAW, verbatim from EPICS/POSTMARK/freshness-architecture.md § the mushy
// middle (founder-ruled 2026-08-26, the mail-drift night):
//
//   "mushiness must be disclosed — the page states when it was generated and
//    which ferry crossing it reflects, says 'a ferry has landed since this page
//    was made' when true, and never prints a cadence promise it does not
//    control."
//
// and the layer above it, which is why the SENTENCE and not the mechanism is
// the deliverable here:
//
//   "Static floor — the baked pages and staged records: always present, serves
//    even when every pipeline and the office are down. Possibly stale, never
//    absent. Its law: the floor may lag, but it must never lie about being
//    current."
//
// THE DEFECT THIS CLOSES. On 2026-08-26 the town-data sync stalled 97 minutes
// past a ferry crossing. 48 residents' doorstep pages served yesterday's mail,
// and every one of them said "Regenerates ~every 30 minutes" while doing it.
// The staleness was survivable; the page asserting freshness it did not have
// was not. A floor that lags is a floor. A floor that lies is a trap.
//
// ── WHY THE SENTENCES LIVE IN A MODULE ─────────────────────────────────────
//
// Same reason src/lib/freshness.mjs gives for the hand-poll: the judgment is
// entirely in what the line CLAIMS, and that is testable pure logic, while the
// island around it is two fetches and one textContent. A sentence that
// overclaims is the failure mode; a sentence that says too little is not.
//
// ── WHY IT NEVER COMPUTES A CROSSING ───────────────────────────────────────
//
// Both numbers are read: the baked one from this site's own /build.json, the
// current one from the office's GET /api/. The office's src/crossings.mjs was
// split out of world.mjs precisely because "the two honest options were a
// second copy of the arithmetic — which is how two clocks are born — or this
// file". A site that derived its own crossing would be that second clock, and
// the whole claim this line makes is that the two numbers are comparable.

/** The one sentence the static floor may say with no live reading at all. */
export const CADENCE_FLOOR = "Rebuilt every ~30 minutes from the town record, on a timer phased to the ferry crossings.";

/** Said when a crossing has landed since the bake. The founder's own words. */
export const FERRY_LANDED = "A ferry has landed since this page was made";

const MINUTE = 60_000;

/** "just now" / "18 minutes ago" / "2 hours ago" — a reader's units, not a log's. */
export function agePhrase(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const m = Math.floor(ms / MINUTE);
  if (m < 2) return "just now";
  if (m < 60) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "an hour ago" : `${h} hours ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

/**
 * What this page may say about its own freshness.
 *
 * @param {object|null} stamp          the site's own /build.json
 * @param {number|null} officeCrossing the office's crossing.number from GET /api/
 * @param {number} nowMs
 * @returns {{ text: string, cls: "ok"|"warn"|null, stale: boolean }}
 */
export function describeFreshness({ stamp, officeCrossing = null, nowMs = Date.now() } = {}) {
  // NO STAMP IS SILENCE, NOT A DENIAL. A page that cannot read its own build
  // metadata has nothing to add to the floor sentence already printed beside
  // it, and "this page could not determine its age" is a worse thing to show a
  // resident than saying nothing — it describes the machinery, not the town.
  // (Omit, don't negate.)
  if (!stamp || typeof stamp !== "object") return { text: "", cls: null, stale: false };

  const builtMs = Date.parse(String(stamp.built_at ?? ""));
  const age = Number.isFinite(builtMs) ? agePhrase(nowMs - builtMs) : null;
  const madeAt = age ? `This page was made ${age}` : "This page";

  const baked = Number.isInteger(stamp.crossing) ? stamp.crossing : null;

  // Neither number, or only one: say WHEN and stop. A crossing claim needs both
  // sides — asserting "it reflects crossing 149" without knowing what the town
  // is at now is exactly the false all-clear the floor's law forbids.
  if (baked === null || !Number.isInteger(officeCrossing)) {
    return age
      ? { text: `${madeAt}.`, cls: null, stale: false }
      : { text: "", cls: null, stale: false };
  }

  const gap = officeCrossing - baked;
  if (gap <= 0) {
    return {
      text: `${madeAt}, and it reflects crossing ${baked} — the crossing the town is on.`,
      cls: "ok",
      stale: false,
    };
  }

  // The disclosure the whole file exists for. It names the gap in ferries
  // because that is the unit the reader's mail actually moves in, and it says
  // where the missing letters are rather than only that something is missing —
  // a resident reading this needs to know their mail is coming, not that a
  // pipeline is unwell.
  const ferries = gap === 1 ? "A ferry has landed" : `${gap} ferries have landed`;
  return {
    text: `${ferries} since this page was made — it reflects crossing ${baked} and the town is on ${officeCrossing}. Letters from ${gap === 1 ? "that crossing" : "those crossings"} reach this page at the next rebuild.`,
    cls: "warn",
    stale: true,
  };
}
