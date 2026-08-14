# PLAN — the replay, and the conversations surface

Branch `wright/replay`, off `origin/main` `0452292b` ("LICENSE: AGPL-3.0 — the
walls are public, the replay is legal"). Worktree `G:/postmark/worktrees/jetto-replay`
— my own tree, not the operator clone at `G:/Postmark/site` (Wright's, and a
sync cron commits into that lineage every ~30 min).

Author: Jetto (`meepo-prime`), teammate under Wright, 2026-08-14.

---

## 0. The finding that reshapes the brief

**The conversations page already exists, is already built to the settled design,
and is already live.**

- `town/pages/conversations/index.astro` — 819 lines, on `origin/main` today.
- `https://postmark.town/conversations/` → **HTTP 200**.
- The office serves it: `GET https://postmark.town/api/world/conversations` →
  `{pinned, now, earshot_m: 60, fade_minutes: 5, close_minutes: 30, live[], closed[]}`,
  each thread carrying `id, place, at{x,y}, extent, started, latest,
  participants[], voice_count, voices[{handle, said, at, at_ms, x, y}]`.

Checked against the settled design (`G:/Wright-HQ/PULSE/silver-draft/postmark-earshot-proximity-chat.md`
§ The conversations page, § Rulings 4): world-wide ✓ · threads derived not stored
(the office clusters; the page never persists one) ✓ · live on top, closed below,
still browsable ✓ · place words lead with coords in the detail line ✓ · participants
link to resident pages ✓ · the exchange in order ✓ · `textContent` never `innerHTML` ✓ ·
ALPHA banner ✓ · the two clocks explained in prose ✓.

The map↔page link exists too, in the direction I did not expect: the **viewer**
already draws a conversations layer (`spectator/viewer.mjs:2687` the 💬 control,
`:4094` the ground layer, `:4116` `convoHref = (id) => "/conversations/#" + id`)
and the page catches that fragment (`index.astro:382` `anchorFromHash`).

**So surface 2 is not a build. It is an audit plus a revamp in place** (§4, §4b) —
same route, same URL, no parallel page. Rebuilding it would be the expensive kind
of obedience: two implementations of a shipped surface, and a fork of a page
Wright already merged.

**The replay does not exist**: `https://postmark.town/replay/` → **HTTP 404**, no
branch, no prior commit. That is the build.

---

## 1. As-found: how the site renders the world (receipts)

The site **does not own a renderer**. The world page is a passthrough:

- `town/pages/world.astro:18` — `import rawHtml from 'postmark-world/spectator/index.html?raw'`,
  emitted verbatim at `:41`. The comment at `:2` states the law: *"the local build
  is THE one viewer; the site serves the same file."*
- `town/scripts/world-engine-island.mjs` — the one wiring. It copies
  `spectator/viewer.mjs` and every `tools/*.mjs` out of `node_modules/postmark-world`
  into the build output under `/world-engine/**` (`:92-100`), and stages four
  record files to their public paths (`:23-30` `RECORD_FILES` → `/WORLD/world-state.json`,
  `/WORLD/skeleton.json`, `/seeding/manifest.json`, `/WORLD/settlement-publications.json`).
  In `astro dev` the same list is served straight from `node_modules` (`:184-203`).
- It also **derives** one record file rather than copying it —
  `/world-engine/residents-meta.json`, built from this repo's own extracted data
  (`:45-77`, written at `:119-124`). **That is the precedent this plan follows.**

The seam that makes reuse possible without forking:

- `spectator/index.html` is a 24-line shell whose entire job is
  `mountViewer(document.getElementById("app"))`.
- `spectator/viewer.mjs:2742` — **`export function mountViewer(appEl)`**. It mounts
  into any host element handed to it. The replay page calls the same export.

And the viewer's data doors are all plain `fetch` of known URLs, office-first with
same-origin fallback:

| door | site | receipt |
|---|---|---|
| world state | `/world/state` → `/WORLD/world-state.json` → raw.github | `viewer.mjs:2794` |
| skeleton | `/world/skeleton` → `/WORLD/skeleton.json` → raw | `:2819` |
| walkers | `/world/walkers` → `/walks` | `:4305` |
| conversations | `/world/conversations` | `:4018` |
| settlements | `/world/settlements` | `:3985` |
| activity | `/repo/log?limit=120` | `:3976` |
| identity | `/ops/whoami`, `/world/my-marks` | `:5707`, `:5690` |

There are **no URL parameters** in the viewer (`location.search` / `URLSearchParams`:
zero hits) and `mountViewer` takes no options, so the fetch layer is the seam the
replay uses.

> **Corrected later in the build:** "no URL parameters" is true and "therefore the
> fetch layer is the ONLY seam" — which this section originally said — was wrong,
> and it cost me a gap I first reported as unclosable. There is a second seam:
> the viewer's **delegated click handlers** are a public interface too. Any `.ctl`
> with `data-x`/`data-y` sets the standpoint (`:5595`); the follow control centres
> the camera on it (`:5525`); the crossing time-travel dial takes a number
> (`:5667`). All three are driven from site-side pages on this branch. **Absence
> of the seam you looked for is not absence of a seam.**

---

## 2. As-found: where crossing and speech data actually live

`postmark-world` carries a committed, tracked event record under `STATE/`:

```
STATE/log/<n>.jsonl        one JSON object per event
STATE/log/<n>.meta.json    {crossing, covers_from, covers_to, complete,
                            as_of_world, event_count, counts{departure,attachment,emission}}
STATE/snapshot/<n>/entities.json
                           {crossing, evaluated_at, grammar, as_of_world, omits[],
                            entity_count, entities[], attachment_count, attachments[]}
```

An **entity** is a resident frozen at the crossing boundary:
`{handle, x, y, arrived, standing, leg_m, travelled_m, remaining_m, eta_crossings, departure{...}}`.
That maps almost one-to-one onto the live walkers payload the viewer already eats
(`{handle, x, y, source, moving, toward, remaining_m, eta_crossings, mark_id}`) — so
the frame can be handed to the viewer in the shape it already understands.

An **event** is one of three types. Verbatim from `STATE/log/120.jsonl`:

- `departure` — `{at, type, actor, seq, payload:{from{x,y}, toward{x,y}, crossing, within, to, pace, declared_by, source}}`
- `emission` — `{at, type, actor, id, payload:{class:"sound", x, y, ttl_expires_at, spoken_by, human, aboard, place, text, radius_m:60, ttl_min:5}}`
- `attachment` — present in the schema, **zero occurrences** in the whole record.

**`emission` is speech.** It carries `text`, `spoken_by`, `place` (place words, e.g.
*"the Looking Room, the Lanternseed Gardens"*), coordinates, and the earshot radius.
So the same STATE record answers both surfaces: it is the replay's event digest
*and* a per-crossing speech record.

### It ships

`STATE/**` is inside the npm package — verified with `npm pack --dry-run` in the
world repo, not inferred: the tarball listing includes `STATE/log/118.jsonl`
through `STATE/snapshot/…`. (The `node_modules/postmark-world` in the operator
clone lacks `STATE/` only because it predates it — it also lacks `READS.md`, which
shipped 2026-08-06. Stale install, not a packing rule.)

### What the record honestly covers — the gap to report

At the pinned commit `c432b842` there are **ten crossings, 118–127**:

| crossing | covers (UTC) | complete | events | dep | emit |
|---|---|---|---|---|---|
| 118 | 08-10 00:00 → 12:00 | yes | 10 | 7 | 3 |
| 119 | 08-10 12:00 → 08-11 00:00 | yes | 59 | 54 | 5 |
| 120 | 08-11 00:00 → 12:00 | yes | 17 | 9 | 8 |
| 121 | 08-11 12:00 → 08-12 00:00 | yes | 9 | 5 | 4 |
| 122 | 08-12 00:00 → 12:00 | yes | 4 | 4 | 0 |
| 123 | 08-12 12:00 → 08-13 00:00 | yes | 3 | 2 | 1 |
| 124 | 08-13 00:00 → 12:00 | yes | 0 | 0 | 0 |
| 125 | 08-13 12:00 → 08-14 00:00 | yes | 6 | 1 | 5 |
| 126 | 08-14 00:00 → 12:00 | yes | 1 | 1 | 0 |
| 127 | 08-14 12:00 → (open) | **no** | 0 | 0 | 0 |

109 events total — 83 departures, 26 emissions, 0 attachments — over ~4.5 days.
49 entities per snapshot.

**The gap, stated plainly: the replay reaches back to crossing 118 and no further.**
`STATE/` was introduced around 2026-08-10; the town is far older. Crossing 124 is
a genuinely empty half-day and 127 is still open. The page must say this rather
than imply the archive is the world's whole life.

I am **not** reconstructing earlier crossings from `WORLD/walk-ledger.md`. It would
mean re-deriving positions by hand — reimplementing a law the engine already owns,
which is exactly the trap [[recursor-write-execution]] rule (t) cost me a day for.

No office endpoint offers history: probed `GET /api/world/{crossings,snapshot,replay}`
→ 404 each; only live doors (`/world/state`, `/world/walkers`, `/world/present`,
`/world/settlements`) exist.

---

## 3. The replay — design

### Derivation: build-time, following `residents-meta.json`

The brief said prefer whatever the site already does for world data, and the site
does two things: stage record files from the package, and derive one small file at
build. Replay data is **derived at build**, in `world-engine-island.mjs`, beside
the existing `residentsMeta()`:

- `/world-engine/replay/index.json` — `{generated, crossings:[{n, from, to, complete, counts, entity_count, digest{...}}]}`.
  One fetch tells the page the whole scrubber.
- `/world-engine/replay/<n>.json` — one frame: `{meta, entities[], events[], voices[]}`,
  the jsonl already parsed into JSON so no client parses a log format.

Build-time freshness is the same freshness the map already has (the world-state it
draws over is staged from the same pin). Raw `STATE/**` is **not** shipped verbatim —
deriving is one surface instead of two-fetches-plus-a-parser, and it keeps the
jsonl an engine-internal format rather than a public contract I would be
accidentally freezing.

### Render: `mountViewer` + a frozen-frame fetch lens

`/replay/` mounts **the same viewer**, into its own host element, and installs a
small `window.fetch` lens *before* the module loads (the same ordering trick
`world.astro:33-39` already uses for its identity bridge). The lens answers the
viewer's office reads from the selected frame and passes everything else through:

- `/world/walkers`, `/walks` → the frame's entities, in walkers shape.
- `/world/conversations` → **empty, deliberately.** Clustering voices into threads
  is the office's law; a second implementation would disagree at exactly the
  interesting cases (rule (t)). That crossing's speech is listed verbatim in the
  digest instead, from the emissions themselves.
- `/repo/log`, `/world/settlements` → empty, so no live sidebar bleeds into a past frame.
- `/WORLD/walk-ledger.md` → the ledger at the crossing's own commit. It is
  append-only, so taking it at that sha simply ENDS there and the viewer's
  "lately" column becomes that crossing's recent history instead of today's.
- `/ops/whoami`, `/world/my-marks` → **anonymous**. This is the important one: it
  makes `identityResolved()` (`viewer.mjs:2928`) false, so `canAct()` is false and
  every act control feature-detects off **through the viewer's own supported
  spectator path** — not by CSS-hiding a live button.
- **Any non-GET to the office → refused.** The replay is read-only by construction;
  a historical frame must not be a place from which someone walks or stakes the
  live world.
- `/world/state`, `/WORLD/*`, `/atlas/*`, `/media/*`, `residents-meta.json` → pass
  through. See the honesty note below.

Scrubbing re-answers the lens and asks the viewer to re-read; no second renderer,
no forked draw code, no edit to `postmark-world` (which is read-only to me here).

### The honesty note this page must carry

> **Corrected during the build — the first version of this section was wrong in
> the pessimistic direction, and the correction is the best thing on the branch.**
> I had planned to render today's marks under historical walkers and apologise for
> it in prose. But every crossing's meta names the world commit it was computed
> against (`meta.as_of_world`; crossing 120 → `3b3421b4…`), those are real commits
> in a **public** repo, and the viewer already falls back to
> `raw.githubusercontent.com/keeminlee/postmark-world/main/...`. Pinning that
> fallback to the crossing's own sha instead of `main` yields the true historical
> fold, at no new infrastructure. **Verified: crossing 120 loads 612 marks,
> crossing 126 loads 623**, and `alden/the-fox-hearth` — founded between them —
> is drawn in the later frame only.

So the real limit is narrower, and the page states exactly this one:

**The world's *record* is historical; the atlas *painting* underneath is today's.**
The illustrated basemap is `/atlas/town.html`, which is kept by the town in
`postmark-site` and has no per-crossing version to fetch. Everything derived from
the record — which marks existed, their extents and tiers, who stood where, what
moved, what was said — is that crossing's. The painting is not.

That distinction is the whole reason this surface can be trusted, so it is chrome,
not a footnote.

### Page shape

- Header: what a crossing is (a half-day between ferry sailings), the ALPHA
  honesty line, and the coverage sentence (crossings 118–127, and that the record
  starts there).
- The map, full-width, mounted viewer.
- A scrubber under it: ◀ ▶ arrows, the crossing number, its UTC span, and a
  track of ten ticks whose height reads event volume — so a viewer can *see* that
  119 was the busy one and 124 was silent.
- A digest panel beside/below the map: who moved (departures, with place words
  where the record carries them) and what was said (emissions, verbatim, with
  speaker and place) — each in the order it happened, with links out to resident
  pages and, for speech, to `/conversations/`.
- Empty crossings say so warmly ("nothing was recorded this crossing — a quiet
  half-day"), never an error.

Taste: the town's own window. Warm ground, place words and handles as people read
them, no JSON on the page, no coordinates leading a line. Matches
`conversations/index.astro`'s palette and `PostmarkLayout`.

---

## 4. Conversations — the audit, and the one gap

Not a rebuild. What I will do:

1. **Verify** it against the settled design with rendered eyes (screenshots,
   desktop + narrow), and report exactly what it can and cannot show.
2. **The map link — NOW CLOSED, and I was wrong that it couldn't be.**

   My first reading said the round trip was impossible without a `postmark-world`
   change: `viewer.mjs` has zero `location.search` / `URLSearchParams` /
   `location.hash`, and `mountViewer(appEl)` takes no options. Both facts are true
   and the conclusion was still wrong — I had checked for a URL entry point and
   stopped, instead of asking whether the viewer could be *driven* to a place at
   all. It can, through affordances it already publishes:

   - **`viewer.mjs:5595`** — any `.ctl` element carrying `data-x`/`data-y`, when
     clicked, sets the standpoint and re-tells. It is the viewer's own delegated
     handler, the one its coordinate buttons use.
   - **`viewer.mjs:5525`** — the follow control (◎) calls `lockOn()` and centres
     the camera on the standpoint.

   So `/world/?at=<x>,<y>` is implemented **entirely site-side** in
   `town/pages/world.astro`, composing those two. It is inert without the
   parameter — a plain `/world/` is byte-identical and measurably untouched.

   **Two wrong versions before the right one, both of which LOOKED like they
   worked** (kept, because the shape recurs):
   - Waiting for `#wv-map svg` before acting: the map element exists long before
     the world loads, so the standpoint was set and then silently overwritten by
     the boot's first render. Fixed by waiting on a drawn overlay *and* by
     re-checking the follow click's own effect rather than trusting it.
   - Following *first* and standing second: `lockOn()` starts a tween, and while
     `_tweening` is true the standpoint's re-render skips its re-lock
     (`viewer.mjs:3840`). The map zoomed decisively — to the town centre — and my
     probe's "the camera moved" check passed, because a camera that goes to the
     wrong place has still moved. The discriminating check is against the atlas
     grid: `WORLD/skeleton.json` puts Ferry's crossing at atlas `(485,760)` at
     5 m per px, so `-1375,-2545` must land at `(210,251)`. It now does.

3. **What else changed on the page** — small, additive, no rewrite:
   - Each thread now carries its **own permalink**. The page has always *answered*
     to `#<thread-id>` (that is how the map arrives) but offered no way to get
     that link out, which is precisely what a reader wants when they find one
     conversation worth showing someone.
   - The replay's spoken lines use the same `/world/?at=` door, so both surfaces
     say "here is where that happened" the same way.

Verified end-to-end by `qa-shots/verify-links.mjs` (6/6): 40 threads, 40
well-formed place links, 40 permalinks, and following a link the page actually
rendered lands the map at `(210,251)` with follow engaged — plus the
discriminator that it is *not* parked on the town centre.

Nothing else on this page was touched. It was already right.

---

## 4b. The conversations page: what I found vs what I changed

Asked for explicitly, since the brief was corrected mid-flight from "build one" to
"revamp the existing one in place". **Same URL, same route, no parallel page.**

| | |
|---|---|
| **Found** | `town/pages/conversations/index.astro`, 819 lines, on `origin/main`, live at postmark.town/conversations/ (HTTP 200). Already the full settled design: world-wide scope; threads derived by the office, never stored; live on top and "gone quiet" below, still browsable; place words leading with coords in the detail line; participants linked to resident pages; the exchange in order; faces with the three copied-not-paraphrased guards; the doorstep say-box with its own signed-out/no-handles gates; pinned notices; scroll-position preservation across the 7 s poll; ALPHA banner; `textContent` everywhere. |
| **Changed** | Three things, ~40 lines total. (1) Place words became a link to `/world/?at=x,y` — the missing return half of a round trip the viewer already made in one direction. (2) Each thread gained a permalink. (3) Supporting CSS. |
| **Deliberately not changed** | Everything else. The poll cadence, the say-box, the safety guards, the two-clocks prose, the empty-state wording, the layout. It was built right and re-doing it would only add risk. |

One observation rather than a change: the page is **15,348 px tall** with 40
threads and grows with the town, since closed threads stay forever by ruling. A
"load more" or a date rule will be wanted eventually. Not mine to decide, and not
urgent.

## 5. Lanes, and what I will not touch

- Write only inside this worktree. `postmark-world` and `office` are **reads only** —
  no commit, no HEAD move, no fetch that rewrites their refs.
- Never push to `main`. Branch pushed for Wright's own-eyes visual QA; the merge
  is his (visual QA before merge is an absolute gate for UI work).
- No deploys, no external posts, no MCP writes into the live world.
- Screenshots into `qa-shots/` on the branch so review starts on pixels.

## 6. Gates — results

- **`npm run build` exit 0**, 2491 pages, `[world-engine-island] staged 55 files`
  (44 before + the 11 replay files).
- **Derivation checked against the engine's own counts**: for every crossing, the
  moves/voices/attachments I derive equal `meta.counts.{departure,emission,attachment}`
  — 0 mismatches. Those counts are written by the engine, not by me, so the check
  can fail.
- **`qa-shots/verify.mjs` — 8/8 pass**, each able to fail: two crossings fetch two
  different pinned world commits; a mark founded between them is drawn in the later
  frame only; the folds differ (612 vs 623 marks, counted off the wire); walkers
  come from the frozen snapshot; the viewer's own caption names the replayed
  crossing; no act control is enabled; a POST at the office is **refused 403**;
  ordinary GETs still pass.
- **`qa-shots/shoot.mjs`** — 7 screenshots, desktop + narrow, **zero console errors
  on every surface**. (For contrast, `/world/` itself throws three 500s under local
  preview: the island's preview proxy targets the dev port on Windows. Pre-existing,
  not introduced here, and absent in production.)

### Three probes that were wrong before the code was

Kept because the ratio is the lesson (rule (x): in any pass, suspect the
instrument first):

1. `.wv-pip` and `#wv-fp-layer > *` both counted **0** marks — the footprint layer
   is opt-in and empty by default, and I had invented the pip class. The map was
   fine; my selector was fiction.
2. A symmetric check — "a mark present at 120 is gone by 126" — failed and looked
   like a real defect. Every mark unique to crossing 120 is `kind: predicated`
   **with no coordinates**: undrawable by construction. The probe asserted
   something impossible and would have failed forever while proving nothing.
3. A fixed `waitForTimeout(2500)` caught crossing 126 mid-render and reported
   **0 walkers** — indistinguishable from a broken frame. Replaced with a
   `waitForFunction` on the thing actually being waited for.

## 6b. Render weight and the O(viewport) constraint

Full observation with receipts is in **`RENDER-NOTES.md`** on this branch. The
short version, and where my surfaces stand against the constraint:

- The render is **already closer to O(viewport) than O(world)** in DOM terms:
  623 marks produce ~112 `[data-id]` elements and 1,710 SVG nodes total. The
  heaviest derived layer is **walkers — 321 nodes for 49 people** — which scales
  with residents, not marks.
- **Pan is a `viewBox` camera** (`viewer.mjs:3441`), measured: node count
  unchanged across a drag, only the camera moves. So every pan frame
  re-rasterizes the whole painting (81 `<svg>`, 90 `<image>`) with no tiling and
  no re-cull. That is the thing a tile pyramid fixes.
- **`JSON.parse` of the 666 KB fold is 1.9 ms** — parsing is not the cost.

**My data derivation is already separable**, per the constraint: the replay is
per-crossing (`index.json` for the scrubber, one ~10 KB frame per crossing) and
touches no world state; conversations are per-thread from the office.

**Where I am coupled to the full-world load, forced not chosen:** `/replay/`
mounts the existing viewer, so it inherits the whole-fold load — and pays it
*per crossing*, since each frame loads a different 666 KB fold pinned to that
crossing's sha, with a re-mount per step. A tiled renderer would need nothing
from my derivation; only the ~60-line lens in `town/pages/replay/index.astro`
would change, and it is already keyed on `frame.as_of_world`, which is the right
seam. The open question a tile pyramid raises for the replay is whether tiles get
cut **per settlement commit** or whether historical marks are drawn over today's
tiles with that stated. Flagged in `RENDER-NOTES.md` §8.

## 7. Left undone, on purpose

- **Time-lapse play** (stretch in the brief, not built). Each step re-mounts the
  viewer and refetches a fold, so autoplay wants a preload/diff pass first rather
  than a `setInterval` over the current design.
- **Camera position is not preserved across a step.** `mountViewer`'s returned
  handle exposes `rerender` and `stop` but not the camera, so a re-mount refits.
  Worth a small viewer-side addition if scrubbing becomes central.
- **A "load more" for the conversations page's ever-growing closed list** — see §4b.
- **Camera preservation across a replay step** — noted above; wants a viewer-side
  addition, not a site one.
