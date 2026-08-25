// freshness.mjs — what the hand-poll SAYS, separated from what it touches.
//
// THE LADDER, from the site's side. A resident page is static and rebuilt on
// the half hour; the office knows more than it does for up to that long, and
// since the office grew its freshness stamp (postmark-office
// src/paper-fresh.mjs, 2026-08-25) it can say exactly what and by how much.
// The founder's frame, 2026-08-23: "a unified thing where it's clear what's
// from the latest crossing/settlement versus what was JUST polled live", and
// 2026-08-25: "we can add the ability to refresh specific things on the site
// by hand."
//
// WHY THE SENTENCES LIVE IN A MODULE AND NOT IN THE ISLAND. The judgment in a
// hand-refresh is entirely in what it claims: which fields moved, how they are
// named to a visitor, and — the part that is easy to get wrong — what it says
// when the office cannot tell it anything. That is testable pure logic. The
// island keeps only the DOM: the fetch, the iframe reload, one textContent.
// (The site's own 2026-08-25 lesson, from the nav rail: a probe that can only
// match a literal source line survives by nobody moving the literal.)
//
// WHAT THIS DELIBERATELY WILL NOT SAY. The page's prose is markdown baked by
// the build; repainting it client-side would need a second renderer, and a
// second renderer is a second answer. So the poll refreshes what it can refresh
// honestly — the sandboxed pane, the profile's plain strings — and REPORTS the
// rest. LOGOS/INDEX.md § the atomic laws, 5: "A rendering may say less than its
// source, never other." A half-repainted page would say other.

/**
 * The office's composable paper fields, in a visitor's words.
 *
 * A field this map has not learned is named by its own key rather than dropped.
 * That matters: the office may grow a sixth paper before this file hears about
 * it, and an unnamed change is still a change — dropping it would make the line
 * read "nothing moved", which is the one thing it must never say wrongly.
 */
export const PAPER_LABEL = Object.freeze({
  "address.body": "the prose on their card",
  "address.data": "their card's fields",
  home: "their home page",
  profile: "their profile",
  window_state: "their window",
  window: "their window",
});

/**
 * The office's three rungs, in a visitor's words.
 *
 * `settled` has no phrase on purpose. A settled field is one that did not move,
 * and this line only ever names the ones that did — a sentence listing the
 * fields that are fine is a sentence nobody reads to the end.
 */
export const TENSE_PHRASE = Object.freeze({
  written: "already in the record, not yet in the page",
  pending: "made at the door, settling at the next ferry crossing",
});

/** The fields standing ahead of the page, named. Empty when nothing moved. */
export function movedFields(freshness) {
  const fields = freshness && freshness.fields;
  if (!fields || typeof fields !== "object") return [];
  return Object.keys(fields).reduce((out, key) => {
    const tense = fields[key] && fields[key].tense;
    if (!tense || tense === "settled") return out;
    out.push(`${PAPER_LABEL[key] ?? key} (${TENSE_PHRASE[tense] ?? tense})`);
    return out;
  }, []);
}

/**
 * The whole sentence the poll writes, and the class it writes it in.
 *
 * THREE ANSWERS, and the third is the one that must not be forgotten. The site
 * and the office ship on their own trains and either may land first, so a live
 * office that does not stamp freshness is not a hypothetical — it is the state
 * of the world for however long the two releases are apart. It gets its own
 * honest, narrow answer rather than being folded into "nothing moved", which
 * would be a page confidently reporting an all-clear it never received.
 */
export function describePoll(card, { paneReloaded = false } = {}) {
  const freshness = card && card.freshness;

  if (!freshness || !freshness.fields) {
    return {
      text: "Polled just now. This office does not stamp freshness yet, so all this can tell you is that it answered"
        + (paneReloaded ? " — the window above is the one hanging now." : "."),
      cls: null,
    };
  }

  const moved = movedFields(freshness);
  if (!moved.length) {
    const sha = typeof freshness.settled_as_of === "string" ? freshness.settled_as_of.slice(0, 8) : null;
    return {
      text: "Polled just now — nothing has moved. The office is serving exactly what this page was built from"
        + (sha ? ` (record ${sha}).` : "."),
      cls: "ok",
    };
  }

  let text = `Polled just now — ${moved.length} ${moved.length === 1 ? "thing has" : "things have"}`
    + ` moved since this page was built: ${moved.join("; ")}.`;
  if (paneReloaded) text += " The window above has been reloaded and is current.";
  text += " The writing on this page is still the baked copy; the newer one is in the record, linked at the foot of this card.";
  return { text, cls: "warn" };
}

/** What the line says when the office does not answer at all. */
export function describeFailure(error) {
  const why = error && error.message ? error.message : "network";
  return {
    text: `The office didn't answer (${why}). Nothing on this page has changed — try again in a moment.`,
    cls: "warn",
  };
}
