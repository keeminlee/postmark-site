// world-pin-publish.test.mjs — the one line the office cannot derive.
//
// LANE A's A8 (docs/2026-09-07/jetto-lane-a-report.md § 5.4), verbatim:
//
//   "`receipt.site_pin` is `null` and cannot be anything else today: the office
//    holds no clone of `keeminlee/postmark-site` and no record of its
//    `postmark-world` pin. … the question it answers is real — 'the world says
//    my mark is published; why does the site not show it?' is a resident
//    question, and it is unanswerable without that sha. But it is the site's to
//    publish, so it is Lane E's."
//
//   node --test test/world-pin-publish.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { worldPin, shaFromSpec } from "../tools/lib/world-pin-publish.mjs";

const SHA = "ecc63613a063ca2e3da262c6306c34b72ae3b9f8";
const SEP = String.fromCharCode(92); // a backslash, spelled so no quoting layer can eat it
// Windows joins with a backslash and the fixture keys are written with slashes,
// so the match is on the tail of either spelling rather than a normalized copy.
const reader = (files) => (p) => {
  const key = String(p).split(SEP).join("/");
  for (const [suffix, value] of Object.entries(files)) if (key.endsWith(suffix)) return value;
  const e = new Error(`ENOENT ${key}`); e.code = "ENOENT"; throw e;
};

test("the spec's sha is the pin, and anything that is not a pinned sha is refused as one", () => {
  assert.equal(shaFromSpec(`github:keeminlee/postmark-world#${SHA}`), SHA);
  assert.equal(shaFromSpec("github:keeminlee/postmark-world#main"), null, "a branch is a moving target, not a pin");
  assert.equal(shaFromSpec("^1.2.3"), null);
  assert.equal(shaFromSpec(undefined), null);
});

test("the ordinary build publishes the sha and says when", () => {
  const p = worldPin({
    builtAt: "2026-09-07T09:00:00.000Z",
    readJson: reader({
      "node_modules/postmark-world/package.json": { name: "postmark-world" },
      "package.json": { dependencies: { "postmark-world": `github:keeminlee/postmark-world#${SHA}` } },
    }),
  });
  assert.equal(p.world_pin, SHA);
  assert.equal(p.built_at, "2026-09-07T09:00:00.000Z");
  // THE THIRD STATE, and it is the ordinary one: npm drops _resolved/gitHead on
  // a git install, so the installed copy records no commit. That is not an
  // unreadable package, and the note must not say it is — reporting a present
  // thing as unreadable is the same false negative this whole lane is about.
  assert.equal(p.world_installed, null);
  assert.match(p.notes.join(" "), /records no commit of its own/);
  assert.doesNotMatch(p.notes.join(" "), /could not be read at all/);
});

test("a spec and an installed copy that DISAGREE are both named, never averaged", () => {
  const other = "0000000000000000000000000000000000000000";
  const p = worldPin({
    readJson: reader({
      "node_modules/postmark-world/package.json": { _resolved: `github:keeminlee/postmark-world#${other}` },
      "package.json": { dependencies: { "postmark-world": `github:keeminlee/postmark-world#${SHA}` } },
    }),
  });
  assert.equal(p.world_pin, SHA, "what the repo asks for");
  assert.equal(p.world_installed, other, "and what it actually compiled against");
  assert.match(p.notes.join(" "), /the build compiled against the installed one/);
});

test("an unreadable package.json publishes nulls with a reason — never an invented sha", () => {
  const p = worldPin({ readJson: reader({}) });
  assert.equal(p.world_pin, null);
  assert.equal(p.world_spec, null);
  assert.match(p.notes.join(" "), /package.json could not be read/);
  assert.match(p.notes.join(" "), /could not be read at all/, "and the missing package is its own sentence");
});

test("a dependency that names a branch is called out as a moving target", () => {
  const p = worldPin({
    readJson: reader({
      "node_modules/postmark-world/package.json": {},
      "package.json": { dependencies: { "postmark-world": "github:keeminlee/postmark-world#main" } },
    }),
  });
  assert.equal(p.world_pin, null, "a branch is not a pin, and null says so");
  assert.match(p.notes.join(" "), /pinned to a moving target/);
});
