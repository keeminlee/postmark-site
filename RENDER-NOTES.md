# RENDER-NOTES — what the world render path actually does

Observation, not a profile. ~20 minutes of looking while building `/replay/`, so
the next person profiling has receipts instead of guesses. Measured against
**production postmark.town/world/** (the page Keemin says is laggy), headless
Chromium, 1440×900, this machine — *not* Keemin's, which matters for the timing
numbers and not at all for the structural ones.

Jetto (`meepo-prime`), 2026-08-14. Receipts are `spectator/viewer.mjs` in the
`postmark-world` package unless said otherwise.

---

## The one-line answer

**The DOM is not the problem, and neither is JSON parsing.** The map is ~1,710 SVG
nodes total regardless of how many marks exist, and the 666 KB fold parses in
1.9 ms. The two things actually carrying weight are **the painted atlas** (90
raster `<image>` nodes inside 81 `<svg>`s) and **the fact that panning
re-rasterizes all of it every frame**, because the camera is the `viewBox`.

---

## 1. There is one renderer, and the site does not own it

- `town/pages/world.astro:18,41` — the site emits the package's
  `spectator/index.html` **verbatim**. Its comment states the law: *"the local
  build is THE one viewer; the site serves the same file."*
- `town/scripts/world-engine-island.mjs:92-100` — `viewer.mjs` and every
  `tools/*.mjs` are copied into the build output at `/world-engine/**`.
- `spectator/index.html` is a 24-line shell; all markup, styles and logic live in
  `viewer.mjs`, entered through `export function mountViewer(appEl)`
  (`viewer.mjs:2742`), which returns `{ rerender, stop }`.

So any render change is a `postmark-world` change. The site can only wrap it.

## 2. The map is the ATLAS PAINTING plus derived `<g>` layers

`loadMinimap` (`viewer.mjs:3321`) fetches `/atlas/town.html`, `DOMParser`s it,
disciplines its images, takes its `<svg>`, and appends the viewer's own layers
around it. Layer order IS z-order — mist and far-art are *inserted before* the
painting's first child (the painting opens with a full-bleed rect that would erase
them), then grid, footprints, conversations, overlay/pips, highlight, walk-preview,
walkers, convo-hover.

**Consequence for a tile pyramid:** the settled ground is not drawn by the viewer
at all — it is a synced artifact from `postmark-site`. Tiling the ground is
mostly a question about `/atlas/town.html`, and it can be answered largely
independently of the derived layers.

## 3. Is every mark a live DOM node? **No.**

Measured on production, default fit view, 623 marks in the fold:

| | count |
|---|---|
| total DOM nodes | 2,200 |
| total SVG descendants | 1,710 |
| `<svg>` elements | 81 |
| `<image>` elements | 90 |
| elements carrying `[data-id]` (a mark) | **112** |
| `#wv-overlay` children (pips) | 15 |
| `#wv-walk-layer` descendants | **321** |
| `#wv-fp-layer` (footprints) | 0 — opt-in, empty by default |
| `#wv-grid-layer` | 0 — opt-in |

So ~112 of 623 marks reach the DOM at the default view, and the single heaviest
derived layer is **walkers: 321 nodes for 49 people** (~6.5 nodes each — hit
circle, face image or monogram, ring, label). The overlay is written as **one
`innerHTML` string assignment** (`viewer.mjs:3834`), not per-node DOM churn;
there are 47 `innerHTML =` sites in the file overall.

**This is already closer to O(viewport) than to O(world) in DOM terms.** The
scaling risk is walkers (linear in residents, all drawn) more than marks.

## 4. Pan is a `viewBox` camera — not re-layout, not CSS transform

- `viewer.mjs:3428` — *"the viewport (P2 convergence): the viewBox IS the camera"*.
- `applyView()` (`:3441-3442`) does exactly one thing: `svg.setAttribute("viewBox", …)`.
- Culling exists (`markGeometryIntersectsViewport`, exported at `:118`) but is
  consulted during a render pass (`:3867`), **not on drag**.

Measured across a 30-step drag: node count **1,710 → 1,710**, viewBox
`0 650.3 1500 1099.3` → `488.6 894.6 1500 1099.3`. Nothing was added, removed, or
re-culled; only the camera moved.

**This is the load-bearing finding for the rewrite.** Every pan frame asks the
browser to re-rasterize the entire painting — 81 nested `<svg>`s and 90 raster
`<image>`s — at a new transform, with no tiling and no culling in between. That is
the classic laggy-SVG-pan shape, and it is exactly what a tile pyramid fixes.

A `settle` pass runs 340 ms after motion stops (`:5374`), so re-render is
trailing-edge, which is the right instinct already.

## 5. Per-frame loops: there is no idle burn

`requestAnimationFrame` appears only for the camera tween (`:3458`) and bubble
positioning (`:3381`, `:4438`) — no continuous animation loop. Timers:

| what | interval | receipt |
|---|---|---|
| walkers poll | 15 s | `:4339` |
| main clock (crossing, settlements, conversations, fold as-of) | one tick, ~30 s | `:5895` |
| conversations layer re-poll | every other tick, ~60 s, **only when toggled on** | `:5906` |
| fold `X-Postmark-As-Of` re-check | every other tick, office-live source only | `:5908` |
| settle after layout motion | 340 ms trailing | `:5374` |
| dev-dial debounce | 70 ms | `:5678` |

Mist, boat and far-art are **static SVG**, not animated — I found no rAF driving
them. So an idle world page is genuinely idle.

## 6. Payload shapes and sizes (production, measured)

| URL | wire (gzip) | raw |
|---|---|---|
| `/api/world/state` | 110 KB | **666 KB** |
| `/atlas/town.html` | 126 KB | **385 KB** |
| `/world-engine/spectator/viewer.mjs` | 128 KB | 338 KB |
| `/WORLD/skeleton.json` | 6 KB | 21 KB |
| `/api/world/walkers` | 2 KB | 14 KB |
| `/world-engine/residents-meta.json` | 2 KB | 9 KB |
| **total** | **~374 KB** | **~1.43 MB** |

`/api/world/state` is the whole fold — every mark, unculled. It is the one payload
that grows with the world.

## 7. Timings, with their caveats

- **`JSON.parse` of the 666 KB fold: 1.9 ms.** Parsing is not the cost; that
  hypothesis is dead. What follows it — `assembleWorld` + `renderCurrent`
  (`:2807-2811`) — is untimed here and is where I would point a profiler first.
- **Pan frame intervals** over a 30-step drag: median **15.4 ms**, p90 **28.3 ms**,
  p99/max **41.6 ms**; **8 of 97 frames over 33 ms**. So it mostly holds 60 fps
  with real hitches, on a headless browser with nothing else running. Keemin's
  lived experience being worse is consistent with this, not contradicted by it.
- `networkidle` load: ~1.0 s.

**Where I would look next, in order:** (1) rasterization cost of the painting on
`viewBox` change — the only thing that runs on every pan frame; (2) `assembleWorld`
+ the telling on the initial load and on each re-render; (3) the 321-node walker
layer as resident count grows.

---

## 8. What my two surfaces coupled to — the O(viewport) constraint

Per the constraint: keep derivation separable so a tiled renderer can slot under.

**Separable, no full-world coupling:**
- The replay's own data is **per-crossing by construction**:
  `/world-engine/replay/index.json` (scrubber only — 10 rows, ~1 KB) plus one
  `/world-engine/replay/<n>.json` per frame (~10 KB each, 112 KB for all ten).
  A frame carries only that crossing's walkers, moves and voices. Nothing in
  `town/scripts/replay-record.mjs` reads or needs the world fold.
- The conversations page is **per-thread** already — the office serves derived
  threads and the page never loads world state at all.

**Where I DID couple to the full-world load, and it is forced, not chosen:**
- `/replay/` mounts the existing viewer, so it inherits the full-fold load — and
  worse than `/world/` does: it fetches a **different 666 KB fold per crossing**
  (pinned to that crossing's `as_of_world` sha on raw.githubusercontent), and
  **re-mounts the viewer on every step**, so scrubbing pays a fresh assemble each
  time. Per-sha URLs are immutable so the browser caches them, which is the only
  reason this is tolerable today.
- **What a tiled renderer would want from me:** nothing changed in the derivation;
  only the lens (`town/pages/replay/index.astro`, the inline `fetch` shim) would
  need to answer tile requests pinned to `frame.as_of_world` instead of one whole
  fold. The shim is ~60 lines and already keyed on exactly that sha, so it is the
  right seam and it is site-side.
- The replay also needs **per-crossing ground**, which a tile pyramid built only
  for `main` would not serve. If tiles are cut, cutting them per settlement
  commit (or accepting today's tiles under historical marks, stated) is a
  decision the replay is waiting on.
