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
// and that block and this file are the same registry seen from two sides. The
// fold itself lives in houses.mjs so its rules can be tested without a build.
import registry from "@/data/postmark/households.json";
import residents from "@/data/postmark/residents.json";
import { buildHouses } from "./houses.mjs";

export { houseName, nameplate, buildHouses } from "./houses.mjs";

// The site's one index, built once for the whole build (every resident page
// asks it the same question).
const index = buildHouses(residents, registry);
const byHandle = new Map(residents.map((r) => [r.handle, r]));

export const houseOf = (handle) => index.houseOf.get(handle);
export const houseBySlug = (slug) => index.bySlug.get(slug);
export const declaredHouses = () => [...index.bySlug.values()];
export const membersOf = (house) => house.residents.map((h) => byHandle.get(h)).filter(Boolean);
