import assert from "node:assert/strict";
import test from "node:test";

import {
  STORAGE_PREFIX,
  emptyState,
  evaluate,
  markDone,
  markShown,
  normalizeState,
  storageKey,
  validateRegistry,
} from "../src/lib/tutorial.mjs";

const content = { title: "A title", body: "A body" };

test("validateRegistry rejects missing fields and duplicate ids", () => {
  assert.throws(() => validateRegistry([{ trigger: "page:enter", content }]), /<missing>.*id/);
  assert.throws(() => validateRegistry([{ id: "no-trigger", content }]), /no-trigger.*trigger/);
  assert.throws(() => validateRegistry([
    { id: "same", trigger: "page:enter", content },
    { id: "same", trigger: "auth:signed-in", content },
  ]), /same.*duplicate/);
});

test("validateRegistry rejects invalid optional controls", () => {
  assert.throws(() => validateRegistry([{ id: "bad-when", trigger: "page:enter", when: true, content }]), /bad-when.*when/);
  assert.throws(() => validateRegistry([{ id: "bad-priority", trigger: "page:enter", priority: Infinity, content }]), /bad-priority.*priority/);
});

test("evaluate picks highest priority and breaks ties by registry order", () => {
  const registry = validateRegistry([
    { id: "first-high", trigger: "page:enter", priority: 4, content },
    { id: "second-high", trigger: "page:enter", priority: 4, content },
    { id: "low", trigger: "page:enter", priority: -1, content },
    { id: "other-event", trigger: "auth:signed-in", priority: 99, content },
  ]);
  assert.equal(evaluate(registry, emptyState(), "page:enter", {}), registry[0]);
});

test("evaluate skips shown and done tutorials", () => {
  const registry = validateRegistry([
    { id: "shown", trigger: "page:enter", priority: 9, content },
    { id: "done", trigger: "page:enter", priority: 8, content },
    { id: "unseen", trigger: "page:enter", content },
  ]);
  const state = {
    v: 1,
    tutorials: {
      shown: { status: "shown", shownAt: 10 },
      done: { status: "done", doneAt: 20 },
    },
  };
  assert.equal(evaluate(registry, state, "page:enter", {}), registry[2]);
});

test("a throwing when is ineligible without crashing evaluate", () => {
  const registry = validateRegistry([
    { id: "throws", trigger: "page:enter", priority: 10, when: () => { throw new Error("no"); }, content },
    { id: "fallback", trigger: "page:enter", when: (ctx) => ctx.ready, content },
  ]);
  assert.equal(evaluate(registry, emptyState(), "page:enter", { ready: true }), registry[1]);
  assert.equal(evaluate(registry, emptyState(), "page:enter", { ready: false }), null);
});

test("markShown is immutable, idempotent, and never regresses done", () => {
  const initial = emptyState();
  const shown = markShown(initial, "welcome", 100);
  assert.notEqual(shown, initial);
  assert.deepEqual(initial, { v: 1, tutorials: {} });
  assert.deepEqual(shown.tutorials.welcome, { status: "shown", shownAt: 100 });
  assert.equal(markShown(shown, "welcome", 200), shown);

  const done = markDone(shown, "welcome", 300);
  assert.equal(markShown(done, "welcome", 400), done);
  assert.deepEqual(done.tutorials.welcome, { status: "done", shownAt: 100, doneAt: 300 });
});

test("markDone preserves shownAt, creates missing records, and is idempotent", () => {
  const shown = markShown(emptyState(), "welcome", 100);
  const done = markDone(shown, "welcome", 200);
  assert.notEqual(done, shown);
  assert.deepEqual(done.tutorials.welcome, { status: "done", shownAt: 100, doneAt: 200 });
  assert.equal(markDone(done, "welcome", 300), done);

  assert.deepEqual(markDone(emptyState(), "direct", 400).tutorials.direct, { status: "done", doneAt: 400 });
});

test("normalizeState rejects malformed and wrong-version data but passes valid state through", () => {
  assert.deepEqual(normalizeState(null), emptyState());
  assert.deepEqual(normalizeState({ v: 1, tutorials: [] }), emptyState());
  assert.deepEqual(normalizeState({ v: 2, tutorials: {} }), emptyState());
  assert.deepEqual(normalizeState({ v: 1, tutorials: { broken: null } }), emptyState());

  const valid = { v: 1, tutorials: { welcome: { status: "shown", shownAt: 100 } } };
  assert.equal(normalizeState(valid), valid);
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(valid))), valid);
});

test("storageKey namespaces tutorial state by household", () => {
  assert.equal(STORAGE_PREFIX, "pm.tutorial.state.");
  assert.equal(storageKey("wright,keemin"), "pm.tutorial.state.wright,keemin");
  assert.notEqual(storageKey("wright"), storageKey("keemin"));
});
