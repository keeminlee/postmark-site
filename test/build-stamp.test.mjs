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
