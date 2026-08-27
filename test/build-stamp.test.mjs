import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { composeStamp, gather, main, SCHEMA } from "../tools/build-stamp.mjs";

const AT = "2026-08-25T23:00:00.000Z";

test("the release lane stamps two shas on two different clocks", () => {
  // Prod builds CODE from the newest release/* tag and overlays town DATA from
  // main. One number cannot hold both, and comparing the code against main
  // would report a permanent staleness that is actually the design working.
  const s = composeStamp({
    channel: "release",
    codeSha: "aaaaaaaaaaaaaaaa",
    codeRef: "release/2026-w35.1",
    townDataSha: "bbbbbbbbbbbbbbbb",
    townSha: "cccccccccccccccc",
    crossing: 149,
    builtAt: AT,
  });
  assert.equal(s.schema, SCHEMA);
  assert.equal(s.channel, "release");
  assert.equal(s.code_sha, "aaaaaaaaaaaaaaaa");
  assert.equal(s.code_ref, "release/2026-w35.1");
  assert.equal(s.town_data_sha, "bbbbbbbbbbbbbbbb");
  assert.match(s.town_data_from, /overlaid from site main/);
  assert.deepEqual(s.notes, []);
});

test("the snapshot lane says the two shas share one commit rather than leaving a reader to guess", () => {
  // Dev has no tag pin and no overlay, so code and data genuinely are the same
  // commit. Equal fields must not be readable as "verified in sync".
  const s = composeStamp({ channel: "snapshot", codeSha: "cccccccc", codeRef: "main", townDataSha: null, builtAt: AT });
  assert.equal(s.town_data_sha, "cccccccc");
  assert.match(s.town_data_from, /the checkout itself/);
  assert.deepEqual(s.notes, [], "a snapshot build with no overlay is complete, not degraded");
  // …and that stays true now that the stamp carries a town commit and a
  // crossing. Dev has no town checkout and no box refresh asking the office, so
  // those two are absent BY DESIGN here — noting them every time would make the
  // notes array a standing complaint nobody reads.
  assert.equal(s.town_sha, null);
  assert.equal(s.crossing, null);
});

test("an unknown is null plus a note — never a plausible guess", () => {
  // A stamp that is confidently wrong is worse than one that admits it cannot
  // say, because the watcher downstream believes it.
  const noSha = composeStamp({ channel: "release", codeSha: null, codeRef: "release/x", townDataSha: "bbb", builtAt: AT });
  assert.equal(noSha.code_sha, null);
  assert.ok(noSha.notes.some((n) => /could not read the built commit/.test(n)));

  // The release lane must NOT fall back to the code sha for town data — that
  // would silently assert the overlay happened when it may not have.
  const noOverlay = composeStamp({ channel: "release", codeSha: "aaa", codeRef: "release/x", townDataSha: null, builtAt: AT });
  assert.equal(noOverlay.town_data_sha, null, "the release lane must not borrow the code sha for the data sha");
  assert.ok(noOverlay.notes.some((n) => /did not report the overlay/.test(n)));

  const noLane = composeStamp({ channel: undefined, codeSha: "aaa", codeRef: null, townDataSha: null, builtAt: AT });
  assert.equal(noLane.channel, null);
  assert.ok(noLane.notes.some((n) => /PUBLIC_CHANNEL/.test(n)));
});

test("gather reads HEAD, not github.sha, and survives a git that will not answer", () => {
  // github.sha names the commit that TRIGGERED the workflow; the release lane
  // then checks out the tag and github.sha does not follow it. HEAD is read
  // after every checkout, so it is the sha that was actually compiled.
  const exec = (bin, args) => {
    assert.equal(bin, "git");
    assert.deepEqual(args, ["rev-parse", "HEAD"]);
    return "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\n";
  };
  const s = gather({
    env: { PUBLIC_CHANNEL: "release", BUILD_CODE_REF: "release/2026-w35.1", BUILD_TOWN_DATA_SHA: "f00d" },
    exec,
    now: () => new Date(AT),
  });
  assert.equal(s.code_sha, "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
  assert.equal(s.built_at, AT);

  // A git that throws costs the build a field, never the build itself.
  const broken = gather({ env: { PUBLIC_CHANNEL: "snapshot" }, exec: () => { throw new Error("not a git repo"); }, now: () => new Date(AT) });
  assert.equal(broken.code_sha, null);
  assert.equal(broken.town_data_sha, null);
});

// ── the town record and the crossing ────────────────────────────────────────
//
// THE LAW THESE ASSERT, verbatim from EPICS/POSTMARK/freshness-architecture.md
// § the mushy middle:
//
//   "mushiness must be disclosed — the page states when it was generated and
//    which ferry crossing it reflects, says 'a ferry has landed since this page
//    was made' when true, and never prints a cadence promise it does not
//    control."
//
// A page cannot say which crossing it reflects unless the build writes it down.
// These are the field that makes the sentence possible.

test("the stamp names the TOWN record it read and the crossing it reflects", () => {
  const s = composeStamp({
    channel: "release", codeSha: "a".repeat(40), codeRef: "release/2026-w35.1",
    townDataSha: "b".repeat(40), townSha: "c".repeat(40), crossing: 149, builtAt: AT,
  });
  assert.equal(s.town_sha, "c".repeat(40));
  assert.equal(s.crossing, 149);
  assert.deepEqual(s.notes, [], "a build that knows both is complete, not degraded");
  assert.notEqual(s.town_sha, s.town_data_sha,
    "the town commit and the site commit the data was copied from are DIFFERENT questions — one field cannot answer both");
});

test("crossing ZERO is a real crossing and must survive — the falsifier for a truthy test", () => {
  // `if (crossing)` would drop 0, and 0 is the town's first ferry. The bug
  // would be invisible for the rest of the town's life and wrong on the one
  // day it mattered, which is exactly the kind that ships.
  const s = composeStamp({ channel: "release", codeSha: "a", codeRef: "r", townDataSha: "b", townSha: "c", crossing: 0, builtAt: AT });
  assert.equal(s.crossing, 0);
  assert.deepEqual(s.notes.filter((n) => /crossing/.test(n)), [], "zero is known, not unknown");
});

test("an unreachable office is null plus a note — NEVER crossing 0, which is a real ferry in June", () => {
  // THE FALSIFIER. gather() takes BUILD_CROSSING from a shell, and the box
  // script passes `$(crossing_now)`, which is the EMPTY STRING when the office
  // did not answer. Number("") is 0. A build that could not ask would then
  // stamp the town's very first crossing and the site would report itself 150
  // ferries behind — a loud, confident lie, which is worse than the silence.
  for (const raw of ["", "   ", undefined, "not-a-number", "-3"]) {
    const s = gather({
      env: { PUBLIC_CHANNEL: "release", BUILD_CODE_REF: "r", BUILD_TOWN_DATA_SHA: "b", BUILD_TOWN_SHA: "c".repeat(40), ...(raw === undefined ? {} : { BUILD_CROSSING: raw }) },
      exec: () => "a".repeat(40) + "\n",
      now: () => new Date(AT),
    });
    assert.equal(s.crossing, null, `BUILD_CROSSING=${JSON.stringify(raw)} must be unknown, not a number`);
    assert.ok(s.notes.some((n) => /cannot say which ferry crossing/.test(n)),
      "and it must say WHY, so a reader of the stamp knows the office was unreachable rather than the field being new");
  }

  // and a real number still gets through the same gate
  assert.equal(gather({
    env: { PUBLIC_CHANNEL: "release", BUILD_CODE_REF: "r", BUILD_TOWN_DATA_SHA: "b", BUILD_TOWN_SHA: "c".repeat(40), BUILD_CROSSING: "149" },
    exec: () => "a".repeat(40) + "\n", now: () => new Date(AT),
  }).crossing, 149);
});

test("a town sha that is not a sha is unknown, not repeated back", () => {
  // The box passes this through a shell too. A stamp that echoes "none" or a
  // half-written value would put it on the page as if it were a commit.
  for (const bad of [null, "", "none", "HEAD", "not a sha"]) {
    const s = composeStamp({ channel: "release", codeSha: "a", codeRef: "r", townDataSha: "b", townSha: bad, crossing: 1, builtAt: AT });
    assert.equal(s.town_sha, null);
    assert.ok(s.notes.some((n) => /which town record it reflects/.test(n)));
  }
});

test("main writes valid JSON the sentinel can parse, at the path it was given", () => {
  const dir = mkdtempSync(join(tmpdir(), "build-stamp-"));
  const out = join(dir, "nested", "build.json");
  const logged = [];
  const realLog = console.log;
  console.log = (m) => logged.push(String(m));
  try {
    main(["node", "build-stamp.mjs", "--out", out], {
      env: { PUBLIC_CHANNEL: "release", BUILD_CODE_REF: "release/2026-w35.1", BUILD_TOWN_DATA_SHA: "b".repeat(40) },
      exec: () => "a".repeat(40) + "\n",
      now: () => new Date(AT),
    });
  } finally { console.log = realLog; }

  const parsed = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(parsed.channel, "release");
  assert.equal(parsed.code_sha, "a".repeat(40));
  assert.equal(parsed.town_data_sha, "b".repeat(40));
  assert.ok(parsed.why_two.length > 40, "the stamp explains its own two-tense shape to whoever meets it first");
  assert.ok(logged.some((l) => /build-stamp:/.test(l)));
});
