// threads.test.mjs — a conversation is what reply edges actually connect.
//
//   node --test test/threads.test.mjs
//
// ── WHY THIS FILE EXISTS (#1288) ─────────────────────────────────────────────
// `buildThreads` union-finds letters by their `thread:` field, and its `ensure`
// minted a union-find node for ANY string. So a `thread:` value naming no
// letter did not fail, and did not stand alone — it became a node, and every
// letter carrying the SAME unseen string joined the SAME component. A typo in a
// metadata field silently fused strangers' correspondence into one conversation.
//
// The function's own comment called this intended: "the record stays honest
// about mail we can't see." The intention was real; the code did something
// else with it. One letter pointing at something invisible is a letter we
// cannot place. TWO letters pointing at the same invisible thing are not
// evidence that they belong together, and the record has no way to know that.
// `reply` and `null` are the proof of how cheaply the guess is fooled: eleven
// letters carrying the literal word `reply`, and eight carrying the
// four-character string `null` — a serialiser writing the word for absence,
// which is not a shape any "unseen letter" theory anticipated.
//
// What it produced, on the open web: a thread page titled after ONE resident's
// letter, presenting twenty-one letters from nine residents — two months of
// separate correspondence between people who never wrote to each other — as a
// single conversation.
//
// ── WHAT THE FIX IS, AND WHAT IT IS NOT ──────────────────────────────────────
// One condition: an edge exists only when the letter it names exists. A letter
// whose `thread:` resolves to nothing stands alone, exactly as if the field
// were absent. NO LETTER IS TOUCHED — the bogus values stay in the record as
// the history they are; only the reading changes. That is why the corpus check
// below reads the committed letters and never writes them.
//
// ── THE LAW, STATED SO IT CANNOT DRIFT ───────────────────────────────────────
// Every thread must be CONNECTED BY REAL EDGES: for any thread `buildThreads`
// returns, walking only the `thread:` links whose target is a letter in the
// corpus must reach every member from any member. This is stated as a property
// of the output rather than as a count, so it survives the next crossing —
// there is no pinned number here for the record to grow out of.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { buildThreads } from "../tools/lib/town.mjs";
import { deriveThreadMailState } from "../tools/lib/doorstep.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = join(ROOT, "src", "data", "postmark", "letters.json");

/** A letter in the shape buildThreads and the doorstep both read. */
const L = (id, from, to, date, thread = null, body = "") => ({ id, from, to, toList: [to], date, thread, body });

/**
 * The pieces a thread would fall into if only REAL edges held it together.
 * One piece means the thread is honest; two or more means something joined
 * members that no reply connects.
 */
function realPieces(thread, byId) {
  const ids = new Set(thread.letterIds);
  const parent = new Map([...ids].map((i) => [i, i]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const id of ids) {
    const l = byId.get(id);
    if (!l?.thread) continue;
    if (!byId.has(l.thread) || !ids.has(l.thread)) continue; // not a real edge inside this thread
    const a = find(id), b = find(l.thread);
    if (a !== b) parent.set(a, b);
  }
  return new Set([...ids].map(find)).size;
}

const peopleOf = (l) => [l.from, ...(l.toList?.length ? l.toList : [l.to])].filter(Boolean);

// ── THE FIXTURE HALF: the two shapes, on data this file owns outright ────────

test("two households writing `thread: reply` are two conversations, not one", () => {
  // THE DEFECT, at its smallest. Neither letter answers the other; neither
  // names a letter that exists. Before the guard they shared a phantom root
  // named `reply` and came back as ONE thread with all four people in it.
  const letters = [
    L("ash-2026-01-01-to-brin-the-well", "ash", "brin", "2026-01-01", "reply"),
    L("cass-2026-02-02-to-dov-the-orchard", "cass", "dov", "2026-02-02", "reply"),
  ];
  const threads = buildThreads(letters);

  assert.equal(threads.length, 2,
    `two unrelated letters carrying the same bogus thread came back as ${threads.length} conversation(s) — the phantom root is back`);
  for (const t of threads) {
    assert.equal(t.size, 1, `a letter that answers nothing is a conversation of one, got ${t.size}`);
    assert.equal(t.participants.length, 2, `a two-party letter has two participants, got ${t.participants.join(", ")}`);
  }
  assert.deepEqual(threads.flatMap((t) => t.participants).sort(), ["ash", "brin", "cass", "dov"],
    "every letter must still appear — standing alone is not disappearing");
});

test("a real reply chain still groups, and a chain is not broken by a bogus link hanging off it", () => {
  // THE FIX MUST NOT COST THE FEATURE. Three letters that genuinely answer one
  // another are one conversation, and a fourth letter carrying a bogus value
  // joins none of them while leaving the chain whole.
  const chain = [
    L("ash-2026-01-01-to-brin-the-well", "ash", "brin", "2026-01-01"),
    L("brin-2026-01-02-to-ash-the-rope", "brin", "ash", "2026-01-02", "ash-2026-01-01-to-brin-the-well"),
    L("ash-2026-01-03-to-brin-the-bucket", "ash", "brin", "2026-01-03", "brin-2026-01-02-to-ash-the-rope"),
    L("cass-2026-02-02-to-dov-the-orchard", "cass", "dov", "2026-02-02", "reply"),
  ];
  const threads = buildThreads(chain);
  const bySize = [...threads].sort((a, b) => b.size - a.size);

  assert.equal(threads.length, 2, "the chain and the stray are two conversations");
  assert.equal(bySize[0].size, 3, "the three-letter reply chain must still be one conversation");
  assert.deepEqual(bySize[0].participants, ["ash", "brin"], "the chain's participants are its own two people");
  assert.equal(bySize[0].key, "ash-2026-01-01-to-brin-the-well", "the earliest letter still names the thread");
  assert.equal(bySize[1].size, 1, "the stray joins nothing");
});

test("a letter answering an id we do not hold is a letter we cannot place, not a letter that belongs to the others", () => {
  // THE INTENTION THE OLD COMMENT NAMED — "honest about mail we can't see" —
  // held for ONE letter and broke for two. This pins both halves: a single
  // unresolvable reference still yields exactly one conversation of one, and a
  // second letter naming the SAME unseen id does not get pulled in with it.
  const one = buildThreads([L("ash-2026-01-01-to-brin-the-well", "ash", "brin", "2026-01-01", "a-letter-nobody-has")]);
  assert.equal(one.length, 1);
  assert.equal(one[0].size, 1);

  const two = buildThreads([
    L("ash-2026-01-01-to-brin-the-well", "ash", "brin", "2026-01-01", "a-letter-nobody-has"),
    L("cass-2026-02-02-to-dov-the-orchard", "cass", "dov", "2026-02-02", "a-letter-nobody-has"),
  ]);
  assert.equal(two.length, 2,
    "two letters naming the same letter nobody has is not evidence that they are one conversation");
});

test("the mail-state derivation reads only real threads — a stranger's letter cannot set your doorstep", () => {
  // THE HALF THAT REACHED PEOPLE. With the letters fused, a thread's LAST
  // letter decided every participant's state, so whichever stranger wrote last
  // could put a letter you had never seen into your awaiting-you, or bury one
  // you owed. `deriveThreadMailState` is no longer wired to a surface, but it
  // is the standing statement of the shape, and the guard has to hold here too.
  const letters = [
    L("ash-2026-01-01-to-brin-the-well", "ash", "brin", "2026-01-01", "reply", "the well"),
    L("cass-2026-02-02-to-dov-the-orchard", "cass", "dov", "2026-02-02", "reply", "the orchard"),
  ];
  const threads = buildThreads(letters);
  const brin = deriveThreadMailState({ handle: "brin", threads, letters, baseUrl: "https://example.test", asOf: "2026-03-01" });

  assert.equal(brin.awaiting_you.length, 1, "brin owes exactly the one letter written to brin");
  assert.equal(brin.awaiting_you[0].lastFrom, "ash", "brin's doorstep must be set by the letter ash sent brin");
  assert.equal(brin.awaiting_you[0].letters, 1, "and it is a conversation of one letter, not of four people's mail");
  assert.deepEqual(brin.awaiting_reply, [], "brin has written nothing here");

  const dov = deriveThreadMailState({ handle: "dov", threads, letters, baseUrl: "https://example.test", asOf: "2026-03-01" });
  assert.equal(dov.awaiting_you.length, 1);
  assert.equal(dov.awaiting_you[0].lastFrom, "cass", "dov's doorstep must not be set by ash, who never wrote to dov");
});

// ── THE CORPUS HALF: the committed record, read and never written ────────────

const corpusLetters = existsSync(CORPUS) ? JSON.parse(readFileSync(CORPUS, "utf8")) : null;

test("the committed corpus is readable and large enough to mean something", () => {
  assert.ok(Array.isArray(corpusLetters), `${CORPUS} did not parse to an array of letters`);
  assert.ok(corpusLetters.length > 1000,
    `only ${corpusLetters.length} letters in the committed corpus — the checks below would be measuring almost nothing`);
});

test("NO conversation joins letters that no reply connects", () => {
  // THE LAW. A relation, not a count: whatever the record grows into, a thread
  // is exactly what real reply edges hold together.
  const byId = new Map(corpusLetters.filter((l) => l.id).map((l) => [l.id, l]));
  const broken = [];
  for (const t of buildThreads(corpusLetters)) {
    const pieces = realPieces(t, byId);
    if (pieces > 1) {
      const people = new Set(t.letterIds.flatMap((i) => peopleOf(byId.get(i) ?? {})));
      broken.push(`${t.key} — ${t.size} letters served as one conversation, ${pieces} real ones, ${people.size} people`);
    }
  }
  assert.deepEqual(broken, [],
    "a thread page is presenting letters as one conversation that no reply edge connects. This is the phantom root: " +
    "a `thread:` value naming no letter became a node, and every letter carrying that same value joined it.");
});

test("every letter is in exactly one conversation — standing alone is not falling out", () => {
  // THE OTHER DIRECTION, because a guard that DROPPED the unplaceable letters
  // would pass the law above and lose mail. Count, don't sample.
  const withId = corpusLetters.filter((l) => l.id);
  const seen = new Map();
  for (const t of buildThreads(corpusLetters)) for (const id of t.letterIds) seen.set(id, (seen.get(id) ?? 0) + 1);
  assert.equal(seen.size, new Set(withId.map((l) => l.id)).size, "a letter went missing from the fold");
  assert.deepEqual([...new Set(seen.values())], [1], "a letter appears in more than one conversation");
});

test("the corpus still exercises the guard — and here is when to retire this control", () => {
  // A CHECK OVER A CLEAN RECORD PROVES NOTHING. The law above only bites while
  // the committed letters actually carry `thread:` values naming no letter.
  //
  // RETIREMENT CONDITION, written here so the next reader does not have to
  // guess: if this ever reds, the record has been cleaned — every `thread:`
  // resolves — and the corpus checks have become vacuous. That is good news.
  // Delete THIS test and say so; the fixtures above carry the law on their own
  // and do not depend on the record's contents at all.
  const byId = new Map(corpusLetters.filter((l) => l.id).map((l) => [l.id, l]));
  const dangling = corpusLetters.filter((l) => l.thread && !byId.has(l.thread));
  const shared = [...dangling.reduce((m, l) => m.set(l.thread, (m.get(l.thread) ?? 0) + 1), new Map())]
    .filter(([, n]) => n >= 2);
  assert.ok(shared.length > 0,
    `no bogus \`thread:\` value is carried by two or more letters (${dangling.length} unresolvable refs in all), ` +
    "so nothing in the corpus could fuse and the law above cannot fail on this data. Read the comment in this test.");
});
