// sentinel-alert.mjs - what the town's own watchman is saying, for the header.
//
// THE FOUNDER'S SENTENCE, 2026-09-17: "please have postmark sentinel notify when
// degradation like this happens and make it obvious on the site too (like an
// alert icon that you can hover to find out more)." He had just watched
// postmark.town serve a 134-resident town for five minutes while the sentinel's
// board read fourteen green.
//
// This file is the DECISION half, kept out of the layout's inline script so it
// can be falsified without a browser. The layout owns the fetch, the markup and
// the popover; this owns "is anything actually wrong, and what should it say".
//
// -- WHERE THE BAD SET COMES FROM, AND WHY IT IS NOT LONGER ------------------
//
// `tools/site-sentinel.mjs` in postmark-office declares `export const BAD = new
// Set(["DOWN", "STALE"])` and uses it for the Discord alert machine. Those are
// the two verdicts, and there is no FAILED. INFO and UNKNOWN are deliberately
// absent, quoting that file's own reasoning: "an info-only door and an
// unreadable reference are not site outages, and alarming on them teaches the
// reader to ignore the channel." The glyph must agree with Discord or the town
// has two watchmen telling it different things, so the set is copied, not
// widened. If the sentinel ever grows a third bad verdict, it belongs here too
// and the test below is where that is asserted.
export const SENTINEL_BAD = new Set(["DOWN", "STALE"]);

/** The one standing sentence, on every popover: what the reader can do about
 *  it, which is wait for the next bake. `postmark-site-refresh.timer` is
 *  `OnCalendar=*:10,40`. */
export const REBAKE_LINE = "the town's pages rebake at :10 and :40";

/**
 * A board, or null. NEVER throws: a dev build has no sentinel, a local build
 * has no sentinel, and a header that throws over a missing ops file is a worse
 * outage than the one it was built to report.
 */
export function parseBoard(text) {
  if (typeof text !== "string" || text.trim() === "") return null;
  let board;
  try {
    board = JSON.parse(text);
  } catch {
    return null;
  }
  if (board == null || typeof board !== "object" || Array.isArray(board)) return null;
  return board;
}

/** "3 min", "2 h 10 min", "4 d" - the same shape site-sentinel prints. */
export function humanAge(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

/**
 * What the header should show for this board.
 *
 * `show: false` is the ordinary answer and must be the answer for every one of:
 * no board at all, an unparsable board, a board whose probes are missing or not
 * an array, and a board on which nothing is DOWN or STALE. The glyph exists to
 * be absent.
 *
 * `since` is read WHEN THE BOARD CARRIES IT and omitted otherwise. Today it does
 * not: the sentinel keeps a bad probe's onset in its own state file, and its
 * published probe entries carry `key/label/kind/verdict/reason` (+ `url`,
 * `workflow`, and `detail` for the refresh probe). Most reasons already say the
 * age in prose - "ticked 8 min ago", "published 3 min ago" - which is where a
 * reader gets "how long" today.
 */
export function alertFromBoard(board, { nowMs = Date.now() } = {}) {
  const none = { show: false, status: null, headline: null, rows: [], rebake: REBAKE_LINE };
  if (board == null || typeof board !== "object") return none;
  const probes = Array.isArray(board.probes) ? board.probes : null;
  if (!probes) return none;

  const rows = [];
  for (const p of probes) {
    if (p == null || typeof p !== "object") continue;
    if (!SENTINEL_BAD.has(p.verdict)) continue;
    const sinceMs = typeof p.since === "number" ? p.since : Date.parse(p.since ?? "");
    rows.push({
      key: typeof p.key === "string" ? p.key : null,
      verdict: p.verdict,
      label: typeof p.label === "string" && p.label !== "" ? p.label : (p.key ?? "a probe"),
      reason: typeof p.reason === "string" ? p.reason : "",
      // `detail` is the refresh report's own sentence, carried onto the board by
      // the office's site_refresh probe so this popover can say "48 doors are
      // missing" rather than only "failed".
      detail: typeof p.detail === "string" && p.detail !== "" ? p.detail : null,
      age: Number.isFinite(sinceMs) ? humanAge(nowMs - sinceMs) : null,
    });
  }
  if (rows.length === 0) return none;

  const headline = typeof board.headline === "string" && board.headline !== ""
    ? board.headline
    : (typeof board.summary === "string" ? board.summary : null);

  return {
    show: true,
    status: typeof board.status === "string" ? board.status : null,
    headline,
    rows,
    rebake: REBAKE_LINE,
  };
}
