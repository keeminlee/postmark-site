# RESULT — Civic Quarter polish, site `train/2026-w37`

**Jetto (`meepo-prime`), 2026-08-31.** Brief: `G:/Starstory/docs/2026-08-31/jetto-brief-civic-quarter-polish.md`.
Worktree: `G:/Postmark/worktrees/civic-polish-w37` (`--no-track`, created off `release/2026-w36.1`; its own `npm ci`, no junction).

---

## Branch and remote tip

| | |
|---|---|
| Branch | `train/2026-w37` (new; base `release/2026-w36.1` = tag `c0e417e1` → commit `7d4c7e836`) |
| **Remote tip** | **`6c6adc083262f5b9319789fb07aa5460a27fc616`** |
| Receipt | `git ls-remote origin refs/heads/train/2026-w37` → `6c6adc083262f5b9319789fb07aa5460a27fc616` (LOCAL == REMOTE) |
| Commits | 4 — the five rulings · the holo-surfaces re-aim · the QA runner + shots · the dev QA + a correction |
| No release tag cut | correct per the brief |

Upstream check at creation: `git rev-parse --abbrev-ref @{u}` → *"no upstream configured"*. The lane
ref-trap was disarmed before any work; `push -u` later set it to its **own** remote branch.

## Dev deploy

| | |
|---|---|
| Run on tip `f8f950bb9` | **success** — https://github.com/keeminlee/postmark-site/actions/runs/33411222862 |
| Run on the final tip `6c6adc083` | **success** — https://github.com/keeminlee/postmark-site/actions/runs/33411748663 |
| Verified how | not by the run's word — by the **served** `/build.json` on dev. Final read: `code_sha` **`6c6adc083262f5b9319789fb07aa5460a27fc616`**, `code_ref` `train/2026-w37`, `channel` `snapshot` — dev is serving this branch's tip |
| Dev QA | **14/14 checks** against `https://dev.postmark.town/town/` (taken on `f8f950bb9`; the only change since is RESULT.md and shot PNGs, no page code) |

⚠ **A green run is not a receipt that dev is still serving you.** Dev is shared and reclaimed by
later pushes; every dev claim below is scoped to the sha in that stamp.

## Shots — before / after, read with my own eyes

Committed under `qa-shots/civic-polish/`. Runner: `qa-shots/civic-polish-shots.mjs`
(`SHOT_TAG=before|after`, same script both halves so the two sets cannot drift in what they measure).
**before 9/22 · after 21/22 · dev 14/14.**

| Item | Before | After |
|---|---|---|
| 1 · Quest Guild (drop plaque · pots under cards · standings last · holo moved) | `before/02-quest-guild.png` | `after/02-quest-guild.png`, `dev/02-dev-quest-guild.png` |
| 2 · Think Tank (law line · claim once · quay note) | `before/03-think-tank.png` | `after/03-think-tank.png`, `dev/03-dev-think-tank.png` |
| 2a · the card, against a world that HAS an idea | `before-settlement/03-think-tank.png` | `after-settlement/03-think-tank.png` |
| 3 · Bounty Board (weight paragraph removed) | `before/04-bounty-board.png` | `after/04-bounty-board.png` |
| 4 · Ballot House (one sentence + the button) | `before/05-ballot-house.png` | `after/05-ballot-house.png`, `dev/05-dev-ballot-house.png` |
| 5 · panels tinted like their buildings | `before/01-lanes-shut-tinted.png` | `after/01-lanes-shut-tinted.png`, `dev/01-dev-town-top.png` |
| whole page, 1440 and 420 | `before/06,07,08` | `after/06,07,08`, `dev/06-dev-town-full.png` |

---

## The cause of the stale quote (item 2c) — reproduced, not guessed

The page held a **hand copy**, and the pin was never behind.

- The page's literal: *"Asking a resident? Plant a bounty here. An idea for the town? **Open a
  blueprint in the chest — BLUEPRINTS/, your slug — and talk in its Discussions.**"*
- That is `the-town/how-ideas-enter` **exactly as it read at world commit `6b235216`** (2026-08-30
  13:55 EDT).
- It was superseded **the same day at 17:21** by `e383e992` ("the Think Tank stands"), which rewrote
  the body to route an idea to the tank.
- **The site's world pin `0b4616cc` is a descendant of `e383e992`** (`git merge-base --is-ancestor`
  → true) and carries the **current** body byte-for-byte. So does world `main` (`ea584802`) today.

So: not a stale snapshot, not a pin behind main, not a bad reader — **a transcription made four
hours before the record changed, with nothing on either side that could compare them.**

**The fix is not a better transcription** (which would rot identically). The note is now READ from
the mark the page already loads, via `HOW_IDEAS_ENTER_PLACE`, and a falsifier forbids the page
holding *any* copy of it. The same disease was in the law line (item 2b): `civic.mjs` gained
`laneLaw`, which prefers the live pen body over the constant, and the ideas lane carries
`lawFrom: "the-town/the-think-tank"`. **Named limit:** only lanes whose mark sits at
`<household>/<slug>` can do this — `loadPlaceMarks` walks two levels, and the bounty board's and
ballot house's marks are filed at `let-there-be-light/the-town-centre/…`, so their law lines stay
constants. That limit is written in the code, not left as a gap.

---

## Tests — by name, versus base, same worktree

| | tests | pass | fail | skipped |
|---|---|---|---|---|
| Base (`release/2026-w36.1`, six files flipped back) | 559 | 551 | 4 | 4 |
| Branch | 570 | 561 | 4 | 5 |
| Branch, with `dist-town` built | **570** | **566** | **4** | **0** |

**Zero new failures by name.** The four are identical in both runs and all live in
`test/extract-seam.test.mjs`, which reads a local town clone (`../postmark` /
`../../seam-overnight/town-main`) — the known stale-local-fixture class, red on any dev machine.

**+11 tests = exactly the new falsifiers** (5 reader/art, 5 hub content laws, 1 built-page);
the +1 skip at the un-built measurement is that built-page law, which stops skipping once a build
exists. Base measured by flipping the six files back **from a committed branch** — nothing
uncommitted was ever at risk, and the tree was proved clean after.

### Can-fail flips — 15 red, 1 apparatus fault caught

- **6 hub content laws** red against the base page (the five new + the re-aimed holo law).
- **9 per-law mutations** on the reader and the art, each verified applied to disk, tree proved
  byte-identical after: `9/9 red, 0 apparatus faults`
  (runner: scratchpad `civic-polish-w37-flips.mjs`).
- **1 built-page flip.** My first attempt came back **GREEN** — and it was **my mutation**, not the
  law: I injected the expansion with an HTML entity where the constant carries an em dash, so it
  matched nothing. Re-done with the verbatim constant → **RED**, green again on restore.

---

## What the brief got wrong

1. **`NODE_PATH=G:/postmark/site/node_modules` would have made every measurement in this lane
   false.** That clone is on `main`, whose lockfile pins the world at `0c1aa924`, and its *installed*
   tree is older still (`272ed4bb`) — three pins from this branch's `0b4616cc`, with **no
   `WORLD/marks/the-town/` directory at all**. Every civic-quarter reading (which buildings stand,
   the pen-vs-fold union, both mark bodies I now read) would have come back empty and looked like a
   defect in my work. I ran the worktree's own `npm ci` instead, and verified the installed world
   carries the pinned marks before trusting a single number.

2. **The site has no light theme.** Item 5 says the tint "must hold contrast in light AND dark
   theme; check both." There is no second theme to check: zero `prefers-color-scheme` and zero
   `data-theme` in `src/` or `town/`. I held contrast on the one theme that exists and measured it
   rather than eyeballing — the lane heading over its composited tint is **12.74:1 at worst** (AA
   needs 4.5:1), reported per lane in the shot runner's output.

3. **"`civic-art.mjs` already carries a per-lane palette from `src/styles/postmark.css`" is half
   true.** The shared INK table is from `postmark.css` (all four asserted hexes are in it), but the
   per-lane ACCENTS are **not**: only 3 of the 5 base accents appear there, and the lit/mid tones
   appear nowhere. They are invented in `civic-art.mjs`, which is fine — it is still *one* source,
   which is what the ruling needs — but "no new hex" means "no hex the art doesn't already use",
   not "no hex the CSS doesn't already use". The falsifier asserts the former, channel for channel.

4. **Item 1's "header sentence" is not a header.** The sentence he quoted is
   `the-town/the-quest-guild`'s **mark body**, rendered as `<p class="c-soon">` *below* the
   standings, near the bottom of the fold. There is exactly one instance of it on the page and I
   removed it; naming this because "drop the header sentence" would send the next reader to the
   lane's `<summary>`, which is a different thing and must stay.

5. **Item 1's holo move needs nothing added to `/stamps/`.** The brief says move it there as "its
   one home" — it is already there, in **three** fuller forms (the seam card, the minterest section,
   the glossary entry), all reading the same constants. The hub's paragraph was the fourth copy.
   Only the removal and a one-line pointer were needed.

---

## Things I found that are not mine

1. ⚠ **Item 2a cannot be seen on dev, and Keemin should be told before he walks it.** Every
   world-pin step in `deploy.yml` is gated on `channel == 'release'`. A train push takes the
   **snapshot** lane, which builds the world from the branch's own `package.json` pin — and
   `0b4616cc`'s fold carries **zero `class: idea` marks** (1023 marks, 0 ideas; so does site main's
   `0c1aa924`). **The Think Tank on dev reads "The Think Tank is up, and empty."** The claim-twice
   redundancy has no instance there. It appears when the release lane resolves `settlement/S51`,
   which does carry the town's first idea (`wright/a-newcomers-first-hour`, planted 03:36Z today).
   The before/after pair for that item was shot against S51's fold staged over the installed one —
   which is what prod will read — and the fold was restored and re-verified afterwards.

2. ⚠ **The vaulted dev recipe does not produce a signed-in lens on the site's own pages, and I
   could not get one.** `POSTMARK-DEV-ACCESS.md` says setting `localStorage.pm_key` "is enough for
   the signed-in lens" — that is the **world viewer's** shape. `PostmarkLayout.astro` (the top rail
   on every page) reads **`pm.oauth.token`**. Seeding a well-formed one from the static fleet key
   gets the handles cache to render `✦ jetto-of-starforge` and is then **undone**: the auth island
   **401s three times** against the office and hides the pill back to "Sign in". So **my dev QA is
   signed-OUT for the site chrome.** None of the five items is auth-gated — no changed text, order
   or tint depends on a session — so the verdict stands; what I did not verify is the signed-in
   chrome. The recipe wants a line about the site's token shape before the next lane trusts it.

3. **28px of horizontal overflow at 420px** with all five lanes force-opened — **identical at
   base**, so not mine. Not reachable by default (lanes ship shut but the board). Flagged, not
   patched.

4. **Removing the Bounty Board paragraph takes the hub's only door to "post an ask of your own."**
   That was his ruling and I applied it; noting the consequence. `/stamps/#staking` still carries
   "Posting a notice of your own" whole, and it is the better text — the struck paraphrase had
   silently dropped the weight rule's *other than the mark's own* exclusion.

5. **Four other lanes still hardcode their law lines** (`the-town/quest`, `the-town/bounty-lane`,
   the marketplace's, the ballot's) and can go stale exactly as the ideas lane did. Three of the
   four cannot be fixed the same way today, because their marks are filed deeper than
   `loadPlaceMarks` walks. Reported rather than widened into — that is a reader change, not polish.

---

## Two of my own instruments were wrong before the page ever was

Said plainly because both would have put a false finding in this report.

- **The QA twin sliced element text to 160 characters and then judged it.** The Think Tank's law
  line is 143 characters before its cite, so the window cut the cite off and "does the law name its
  mark" reported a page that names it perfectly well as one that had lost it. I nearly filed it.
  **An instrument that truncates the evidence and then rules on it invents findings** — the same
  disease as one that cannot fail, pointed the other way.
- **The dev probe read `stamp.sha`; the stamp's field is `code_sha`.** It reported a dev that was
  serving this exact tip as one that was not. A probe naming the wrong field returns a false
  negative just as silently.
- (And Astro's dev toolbar sat across the pot cards in the first Guild shot. A QA shot with a widget
  parked over the content can hide the thing it was taken to find; it is removed before anything is
  measured.)

---

## Not done, and why

- **No release tag** — the brief forbids it; prod waits for Keemin's walk.
- **No world/law text touched.** Both mark bodies I now render are read, never edited.
- **Nothing under `spectator/`, no `MAX_WINDOW`, no viewer/cockpit.**
