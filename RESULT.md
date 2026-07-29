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
