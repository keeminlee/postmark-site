# The world pin follows the blessing — deploy note (POS-55)

**Branch:** `wright/pos-55-pin-follows-blessing`
**Written:** 2026-08-25, before merge, by Jetto (`meepo-prime`) on Wright's tasking.
**Ships via:** the site train + the founder's Approve. Nothing here is performed
on the box, and nothing here needs to be.

---

## Box-side install steps required: NONE

This is the first thing to know, and it is a finding rather than an assumption.

The scheduled rebuild lane is **GitHub Actions**, not a systemd timer on the
box: `.github/workflows/deploy.yml` carries `schedule: cron "*/30 * * * *"`, and
the box's only part in the lane is receiving the `rsync` at the end of the job.
Read live on `meepo-ec2` (2026-08-25 14:02 UTC, read-only), the twenty-five
timers installed there contain no site-rebuild unit. The one whose name invites
the mistake — `postmark-dev-freshen.timer`, every ten minutes — runs
`/srv/postmark-office-dev/postmark-dev-freshen.sh`, which re-mirrors the **office
dev clone**; its own unit description says so ("dev clones re-mirror the record;
local rehearsal acts are wiped"). It never builds the site.

So: merge the branch, let the train cut a release tag, and the mechanism is
installed. There is no `systemctl daemon-reload`, no unit to copy into
`G:/postmark/office/deploy/`, and no box file to edit.

## What the gap was worth, measured 2026-08-25

Not an abstraction. Between the frozen floor `272ed4bb` and `settlement/S45`
(`016813ad`) the world repo moved **64 commits, 13,387 insertions across 101
files** — and the site stages a specific subset of those from the pin, so the
subset is what prod was missing:

- `WORLD/world-state.json`, staged verbatim to `/WORLD/world-state.json`:
  **7,859 lines changed.** This is the world the browser reads.
- `WORLD/settlement-publications.json` (+40) — which marks the keeper has
  blessed. Prod was serving an older answer to "what is published".
- every non-test `tools/*.mjs`, staged to `/world-engine/tools/`: `geometry.mjs`
  (+99), `settlement-sweep.mjs` (+417), and two new modules the engine did not
  have at the floor, `region-outsiders.mjs` and `region-rings-gen.mjs`.

Precisely: `spectator/viewer.mjs` itself is **unchanged** across that range. The
viewer was not stale; the world it drew and the engine modules it imported were.

## What changed

| File | What it is |
|---|---|
| `tools/lib/world-pin.mjs` | the decision law — pure, no I/O, both world-touching seams injected |
| `tools/resolve-world-pin.mjs` | the CLI — supplies `git ls-remote` and the ancestry walk, writes `$GITHUB_OUTPUT` |
| `test/world-pin.test.mjs` | fifteen falsifiers, each named for the guardrail it asserts |
| `.github/workflows/deploy.yml` | three steps in the release lane |

The world pin **file** — `package.json` → `postmark-world` — is not touched by
any of this. It is read, never written. The keeper's ceremony (bump it on site
main at each blessing) continues exactly as it did, and it is what keeps the
fallback floor fresh.

## The three tenses, named

The release lane now assembles a build from three sources moving at three
speeds. They were always three; two of them were unlabelled.

1. **Code, at release pace.** `git checkout "$TAG"` — the founder-approved
   `release/*` tag. Unchanged.
2. **Town data, at crossing pace.** `git checkout origin/main -- public/atelier/postmark src/data/postmark`.
   Shipped 2026-08-24 as commit `9133da117`; this note's mechanism is its
   sibling, deliberately.
3. **The world, at blessing pace.** Resolved from the world repo's newest
   `settlement/S<n>` tag at rebuild time. New.

There is a fourth, and it is worth saying out loud because it looks like a
violation of the first: **the deploy machinery itself travels with the lane, not
with the release.** On a `schedule` trigger, Actions reads `deploy.yml` from the
default branch — but the job then checks out the release tag, so the workflow
from main is calling scripts from the tag. A step
(`Take the world-pin resolver from main`) restores `tools/resolve-world-pin.mjs`
and `tools/lib/world-pin.mjs` from `origin/main` for exactly this reason. Without
it, main's workflow would invoke a file the standing tag has never heard of.

## The three guardrails, and where each one lives

Quoted as the POS-55 brief states them (founder-ruled 2026-08-25); the wording
below is the brief's, not a paraphrase of it. Each is falsified in both
directions in `test/world-pin.test.mjs`.

**"tags only, never main tip."** The candidate set is exactly
`refs/tags/settlement/S<n>`. `git ls-remote` is deliberately called **without**
`--tags`, so the listing genuinely contains `refs/heads/main` and the filter that
throws it away is code we can test rather than a flag someone could quietly drop.
Annotated tags advertise twice — the tag object and the peeled `^{}` commit — and
the peeled commit is what a pin means, so it always wins.

**"monotonic by settlement number — the pin never rolls backwards."** The
settlement number is parsed as an integer and compared numerically. The bronze
class here is *"release tags can roll the world pin backwards"*; a lexical sort is
the same bug in a different coat, answering `S9` over `S45`. The resolved
settlement must be **strictly** newer than the floor's — equal is a hold, because
the floor is usually a commit *downstream* of its own tag (the live one,
`272ed4bb`, sits after `settlement/S44`), and replacing it with the tag itself
would be a rollback wearing an equals sign.

**"on any tag-resolution failure, fall back to the release's frozen pin file."**
Ordering carries this one rather than a code path: `npm ci` installs the floor
**first**, and the advance is an overlay on top of it. The resolver exits 0 on
every failure. A rebuild that cannot resolve a settlement is not a broken
rebuild — it is a rebuild that ships exactly what every release before this one
shipped.

## Where the floor's settlement number comes from

The floor pin is usually **not** a settlement tag, so it cannot be looked up by
sha. `floorSettlementOf` clones the world repo `--filter=blob:none --no-checkout`
and walks settlement tags downward until one is an ancestor of the floor. Measured
end to end on 2026-08-25: **2.6 seconds**, against a repo that is 11 MiB packed
with 1036 commits. Forty-eight runs a day, so call it two minutes of runner time
and half a gigabyte of GitHub-to-GitHub transfer per day — inside the noise of a
thirty-minute cron, and worth re-measuring if the world repo ever gets large. If
the server refuses a partial clone the resolver retries without the filter: the
slow road, not a closed one.

`postmark-world` is public, so this is an anonymous clone needing no secret.

## Bootstrap: the mechanism is dormant until a tag carries it

The resolver step is guarded by `[ -f tools/resolve-world-pin.mjs ]` and the
restore step by `||`. Until this branch merges and a release tag exists that
contains it, both no-op and the pin holds at the floor. That is the correct
degraded state and it is the one prod is in right now.

## Named risks, accepted in place

- **A tag-era template against a blessing-era world.** The same shape as the
  town-data overlay's accepted risk, one layer out: site code frozen at the
  release tag renders a world resolved after it. World shape changes rarely and
  deliberately, and the viewer already degrades rather than throws on a
  pre-bump package (`town/scripts/world-engine-island.mjs:93`). If this ever
  bites, the answer is the same two-tense site the overlay note points at.
- **The verify is a hard fail.** If `npm install` claims success and the lock
  resolves a different sha, the job exits non-zero and **nothing is rsynced** —
  prod keeps serving the previous build and the next half-hour retries. A build
  that silently ships the wrong world is worse than a build that does not ship.
- **Monotonic by NUMBER, not by ancestry — a fourth guardrail deliberately not
  written.** The ruling named three, and this implements three. But there is a
  case the settlement number alone does not cover: if the keeper ever pins the
  floor to a world commit that is **not an ancestor of the next settlement tag**
  — a hotfix off main, say — then advancing to S<n+1> silently drops it. The
  clone that computes the floor's settlement number could answer this in the
  same walk (`merge-base --is-ancestor floor chosen`), so it is cheap to add.
  It is not added because the cure has its own disease: a floor that is
  permanently off-main would make the mechanism permanently inert, and inert
  looks exactly like working. Flagging, not deciding — this is the founder's
  call, and it only becomes live the first time a world hotfix does not go
  through main.

- **Release-lane only.** Dev (`train/**` → snapshot) still builds the pin the
  branch carries, which is what makes dev the preview of the *next* blessing's
  code. Whether dev should also follow the blessing is a real question and is
  left open on purpose, not decided by omission.

## ⚑ Nothing runs these tests but a person

Worth knowing before trusting the fifteen falsifiers: **this repo has no test
CI.** `.github/workflows/` holds exactly two files, `deploy.yml` and
`sync-atlas.yml`, and neither runs `npm test` — deploy goes straight from
`npm ci` to `npm run build`. There is no `pull_request` trigger anywhere in the
repo, so a PR that breaks `test/world-pin.test.mjs` goes red nowhere.

That is a gap in the repo, not in this change, and it is left alone on purpose:
adding a test gate touches every branch in flight and is a decision above a
lane's pay grade. But it means the guardrails above are only as live as the last
person who typed `npm test`, and a falsifier nobody runs cannot fail. Flagging
it where the next reader of this mechanism will see it.

## How to check it worked, on a live run

The job summary carries one line per run:

> world pin: **advance** to settlement **S45** (016813ad), from floor S44 (272ed4bb)

and the `Install the blessed world` step logs `world pinned at <sha>` only after
reading the sha back out of `package-lock.json`. A hold prints the reason it
held. Silence from both means the step did not run — check the lane condition,
not the resolver.
