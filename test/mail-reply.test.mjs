// mail-reply.test.mjs — a reply names the letter it answers, never the root.
//
//   node --test test/mail-reply.test.mjs
//
// THE INSTANCE (postmark-town/postmark#2876): the correspondence page keyed every
// letter to its conversation root and handed the root to the composer as
// `thread`. At the office `thread` is a direct edge to the letter being answered,
// so a reply naming the root answered nothing and the other side stayed "owed a
// reply" — Solan's hand-made mistake of 2026-09-15, mechanized on the site.
//
// THE CAN-FAIL FLIP: make `replyTarget` return `sorted[0].id` unconditionally →
// the first test reds (the viewer's own newer letter is chosen over the one they
// are answering). Restore the `rootOf` handoff in [pair].astro → the third test
// reds (the page hands the composer a thread key again).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { replyTarget } from "../src/lib/mail-reply.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const letters = [
  { id: "ada-2026-09-01-to-bo-hello", from: "ada", to: "bo", date: "2026-09-01" },
  { id: "bo-2026-09-02-to-ada-re-hello", from: "bo", to: "ada", date: "2026-09-02" },
  { id: "ada-2026-09-03-to-bo-again", from: "ada", to: "bo", date: "2026-09-03" },
];

test("a reply names the newest letter the viewer did not write, not their own newer one and not the root", () => {
  // bo is answering: ada wrote last, so bo answers ada's newest letter.
  assert.equal(replyTarget(letters, "bo"), "ada-2026-09-03-to-bo-again");
  // ada is answering: her own letter is newest, so she answers bo's — the one
  // that would otherwise stay "owed a reply" on his doorstep.
  assert.equal(replyTarget(letters, "ada"), "bo-2026-09-02-to-ada-re-hello");
  // never the root
  assert.notEqual(replyTarget(letters, "bo"), "ada-2026-09-01-to-bo-hello");
});

test("only the viewer's own letters → the newest of them; none → null; same-day letters decide by id", () => {
  assert.equal(replyTarget(letters.filter((l) => l.from === "ada"), "ada"), "ada-2026-09-03-to-bo-again");
  assert.equal(replyTarget([], "ada"), null);
  assert.equal(replyTarget(undefined, "ada"), null);
  const sameDay = [
    { id: "bo-2026-09-05-to-ada-a", from: "bo", date: "2026-09-05" },
    { id: "bo-2026-09-05-to-ada-b", from: "bo", date: "2026-09-05" },
  ];
  assert.equal(replyTarget(sameDay, "ada"), "bo-2026-09-05-to-ada-b");
});

test("the correspondence page hands the composer a letter id, never the thread key", () => {
  const src = readFileSync(join(ROOT, "town", "pages", "mail", "with", "[pair].astro"), "utf8");
  assert.equal(src.includes("thread=${encodeURIComponent(tkeyOf(last))}"), false,
    "the compose link hands the conversation ROOT to the composer again (#2876)");
  assert.equal(src.includes("thread=${encodeURIComponent(last.id)}"), true,
    "the compose link does not name the newest delivered letter (the office's latest_delivered_id notion)");
  assert.equal(src.includes("replyTarget(t.letters, from)"), true,
    "the in-page composer's thread options do not name the letter the signed-in viewer is answering");
  assert.equal(/<option value="\$\{t\.key\}">/.test(src), false,
    "a thread option still carries the thread KEY as its value — the office would receive the root");
});
