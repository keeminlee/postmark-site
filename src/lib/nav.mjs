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
// the read the seat itself leads to. The World's first chip is the living map.
// The Town's first chip is Ferry's Daily. A section whose seat and whose first
// chip disagree is a section with no aggregate, and the first-chip law in the
// test says so out loud.
//
// THE ROW IS ONE ROW DEEP AND IT IS THE SECTION'S — founder, 2026-08-25: "no
// subpage removes the town level subrail and replaces with its own." The chip
// wave briefly let a member carry a `chips:` row of its own, so a reader inside
// /residents/ or /mail/compose/ saw three chips where The Town's row had been
// and lost every neighbouring room at once. `subChipsFor` still exists and
// still obeys the first-is-the-aggregate law, but nothing in The Town declares
// a second row any more; a sub-page tells the layout its ROOM's key instead, so
// it draws the section's row with its own room lit.
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

  // THE TOWN — the town apex and its reads. It sits AHEAD of The World by the
  // founder's word, 2026-08-25: "the town comes before the world." The town is
  // what a reader arrives for; the world is the ground it stands on, and the
  // ground is the second thing you look at. Everything the town IS hangs here,
  // including The Works, demoted out of the top rail the same day: "weird
  // having that old surface be first-class."
  //
  // THE SEAT LANDS ON FERRY'S DAILY, and /town/ is not in the row at all —
  // founder, same sitting: "the town goes to ferry's daily, hide 'the town'
  // (it's empty now, maybe comes back later if we have town info to put
  // there)." That is him answering the honest note left on the last lane: the
  // page had just had its card grid and its four dials deleted as restatement,
  // and what remained was a room with nothing in it. So the aggregate seat goes
  // to the read that actually carries the town's day.
  //
  // The first-chip law is NOT bent by this — it is satisfied one rung down. The
  // row still leads with the thing the seat leads to (both are /daily/), so a
  // reader who clicks the section and a reader who clicks its first chip still
  // land in the same place. What changed is WHICH read stands for the whole,
  // and that was the founder's call to make. `/town/` keeps its URL and its
  // page; it is simply unlinked until there is town info to put there.
  {
    key: "town",
    label: "The Town",
    href: "/daily/",
    members: [
      { key: "daily", label: "ferry’s daily", href: "/daily/" },
      // The notice board came BACK to /bulletin/ in this wave. It had been
      // folded into the Daily as an anchor, which made it a chip that could
      // never light up — and `town.bulletin` is its own read, so under the
      // page-per-read law it wants its own page. Its old URL was still sitting
      // there as a redirect stub, so restoring it cost no new URL and made
      // every doorstep deep-link (/bulletin/#slug) land natively.
      { key: "bulletin", label: "the notice board", href: "/bulletin/" },
      { key: "residents", label: "residents", href: "/residents/" },
      { key: "mail", label: "the mail", href: "/mail/" },
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

  // NO SECOND ROW ANYWHERE IN THE TOWN — founder, 2026-08-25: "no subpage
  // removes the town level subrail and replaces with its own." Residents and
  // the mail each grew a `chips:` row in the chip wave, so standing on
  // /residents/ or /mail/compose/ replaced The Town's row with a row of three.
  // A reader deep in a room lost the only chrome that showed the room's
  // neighbours, and the swap read as arriving somewhere else entirely.
  //
  // Both rows are gone, and with them four chips the founder struck by name:
  // "the windows" and "the meeps" off residents, "returned to sender" and
  // "write a letter" off the mail. THE PAGES ALL STAY at the URLs they have —
  // /window/, /meeps/, /mail/returned/, /mail/compose/ — and each one now tells
  // the layout its ROOM's key, so it draws The Town's row with its own room
  // lit. That is the whole point of the ruling: one row, always the same row,
  // and it says which room you are standing in.
  //
  // Three of the four keep a door in prose — /meeps/ from the Daily, the
  // homepage, /mail/ and /town/; /mail/returned/ and /mail/compose/ from the
  // mail's own page, which is where the write-a-letter button always lived.
  // /window/ has NO inbound link left anywhere on the site. That is the
  // /votes/ condition this whole file exists because of, and it is recorded
  // here rather than quietly fixed, because re-siting the window street is a
  // shape call and nobody has made it. (`test/nav.test.mjs` holds the four to
  // the row they must draw; it cannot hold a page to a link nobody wrote.)

  // THE WORLD — the model section, already chip-shaped in spirit before the
  // chip wave. Replay, Conversations and the Atlas are lenses ON the World, not
  // peers of it, so they left the top rail in 2026-08-15 and are reached
  // through this row and the map's own floating panel. /world/ keeps its own
  // side rail until the cockpit wave.
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
