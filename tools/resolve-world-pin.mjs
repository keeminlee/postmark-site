#!/usr/bin/env node
// resolve-world-pin.mjs — CLI for the rebuild-time world pin.
//
//   node tools/resolve-world-pin.mjs [--package package.json] [--remote <url>]
//
// Prints a decision as JSON and, under Actions, writes it to $GITHUB_OUTPUT for
// the step that installs it. The decision law lives in tools/lib/world-pin.mjs;
// this file only supplies the two seams that touch the network:
//
//   lsRemote()          the world repo's advertised refs, UNFILTERED — the
//                       listing contains refs/heads/main and the code is what
//                       refuses it (guardrail 1).
//   floorSettlementOf() the newest settlement tag that is an ancestor of the
//                       release's frozen pin — the floor's place in the
//                       sequence, which is what "never rolls backwards" is
//                       measured against (guardrail 2). The floor is usually
//                       NOT a settlement tag itself: the keeper pins whatever
//                       commit the blessing landed on, so this has to be an
//                       ancestry walk, not a sha lookup.
//
// EXIT CODE IS ALWAYS 0 on a resolution failure. A rebuild that cannot resolve
// a settlement is not a broken rebuild — it is a rebuild that ships the floor
// (guardrail 3), which is exactly what every release before this one shipped.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { decideWorldPin, floorPinFrom, WORLD_REMOTE } from "./lib/world-pin.mjs";

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const PACKAGE = arg("--package", "package.json");
const REMOTE = arg("--remote", process.env.WORLD_REMOTE || WORLD_REMOTE);

const git = (args, opts = {}) =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });

// No --tags. See guardrail 1: the branch refs are supposed to be in this
// listing so that the settlement filter is the thing that excludes them.
const lsRemote = () => git(["ls-remote", REMOTE]);

/**
 * Walk down from the newest settlement until one is an ancestor of the floor.
 * A blobless, checkout-less clone carries the whole commit graph and no file
 * content; the world repo is ~11 MiB packed, so this costs seconds.
 *
 * @returns {number} the floor's settlement number, or 0 if it predates S1
 */
function floorSettlementOf(floorSha, tags) {
  const work = mkdtempSync(join(tmpdir(), "postmark-world-pin-"));
  try {
    try {
      git(["clone", "--filter=blob:none", "--no-checkout", "--quiet", REMOTE, work]);
    } catch {
      // A server that will not serve a partial clone must not make the whole
      // mechanism permanently inert. Full history of an 11 MiB repo is still
      // cheap; this is the slow road, not the closed one. The failed attempt
      // leaves a half-written directory, and `git clone` refuses a non-empty
      // destination, so clear it first.
      rmSync(work, { recursive: true, force: true });
      git(["clone", "--no-checkout", "--quiet", REMOTE, work]);
    }
    try {
      git(["-C", work, "cat-file", "-e", `${floorSha}^{commit}`]);
    } catch {
      throw new Error(`the frozen pin ${floorSha.slice(0, 8)} is not a commit in ${REMOTE}`);
    }
    for (const settlement of [...tags.keys()].sort((a, b) => b - a)) {
      const sha = tags.get(settlement);
      try {
        git(["-C", work, "merge-base", "--is-ancestor", sha, floorSha]);
        return settlement;
      } catch {
        // not an ancestor; keep walking down
      }
    }
    return 0;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

let floorSha = "";
let result;
try {
  floorSha = floorPinFrom(readFileSync(PACKAGE, "utf8")).sha;
  result = decideWorldPin({ floorSha, lsRemote, floorSettlementOf });
} catch (error) {
  // Even an unreadable pin file holds rather than throws: the build carries on
  // with whatever `npm ci` already installed, which IS the floor.
  result = {
    decision: "hold",
    sha: floorSha,
    settlement: null,
    floorSha,
    floorSettlement: null,
    reason: `pin-file-unreadable: ${error.message}`,
  };
}

if (result.decision !== "advance") console.warn(`WARN world-pin: holding at the floor — ${result.reason}`);
console.log(JSON.stringify(result, null, 2));

// A git failure message is multi-line, and $GITHUB_OUTPUT is `key=value` per
// line: writing the raw reason would spill git's stderr into the output map as
// bogus keys. The full text is already on stdout above; this is the label.
const oneLine = (s) => String(s).replace(/\s+/g, " ").trim().slice(0, 240);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    [
      `decision=${result.decision}`,
      `sha=${result.sha}`,
      `settlement=${result.settlement ?? ""}`,
      `floor_sha=${result.floorSha}`,
      `floor_settlement=${result.floorSettlement ?? ""}`,
      `reason=${oneLine(result.reason)}`,
      "",
    ].join("\n"),
  );
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const line =
    result.decision === "advance"
      ? `world pin: **advance** to settlement **S${result.settlement}** (\`${result.sha.slice(0, 8)}\`), from floor S${result.floorSettlement} (\`${result.floorSha.slice(0, 8)}\`)`
      : `world pin: **hold** at the release floor \`${result.floorSha.slice(0, 8)}\` — ${oneLine(result.reason)}`;
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}
