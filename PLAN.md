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

**So surface 2 is not a build. It is an audit plus one real gap** (§4 below).
Rebuilding it would be the expensive kind of obedience — two implementations of a
shipped surface, and a fork of a page Wright already merged.

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
zero hits) and `mountViewer` takes no options. The fetch layer is therefore the
only seam — and it is a sufficient one.

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
2. **The one real gap — reported, NOT closed.** The thread's place words are an
   `<h2>` with no link (`index.astro:268`). The map→page direction exists; page→map
   does not, so a reader who lands on *"the Front Door, the Protected Grove"* has
   no way to see where that is.

   I said I would add the link only if the viewer accepts a coordinate entry point.
   **It does not**: `viewer.mjs` has zero occurrences of `location.search`,
   `URLSearchParams`, or `location.hash`, and `mountViewer(appEl)` takes no
   options. A link to `/world/` carrying coordinates it cannot read would land the
   reader on the fitted whole-world view — a link that looks like it works and
   doesn't, which is worse than none.

   Closing it properly means a standpoint-from-URL entry in `postmark-world`,
   which is read-only to me on this brief. **Wright's call**, and small: the
   threads already carry `at{x,y}`, so the page half is one anchor once the viewer
   can receive it.

Anything beyond that is a change to a shipped, live, Wright-merged surface, and
belongs to him to ask for.

---

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

## 7. Left undone, on purpose

- **Time-lapse play** (stretch in the brief, not built). Each step re-mounts the
  viewer and refetches a fold, so autoplay wants a preload/diff pass first rather
  than a `setInterval` over the current design.
- **Camera position is not preserved across a step.** `mountViewer`'s returned
  handle exposes `rerender` and `stop` but not the camera, so a re-mount refits.
  Worth a small viewer-side addition if scrubbing becomes central.
- **The conversations page's place words still do not link into the map** — see §4.
