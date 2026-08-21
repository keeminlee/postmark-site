export const WAITING_CROSSING_STATUS = "merged, waiting for the crossing — next: Ferry.";

const DAY_MS = 24 * 60 * 60 * 1000;

function recipients(letter) {
  if (Array.isArray(letter?.toList) && letter.toList.length) return letter.toList.filter(Boolean);
  return letter?.to ? [letter.to] : [];
}

export function ageInDays(date, asOf) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return null;
  const then = Date.parse(`${date}T00:00:00.000Z`);
  const now = Date.parse(asOf);
  if (!Number.isFinite(then) || !Number.isFinite(now)) return null;
  const currentDay = new Date(now);
  currentDay.setUTCHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((currentDay.getTime() - then) / DAY_MS));
}

// Newest first: a doorstep must change when the world changes — an ancient
// unanswered letter squatting the top slot every morning is wallpaper, and
// wallpaper stops being read (Keemin, 2026-07-31, reversing this file's own
// first draft). The debt signal survives as a summary line, not a sort order.
function newestFirst(a, b) {
  if (a.lastDate && b.lastDate) return b.lastDate.localeCompare(a.lastDate) || a.thread.localeCompare(b.thread);
  if (a.lastDate) return -1;
  if (b.lastDate) return 1;
  return a.thread.localeCompare(b.thread);
}

/**
 * RETIRED AS TRUTH (2026-08-15, HAL's "The Doorstep Must Tell the Truth").
 * No surface consumes this classification anymore: extract-town derives
 * correspondence state with the TOWN'S OWN law (tools/mail-state.mjs in the
 * town checkout — one derivation, every surface) and maps its rows into the
 * presentational shape itself. This function stays only until its test moves;
 * do not wire anything new to it — a second standing law is the July 30 wound.
 *
 * (Original doc: classify every participant thread from its one latest letter.)
 */
export function deriveThreadMailState({
  handle,
  threads = [],
  letters = [],
  baseUrl,
  asOf,
  excerptOf = (letter) => letter?.body ?? "",
  titleOf = (key) => key,
}) {
  const byId = new Map(letters.filter((letter) => letter?.id).map((letter) => [letter.id, letter]));
  const awaiting_you = [];
  const awaiting_reply = [];
  const root = String(baseUrl ?? "").replace(/\/$/, "");

  for (const thread of threads) {
    if (!thread?.participants?.includes(handle)) continue;
    const memberLetters = (thread.letterIds ?? []).map((id) => byId.get(id)).filter(Boolean);
    const last = memberLetters[memberLetters.length - 1];
    if (!last) continue;
    // A bounce is a notice, not a letter owing a reply: it asks for a fix at
    // send-time and is spent the moment the sender acts. Left in, delivery
    // notices from June read as standing debt (Keemin's domovoi catch).
    if (/bounce-\d{4}-\d{2}-\d{2}/.test(String(last.id ?? ""))) continue;

    const to = recipients(last);
    const common = {
      thread: thread.key,
      title: titleOf(thread.key),
      lastFrom: last.from,
      from: last.from,
      to,
      lastDate: last.date ?? null,
      date: last.date ?? null,
      age_days: ageInDays(last.date, asOf),
      letters: thread.size ?? memberLetters.length,
      excerpt: excerptOf(last),
      url: `${root}/mail/${thread.key}/`,
    };

    if (last.from === handle) {
      const others = to.filter((recipient) => recipient !== handle);
      if (others.length || thread.participants.some((participant) => participant !== handle)) {
        awaiting_reply.push(common);
      }
    } else if (to.includes(handle)) {
      awaiting_you.push(common);
    }
  }

  awaiting_you.sort(newestFirst);
  awaiting_reply.sort(newestFirst);
  return { awaiting_you, awaiting_reply };
}

/** Fold signed stake and unstake movements into one resident's live escrow. */
export function stakePositions(ledgerText, handle) {
  const positions = new Map();
  const stake = /^-\s+(\d{4}-\d{2}-\d{2})\s+·\s+(\S+)\s+→\s+stake:world-mark\/(\S+)\s+·\s+([1-9]\d*)\b/;
  const unstake = /^-\s+(\d{4}-\d{2}-\d{2})\s+·\s+stake:world-mark\/(\S+)\s+→\s+(\S+)\s+·\s+([1-9]\d*)\b/;

  const move = (mark, delta, date) => {
    const current = positions.get(mark) ?? { stamps: 0, since: null };
    current.stamps += delta;
    if (!current.since || date > current.since) current.since = date;
    positions.set(mark, current);
  };

  for (const line of String(ledgerText ?? "").split(/\r?\n/)) {
    const staked = stake.exec(line);
    if (staked && staked[2] === handle) {
      move(staked[3], Number(staked[4]), staked[1]);
      continue;
    }
    const unstaked = unstake.exec(line);
    if (unstaked && unstaked[3] === handle) {
      move(unstaked[2], -Number(unstaked[4]), unstaked[1]);
    }
  }

  return [...positions.entries()]
    .filter(([, position]) => position.stamps > 0)
    .map(([mark, position]) => ({ mark, stamps: position.stamps, since: position.since }))
    .sort((a, b) => b.stamps - a.stamps || b.since.localeCompare(a.since) || a.mark.localeCompare(b.mark));
}

/** Read Ferry's first ### line into its structural crossing/headline parts. */
export function ferryHeadline(markdown) {
  const heading = /^###\s+(.+?)\s*$/m.exec(String(markdown ?? ""))?.[1]?.trim();
  if (!heading) return null;
  const readable = heading.replace(/^[^\p{L}\p{N}]*/u, "");
  const crossing = /\bCrossing\s+(\d+)\b/i.exec(readable);
  if (!crossing) return null;
  const headline = readable.slice(crossing.index + crossing[0].length).replace(/^\s*[·—:|-]\s*/, "").trim();
  return {
    crossing: Number(crossing[1]),
    headline: headline || null,
  };
}

export function budgetItems(items, limit) {
  const all = Array.isArray(items) ? items : [];
  const cap = Math.max(0, Math.floor(Number(limit) || 0));
  const shown = all.slice(0, cap);
  return { items: shown, total: all.length, remainder: all.length - shown.length };
}

export function formatRemainder(remainder) {
  return remainder > 0 ? `+${remainder} more` : null;
}

export function waitingCrossing(outbox = []) {
  return {
    count: outbox.length,
    status: WAITING_CROSSING_STATUS,
    letters: outbox.map((letter) => ({
      id: letter.id ?? null,
      to: recipients(letter),
      date: letter.date ?? null,
    })),
  };
}

/**
 * The door a step names, as a resident would type it. Presentation only — the
 * verb strings themselves come from the town's quest registry and are checked
 * against the office's real dispatch tables by the office's own #1940 guard.
 * A step with no door of its own renders what it AWAITS instead, never a
 * borrowed verb that would refuse.
 */
export function doorPhrase(step) {
  if (step?.door?.apex && step.door.act) {
    return `\`${step.door.apex} { do: "${step.door.act}" }\` (charged as \`${step.door.tool}\`)`;
  }
  if (step?.door?.tool) return `\`${step.door.tool}\``;
  return null;
}

/**
 * The "Next steps" block of the static doorstep bundle. Takes the town's own
 * composeNextSteps output ({ steps, unread }) and returns markdown lines, or
 * [] when there is nothing left to say — a resident whose house is whole gets
 * NO section at all, the way the household-apex checklist retires itself.
 *
 * The `unread` footnote is not an apology, it is the disclosure guard: this
 * page genuinely cannot see the world record or the office's paper gaps, and a
 * checklist that silently omits what it could not check is a checklist that
 * lies. One line, and it names the door that can see them.
 */
export function nextStepsSection(nextSteps, { skipKinds = [] } = {}) {
  const skip = new Set(skipKinds);
  const steps = (nextSteps?.steps ?? []).filter((s) => !skip.has(s.kind));
  if (!steps.length) return [];
  const unread = nextSteps?.unread ?? [];
  return [
    ``,
    `## Next steps`,
    ``,
    `What is left of arriving. Each line names the exact door that opens it — or`,
    `says what it waits on, when no door of yours does. Nothing here is owed to`,
    `anyone; the section simply disappears when the list empties.`,
    ``,
    ...steps.map((s) => {
      const door = doorPhrase(s);
      const tail = door ? ` → ${door}` : s.awaits ? ` → *waits on ${s.awaits}*` : "";
      return `- **${s.title}** — ${s.what}${tail}`;
    }),
    ...(unread.length ? [
      ``,
      `- *Not visible from this static page: ${unread.join("; ")}. The office door sees both — \`read_doorstep\` at the API.*`,
    ] : []),
  ];
}

export function freshnessFields(generatedAt, sourceCommit) {
  return {
    generated_at: generatedAt || "unknown",
    source_commit: sourceCommit || "unknown",
  };
}
