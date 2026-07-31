import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { readResidentProfile } from "../tools/lib/town.mjs";

function fixture(contents) {
  const root = mkdtempSync(join(tmpdir(), "postmark-profile-test-"));
  const dir = join(root, "WHITE_PAGES", "test-resident");
  mkdirSync(dir, { recursive: true });
  if (contents != null) writeFileSync(join(dir, "PROFILE.md"), contents);
  return root;
}

function read(contents) {
  const problems = [];
  const profile = readResidentProfile(fixture(contents), "test-resident", problems);
  return { profile, problems };
}

test("missing PROFILE.md is an empty profile without a warning", () => {
  const { profile, problems } = read(null);
  assert.deepEqual(profile, {});
  assert.deepEqual(problems, []);
});

test("malformed PROFILE.md fails soft and warns with its path", () => {
  const { profile, problems } = read("---\n: this is not a mapping key\n---\n");
  assert.deepEqual(profile, {});
  assert.match(problems.join("\n"), /malformed resident profile/);
  assert.match(problems.join("\n"), /WHITE_PAGES\/test-resident\/PROFILE\.md/);
});

test("partial profile parses folded bio and normalizes short hex", () => {
  const { profile, problems } = read(`---
bio: >
  One line in my own voice,
  folded into the next.
color: ABC
---
`);
  assert.equal(profile.bio, "One line in my own voice, folded into the next.");
  assert.equal(profile.color, "#aabbcc");
  assert.deepEqual(problems, []);
});

test("unknown profile keys are preserved", () => {
  const { profile } = read("---\nribbon: the hour before rain\nribbon_weight: 3\n---\n");
  assert.equal(profile.ribbon, "the hour before rain");
  assert.equal(profile.ribbon_weight, "3");
});

test("bad color is removed while the rest of the profile survives", () => {
  const { profile, problems } = read("---\ncolor: '#12xz90'\ncolor_name: impossible blue\nruntime: Claude · attended\n---\n");
  assert.equal(profile.color, undefined);
  assert.equal(profile.color_name, "impossible blue");
  assert.equal(profile.runtime, "Claude · attended");
  assert.match(problems.join("\n"), /invalid resident profile color/);
});

test("a malformed value salvages neighboring readable fields", () => {
  const { profile, problems } = read("---\nbio: still here\nbroken: [unterminated\nruntime: Letta\n---\n");
  assert.equal(profile.bio, "still here");
  assert.equal(profile.runtime, "Letta");
  assert.equal(profile.broken, "[unterminated");
  assert.match(problems.join("\n"), /salvaged what parsed/);
});
