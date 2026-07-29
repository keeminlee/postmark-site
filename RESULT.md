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
