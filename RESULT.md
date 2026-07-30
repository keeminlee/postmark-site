# RESULT — world-page UI lift

Completed locally on 2026-07-29. Nothing was pushed, and `G:/postmark/office` was read-only throughout.

## Outcome

The world page now has one identity, one lens, and one marks filter row:

- Signed-in households get a sticky `Act As` resident picker in the viewer nav. The selection is browser UI memory only; every stake, unstake, and walk request still sends `handle` explicitly.
- The view starts with the single `True World ⟷ My World` lens. The only marks vocabulary is `everything · just mine · new`; anonymous viewers see `just mine` disabled rather than a second filter surface.
- Every rendered mark cell has an inline `✦ back this` flow: amount, exact sealed ledger-line preview, then confirm. A cell backed by the acting resident also offers `take back`.
- The walk desk accepts a published sited mark or raw point. It previews distance and ETA with `tools/walk.mjs` and names crossings with `tools/water.mjs`, then posts the confirmed departure to `/world/walks`.
- The acting resident's viewpoint follows the public walk-ledger derivation. A resident with no departure yet uses the office-derived home as the honest starting fallback.
- Signed features disappear when there is no `pm_key` or office response. The standalone spectator and ALPHA banner remain intact. Stand At and Move remain localhost/principal dev tools.

The simpler “Act As only inside dialogs” kill-condition was considered and not taken: stake cells, unstake cells, the walk desk, and the ledger-derived viewpoint all consume the same actor, so the first-class nav picker reads as one shared page identity rather than repeated dialog state.

## `postmark-world` worktree

Commit: `53225189063106cdc53c0d6ea6a7700059cb49a7` (`feat: unify resident actions in the world viewer`)

Implementation files:

- `spectator/viewer.mjs` — unified office-base helper, Act As, lens/filter row, inline stake/unstake, walk desk, ledger-derived position, and spectator-safe feature detection.
- `spectator/index.html` — shell description updated for credentialed office acts.
- `tools/viewer-axes.test.mjs` — lens/filter, office base, sealed line, and pure walk-preview coverage.
- `tools/settlement-sweep.mjs` — made the existing tar extraction gate Windows-safe by extracting from the temp directory, avoiding drive-letter-as-remote parsing.

## `postmark-site` worktree

Implementation commit: `38d2a427db7c8b667f832c31084ecc6d49a78744` (`feat: make world acts native to the viewer`)

Implementation files:

- `town/pages/world.astro` — remains the verbatim viewer passthrough with noindex, the `pm_key` bridge, and `<WorldSignIn />`; the duplicate island is gone.
- `src/components/MyWorldIslands.astro` — deleted.
- `src/lib/my-world.mjs` — deleted; all still-needed behavior moved to the viewer, so no dead exports remain.
- `test/my-world.test.mjs` — deleted with the retired surface.
- `astro.config.town.mjs` — dev-only `/api` proxy to `https://postmark.town/api`, with `changeOrigin` and prefix rewrite; build config has no proxy.
- `src/lib/auth.mjs`, `test/auth.test.mjs` — one same-origin office helper, `localStorage["pm.office.base"] || "/api"`, including OAuth endpoint getters and tests.
- `src/components/WorldSignIn.astro` — documentation aligned with the viewer-owned signed features.
- `town/scripts/world-engine-island.mjs`, `README.md` — source/staging map wording updated after the retirement.

This `RESULT.md` is committed separately as the local handoff record.

The pre-existing local `package.json`/`package-lock.json` file-link changes, `.omx/`, and supplied `BRIEF.md` were preserved but not included in the implementation commits. The current `node_modules/postmark-world` link is what makes the two local worktrees run together without an unpushable package pin.

## Validation

- World: `npm test` — 49/49 tests passed across the six configured test files, including `viewer-axes`.
- Site: `npm test` — 17/17 tests passed.
- Site: `npm run build` — 1,560 pages built; `/world/` emitted and the current viewer plus browser-safe engine tools staged under `/world-engine/`.
- Staging check: source and staged `spectator/viewer.mjs` SHA-256 hashes matched.
- Spectator smoke: `node spectator/server.mjs` booted on `http://localhost:4877/`; `/` returned HTTP 200.
- Anonymous headless-browser QA: viewer and ALPHA mounted, all three chips shared one row, `just mine` was disabled, signed walk controls stayed hidden, and no load error appeared.
- Mocked signed-in browser QA: two Act As residents rendered and persisted, exactly one lens and one filter row rendered, walk desk and mark backing controls appeared, the sealed stake line and pure walk preview rendered, actor switching worked, and there were no runtime exceptions.
- Astro dev smoke: `http://127.0.0.1:4327/world/` and `/world-engine/spectator/viewer.mjs` returned HTTP 200; `/api/ops/whoami` proxied successfully to the production office shape.
- `git diff --check` passed before both implementation commits.

No live stake or walk was submitted during automated QA: that would write a real ledger. The preview/confirm UI and exact request shapes were exercised with intercepted office responses; the recipe below is the intentional human confirmation path.

## Exact local signed-in test recipe

Use PowerShell in the existing worktrees.

1. Verify the local viewer link and start the town site:

   ```powershell
   Set-Location G:\postmark\worktrees\site-world-ui
   Get-Item node_modules\postmark-world | Format-List LinkType,Target
   npm run dev -- --host 127.0.0.1
   ```

2. Open `http://127.0.0.1:4321/world/`.

3. Click `Sign in with GitHub`. Complete the callback and return to `/world/`. Leave `pm.office.base` unset to exercise the dev proxy and same-origin `/api`; an intentional alternate door can be selected in DevTools with:

   ```js
   localStorage.setItem("pm.office.base", "https://your-office.example/api")
   location.reload()
   ```

4. Confirm the signed UI:

   - `Act As` lists every resident returned by `/api/ops/whoami`; switch residents, reload, and confirm the choice persists.
   - Toggle only `True World ⟷ My World`.
   - Use the single `everything · just mine · new` row; `just mine` is the complete My-marks surface.

5. Preview backing without committing until the receipt is correct:

   - On any mark cell, click `✦ back this`.
   - Enter a whole stamp amount.
   - Click `preview the sealed line`; verify resident, mark id, amount, and `sig: …`.
   - Click `confirm and send` only if a real ledger write is intended.
   - On a mark already backed by the acting resident, use `take back`, preview, then confirm.

6. Preview and optionally declare a walk:

   - Pick a mark in the Walk desk, switch to point coordinates, or click the painting to fill a point.
   - Click `preview the leg`; verify metres, ETA in crossings, and named water crossings.
   - Click `confirm departure` only if a real walk-ledger write is intended.
   - After the receipt, the viewpoint and map walker should reflect `/api/world/walkers`.

7. Check the tokenless spectator separately:

   ```powershell
   Set-Location G:\postmark\worktrees\world-ui-lift
   node spectator/server.mjs
   ```

   Open `http://localhost:4877/`. The ALPHA viewer should render, signed controls should be absent/disabled, and the local walk-ledger overlay should remain readable.

8. Re-run all gates:

   ```powershell
   Set-Location G:\postmark\worktrees\world-ui-lift
   npm test

   Set-Location G:\postmark\worktrees\site-world-ui
   npm test
   npm run build
   ```

## Improvement pass

Completed locally on 2026-07-29 from `BRIEF2.md`. Nothing was pushed, no live
stake or walk was submitted, and `G:/postmark/office` remained read-only.

### What changed

- Stamp-touching UI now carries the retired island's named violet family:
  `--stamp-violet`, `--stamp-violet-dark`, `--stamp-violet-heading`, and
  `--stamp-violet-subhead`. The `✦ back this` and take-back buttons, both act
  sheets, their headings and confirmations, actor balances, and every
  `.wv-chip.stamps` weight chip use those tokens. World/telling surfaces remain
  amber.
- A signed viewer reads the acting resident's liquid balance from the keyless
  `GET /stamps/{handle}` shape. The active Act As chip now reads like
  `wright · ✦ 199`, actor switching refreshes it, and the stake sheet names
  `you hold ✦ N`.
- Stake amounts have an HTML maximum and a pure balance clamp. An over-limit
  preview is not silently accepted: the field moves to the liquid balance, the
  refusal names the resident, requested amount, and available balance, and the
  reader must preview the balance-sized act again before confirmation.
- The viewer banner is now BETA. Its two sentences say that the record and acts
  are real while the viewer may still change shape without notice.
- The Walk desk has no destination/mark dropdowns and no coordinate form.
  Clicking the painting chooses a point; `walk here` on a mark cell chooses that
  cell's point; parcel cells now participate. The selected point is labeled with
  the smallest recorded extent containing it, excluding the world root, so open
  parcel ground reads `in wright/the-trueing-house-parcel`.
- Walk confirmation uses `{ x, y, handle }` for both painting and cell targets,
  making parcel targeting viewer-derived without an office or ledger change.
  The named-water-crossings line remains.
- `previewWalkLeg` still returns `etaCrossings`. Viewer prose converts that value
  with the named 12-hours-per-crossing rule, rounds to the nearest minute, and
  renders `≈ H h MM m` in the desk, receipt, and walker tooltip.

### Files and local commits

`postmark-world`:

- `spectator/viewer.mjs` — violet tokens, balance fetch/clamp, point-first walk
  desk, containment labels, parcel targets, and ETA formatting.
- `spectator/index.html` — BETA shell annotation.
- `tools/viewer-axes.test.mjs` — balance clamp, h/min formatter, and point
  containment coverage.
- `1a16a0c8e19bbfadb771a24eefc9a1cb46098645` —
  `feat: make stamp balance first-class in viewer`
- `21a264d7af3d2dbc7d5c3eaff42d7dc6c8fa1791` —
  `feat: make the walk desk point-first`
- `1cd82507c7896ff3e33a10bc2bcaf8b952c14afb` —
  `chore: mature the world viewer to beta`

`postmark-site`:

- `RESULT.md` — this appended improvement record. The site implementation stays
  the existing verbatim viewer passthrough; build staging consumed the linked
  world worktree without copying engine source into the tracked site tree.

The pre-existing local `package.json`/`package-lock.json` file-link changes,
`.omx/`, `BRIEF.md`, and `BRIEF2.md` remain uncommitted and were not folded into
the improvement commits.

### Validation

- World `npm test`: 51/51 passed across the six configured test files.
- Site `npm test`: 17/17 passed.
- Site `npm run build`: 1,560 pages built; `/world/` and
  `/world-engine/spectator/viewer.mjs` were emitted.
- Source/staged `spectator/viewer.mjs` SHA-256:
  `0F8E9240F1301DC88D415BC087DF8442152D205CF077E91CC5DFB58B8A51FC1`
  on both sides.
- Standalone `node spectator/server.mjs`: booted read-only on
  `http://localhost:4877/`; `/` and the viewer module both returned HTTP 200.
- Anonymous headless browser: BETA mounted, the identity block stayed empty,
  the walk desk stayed hidden, and no stake affordance rendered.
- Mocked signed browser, with no write endpoint invoked: `wright · ✦ 199`
  rendered; switching actor refreshed to `rei · ✦ 17`; stamp controls resolved
  to the named violet colors; a `200` request clamped to `199` with an honest
  refusal; the parcel cell selected
  `in wright/the-trueing-house-parcel`; the desk had no select/input fallback;
  and its preview rendered an h/min ETA.
- `git diff --check` passed for the full world improvement range and the site
  handoff change.

### Judgment calls and updated check

- “Balance” means the API's liquid `stamps`/`liquid` value, not `assets`,
  because only liquid stamps can be newly backed.
- Over-limit input clamps visibly but does not auto-preview the changed amount.
  Requiring a second preview keeps the exact sealed line deliberate.
- Painting clicks choose the smallest containing extent. A cell button keeps
  the chosen cell's id in the label even when its center also lies inside a
  smaller child; this makes `walk here` name the thing the reader chose.
- Raw coordinate inputs were dropped rather than dev-gated because painting
  clicks provide the same point path without making coordinates the desk's
  primary vocabulary.
- Minute conversion rounds, rather than floors, because the UI marks ETA as
  approximate; engine and office crossing values remain untouched.

For the signed improvement check, follow the existing local recipe above but
replace its old Walk step with: click anywhere on the painting and verify the
desk names the point and its containing extent, or press `walk here` on a sited
or parcel cell; preview and verify `ETA ≈ H h MM m` plus the unchanged named
water crossings line. Before backing, verify the Act As balance and `you hold`
line agree; enter one more than the balance and confirm the UI names and clamps
the excess without enabling confirmation until the corrected act is previewed.

## Interaction pass

Completed locally on 2026-07-29 from `BRIEF3.md`. Nothing was pushed, no live
stake or walk was submitted, and `G:/postmark/office` remained read-only.

### What changed

- The Act As block now consists only of its resident buttons and the acting
  resident's stamp balance. The remembered-choice caption is gone.
- The Walk desk no longer has a `preview the leg` button. Choosing a painting
  point, pressing `walk here`, selecting a walkable mark, or switching actors
  with a destination already set immediately recomputes the pure client-side
  leg. A valid preview shows metres, h/min ETA, and named water crossings and
  arms `confirm departure`; an invalid origin or destination leaves it
  disabled with an honest refusal.
- One `createMarkInteractionStore` owns `selectedId` and `hoveredId` for both
  the telling and the painting. Cells and glyphs no longer maintain parallel
  highlight state.
- Painting glyph hit-testing is screen-space and buffered. The nearest glyph
  within 18 px wins before point containment is considered; only genuinely
  open ground follows the BRIEF2 raw-point path.
- Clicking a mark on either surface selects the same state. Matching cells and
  glyphs remain highlighted, a painting click scrolls the selected cell into
  view, and a signed walkable mark becomes the destination and previews at
  once. Selection remains available to spectators, while destination arming
  remains signed-only. Marks without geometry remain cell-only selections.
- Hover works in both directions without scrolling. A hovered cell lights the
  mark's authored shape and glyph on the painting; a hovered painting glyph
  lights its matching cell and gets an in-map id/title label. Leaving restores
  the persistent selected highlight.

### Files and local commit

`postmark-world`:

- `spectator/viewer.mjs` — shared interaction store, buffered glyph hit test,
  bidirectional hover/selection rendering, in-map identity label, click-scroll,
  and automatic walk previews.
- `tools/viewer-axes.test.mjs` — 18 px nearest-hit behavior and shared-store
  state/notification coverage.
- `42e1675aa86ef58c90ef68cda0d52eb433de40a5` —
  `feat: unify mark interactions and walk previews`

`postmark-site`:

- `RESULT.md` — this interaction-pass handoff. The site remains a verbatim
  passthrough and staged the linked world viewer without copied source changes.

The pre-existing local `package.json`/`package-lock.json` file-link changes,
`.omx/`, and supplied `BRIEF.md`, `BRIEF2.md`, and `BRIEF3.md` remain outside
the implementation commits.

### Validation

- World `npm test`: 53/53 passed across all six configured test files.
- Site `npm test`: 17/17 passed.
- Site `npm run build`: 1,560 pages built; `/world/` and the linked viewer were
  emitted under `dist-town/world-engine/`.
- Source and staged `spectator/viewer.mjs` SHA-256 matched:
  `EBD235C46CBDC42850BFB58CFBDADE16F6F50F16CA9FCBB54664C008D5CFFF96`.
- Standalone `node spectator/server.mjs`: `/` and
  `/world-engine/spectator/viewer.mjs` both returned HTTP 200.
- Anonymous headless-browser QA: hovering a painting glyph highlighted the
  same-id cell and displayed the identity label; clicking selected that cell,
  set `aria-selected`, and brought it into the viewport. The walk desk stayed
  hidden.
- Mocked signed-browser QA, with no write endpoint invoked: `walk here`
  selected `wright/the-crossing-bench`, immediately rendered distance, h/min
  ETA, and named water crossings, and armed confirmation. Switching from
  `wright` to `rei` recomputed the preview and re-armed confirmation; the
  manual-preview button count was zero.
- `node --check spectator/viewer.mjs` and `git diff --check` passed.

### Judgment calls

- The snap radius is 18 CSS pixels at every zoom. This is slightly larger than
  the normal glyph, giving a forgiving buffer without converting nearby open
  ground into a mark click. Nearest distance wins, with id order only as a
  deterministic tie-break.
- Hover uses the mark's existing tier accent (amber market, green home, blue
  constitution) on both surfaces. Selection adds a persistent tier-colored
  outline; while another mark is hovered, the map temporarily shows that hover
  and returns to the selected glyph on leave.
- The map identity label uses the mark id plus its short title/body lead,
  remains screen-readable while zooming, and clamps to the visible viewBox.
- Only painting clicks scroll the list. Hover never calls `scrollIntoView`, and
  cell clicks stay where the reader already is.

## Performance pass

Completed locally on 2026-07-29 from the PULSE gold plan. Nothing was pushed,
`G:/postmark/office` stayed read-only, and no synced
`public/atelier/postmark/**` artifact was edited.

### Outcome

- The island integration stages `WORLD/world-state.json`,
  `WORLD/skeleton.json`, and `seeding/manifest.json` beside the viewer in both
  dev and build output. The raw GitHub sources remain the viewer's resilience
  fallback.
- The built `/world` head derives 22 modulepreloads from the same staging walk
  and adds four fetch preloads for the three records plus `/atlas/town.html`.
- The viewer adds `loading="lazy"` and `decoding="async"` to detached atlas
  `<img>` and SVG `<image>` nodes before mounting them.
- Signed hydration starts composed world, home, and balance reads together
  after `whoami`.
- The front-page mintbar renders the build-time public stamp count immediately,
  falls back safely when that snapshot is unavailable, and still hydrates live.
- Astro prefetches internal navigation on hover. Windows-only Astro preview
  preserves the public uppercase `/WORLD/**` URLs despite the case-insensitive
  collision with the `/world/` page directory.

### Local commits

`postmark-site`:

- `c0622a12d314b9d8f80f26d9beef0567689dfe99` — S1 record staging.
- `ff59754ab10002076ddb090e1867a113253b9ad1` — S2 preload chain.
- `612612a5b33629c129b8c5f3104ade0155cb4fe8` — S5 mint snapshot.
- `20ace236666d68d8276872cacc9ed665e8e7b1e3` — S6 nav prefetch.
- `657643bc50e84455af41a350bfa5f99fbe50eb51` — S7 Playwright
  proof and preview compatibility.

`postmark-world`:

- `c96eb2c67ef9237d17cacf2ec742433b842fce76` — S3 atlas image
  discipline.
- `c323957eca921af84af2f669025071d4c1e419eb` — S4 signed-lane
  parallelization.

### Validation

- Playwright fixture, exact baselines site `2d153f0` and world `42e1675`, with
  identical 35 ms critical-resource latency: overlap-wave depth fell from
  5 to 2. Critical resource entries changed from 12 to 27 because the browser
  now discovers the full preload set in the first wave.
- The same proof changed `/WORLD/world-state.json` from 404 to 200 and changed
  atlas lazy/async coverage from 0/34 to 34/34, with no page exceptions.
- Real Astro dev and real `astro preview` both served the 170,707-byte
  `/WORLD/world-state.json` at HTTP 200. Preview served 22 modulepreloads and
  four fetch preloads.
- World `npm test`: 54/54 passed. Site `npm test`: 18/18 passed.
- Site `npm run build`: 1,560 pages; 25 viewer/engine/record files staged and
  26 preload hints emitted.
- Read-only spectator smoke: `/` and `/WORLD/world-state.json` both returned
  HTTP 200.
- The built mintbar snapshot was `2,878` stamps with a `100.0%` immediate fill;
  the live `/api/stamps` hydration remained present.

## Legibility pass

Executed locally on 2026-07-29 from the PULSE silver
`silver-2026-07-29_postmark-world-viewer-legibility-batch`. Nothing was pushed,
and `G:/postmark/office` was used only to confirm the public
`GET /world/stake?mark=…` read contract.

### Outcome

- Ambient ancestry now keeps the world root and fog-like conditions out of every
  extent, direction, hit target, and off-screen-location path.
- Mark cells lead with resolved Names, show fold-determined names in gold, keep a
  larger meaningful-direction arrow beside the Name, and reveal id/author/date,
  honest extent, cardinal position, distance, and direction on hover or
  selection.
- Polygon claims carry polygon glyphs. Painting hits resolve by 18 px pip snap,
  then smallest containing non-ambient true extent, then open ground.
- Every cell shows current backing passively. The unchanged violet `back` sheet
  reads the public holder rows and shows the top five plus the remaining count.
- The walk desk has no `walk here` chip. Cell selection arms a named destination;
  open ground uses a dot plus cardinal position; repeat-click or Esc clears both
  selection and destination; previews contain only distance, h/min ETA, and
  destination.
- All viewer positions use the shared cardinal Town Centre formatter. Selected
  and hovered off-screen marks retain tier-colored edge locators; non-ambient
  predicates resolve through their nearest embodied ancestor.
- “Where you stand” is exact, the redundant “What tells from here” heading is
  gone, and each distance band derives its approximate range from the live LOD
  band dials.

### Local `postmark-world` commits

- `82c1068` — ambient classifier.
- `27138b4` — resolved Name-first cells and hover/selection details.
- `bbebc34` — honest rectangle/polygon extent glyphs.
- `229e0b9` — passive backing and top-five backers.
- `b9604f4` — shared cardinal position display.
- `dbbc23d` — walk-desk declutter and deselection.
- `62bfca2` — off-screen edge locators.
- `1887da0` — painting extent hit order.
- `f5d66b0` — section and distance-band hierarchy.
- `54d0871` — selected-locator persistence while another mark is hovered.

### Validation

- World `npm test`: 62/62 passed across all six configured test files, including
  the required ambient, name, cardinal, containment-order, and backer-summary
  pure coverage.
- Site `npm test`: 18/18 passed.
- Site `npm run build`: 1,560 pages built; 25 viewer/engine/record files staged
  and 26 preload hints emitted.
- Linked source and built `spectator/viewer.mjs` SHA-256 matched:
  `253ED6609B70113FE12AB538BF0F6EB81343201382EEA13956255B1CB1CDD5CB`.
- Anonymous Chrome spectator smoke: 16/16 checks passed with zero runtime
  exceptions. Signed controls feature-detected off; passive backing, hover,
  selection/detail reveal, repeat-click/Esc deselection, and the persistent
  off-screen locator all worked.

## Containment + nits pass

Executed locally on 2026-07-29 from the bronze dispatch
`wright-2026-07-29-sea-false-containment-in-where-you-stand`. Nothing was
pushed.

### Outcome

- The hypothesized mechanism was confirmed against the live Sea mark. At
  `(4000, 4000)`, the Sea's `at/extent` bounding rectangle returned true while
  its authored coast polygon returned false; the rectangle-only runtime
  `containmentChain()` therefore put `the-town/the-sea` in `within` on dry
  land.
- Runtime standpoint containment, investigation ancestry, walk point labels,
  and the viewer's legacy home-set fallback now use the existing true-shape
  geometry path. A wet control remains inside the Sea.
- Extent hover/selection was already polygon-aware and its existing regression
  remained green. The held-back painting hit-test structure was not changed.
- Fog mechanic cells no longer show a crossing number, hover/selection details
  no longer repeat the `{author}/{slug}` mark id, and cell Names are bold.

### Local `postmark-world` commit

- `b701200ccdf302fcec125cf69ffce67629f9a5cc` — true-shape containment plus
  the three viewer riders.

### Validation

- Red control: the new real-Sea engine assertion and polygon walk-label
  assertion both failed before the fix; the targeted engine/viewer run then
  passed 36/36.
- World `npm test`: 64/64 passed across all six configured test files.
- Site `npm test`: 18/18 passed.
- Site `npm run build`: 1,560 pages built; 25 viewer/engine/record files staged
  and 26 preload hints emitted.
- Read-only spectator smoke: `/`,
  `/world-engine/spectator/viewer.mjs`, and `/WORLD/world-state.json` all
  returned HTTP 200; the state carried 288 marks.

## Telling-filter pass

Executed locally on 2026-07-29 from the bronze dispatch
`wright-2026-07-29-viewer-telling-filter-you-color-coordinate-quiet`. Nothing
was pushed.

### Outcome

- Painting extent-hover now draws candidates only from the current radial
  telling plus its containment ladder. Pip snap keeps its existing telling-only
  order, a within-chain parcel remains hoverable without a pip, and untold
  foggy/occluded extents are inert.
- The existing click/select/investigate structure is unchanged. A miss still
  follows the existing open-ground walk/camera path, whose containment labeler
  deliberately continues to read the full record.
- Viewer-facing absolute Town Centre readouts are gone. Standing locations use
  the smallest containing mark's Name or `on open ground`; open-ground
  destinations use distance and direction from the walker while retaining an
  `in <Name>` containment suffix; hover details keep only relative
  distance/direction. The pure cardinal formatter remains exported and tested,
  and the dev-only Move pad keeps raw coordinates.
- One `--you` red-orange token now colors the painting's actor dot/halo, the
  selected Act As chip, and both standing-location accents.

### Local `postmark-world` commit

- `21ef432c44c3aee031801d079f33310a9f1b0f2d` —
  `fix: make viewer perception obey the telling`

### Validation

- Targeted viewer axes: 18/18 passed, including told-plus-within candidate
  order, a no-pip containment extent, an inert untold extent, named standing
  containment, and relative open-ground labels.
- World `npm test`: 65/65 passed across all six configured test files.
- Site `npm test`: 18/18 passed.
- Site `npm run build`: 1,560 pages built; 25 viewer/engine/record files staged
  and 26 preload hints emitted.
- Source and staged `spectator/viewer.mjs` SHA-256 matched:
  `FC8EDD0E1D156B2B53896A1349F0E3E24D686C3DF0ECB9B4BA4A07A9ADD5A908`.
- Read-only spectator smoke: 3/3 HTTP checks and 8/8 rendered-Chrome checks
  passed. The state carried 288 marks; telling cards and named standing
  containment rendered; the shared `--you` token was present; absolute Town
  Centre/detail-position readouts and telling errors were absent.

## Cells v1.5 pass

Executed locally on 2026-07-29 from the bronze dispatch
`wright-2026-07-29-viewer-cells-v1-5-dedup-and-select-then-act`. Nothing was
pushed, and the nested cells-v2 tree was not attempted.

### Outcome

- Investigate `sits inside`, `within it`, and `alongside` entries are compact,
  tier-accented bold Name lines. They remain select-and-drill targets and never
  quote the relative's body.
- Predicated and naming marks fold into a flat `slot: value · ✦weight` attribute
  on a rendered non-predicate subject cell. The attribute keeps its own mark id
  and backing/take-back affordance. If the subject is absent, the predicate's
  standalone card remains unchanged; predicate-on-predicate chains remain
  standalone for the later nested-tree design.
- Cell clicks now select and investigate only. A selected walkable cell reveals
  `walk here`; only that action arms the walk desk. Painting open-ground walking,
  re-click deselection, and Esc clearing remain intact.
- Ambient elevation and fog mechanic readings survive on their folded attribute
  lines.

### Local commits

- `postmark-world`:
  `cf8d7dfd915c9f554aa5c2caf4ef227fb10ce82d` —
  `feat: add cells v1.5 select-then-act` (2 files, +188/-45).

### Validation

- Targeted viewer axes: 20/20 passed, including the required predicate-fold
  decision and body-free name-line renderer coverage.
- World `npm test`: 67/67 passed across all six configured test files.
- Site `npm test`: 18/18 passed.
- Site `npm run build`: 1,560 pages built; 25 viewer/engine/record files staged
  and 26 preload hints emitted.
- Source and staged `spectator/viewer.mjs` SHA-256 matched:
  `BC06183331285D024842E256513002247ECA2EC035C1AEEABD0C84F0BC95A68B`.
- Read-only spectator smoke: 2/2 HTTP checks passed; anonymous Chrome rendered
  14 cells, 2 initially folded ambient attributes, and 16 body-free relative
  name-lines with zero viewer/runtime errors. The New view kept 5 predicates
  standalone because their parents were absent and folded 7 whose parents were
  present.
- Read-only signed-lane browser mock: 7 walkable cells exposed a selected-only
  action. Selection left the destination unset; `walk here` armed the preview;
  re-click and Esc each cleared selection and destination.
