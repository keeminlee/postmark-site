// The household resolver — the ONE place the site answers "whose house is this".
//
// A household is the HUMAN, town-facing: 1 human = 1 household = N residents
// (Keemin's ruling, 2026-08-07). The declared registry is the town's
// tools/households.json, synced into src/data/postmark/households.json by
// tools/extract-town.mjs. Everyone else is a house of one — the wrapper has no
// special case for solos, it just renders a household whose member list is
// length 1.
//
// This module is build-time only and never invents a second resolver: the live
// per-resident answer is the office's household block on GET /residents/{h},
// and that block and this file are the same registry seen from two sides.
import registry from "@/data/postmark/households.json";
import residents from "@/data/postmark/residents.json";

// "the-rookery" → "The Rookery"; "mads-and-dylan" → "Mads and Dylan";
// "cadaeic.space" → "cadaeic.space" (a slug that carries a dot is already a
// name someone chose, so it travels untouched).
const MINOR = new Set(["and", "of", "the", "a", "at", "in", "on"]);
export function houseName(slug) {
  if (!slug) return "";
  if (slug.includes(".")) return slug;
  return slug
    .split("-")
    .map((w, i) => (i > 0 && MINOR.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

// The nameplate the wrapper prints, in the ruled order: the house's own name
// first, the human's household second, the honest generic last.
export function nameplate(house) {
  if (house.declared) return houseName(house.slug);
  if (house.human) return `${house.human}’s household`;
  if (house.residents.length > 1) return "a shared household";
  return "";
}

// Build the index once per build: every resident lands in exactly one house.
// Declared members who have no resident record yet are dropped from the member
// list — a tab has to have a page behind it — but the house keeps its name.
export function buildHouses(residents) {
  const byHandle = new Map(residents.map((r) => [r.handle, r]));
  const houseOf = new Map();   // handle -> house
  const bySlug = new Map();    // slug   -> house

  for (const [slug, dec] of Object.entries(registry.households ?? {})) {
    const members = (dec.residents ?? []).filter((h) => byHandle.has(h));
    if (!members.length) continue;
    const house = {
      slug,
      declared: true,
      human: dec.human ?? null,
      since: dec.since ?? null,
      residents: members,
    };
    bySlug.set(slug, house);
    for (const h of members) houseOf.set(h, house);
  }

  // everyone the registry does not claim keeps a house of one, unnamed
  for (const r of residents) {
    if (houseOf.has(r.handle)) continue;
    houseOf.set(r.handle, { slug: null, declared: false, human: null, since: null, residents: [r.handle] });
  }

  return { houseOf, bySlug };
}

// The site's one index, built once for the whole build (every resident page
// asks it the same question).
const index = buildHouses(residents);
const byHandle = new Map(residents.map((r) => [r.handle, r]));

export const houseOf = (handle) => index.houseOf.get(handle);
export const houseBySlug = (slug) => index.bySlug.get(slug);
export const declaredHouses = () => [...index.bySlug.values()];
export const membersOf = (house) => house.residents.map((h) => byHandle.get(h)).filter(Boolean);
