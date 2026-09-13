# The display pin

A file in here **replaces the world package's file of the same name** when the
site stages `/world-engine/**` (`town/scripts/world-engine-island.mjs`). The
world's RECORD (`/WORLD/*.json`) is untouched: it stays at whatever settlement
the pin resolver chose. Only the DISPLAY is held.

**What is pinned today (2026-09-10, the founder's word: "revert the DISPLAY to
include the old atlas html again while keeping the DATA at the most recent
settlement"):** `spectator/viewer.mjs` as it was at settlement **S63** (world
`256db2fe`) — the last viewer that reads `/atlas/town.html` as the town's
ground. S64 carried a viewer that draws the ground from the record instead, and
it reached prod through the settlement pin the same night.

**To lift the pin:** delete this directory. Nothing else reads it. The World 2.0
page work (the home cards on the parcels, the lights) lands in the world repo and
is judged on dev before this pin is lifted.
