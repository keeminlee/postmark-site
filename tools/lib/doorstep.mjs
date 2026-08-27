export const WAITING_CROSSING_STATUS = "merged, waiting for the crossing — next: Ferry.";

/**
 * THE TWO CLOCKS, AT THE ARRIVALS LIST.
 *
 * The town reader merges every resident's inbox/ AND outbox/ into one letters
 * corpus (tools/lib/town.mjs: "After ferry delivery the file MOVES from sender
 * outbox to recipient inbox, so inbox is the settled home; outbox holds mail
 * awaiting the next ferry"). The doorstep then filters that corpus by recipient
 * — which means a letter merged an hour ago and still sitting in the SENDER's
 * outbox, with no ferry between it and you, has been appearing under
 * "Arrived lately" indistinguishably from mail that actually landed.
 *
 * The office already answers this correctly and says so in its own words
 * (src/queries.mjs, the doorstep bundle's `clocks` field, Keemin-ruled
 * 2026-08-10 as disclose-don't-reconcile):
 *
 *   "delivered means the mail-ledger says so; a reply merged but not yet
 *    crossed shows as reply_queued — publication is not arrival, and neither
 *    clock wears the other's noun."
 *
 * This is that sentence applied to the static page's arrivals list: PUBLICATION
 * IS NOT ARRIVAL. The ledger decides, because the ledger is the town's own
 * record of what the ferry carried.
 *
 * @param {Array} letters   letters addressed to this resident, newest first
 * @param {Array} deliveries the ledger's delivery entries ({ kind, id, ... })
 * @returns {{ arrived: Array, onTheWater: Array }}
 */
export const ON_THE_WATER_LABEL = "on the water, not here yet";

export function splitArrivals(letters, deliveries) {
  const landed = new Set();
  for (const e of deliveries ?? []) if (e?.kind === "delivery" && e.id) landed.add(e.id);

  // THE GUARD, and it is the whole difference between a disclosure and a
  // catastrophe. If the ledger could not be read — missing file, a parse that
  // yielded nothing (tools/lib/town.mjs pushes exactly that problem) — then
  // EVERY letter is "not in the delivery set" and every doorstep in town would
  // announce that none of its mail has arrived. So an empty ledger is not
  // evidence; it is the absence of evidence, and the fallback is the other real
  // signal on disk: which mailbox the file is sitting in. Two independent
  // observations of the same fact, and neither is a guess.
  const isLanded = landed.size
    ? (l) => landed.has(l?.id)
    : (l) => l?.box !== "outbox";

  const arrived = [];
  const onTheWater = [];
  for (const l of letters ?? []) (isLanded(l) ? arrived : onTheWater).push(l);
  return { arrived, onTheWater };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The doorstep's plain-text excerpt of a body: the first block that actually
 * says something, markdown stripped, cut to `max`.
 *
 * A HEADING IS NOT AN EXCERPT, and that is the whole reason this lives here
 * with a test around it rather than as a closure inside `extract-town.mjs`.
 * The punctuation strip removes `#` alongside `*_>` and the rest, which turned
 * a posting's own title into an ordinary line long enough to pass the
 * salutation filter — so any bulletin notice whose frontmatter carried no
 * `teaser:` was summarised by its own title, on every doorstep in town:
 *
 *   **Art on your marks — and the shelf now takes SVG** (2026-08-20 · guidance)
 *   — Art on your marks ✦ — and the shelf now takes SVG
 *
 * The card on /bulletin/ read correctly the entire time, because the site's
 * `teaserOf` skips headings. Two readers of one text with different
 * vocabularies; this is the rule the doorstep's reader was missing. Headings
 * are matched on the RAW block, before the `#` that identifies one is stripped.
 */
export function excerptOf(text, max = 200) {
  if (!text) return "";
  const paras = text.split(/\r?\n\s*\r?\n/)
    .filter((p) => !/^\s*#{1,6}\s/.test(p))
    .map((p) =>
      p.replace(/[#>*_`]|\!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/\s+/g, " ").trim()
    ).filter(Boolean);
  // letters open with a salutation line ("Wright —"); skip short openers so the
  // excerpt carries the letter's first real sentence
  const first = paras.find((p) => p.length >= 30) ?? paras[0] ?? "";
  return first.length > max ? first.slice(0, max - 1).trimEnd() + "…" : first;
}

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
