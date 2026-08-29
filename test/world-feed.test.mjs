// world-feed.test.mjs — the rail's feed, falsified (2026-08-29).
//
// THE LAW THESE PIN, in the founder's own words the night he ruled it:
//
//   "the action log can just replace the Lately section in the side rail
//    instead of needing a whole separate panel … tweak the 'lately' section so
//    it's a newest-at-the-bottom chat-like feed, that you can scroll UP to see
//    older things (and we should use this same thing for the log in combat)"
//
// and, for what the fight's lines should read like:
//
//   "the-unlit-cake strikes rei — 7. rei is down; the good-lighter clatters to
//    the floor."
//
// Behavioural, not source pins: every assertion here runs the function against
// the office's own beat shape (postmark-office src/encounter.mjs, the rows
// pushed into `beats`) and the encounter block its read half answers
// (`publicState`). A grammar that only matched a regex over its own source
// would be a test of the spelling, and the spelling is not the law.

import test from "node:test";
import assert from "node:assert/strict";
import {
  actorName, atBottom, beatLine, beatsFromAct, beatsFromDelta, beatsFromTail,
  leafName, mergeFeed, tailWatermark, voiceEntries,
} from "../src/lib/world-feed.mjs";

// ── the names ───────────────────────────────────────────────────────────────

test("a mark is named by its leaf, deslugged; a handle is named by itself", () => {
  assert.equal(leafName("the-town/the-unlit-cake"), "the unlit cake");
  assert.equal(actorName("the-town/the-unlit-cake"), "the unlit cake");
  // A handle has no slash and is already the resident's name in this town.
  assert.equal(actorName("rei"), "rei");
  // The wipe beat carries `actor: null` when no hostile is left to blame it on
  // (office encounter.mjs `wipedBy`), and a consumer mapping beat.actor must
  // not produce "undefined strikes".
  assert.equal(actorName(null), "somebody");
});

// ── the fight, one beat at a time ───────────────────────────────────────────

test("the founder's own sample line is what a landed hostile blow reads like", () => {
  // The office's shape for a creature's landed strike that put someone down and
  // knocked their weapon loose (encounter.mjs § the creature's turn).
  const line = beatLine({
    seq: 12, actor: "the-town/the-unlit-cake", act: "strike", kind: "hostile",
    at: "rei", to_hit: 17, damage: 7, downed: true,
    dropped: "the-town/the-good-lighter", round: 3,
  });
  assert.equal(line.tone, "down");
  // subject, verb, object, the number — then the two consequences, in the order
  // they happened.
  assert.match(line.text, /^the unlit cake strikes rei — 7\./);
  assert.match(line.text, /rei is down\./);
  assert.match(line.text, /the good lighter clatters to the floor\./);
});

test("a hand's blow names what it swung at, which its own beat does not carry", () => {
  // ⚑ THE OFFICE LEAVES `at` OFF A PLAYER'S ROW — it is written only on a
  // creature's, because on this ground a hand's blow lands on the one thing
  // standing. Without the adversary passed in, the line said "rei strikes — 9"
  // and the reader had to know what was in the room.
  const beat = { seq: 9, actor: "rei", act: "strike", to_hit: 14, damage: 9, boss_left: 41 };
  assert.match(beatLine(beat).text, /^rei strikes — 9\./, "no adversary named, no object invented");
  const named = beatLine(beat, { adversary: "the-town/the-unlit-cake" });
  assert.match(named.text, /^rei strikes the unlit cake — 9\. 41 left\.$/);
});

test("the weapon says its name only where it made a difference", () => {
  const withIt = beatLine({
    seq: 9, actor: "rei", act: "strike", damage: 12, weapon_bonus: 3,
    with: "the-town/the-good-lighter", boss_left: 30,
  });
  assert.match(withIt.text, /\(the good lighter, \+3\)/);
  const without = beatLine({ seq: 9, actor: "rei", act: "strike", damage: 9, boss_left: 41 });
  assert.doesNotMatch(without.text, /\(/, "a blow with no bonus carries no parenthetical");
});

test("a miss is a line — the die was thrown and the reader watched it", () => {
  const missed = beatLine({ seq: 4, actor: "rei", act: "strike", to_hit: 3, missed: true },
    { adversary: "the-town/the-unlit-cake" });
  assert.equal(missed.tone, "miss");
  assert.match(missed.text, /rei swings at the unlit cake and misses — 3\./);
  // the office's other miss: a swing at an empty room, which is a different
  // sentence and must not read as bad luck
  const nobody = beatLine({ seq: 5, actor: "the-town/the-unlit-cake", act: "strike", kind: "hostile", missed: "nobody to hit" });
  assert.match(nobody.text, /nobody left standing to hit/);
});

test("the guard, the lift, the join and the wipe each read as themselves", () => {
  assert.match(beatLine({ actor: "rei", act: "guard", round: 2 }).text, /the next hit lands at half/);
  const lift = beatLine({ actor: "wright", act: "lift", lifted: "rei", to: 8 });
  assert.equal(lift.tone, "lift");
  assert.match(lift.text, /^wright lifts rei — back up at 8\.$/);
  const join = beatLine({ actor: "rei", act: "join", initiative: 17, joins_round: 3 });
  assert.equal(join.tone, "join");
  assert.match(join.text, /rei crosses in — initiative 17, at round 3\./);
  // round 1 is not a late arrival, so it is not announced as one
  assert.doesNotMatch(beatLine({ actor: "rei", act: "join", initiative: 9, joins_round: 1 }).text, /at round/);
  const wipe = beatLine({ act: "wipe", actor: "the-town/the-unlit-cake", attempt: 2, everyone: ["rei"] });
  assert.equal(wipe.tone, "wipe");
  assert.match(wipe.text, /everyone is down — the party wakes in the antechamber/);
});

test("a verb this file has never heard of still gets a line", () => {
  // The bar's own standing rule, kept here: the ground can grow a verb tomorrow
  // and a log that dropped it would go quiet about the newest thing in the room.
  const line = beatLine({ seq: 20, actor: "rei", act: "kindle", at: "the-town/the-wick-end" });
  assert.ok(line, "an unknown act is still a beat");
  assert.match(line.text, /rei kindles the wick end\./);
});

test("every line is lowercase-initial, because every subject in this town is", () => {
  const lines = [
    beatLine({ actor: "rei", act: "guard" }),
    beatLine({ act: "wipe", actor: null, attempt: 1 }),
    beatLine({ actor: "rei", act: "strike", damage: 5, boss_left: 0 }),
  ].map((l) => l.text);
  for (const t of lines) assert.doesNotMatch(t, /^[A-Z]/, `"${t}" starts with a capital`);
  // and the sentences INSIDE a line too — this is the one that regressed
  assert.doesNotMatch(lines[2], /\. [A-Z]/, "a second sentence must not be capitalised either");
});

// ── one act answer, whole ───────────────────────────────────────────────────

test("an act answer carries your beat and the turns it drove, in log order", () => {
  // The office's answer shape, arena.mjs § 8.
  const body = {
    did: "strike", seq: 31,
    beat: { seq: 31, actor: "rei", act: "strike", damage: 6, boss_left: 54, round: 2 },
    then: [{ seq: 32, actor: "the-town/the-unlit-cake", act: "strike", kind: "hostile", at: "rei", damage: 5 }],
  };
  const out = beatsFromAct(body, { now: 1000 });
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((e) => e.seq), [31, 32], "seq order, which is the order the fight happened in");
  assert.match(out[0].text, /^rei strikes/);
  assert.match(out[1].text, /^the unlit cake strikes rei/);
  // the id is seq-derived, which is what lets a beat arriving twice be one line
  assert.deepEqual(out.map((e) => e.id), ["b:31", "b:32"]);
});

test("crossing in is joining, and the open is the room's own event", () => {
  const out = beatsFromAct({
    opened: { seq: 4 },
    joined: { seq: 5, initiative: 14, round: 1 },
    beat: { seq: 6, actor: "rei", act: "strike", damage: 5, boss_left: 55 },
  }, { now: 1000, acting: "rei" });
  assert.equal(out.length, 3);
  assert.match(out[0].text, /the wheel turns/, "the open says the fight has begun");
  assert.match(out[1].text, /^rei crosses in — initiative 14\./,
    "the joined block names the acting resident, which the office does not put in it");
});

// ── everybody else's turns, WHOLE: the tail ─────────────────────────────────
//
// `encounter_detail.beats_tail` — the fold's own beats, same shape as the ones
// the act answer already carries. SITE-DEFINED CONTRACT at the time of writing:
// checked against origin/bday-law 883e77d on 2026-08-29 and `publicState`
// carries no tail yet, so these fixtures are the contract made visible, in the
// office's own beat spelling.

const tailOf = (...beats) => ({ phase: "afoot", live: true, beats_tail: beats });

test("where the door sends a tail, every hand's line is whole and attributed", () => {
  // The sentence the receiving voice was standing in for.
  const { entries } = beatsFromTail(tailOf(
    { seq: 40, actor: "rei", act: "strike", to_hit: 15, damage: 6, boss_left: 41, round: 3 },
    { seq: 41, actor: "the-town/the-unlit-cake", act: "strike", kind: "hostile", at: "rei",
      to_hit: 17, damage: 7, downed: true, dropped: "the-town/the-good-lighter", round: 3 },
  ), { now: 1000, adversary: "the-town/the-unlit-cake" });
  assert.equal(entries.length, 2);
  assert.equal(entries[0].text, "rei strikes the unlit cake — 6. 41 left.");
  assert.equal(entries[1].text, "the unlit cake strikes rei — 7. rei is down. the good lighter clatters to the floor.");
  assert.equal(entries[1].who, "the-town/the-unlit-cake", "the hand is named, because the door named it");
});

test("a tail is read in seq order however it arrives", () => {
  // Deliberately out of order — the door's window is a list, and nothing in the
  // contract promises it is sorted. The watermark must be the window's TOP and
  // not merely its last member, or one unsorted answer sets the watermark
  // BACKWARDS and every beat between there and the real top is drawn twice.
  const detail = tailOf(
    { seq: 42, actor: "rei", act: "pass" },
    { seq: 40, actor: "wright", act: "guard" },
    { seq: 41, actor: "wright", act: "lift", lifted: "rei", to: 8 },
  );
  const { entries, watermark } = beatsFromTail(detail, { now: 1 });
  assert.deepEqual(entries.map((e) => e.seq), [40, 41, 42]);
  assert.equal(watermark, 42);
  assert.equal(tailWatermark(detail), 42);
});

test("the watermark is the window's top, and `since` is exclusive", () => {
  const detail = tailOf(
    { seq: 40, actor: "rei", act: "pass" },
    { seq: 41, actor: "wright", act: "guard" },
    { seq: 42, actor: "rei", act: "pass" },
  );
  assert.equal(tailWatermark(detail), 42);
  const { entries, watermark } = beatsFromTail(detail, { since: 41, now: 1 });
  assert.deepEqual(entries.map((e) => e.seq), [42], "41 was already drawn, so it is not drawn again");
  assert.equal(watermark, 42);
  // and with no watermark yet, the whole window comes back — which is what a
  // caller seeding itself wants to be handed and then throw away
  assert.equal(beatsFromTail(detail, { now: 1 }).entries.length, 3);
});

test("no tail and an empty tail are different sentences", () => {
  // ⚑ Only the first should send a caller to the delta fallback. Collapsing them
  // would make a door that HAS beats and simply has none yet look like a door
  // that cannot carry them.
  assert.equal(beatsFromTail({ phase: "afoot" }, { now: 1 }), null, "no tail at all is null");
  assert.equal(tailWatermark({ phase: "afoot" }), null);
  const empty = beatsFromTail(tailOf(), { now: 1 });
  assert.deepEqual(empty, { entries: [], watermark: null }, "a present-but-empty tail is an answer, not an absence");
});

test("a beat reaching the page twice is one line, whichever road it came by", () => {
  // Your own strike arrives whole in the act answer, then again in the next
  // tail. The id is the seq, so the merge drops the second — no coordination
  // between the two roads is needed, and none exists.
  const mine = beatsFromAct({ beat: { seq: 31, actor: "rei", act: "strike", damage: 6, boss_left: 54 } }, { now: 1 });
  const feed = mergeFeed([], mine);
  const later = beatsFromTail(tailOf(
    { seq: 31, actor: "rei", act: "strike", damage: 6, boss_left: 54 },
    { seq: 32, actor: "the-town/the-unlit-cake", act: "strike", kind: "hostile", at: "rei", damage: 5 },
  ), { now: 2 });
  const merged = mergeFeed(feed, later.entries);
  assert.deepEqual(merged.map((e) => e.seq), [31, 32], "the repeat is dropped and the new beat is appended");
});

test("the round rule survives on the tail road, and both roads spell it the same", () => {
  // It was a delta-only line at first, so switching to the tail quietly lost the
  // one divider in the feed — caught by looking at the two shots side by side.
  const detail = tailOf(
    { seq: 44, actor: "rei", act: "pass", round: 3 },
    { seq: 45, actor: "wright", act: "guard", round: 4 },
    { seq: 46, actor: "rei", act: "pass", round: 4 },
  );
  const { entries } = beatsFromTail(detail, { since: 44, now: 1 });
  assert.deepEqual(entries.map((e) => e.text), ["— round 4 —", "wright guards — the next hit lands at half.", "rei passes."]);
  assert.equal(entries[0].id, "d:r4", "the same id the delta's round rule carries, so a deploy that flips roads mid-fight cannot draw it twice");

  // Never on the window's first beat — nothing here knows whether it opened its
  // round or is merely the oldest thing the door still remembers.
  const first = beatsFromTail(tailOf({ seq: 44, actor: "rei", act: "pass", round: 3 }), { now: 1 });
  assert.deepEqual(first.entries.map((e) => e.tone), ["plain"]);

  // The boundary is read across the WHOLE window, including beats already drawn
  // — walking only the fresh ones would put a rule at the top of every batch.
  const already = beatsFromTail(detail, { since: 45, now: 1 });
  assert.deepEqual(already.entries.map((e) => e.text), ["rei passes."], "round 4 was already opened and is not re-announced");
});

test("a tail beat with no seq is not silently dropped", () => {
  // seq is the dedupe key, so a beat without one gets a per-arrival id rather
  // than being filtered out — but it also cannot be compared to the watermark,
  // which is why the filter demands one. Stated here so the trade is deliberate:
  // a seq-less beat in a TAIL is skipped, and a seq-less beat in an ACT ANSWER
  // (where there is no watermark to compare against) still gets its line.
  assert.equal(beatsFromTail(tailOf({ actor: "rei", act: "pass" }), { now: 1 }).entries.length, 0);
  assert.equal(beatsFromAct({ beat: { actor: "rei", act: "pass" } }, { now: 1 }).length, 1);
});

// ── everybody else's turns, derived: THE FALLBACK ───────────────────────────

const encounter = (over) => ({
  phase: "afoot", live: true,
  adversary: { id: "the-town/the-unlit-cake", hp: 60, of: 60 },
  wheel: { round: 2, turn: "rei", order: [{ who: "rei", kind: "player", initiative: 11 }] },
  hands: { rei: { hp: 20, of: 20, downed: false, guarding: false, gone: false } },
  downed: [], dropped: [], looted: [], attempts: 0, acts: 10,
  ...over,
});

test("another player's turn reaches the feed as an effect, never as a claimed hand", () => {
  // ⚑ THE READ HALF CARRIES NO BEATS — office arena.mjs `publicState`: "`beats`,
  // `ignored` and `rolls` are the fold's full working and they are NOT carried
  // here". So this is all two reads can prove, and the line must not pretend to
  // more: the number is a fact, the hand that threw it is not in the answer.
  const prev = encounter();
  const next = encounter({
    hands: { rei: { hp: 13, of: 20, downed: false, guarding: false, gone: false } },
    acts: 11,
  });
  const { entries } = beatsFromDelta(prev, next, { now: 1000 });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].text, "rei takes 7.");
  assert.equal(entries[0].who, null, "no hand is attached to a derived line");
  assert.doesNotMatch(entries[0].text, /strikes|casts/, "a derived line never names a verb it did not see");
});

test("the cake's bar, the drop, the down and the lift all derive", () => {
  const prev = encounter({ downed: [], hands: { rei: { hp: 4, of: 20, downed: false } } });
  const next = encounter({
    adversary: { id: "the-town/the-unlit-cake", hp: 49, of: 60 },
    hands: { rei: { hp: 0, of: 20, downed: true } },
    downed: ["rei"],
    dropped: [{ thing: "the-town/the-good-lighter", by: "rei", at_seq: 40 }],
    acts: 14,
  });
  const texts = beatsFromDelta(prev, next, { now: 1000 }).entries.map((e) => e.text);
  assert.ok(texts.includes("rei takes 4."), texts.join(" | "));
  assert.ok(texts.includes("rei is down."), texts.join(" | "));
  assert.ok(texts.includes("the good lighter clatters to the floor."), texts.join(" | "));
  assert.ok(texts.includes("the unlit cake takes 11 — 49 left."), texts.join(" | "));

  // and back up: only a lift raises a downed hand, so this one CAN be named
  const up = beatsFromDelta(next, encounter({
    adversary: { id: "the-town/the-unlit-cake", hp: 49, of: 60 },
    hands: { rei: { hp: 8, of: 20, downed: false } }, downed: [], acts: 15,
    dropped: [{ thing: "the-town/the-good-lighter", by: "rei", at_seq: 40 }],
  }), { now: 2000 }).entries.map((e) => e.text);
  assert.ok(up.includes("rei is lifted — back up at 8."), up.join(" | "));
});

test("a new row on the wheel is somebody crossing in, and a round is a rule", () => {
  const out = beatsFromDelta(encounter(), encounter({
    wheel: { round: 3, turn: "wright", order: [{ who: "rei" }, { who: "wright", initiative: 14 }] },
    acts: 11,
  }), { now: 1000 }).entries;
  assert.equal(out[0].tone, "turn", "the round marker leads, because everything under it is in it");
  assert.equal(out[0].text, "— round 3 —");
  assert.match(out[1].text, /^wright crosses in — initiative 14\./);
});

test("the two endings", () => {
  const wiped = beatsFromDelta(encounter(), encounter({ attempts: 1, acts: 20 }), { now: 1 }).entries;
  assert.ok(wiped.some((e) => e.tone === "wipe" && /wakes in the antechamber/.test(e.text)));
  const spent = beatsFromDelta(encounter(), encounter({
    phase: "spent", adversary: { id: "the-town/the-unlit-cake", hp: 0, of: 60 }, acts: 22,
  }), { now: 1 }).entries;
  assert.ok(spent.some((e) => /the loot is open/.test(e.text)), spent.map((e) => e.text).join(" | "));
});

test("turns this page had no door to read are counted, never invented", () => {
  // `acts` is the ground's own row COUNT. When it moves further than the lines
  // account for, the difference is real turns nobody here could see — and the
  // rail's standing rule is that a record it could not read is named.
  const { entries, unseen } = beatsFromDelta(encounter(), encounter({ acts: 15 }), { now: 1 });
  assert.equal(entries.length, 0, "nothing observable changed, so nothing is said about what happened");
  assert.equal(unseen, 5);
  // a round marker is not an act and must not eat the remainder
  const withRound = beatsFromDelta(encounter(), encounter({
    wheel: { round: 3, turn: "rei", order: [{ who: "rei" }] }, acts: 11,
  }), { now: 1 });
  assert.equal(withRound.unseen, 1, "the round rule is a divider, not one of the acts");
});

test("a first read is not a delta — there is nothing to compare it against", () => {
  assert.deepEqual(beatsFromDelta(null, encounter(), { now: 1 }), { entries: [], unseen: 0 });
  assert.deepEqual(beatsFromDelta(encounter(), null, { now: 1 }), { entries: [], unseen: 0 });
});

// ── what is being said ──────────────────────────────────────────────────────

test("a say carries the moment it was said, not the moment it was polled", () => {
  // recentVoices hands over ageMs; the feed needs an instant, so it subtracts.
  const [line] = voiceEntries([{ handle: "rei", said: "many happy returns", ageMs: 4000 }], { now: 10_000 });
  assert.equal(line.kind, "say");
  assert.equal(line.who, "rei");
  assert.equal(line.at, 6000, "said four seconds ago, so it sits four seconds back in the feed");
  assert.equal(line.text, "many happy returns");
});

// ── the chat contract ───────────────────────────────────────────────────────

test("newest goes LAST, which is the whole of the founder's ruling", () => {
  const feed = mergeFeed([], [
    { id: "a", at: 2, text: "second" },
    { id: "b", at: 1, text: "first" },
  ]);
  assert.deepEqual(feed.map((e) => e.text), ["first", "second"]);
});

test("a line already drawn is never redrawn and never moves", () => {
  // The same beat reaches this page twice by design — once whole through your
  // act answer, and again as whatever the next poll's delta made of it. Keyed
  // by id, that is one line.
  const first = mergeFeed([], beatsFromAct({ beat: { seq: 31, actor: "rei", act: "guard" } }, { now: 1 }));
  const twice = mergeFeed(first, beatsFromAct({ beat: { seq: 31, actor: "rei", act: "guard" } }, { now: 2 }));
  assert.equal(twice.length, 1);

  // ⚑ AND AN ARRIVAL NEVER REORDERS WHAT IS ABOVE IT. A say polled seven
  // seconds late is genuinely older than the beat over it, and inserting it
  // back into the middle would move lines a reader has already read — the one
  // thing a chat must never do.
  const withOld = mergeFeed(
    [{ id: "x", at: 5000, text: "already read" }],
    [{ id: "y", at: 1000, text: "arrived late, said earlier" }],
  );
  assert.deepEqual(withOld.map((e) => e.text), ["already read", "arrived late, said earlier"]);
});

test("the feed is capped from the top, so scrolling up ends rather than grows forever", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, at: i, text: String(i) }));
  const feed = mergeFeed([], many, { cap: 10 });
  assert.equal(feed.length, 10);
  assert.equal(feed[0].text, "30", "the oldest go, and the newest are the ones kept");
  assert.equal(feed[9].text, "39");
});

test("at the bottom the feed follows; scrolled up it holds", () => {
  // The predicate IS the contract — the mount asks it before every rewrite and
  // only pins when it answers true.
  assert.equal(atBottom({ scrollTop: 400, clientHeight: 200, scrollHeight: 600 }), true);
  assert.equal(atBottom({ scrollTop: 0, clientHeight: 200, scrollHeight: 600 }), false);
  // a sub-pixel row height must not stop it following
  assert.equal(atBottom({ scrollTop: 399.4, clientHeight: 200, scrollHeight: 600 }), true);
  // a feed shorter than its box is at the bottom, and so is no box at all
  assert.equal(atBottom({ scrollTop: 0, clientHeight: 200, scrollHeight: 120 }), true);
  assert.equal(atBottom(null), true);
});
