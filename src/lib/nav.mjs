// nav.mjs — THE RAIL'S SINGLE SOURCE.
//
//   THE LAW: a page per read, a read per page; this structure is the rail's
//   single source.
//
// The header used to be nav-by-accretion: a hand-kept array in the layout that
// nobody had to keep honest. That is how /votes/ came to exist as a complete
// 172-line ballot page reachable only by typing the URL — built, shipped, and
// in no nav array at all for its whole life (found by the 2026-08-25 IA
// inventory). The gap was never a missing page. It was that nothing bound the
// header to the reads.
//
// So the membership lives HERE, in one exported structure, and `test/nav.test.mjs`
// asserts against it: every entry resolves to a route that exists (a rail
// pointing at a 404 fails the suite), and every entry that owns a page is
// marked `active` by that page (a section member that can never light up is the
// ballot's failure again, one step quieter). An entry that genuinely cannot
// satisfy the second rule declares WHY, in the data, next to itself — an
// undeclared miss still fails.
//
// This is the derived-nav law implemented lightly. Full derivation from the
// MCP's own serving tables — so a new read APPEARS in the rail rather than
// waiting to be remembered — is a later wave. This is the step that makes the
// remembering checkable.
//
// ── THE SHAPE: CHIPS, NOT A STRIP (founder's ruling, 2026-08-25 evening) ─────
//
// The site already solved its own IA once, in miniature, and nobody noticed:
// `/households/<slug>/` wears a row of chips where the FIRST chip is the
// AGGREGATE — "Household", the house's own bare read — and each member is a
// chip that swaps the view. No scroller, no menu; a row you take in at a
// glance. The founder walked dev on the trinity rail, saw the household page,
// and ruled that pattern to be the whole site's shape.
//
// So: every section is a chip-shaped surface, and the section's first chip is
// its own apex bare read. The World's first chip is the living map. The Town's
// first chip is /town/, the town's own summary — which is why that page had to
// exist before this structure could be honest. A section landing on one of its
// members instead (The Town used to land on Ferry's Daily) is the aggregate
// missing, and the first-chip law in the test now says so out loud.
//
// A member page long enough to scroll splits into chips of its own rather than
// growing a side rail: `chips:` on a member is that second row, and it obeys
// the same first-is-the-aggregate law. This is what retired `.pm-siderail` from
// /daily/, /mail/ and /residents/ — the reader moves between chips, which are
// real routes, instead of down a page hunting anchors.
//
// EVERY CHIP IS A REAL ROUTE. Not a tab widget: the row is shared chrome drawn
// over real Astro pages, so deep links in letters keep working, the page-per-
// read law stays checkable, and the static build stays static. Where a chip
// needed a page that had been folded into a scroller, the page came BACK to its
// own canonical URL (/bulletin/, /window/, /meeps/) and its redirect stub was
// deleted rather than a new URL invented.

// The Harbor is neutral ground BETWEEN towns and stands on its own flag:
// 1f4ee.town, the codepoint of 📮 U+1F4EE POSTBOX. Absolute from every page,
// including the harbor's own, because there is no root-relative spelling that
// is right from both domains.
export const HARBOR = "https://1f4ee.town/";

/**
 * The rail, top level down. `href` is joined to the layout's `origin` prefix at
 * render time unless `external` — a page served from another domain keeps its
 * chrome pointing back at the town.
 *
 * Per entry:
 *   key       the `active` value a page passes to PostmarkLayout
 *   label     what the rail says
 *   href      root-relative (or absolute, with `external`)
 *   beta      wears the hollow "beta" chip — still cooking, and the rail says so
 *   members   the section's chip row, in reading order; the FIRST is the section's
 *             own aggregate read and must be the seat's own landing
 *   signedIn  the seat is sign-in-aware (see Your House)
 *
 * Per member, additionally:
 *   held      built, routable, deliberately NOT surfaced yet — with the reason
 *   noActive  this member cannot set `active` on a page of its own; the string
 *             is the reason, and the test reads it rather than a bare exemption
 *   chips     the member's OWN chip row — a page that would otherwise scroll,
 *             split into real routes. Same first-is-the-aggregate law.
 */
export const RAIL = [
  // The root stops squatting the town-apex's name (Keemin, 2026-08-25). It took
  // two passes to finish that: the trinity rail freed the LABEL, and this wave
  // freed the KEY — `town` now means the town's own page, and the front door is
  // `postmark`, which is what it has always actually been.
  { key: "postmark", label: "Postmark", href: "/" },

  // THE WORLD — the model section, already chip-shaped in spirit before this
  // wave. Replay, Conversations and the Atlas are lenses ON the World, not peers
  // of it, so they left the top rail in 2026-08-15 and are reached through this
  // row and the map's own floating panel. Untouched by the chip wave except for
  // wearing the chips: /world/ keeps its own side rail until the cockpit wave.
  {
    key: "world",
    label: "The World",
    href: "/world/",
    // /world/ serves the spectator shell verbatim and never renders
    // PostmarkLayout, so no page can mark it active; the section still lights up
    // from its members, and the row appears on the other three.
    noActive: "the spectator shell renders its own document, not PostmarkLayout",
    members: [
      { key: "world", label: "the living map", href: "/world/", noActive: "the spectator shell renders its own document, not PostmarkLayout" },
      { key: "replay", label: "replay", href: "/replay/" },
      { key: "conversations", label: "conversations", href: "/conversations/" },
      { key: "atlas", label: "the atlas", href: "/atlas/" },
    ],
  },

  // THE TOWN — the town apex and its reads. The seat lands on /town/, the
  // town's own bare read, because a section that lands on one of its members is
  // a section with no aggregate. Everything the town IS hangs here, including
  // The Works, which the founder demoted out of the top rail this wave:
  // "weird having that old surface be first-class."
  {
    key: "town",
    label: "The Town",
    href: "/town/",
    members: [
      { key: "town", label: "the town", href: "/town/" },
      { key: "daily", label: "ferry’s daily", href: "/daily/" },
      // The notice board came BACK to /bulletin/ in this wave. It had been
      // folded into the Daily as an anchor, which made it a chip that could
      // never light up — and `town.bulletin` is its own read, so under the
      // page-per-read law it wants its own page. Its old URL was still sitting
      // there as a redirect stub, so restoring it cost no new URL and made
      // every doorstep deep-link (/bulletin/#slug) land natively.
      { key: "bulletin", label: "the notice board", href: "/bulletin/" },
      {
        key: "residents",
        label: "residents",
        href: "/residents/",
        // The biggest scroller in the town: a 126-card directory with the
        // window street and the Meeps' staff cards stacked below it, navigated
        // by a side rail. Now three chips, three routes — and both of the
        // routes it needed already existed as redirect stubs pointing inward.
        chips: [
          { key: "residents", label: "the residents", href: "/residents/" },
          { key: "windows", label: "the windows", href: "/window/" },
          { key: "meeps", label: "the meeps", href: "/meeps/" },
        ],
      },
      {
        key: "mail",
        label: "the mail",
        href: "/mail/",
        // The pulse stays ON the mail's own page — it is the aggregate's stat
        // band, the same job `dash-stats` does on the household seat, and a
        // page of its own would be four numbers alone in a room. What splits
        // off is the tail (the bounces) and what surfaces is the door that was
        // only ever reachable from a button in the page body.
        chips: [
          { key: "mail", label: "the mail", href: "/mail/" },
          { key: "returned", label: "returned to sender", href: "/mail/returned/" },
          { key: "compose", label: "write a letter", href: "/mail/compose/" },
        ],
      },
      // The Ballot — the page this whole law exists because of.
      { key: "votes", label: "the ballot", href: "/votes/" },
      { key: "stamps", label: "stamps", href: "/stamps/", beta: true },
      // The Works — the collaboration layer's front door, deliberately
      // backburnered on its own prerequisites (founder correction, 2026-08-25:
      // this is PROJECTS, the resident collaborative builds, NOT the Keeping
      // Works). Demoted from the top rail into the town the same evening; the
      // page itself is untouched.
      { key: "works", label: "the works", href: "/works/" },
      // The Numbers holds out of every surface until the S4 emission gives it
      // real data (Keemin, 2026-08-21: "it's sitting there empty and
      // misleading"). The route stays reachable; only the chip waits. This is a
      // HOLD with a reason on file, which is the opposite of the ballot's
      // silence — the difference is that this line exists.
      { key: "numbers", label: "the numbers", href: "/numbers/", held: "S4 hold — empty until the emission lands (Keemin, 2026-08-21)" },
    ],
  },

  // The Harbor is the mail's outward half — the towns Postmark connects, and
  // what crosses between them. It stays top-level as a future apex of its own.
  { key: "harbor", label: "Harbor", href: HARBOR, external: true, beta: true },

  // YOUR HOUSE — the household apex. One rail seat, two faces: a signed-out
  // reader meets the lantern-lit Join door they have always met (the newcomer's
  // eye must find it without hunting — Keemin, 2026-07-31), and a signed-in
  // reader meets their own house.
  //
  // AND THAT IS THE WHOLE SEAT — no chip row under it, by the founder's word.
  // The household page IS a chip world already: its own row of member chips
  // with the house's aggregate first. A second row of section chrome above it
  // would be the site explaining the pattern to itself.
  //
  // `houseHref` says the signed-in face points at the reader's own house rather
  // than at /join/. The layout resolves it from the DECLARED household registry
  // — a handle in a declared house goes to /households/<slug>/, and everyone
  // else goes to their resident page, which is the same wrapper rendering a
  // house of one. The static build ships the signed-out face, so it is also the
  // no-JS truth.
  //
  // `houseKey` is the SECOND key this seat answers to, and it exists because
  // the seat's destination is not its href. The founder clicked Your House and
  // watched THE TOWN light up: /households/<slug>/ was passing `active="residents"`,
  // so `sectionOf` walked it into The Town's family and lit the wrong seat — the
  // one page the reader had just deliberately left. A seat whose destination
  // belongs to another section is a seat that can never light itself, so the
  // destination gets a key of this seat's own and `sectionOf` honours it.
  {
    key: "join",
    label: "Join",
    href: "/join/",
    houseKey: "household",
    lantern: true,
    signedOutLabel: "Join",
    signedInLabel: "Your House",
    houseHref: true,
  },
];

/** Every entry in the rail, in every chip row, at every depth, flat. */
export function allEntries() {
  const out = [];
  for (const s of RAIL) {
    out.push({ ...s, section: s.key, depth: 0 });
    for (const m of s.members ?? []) {
      out.push({ ...m, section: s.key, depth: 1 });
      for (const c of m.chips ?? []) {
        // a member's first chip IS the member (the landing), so it is already
        // counted above; listing it twice would double-count the key
        if (c.key === m.key) continue;
        out.push({ ...c, section: s.key, member: m.key, depth: 2 });
      }
    }
  }
  return out;
}

/** The section a page belongs to, by its `active` key — or null for an orphan. */
export function sectionOf(active) {
  if (!active) return null;
  return RAIL.find((s) =>
    s.key === active ||
    s.houseKey === active ||
    (s.members ?? []).some((m) => m.key === active || (m.chips ?? []).some((c) => c.key === active))
  ) ?? null;
}

/** The section's chip row for this page, or null. Held chips never render. */
export function chipsFor(active) {
  const s = sectionOf(active);
  if (!s || !s.members) return null;
  return { of: s, chips: s.members.filter((m) => !m.held) };
}

/**
 * The page-level chip row for this page, or null — the second row, drawn by a
 * member that split rather than scrolled. Returned with the member it belongs
 * to, because the row's kicker names the member, not the section.
 */
export function subChipsFor(active) {
  const s = sectionOf(active);
  if (!s) return null;
  for (const m of s.members ?? []) {
    if (!m.chips) continue;
    if (m.key === active || m.chips.some((c) => c.key === active)) {
      return { of: m, chips: m.chips.filter((c) => !c.held) };
    }
  }
  return null;
}

/**
 * THE ONE ROW a page draws — and it is one, or none, never two.
 *
 * The chip wave shipped `chipsFor` and `subChipsFor` as two rows stacked, and
 * the founder walked into the result: the top rail, then the section's chips,
 * then the room's chips, three bands of chrome before the first word. "We
 * somehow managed to INCREASE the complexity of the site."
 *
 * So the rows compete instead of stacking, and the MOST SPECIFIC one wins: a
 * reader inside a room sees that room's parts, and the way back up to the
 * section is the top rail's own seat. `ownChips` is the third case — a page
 * that already draws a chip row of its own (the shared household's member rail)
 * takes none from the nav at all, which is the founder's Your House rule.
 *
 * This lives here rather than in the layout so the suite can assert the real
 * decision instead of a copy of it that agrees today.
 */
export function rowFor(active, { ownChips = false } = {}) {
  if (ownChips) return null;
  const room = subChipsFor(active);
  if (room) return { ...room, place: "page" };
  const section = chipsFor(active);
  if (section) return { ...section, place: "section" };
  return null;
}
