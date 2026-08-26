import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { apiGet, buildOfficeData, jsonText } from "../tools/lib/fetch-town-data.mjs";

function writeJson(dir, name, value) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), jsonText(value));
}

/**
 * A fixture office, in two flavours.
 *
 *   fixtureFetch()               an office WITH the bulk letter door: /letters
 *                                honours full=1 and answers rows with bodies.
 *   fixtureFetch({ door: false }) an office WITHOUT it: the pre-2026-08-25
 *                                office, which IGNORES an unknown `full` param
 *                                — REST drops what it does not know — and
 *                                answers excerpts with no `body` key at all.
 *
 * The second flavour is the one that matters and the one easy to get wrong: an
 * old office does NOT 404 the new call, it answers it with the wrong shape. A
 * fixture that 404'd would exercise the error path and leave the real
 * capability detection — no bodies, therefore no door — completely untested.
 */
function fixtureFetch({ door = true, stamp = null } = {}) {
  const fullLetters = {
    "wright-2026-07-01-hello": {
      id: "wright-2026-07-01-hello",
      from: "wright",
      to: "rei",
      toList: ["rei"],
      date: "2026-07-01",
      thread: null,
      body: "Rei - hello",
      path: "WHITE_PAGES/rei/inbox/wright-2026-07-01-hello.md",
      box: "inbox",
      attachments: [],
      hasFrontmatter: true,
    },
    "rei-2026-07-02-reply": {
      id: "rei-2026-07-02-reply",
      from: "rei",
      to: "wright",
      toList: ["wright"],
      date: "2026-07-02",
      thread: "wright-2026-07-01-hello",
      body: "Wright - reply",
      path: "WHITE_PAGES/wright/inbox/rei-2026-07-02-reply.md",
      box: "inbox",
      attachments: [],
      hasFrontmatter: true,
    },
  };
  const residents = {
    rei: {
      handle: "rei",
      address: { data: { handle: "rei", agent: "Rei", github: "keeminlee", since: "2026-04-25" }, body: "Rei" },
      home: null,
      region: null,
      homeImages: [],
      inbox: [fullLetters["wright-2026-07-01-hello"]],
      outbox: [],
      is_office: false,
    },
    wright: {
      handle: "wright",
      address: { data: { handle: "wright", agent: "Wright", github: "keeminlee", since: "2026-05-07" }, body: "Wright" },
      home: { data: { title: "the Trueing-House" }, body: "home" },
      region: null,
      homeImages: ["WHITE_PAGES/wright/HOME/house.png"],
      inbox: [fullLetters["rei-2026-07-02-reply"]],
      outbox: [],
      is_office: false,
    },
  };
  // THE FRESHNESS STAMP (2026-08-25). `stamp: null` is the PRE-LADDER office —
  // it does not 404 the read, it answers the same card with no `freshness` key
  // at all, which is the shape an office one release behind actually has. Any
  // other value is spread onto every card.
  if (stamp) for (const r of Object.values(residents)) r.freshness = stamp;

  const routes = new Map([
    ["/town", { as_of: "abc123", counts: { residents: 2, letters: 2, threads: 1, ledger: 2, bulletin: 1 }, offices: [] }],
    ["/residents", [
      { handle: "rei", display: "Rei", github: "keeminlee", is_office: false },
      { handle: "wright", display: "Wright", github: "keeminlee", is_office: false },
    ]],
    ["/residents/rei", residents.rei],
    ["/residents/wright", residents.wright],
    ["/metrics/mail", {
      as_of: "2026-07-02",
      days: [{ date: "2026-07-01", deliveries: 1, bounces: 0 }, { date: "2026-07-02", deliveries: 1, bounces: 0 }],
      totals: { deliveries: 2, bounces: 0, letters: 2, threads: 1, residents: 2 },
      active_threads: 1,
    }],
    ["/bulletin", [{ slug: "settling-in", title: "settling-in", first_line: "# Settling in" }]],
    ["/bulletin/settling-in", { slug: "settling-in", data: { posted: "2026-07-02" }, body: "# Settling in", path: "TOWN_BULLETIN/settling-in.md" }],
    // Keyed on the bare path so ANY /letters?... query lands here — which is
    // exactly how an office treats a query param it does not know.
    ["/letters", door
      ? {
        total: 2, shown: 2, count: 2, limit: 200, offset: 0, complete: true, full: true,
        letters: [
          { ...fullLetters["rei-2026-07-02-reply"], first_line: "Wright -" },
          { ...fullLetters["wright-2026-07-01-hello"], first_line: "Rei -" },
        ],
      }
      : {
        count: 2, limit: 200, offset: 0,
        letters: [
          { id: "rei-2026-07-02-reply", from: "rei", to: "wright", date: "2026-07-02", thread: "wright-2026-07-01-hello", first_line: "Wright -" },
          { id: "wright-2026-07-01-hello", from: "wright", to: "rei", date: "2026-07-01", thread: null, first_line: "Rei -" },
        ],
      }],
    ["/letters/rei-2026-07-02-reply", fullLetters["rei-2026-07-02-reply"]],
    ["/letters/wright-2026-07-01-hello", fullLetters["wright-2026-07-01-hello"]],
  ]);

  return async (url) => {
    const u = new URL(url);
    const key = `${u.pathname}${u.search}`;
    const body = routes.get(key) ?? routes.get(u.pathname);
    if (!body) return { ok: false, status: 404, statusText: "Not Found", headers: { get: () => null }, json: async () => ({}) };
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: (name) => name.toLowerCase() === "x-postmark-as-of" ? "abc123" : null },
      json: async () => JSON.parse(JSON.stringify(body)),
    };
  };
}

function fixtureSnapshot() {
  const root = mkdtempSync(join(tmpdir(), "postmark-fetch-test-"));
  const data = join(root, "data");
  writeJson(data, "ledger.json", [
    { kind: "delivery", date: "2026-07-01", id: "wright-2026-07-01-hello", from: "wright", to: "rei", thread: null },
    { kind: "delivery", date: "2026-07-02", id: "rei-2026-07-02-reply", from: "rei", to: "wright", thread: "wright-2026-07-01-hello" },
  ]);
  writeJson(data, "docs.json", { README: { body: "snapshot docs", path: "README.md" } });
  writeJson(data, "meeps.json", [{ name: "snapshot-meep", skill: null, dailyCount: 0 }]);
  writeJson(data, "stats.json", { latestDate: "2026-07-01", latestDeliveries: [] });
  writeJson(data, "residents.json", [{ handle: "wright", profile: { bio: "snapshot profile" } }]);

  const town = join(root, "town");
  mkdirSync(join(town, "MEEPS", "ferry", "memory", "daily"), { recursive: true });
  mkdirSync(join(town, "MEEPS", "SKILLS"), { recursive: true });
  mkdirSync(join(town, "WHITE_PAGES", "wright"), { recursive: true });
  writeFileSync(join(town, "MEEPS", "ferry", "identity.md"), "# ferry\n");
  writeFileSync(join(town, "MEEPS", "ferry", "memory", "daily", "2026-07-02.md"), "# day\n");
  writeFileSync(join(town, "MEEPS", "SKILLS", "ferry-round.md"), "# skill\n");
  writeFileSync(join(town, "WHITE_PAGES", "wright", "PROFILE.md"), "---\ncolor: '#abc'\nbio: checkout profile\n---\n");
  return { data, town };
}

test("buildOfficeData maps public API payloads to site data files", async () => {
  const { data, town } = fixtureSnapshot();
  const result = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: fixtureFetch() });

  assert.equal(result.asOf, "abc123");
  assert.equal(result.files["letters.json"].length, 2);
  assert.deepEqual(result.files["letters.json"].map((l) => l.id), ["wright-2026-07-01-hello", "rei-2026-07-02-reply"]);
  assert.equal(result.files["threads.json"].length, 1);
  assert.equal(result.files["residents.json"].find((r) => r.handle === "wright").counts.received, 1);
  assert.equal(result.files["residents.json"].find((r) => r.handle === "wright").is_office, false);
  assert.deepEqual(result.files["residents.json"].find((r) => r.handle === "wright").profile, {
    color: "#aabbcc",
    bio: "checkout profile",
  });
  assert.equal(result.files["meeps.json"][0].name, "ferry");
  assert.equal(result.files["ledger.json"].length, 2);
  assert.match(result.endpointGaps.join("\n"), /ledger\.json preserved/);
});

// ── the dual-mode letter corpus (2026-08-25) ────────────────────────────────
//
// The office bounded the address card, which is where this file used to get
// every letter body. `fetchLetterCorpus` asks the office's new bulk door first
// and falls back to the cards when the office has not got one, so NEITHER
// REPO'S RELEASE ORDER CAN BREAK THE BUILD. These are the falsifiers for that,
// and the load-bearing one is the first: the two routes must produce the same
// town, or the fallback is not a fallback, it is a second answer.

test("THE CORPUS IS IDENTICAL through the door and through the cards", async () => {
  const a = fixtureSnapshot();
  const b = fixtureSnapshot();
  const withDoor = await buildOfficeData({ apiBase: "https://example.test", dataDir: a.data, townRoot: a.town, fetchImpl: fixtureFetch({ door: true }) });
  const without = await buildOfficeData({ apiBase: "https://example.test", dataDir: b.data, townRoot: b.town, fetchImpl: fixtureFetch({ door: false }) });

  assert.equal(jsonText(withDoor.files["letters.json"]), jsonText(without.files["letters.json"]),
    "THE FALSIFIER: a dual-mode read whose two modes disagree is not a fallback, it is a second answer");
  // and everything derived from the letters, because a corpus that matches
  // while its derivations drift would be the more dangerous half-failure
  assert.equal(jsonText(withDoor.files["threads.json"]), jsonText(without.files["threads.json"]));
  assert.equal(jsonText(withDoor.files["residents.json"]), jsonText(without.files["residents.json"]));
  assert.equal(jsonText(withDoor.files), jsonText(without.files), "every file the build writes, byte for byte");
});

test("the door is PREFERRED when it is there, and the build says which route it took", async () => {
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: fixtureFetch({ door: true }) });
  assert.match(r.endpointGaps.join("\n"), /built from the office's bulk letter door/);
  assert.doesNotMatch(r.endpointGaps.join("\n"), /built from the resident cards/,
    "THE FALSIFIER: a deploy that silently stopped preferring the door must be visible in the log, not only in a byte count");
  assert.deepEqual(r.problems, [], "taking the door is the ordinary case, not a problem");
});

test("an older office falls back to the cards, and that is recorded rather than silent", async () => {
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: fixtureFetch({ door: false }) });
  assert.equal(r.files["letters.json"].length, 2, "the build still produces the whole town");
  assert.match(r.endpointGaps.join("\n"), /built from the resident cards/);
  assert.match(r.endpointGaps.join("\n"), /pre-2026-08-25 office/);
  // An old office ANSWERS the new call with the wrong shape rather than
  // failing it, so this is a capability detection and not an error path.
  assert.deepEqual(r.problems, [], "an office without the door is a supported state, not a fault");
});

test("detection reads the KEY, not the value: an empty body is still a body", async () => {
  // mapLetter writes `l.body ?? ""`, so a letter with a genuinely empty body is
  // legal. `if (l.body)` would read that real door as an absent one and fall
  // back forever, on a town whose newest letter happened to be blank.
  const base = fixtureFetch({ door: true });
  const emptied = async (url) => {
    const res = await base(url);
    if (!new URL(url).pathname.startsWith("/letters") || new URL(url).pathname.length > 8) return res;
    const body = await res.json();
    return { ...res, json: async () => ({ ...body, letters: body.letters.map((l) => ({ ...l, body: "" })) }) };
  };
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: emptied });
  assert.match(r.endpointGaps.join("\n"), /built from the office's bulk letter door/,
    "THE FALSIFIER: swap Object.hasOwn for a truthiness check and this goes red");
  assert.equal(r.files["letters.json"].length, 2);
  assert.equal(r.files["letters.json"][0].body, "");
});

test("a MIXED page falls back rather than publishing a corpus missing letters nobody can name", async () => {
  const base = fixtureFetch({ door: true });
  const half = async (url) => {
    const res = await base(url);
    const u = new URL(url);
    if (!u.pathname.startsWith("/letters") || u.pathname.length > 8) return res;
    const body = await res.json();
    return { ...res, json: async () => ({ ...body, letters: body.letters.map((l, i) => {
      if (i === 0) return l;
      const { body: _drop, ...rest } = l;   // one row arrives without a body
      return rest;
    }) }) };
  };
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: half });
  assert.match(r.problems.join("\n"), /1 of 2 rows with bodies/);
  assert.match(r.endpointGaps.join("\n"), /built from the resident cards/);
  assert.equal(r.files["letters.json"].length, 2,
    "THE FALSIFIER: keeping only the rows that had bodies would publish a town silently short a letter");
  assert.ok(r.files["letters.json"].every((l) => typeof l.body === "string" && l.body.length > 0));
});

test("a door that ERRORS is a door that is not there — the build goes on and says why", async () => {
  const base = fixtureFetch({ door: true });
  const broken = async (url) => {
    const u = new URL(url);
    if (u.pathname === "/letters") throw new Error("connection reset");
    return base(url);
  };
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: broken, retries: 1 });
  assert.match(r.problems.join("\n"), /the bulk door did not answer/);
  assert.match(r.endpointGaps.join("\n"), /built from the resident cards/);
  assert.equal(r.files["letters.json"].length, 2, "the town still builds");
});

test("buildOfficeData preserves committed profiles when no checkout is supplied", async () => {
  const { data } = fixtureSnapshot();
  const result = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, fetchImpl: fixtureFetch() });
  assert.deepEqual(result.files["residents.json"].find((r) => r.handle === "wright").profile, { bio: "snapshot profile" });
  assert.match(result.endpointGaps.join("\n"), /profiles preserved from committed snapshot/);
});

test("buildOfficeData output is byte-stable for the same API state", async () => {
  const a = fixtureSnapshot();
  const b = fixtureSnapshot();
  const one = await buildOfficeData({ apiBase: "https://example.test", dataDir: a.data, townRoot: a.town, fetchImpl: fixtureFetch() });
  const two = await buildOfficeData({ apiBase: "https://example.test", dataDir: b.data, townRoot: b.town, fetchImpl: fixtureFetch() });
  assert.equal(jsonText(one.files), jsonText(two.files));
});

test("apiGet retries transient failures", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    if (calls < 3) throw new Error("temporary");
    return { ok: true, status: 200, statusText: "OK", headers: { get: () => "sha" }, json: async () => ({ ok: true }) };
  };
  const result = await apiGet("/town", { apiBase: "https://example.test/api", fetchImpl, retries: 3 });
  assert.deepEqual(result, { body: { ok: true }, asOf: "sha" });
  assert.equal(calls, 3);
});

test("fetch-town CLI keeps the committed snapshot when the API is down", () => {
  const result = spawnSync(process.execPath, ["tools/fetch-town.mjs"], {
    cwd: join(import.meta.dirname, ".."),
    env: { ...process.env, POSTMARK_API: "http://127.0.0.1:9" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /keeping committed data snapshot/);
});

// ── THE MUSHY MIDDLE, VERIFIED (2026-08-25) ────────────────────────────────
//
// The question this lane was asked to answer with receipts: does the extract
// pick up the office's composed reads automatically once the office serves
// them? These are that answer, made into something that can go red.
//
// It does, and the reason is one line up in this file rather than anything
// clever: `buildOfficeData` already fetches `/residents/<handle>` for every
// resident, which is EXACTLY the read the office composed. No endpoint changed.
// What was added is only that the build now SAYS how far behind the office's
// index was, because a build that pulled twelve residents out of a stale index
// and a build where nothing was stale produce identical files and different
// truths, and the second is an operational fact somebody should be able to see.

const SETTLED_STAMP = {
  tense: "settled", settled_as_of: "abc123",
  fields: {
    "address.body": { tense: "settled", act: "address-body" },
    "address.data": { tense: "settled", act: "address-fields" },
    home: { tense: "settled", act: "home" },
    profile: { tense: "settled", act: "profile" },
    window_state: { tense: "settled", act: "window" },
  },
};
const AHEAD_STAMP = {
  tense: "pending", settled_as_of: "abc123", settles_at: "the next ferry crossing (00:00 / 12:00 UTC)",
  fields: {
    ...SETTLED_STAMP.fields,
    "address.body": { tense: "written", act: "address-body", file: "WHITE_PAGES/x/ADDRESS.md" },
    window_state: { tense: "pending", act: "window", seq: 41 },
  },
};

test("E1 · the extract needs no endpoint change: the composed card IS the card it already fetched", async () => {
  const plain = fixtureSnapshot();
  const composed = fixtureSnapshot();
  const a = await buildOfficeData({ apiBase: "https://example.test", dataDir: plain.data, townRoot: plain.town, fetchImpl: fixtureFetch() });
  const b = await buildOfficeData({ apiBase: "https://example.test", dataDir: composed.data, townRoot: composed.town, fetchImpl: fixtureFetch({ stamp: SETTLED_STAMP }) });

  assert.equal(jsonText(a.files["residents.json"]), jsonText(b.files["residents.json"]),
    "an office that stamps and one that does not build the same residents.json from the same values — the stamp rides beside the data, never in it");
  assert.equal(jsonText(a.files), jsonText(b.files), "every file the build writes, byte for byte");
});

test("E2 · THE STAMP IS NOT BAKED: a static page carries its build's as_of, never the office's field tenses", async () => {
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: fixtureFetch({ stamp: AHEAD_STAMP }) });
  for (const resident of r.files["residents.json"])
    assert.equal(resident.freshness, undefined,
      "a field-level tense about the OFFICE's index, baked into a page, is a claim the reader has no way to act on — the live tense belongs to the live poll");
  assert.ok(r.asOf, "what a static page owes its reader is when IT was built, and that it still has");
});

test("E3 · a build that saved itself from a stale index SAYS SO, by name", async () => {
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: fixtureFetch({ stamp: AHEAD_STAMP }) });
  const gaps = r.endpointGaps.join("\n");
  assert.match(gaps, /composed ahead of the office index for 2 of 2 residents/);
  assert.match(gaps, /rei, wright/, "the residents are named — a count alone cannot be followed up");
  assert.match(gaps, /rehydrate tick was behind the record/);
});

test("E4 · a build where nothing was stale says THAT, and the two are not the same sentence", async () => {
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: fixtureFetch({ stamp: SETTLED_STAMP }) });
  const gaps = r.endpointGaps.join("\n");
  assert.match(gaps, /all settled across 2 residents/);
  assert.doesNotMatch(gaps, /composed ahead/,
    "THE FALSIFIER: one sentence for both states would make the log decoration rather than information");
});

test("E5 · an office one release behind is a NAMED state, not silence", async () => {
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: fixtureFetch({ stamp: null }) });
  const gaps = r.endpointGaps.join("\n");
  assert.match(gaps, /carry no freshness stamp: this office predates the ladder/,
    "the two repos ride their own trains; 'I cannot tell' must never read as 'nothing was stale'");
  assert.doesNotMatch(gaps, /all settled across/);
  assert.doesNotMatch(gaps, /composed ahead/);
});
