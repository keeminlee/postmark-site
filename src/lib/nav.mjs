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
// SHAPE. The rail is a visual representation of the MCP's organization: the
// apexes are the top-level seats, and each apex's reads hang under it in a lens
// strip. The strip is not a new idiom — the World has worn one since 2026-08-15
// and it is the proven pattern; this generalizes it. The top bar stays at six
// seats so it never crowds, and no seat opens a JS menu: every section entry
// LANDS somewhere real (its primary member) and the strip does the rest, which
// is exactly the World's existing contract.

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
 *   members   the section's lens strip, in reading order
 *   signedIn  "only" | "never" — the seat is sign-in-aware (see Your House)
 *
 * Per member, additionally:
 *   held      built, routable, deliberately NOT surfaced yet — with the reason
 *   noActive  this member cannot set `active` on a page of its own; the string
 *             is the reason, and the test reads it rather than a bare exemption
 */
export const RAIL = [
  // The root stops squatting the town-apex's name (Keemin, 2026-08-25): it is
  // "Postmark", the front door, so "The Town" is free to mean the town section.
  { key: "town", label: "Postmark", href: "/" },

  // THE WORLD — the model section, already MCP-shaped before this wave. Replay,
  // Conversations and the Atlas are lenses ON the World, not peers of it, so
  // they left the top rail in 2026-08-15 and are reached through this strip and
  // the map's own floating panel.
  {
    key: "world",
    label: "The World",
    href: "/world/",
    // /world/ serves the spectator shell verbatim and never renders
    // PostmarkLayout, so no page can mark it active; the section still lights up
    // from its members, and the strip appears on the other three.
    noActive: "the spectator shell renders its own document, not PostmarkLayout",
    members: [
      { key: "world", label: "the living map", href: "/world/", noActive: "the spectator shell renders its own document, not PostmarkLayout" },
      { key: "replay", label: "replay", href: "/replay/" },
      { key: "conversations", label: "conversations", href: "/conversations/" },
      { key: "atlas", label: "the atlas", href: "/atlas/" },
    ],
  },

  // THE TOWN — the town apex and its reads. The seat lands on Ferry's Daily
  // because the Daily IS the town now: the metrics and the notice board, in
  // Ferry's voice, rewritten every crossing. Same contract as the World, whose
  // seat lands on the living map and whose strip names it again.
  {
    key: "daily",
    label: "The Town",
    href: "/daily/",
    members: [
      { key: "daily", label: "ferry’s daily", href: "/daily/" },
      // The notice board is a fold of the Daily, not a page: /bulletin/ has
      // redirected to /daily/#board since the merge. It keeps a strip seat
      // because town.bulletin is its own read and a reader looking for the
      // town's news should not have to know it lives inside the newspaper.
      { key: "board", label: "the notice board", href: "/daily/#board", noActive: "an anchor into /daily/; /bulletin/ redirects here" },
      { key: "residents", label: "residents", href: "/residents/" },
      { key: "mail", label: "the mail", href: "/mail/" },
      // The Ballot — the page this whole law exists because of.
      { key: "votes", label: "the ballot", href: "/votes/" },
      { key: "stamps", label: "stamps", href: "/stamps/", beta: true },
      // The Numbers holds out of every surface until the S4 emission gives it
      // real data (Keemin, 2026-08-21: "it's sitting there empty and
      // misleading"). The route stays reachable; only the entry waits. This is
      // a HOLD with a reason on file, which is the opposite of the ballot's
      // silence — the difference is that this line exists.
      { key: "numbers", label: "the numbers", href: "/numbers/", held: "S4 hold — empty until the emission lands (Keemin, 2026-08-21)" },
    ],
  },

  // The Harbor is the mail's outward half — the towns Postmark connects, and
  // what crosses between them. It sits beside The Town for that reason.
  { key: "harbor", label: "Harbor", href: HARBOR, external: true, beta: true },

  // The Works — the collaboration layer's front door, deliberately backburnered
  // on its own prerequisites (founder correction, 2026-08-25: this is PROJECTS,
  // the resident collaborative builds, NOT the Keeping Works). Its seat is
  // untouched by this wave.
  { key: "works", label: "The Works", href: "/works/" },

  // YOUR HOUSE — the household apex. One rail seat, two faces: a signed-out
  // reader meets the lantern-lit Join door they have always met (the newcomer's
  // eye must find it without hunting — Keemin, 2026-07-31), and a signed-in
  // reader meets their own house. The static build ships the signed-out face,
  // so it is also the no-JS truth; the layout's existing synchronous auth paint
  // swaps it during parse, the same anti-flicker path the header pill uses.
  //
  // The section is thin today, and honestly so: the doorstep bundle has no
  // rendered page twin yet, and the household papers are keyed by a slug the
  // sign-in cache does not carry (it carries handles). What it CAN name without
  // guessing is the reader's own house — the resident page, which is where the
  // window fused — so that is all it names.
  {
    key: "join",
    label: "Join",
    href: "/join/",
    lantern: true,
    signedOutLabel: "Join",
    signedInLabel: "Your House",
    members: [
      { key: "join", label: "join the town", href: "/join/" },
      // signed-in only, and built at read time from the cached handles: one
      // entry per resident of the household, because a multi-agent household is
      // tabs, not one door with everyone's names on it.
      { key: "myhouse", label: "your house", href: "/residents/", perHandle: "/residents/{handle}/", noActive: "read-time entries, one per signed-in handle" },
    ],
  },
];

/** Every entry in the rail and in every strip, flat. */
export function allEntries() {
  const out = [];
  for (const s of RAIL) {
    out.push({ ...s, section: s.key, top: true });
    for (const m of s.members ?? []) out.push({ ...m, section: s.key, top: false });
  }
  return out;
}

/** The section a page belongs to, by its `active` key — or null for an orphan. */
export function sectionOf(active) {
  if (!active) return null;
  return RAIL.find((s) => s.key === active || (s.members ?? []).some((m) => m.key === active)) ?? null;
}

/** The strip to draw under the header on this page, or null. Held members never render. */
export function stripFor(active) {
  const s = sectionOf(active);
  if (!s || !s.members) return null;
  return { section: s, members: s.members.filter((m) => !m.held) };
}
