// tutorial.mjs — the pure state machine behind Postmark's client-side
// tutorial bubbles. Content and browser wiring live elsewhere; this module
// only validates the registry, chooses one event match, and advances the
// per-household no-replay record.

export const STORAGE_PREFIX = "pm.tutorial.state.";

export function storageKey(household) {
  return STORAGE_PREFIX + household;
}

export function validateRegistry(entries) {
  const seen = new Set();
  for (const entry of entries) {
    const id = entry?.id;
    const offender = typeof id === "string" && id ? id : "<missing>";
    if (typeof id !== "string" || id.trim() === "") throw new Error("tutorial " + offender + ": missing id");
    if (typeof entry.trigger !== "string" || entry.trigger.trim() === "") throw new Error("tutorial " + id + ": missing trigger");
    if (seen.has(id)) throw new Error("tutorial " + id + ": duplicate id");
    if (entry.when !== undefined && typeof entry.when !== "function") throw new Error("tutorial " + id + ": when must be a function");
    if (entry.priority !== undefined && !Number.isFinite(entry.priority)) throw new Error("tutorial " + id + ": priority must be a finite number");
    seen.add(id);
  }
  return entries;
}

export function emptyState() {
  return { v: 1, tutorials: {} };
}

export function normalizeState(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyState();
  if (raw.v !== 1 || !raw.tutorials || typeof raw.tutorials !== "object" || Array.isArray(raw.tutorials)) return emptyState();
  for (const record of Object.values(raw.tutorials)) {
    if (!record || typeof record !== "object" || Array.isArray(record)) return emptyState();
    if (record.status !== "shown" && record.status !== "done") return emptyState();
  }
  return raw;
}

export function evaluate(registry, state, eventName, ctx) {
  const tutorials = state?.tutorials || {};
  let winner = null;
  let winnerPriority = -Infinity;
  for (const entry of registry) {
    if (entry.trigger !== eventName || Object.prototype.hasOwnProperty.call(tutorials, entry.id)) continue;
    if (entry.when) {
      try {
        if (!entry.when(ctx)) continue;
      } catch {
        continue;
      }
    }
    const priority = entry.priority ?? 0;
    if (winner === null || priority > winnerPriority) {
      winner = entry;
      winnerPriority = priority;
    }
  }
  return winner;
}

export function markShown(state, id, now) {
  const tutorials = state?.tutorials || {};
  if (Object.prototype.hasOwnProperty.call(tutorials, id)) return state;
  return {
    ...state,
    v: 1,
    tutorials: { ...tutorials, [id]: { status: "shown", shownAt: now } },
  };
}

export function markDone(state, id, now) {
  const tutorials = state?.tutorials || {};
  const record = Object.prototype.hasOwnProperty.call(tutorials, id) ? tutorials[id] : null;
  if (record?.status === "done") return state;
  return {
    ...state,
    v: 1,
    tutorials: {
      ...tutorials,
      [id]: { ...(record || {}), status: "done", doneAt: now },
    },
  };
}
