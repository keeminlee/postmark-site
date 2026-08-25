// build-stamp — the deployed site says, out loud, what it was built from.
//
// Written 2026-08-25 for the office's site-sentinel, which cannot answer "is the
// site fresh?" without something on the live site to compare against. Before
// this file the answer was unreachable: PUBLIC_BUILD_SHA existed but rendered
// only inside the SNAPSHOT badge in PostmarkLayout.astro, which is gated on
// `PUBLIC_CHANNEL === "snapshot"`, so PROD carried no stamp at all. Verified
// against the live site the same day: /build.json was 404 and no build metadata
// appeared anywhere in the served HTML.
//
// ── WHY THE STAMP CARRIES TWO SHAS AND NOT ONE ──────────────────────────────
//
// Because the site has two tenses, and one number cannot hold both.
//
// deploy.yml's release lane does NOT build prod from main. It checks out the
// newest `release/*` tag and builds the CODE from there, then copies the town
// DATA back in from main:
//
//     git checkout origin/main -- public/atelier/postmark src/data/postmark
//
// So prod's code lagging main is the DESIGN, and a one-sha stamp compared
// against main would report a permanent, meaningless staleness — the kind of
// alarm a reader learns to ignore, which is worse than no alarm.
//
// And the split is not theoretical. That overlay step exists because of a real
// freeze, recorded in deploy.yml's own comment: "prod served Crossing 144 while
// main carried 146" — the code correctly pinned, the content silently frozen
// behind it, for a day. A single sha cannot even express that failure. Two shas
// make it the first thing a reader sees.
//
// ── WHY `git rev-parse HEAD` AND NOT `github.sha` ───────────────────────────
//
// `github.sha` names the commit that TRIGGERED the workflow. On the release
// lane the job then does `git checkout "$TAG"`, and github.sha does not follow
// it — so the built code is the tag's while github.sha still says main's. A
// stamp built from github.sha would be confidently wrong on exactly the lane
// where being right matters. HEAD is read after every checkout has happened, so
// it is the sha that was actually compiled.
//
// ── WHAT IT DOES WHEN IT CANNOT TELL ────────────────────────────────────────
//
// It emits the stamp with the unknown field `null` and says why in `notes`. It
// does NOT guess, and it does NOT fail the deploy: a site that ships is worth
// more than a stamp, and the sentinel treats a null half as UNKNOWN — never as
// green — so an honest gap costs visibility and never buys a false all-clear.
//
// Usage: node tools/build-stamp.mjs --out dist-town/build.json
//   env: PUBLIC_CHANNEL         release | snapshot   (deploy.yml sets it)
//        BUILD_CODE_REF         the tag or branch the code came from
//        BUILD_TOWN_DATA_SHA    the origin/main sha the town-data overlay used
//                               (release lane only; on snapshot the data rode
//                               the checkout, so the code sha IS the data sha)

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const SCHEMA = 1;

/**
 * The stamp, as a pure function of what the build knows about itself.
 *
 * Every unknown becomes an explicit null plus a note. The one thing this must
 * never do is fill a gap with a plausible value — a stamp that is confidently
 * wrong is worse than one that admits it cannot say, because the watcher
 * downstream believes it.
 */
export function composeStamp({ channel, codeSha, codeRef, townDataSha, builtAt }) {
  const notes = [];
  const lane = channel === "release" || channel === "snapshot" ? channel : null;
  if (!lane) notes.push("PUBLIC_CHANNEL was not release or snapshot, so the lane is unknown");
  if (!codeSha) notes.push("could not read the built commit (git rev-parse HEAD) — code freshness is unreadable for this build");

  // On the snapshot lane there is no tag pin and no overlay: the town data rode
  // the same checkout as the code, so the code sha IS the data sha. Saying that
  // explicitly is not padding — a reader who sees the two fields equal needs to
  // know whether that means "in sync" or "same source", and only the lane knows.
  let dataSha = townDataSha || null;
  let dataFrom;
  if (lane === "release") {
    dataFrom = "overlaid from site main (deploy.yml: git checkout origin/main -- public/atelier/postmark src/data/postmark)";
    if (!dataSha) notes.push("the release lane did not report the overlay's origin/main sha — town-data freshness is unreadable for this build");
  } else {
    dataSha = dataSha || codeSha || null;
    dataFrom = "the checkout itself — the snapshot lane has no tag pin and no overlay, so code and town data share one commit";
  }

  return {
    schema: SCHEMA,
    channel: lane,
    built_at: builtAt,
    code_sha: codeSha || null,
    code_ref: codeRef || null,
    town_data_sha: dataSha,
    town_data_from: dataFrom,
    // Said on every stamp, not only when the two differ. The whole reason this
    // file exists is that one number could not hold both tenses, and a reader
    // meeting the stamp for the first time should meet that fact here.
    why_two: "prod builds CODE from the newest release/* tag and overlays town DATA from main, so the two move on different clocks and each must be compared against its own source.",
    notes,
  };
}

/** Read what the build knows, tolerating every failure as a null-plus-note. */
export function gather({ env = process.env, exec = execFileSync, now = () => new Date() } = {}) {
  let codeSha = null;
  try { codeSha = String(exec("git", ["rev-parse", "HEAD"], { encoding: "utf8" })).trim() || null; } catch { codeSha = null; }
  return composeStamp({
    channel: env.PUBLIC_CHANNEL ?? null,
    codeSha,
    codeRef: env.BUILD_CODE_REF ?? null,
    townDataSha: env.BUILD_TOWN_DATA_SHA ?? null,
    builtAt: now().toISOString(),
  });
}

export function main(argv = process.argv, deps = {}) {
  const i = argv.indexOf("--out");
  const out = i > -1 ? argv[i + 1] : "dist-town/build.json";
  const stamp = gather(deps);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(stamp, null, 2) + "\n");
  console.log(`build-stamp: ${out} — ${stamp.channel ?? "unknown lane"}, code ${String(stamp.code_sha).slice(0, 8)} (${stamp.code_ref ?? "?"}), town data ${String(stamp.town_data_sha).slice(0, 8)}`);
  for (const n of stamp.notes) console.log(`  note: ${n}`);
  return stamp;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
