// world-api-rail.test.mjs — the falsifiers for the world page's one data source.
//
// THE CONSTRAINT THESE ASSERT (Keemin, 2026-09-09, verbatim): "I'll trust that
// the site ingests just the MCP and API instead of Git. That's the one hard
// constraint that I need."
//
// The pair that matters most: the same-origin git photograph of the world MUST
// be refused, and the office door MUST pass — a rail that lets both through is
// yesterday's page with a sentence on it.
import assert from "node:assert/strict";
import test from "node:test";
import { railDecision, officeAnswer, railReceipt, OFFICE_SERVED, NO_OFFICE_DOOR, WORLD_RAW_HOST } from "../src/lib/world-api-rail.mjs";

test("the git photograph of the world is REFUSED on the living page, and the refusal names the office door", () => {
  for (const [record, office] of Object.entries(OFFICE_SERVED)) {
    const d = railDecision(record);
    assert.equal(d.kind, "refuse", `${record} must be refused`);
    assert.equal(d.status, 503);
    assert.equal(d.office, office);
    assert.match(d.body.defect, /nothing is drawn from a git photograph/);
    assert.match(d.body.hint, new RegExp(office.replace(/[/]/g, "\\/")));
  }
});

test("the office doors PASS, and are marked as the doors to report on", () => {
  for (const office of Object.values(OFFICE_SERVED)) {
    const d = railDecision(office);
    assert.equal(d.kind, "office");
    assert.equal(d.door, office);
  }
});

test("a record with no office door is refused and its absence is NAMED, not filled from git", () => {
  for (const record of Object.keys(NO_OFFICE_DOOR)) {
    const d = railDecision(record);
    assert.equal(d.kind, "refuse");
    assert.equal(d.office, null);
    assert.match(d.body.defect, /no office door serves it/);
    assert.equal(d.body.hint, NO_OFFICE_DOOR[record]);
  }
});

test("the world repo's raw tip on github is REFUSED too — the pinned viewer walks there when a same-origin record is refused (measured 2026-09-09)", () => {
  for (const p of ["/keeminlee/postmark-world/main/seeding/manifest.json", "/keeminlee/postmark-world/main/WORLD/world-state.json", "/keeminlee/postmark-world/main/WORLD/walk-ledger.md"]) {
    const d = railDecision({ sameOrigin: false, host: WORLD_RAW_HOST, pathname: p });
    assert.equal(d.kind, "refuse", p);
    assert.match(d.body.defect, /tags only, never main tip/);
  }
  // other hosts, and other repos on that host, are not the rail's business
  assert.deepEqual(railDecision({ sameOrigin: false, host: "media.postmark.town", pathname: "/media/x/y.png" }), { kind: "pass" });
  assert.deepEqual(railDecision({ sameOrigin: false, host: WORLD_RAW_HOST, pathname: "/someone-else/repo/main/x.json" }), { kind: "pass" });
  // and armed, the replay lens reads its pinned sha there on purpose
  assert.deepEqual(railDecision({ sameOrigin: false, host: WORLD_RAW_HOST, pathname: "/keeminlee/postmark-world/3199a6fe/WORLD/world-state.json" }, { armed: true }), { kind: "pass" });
});

test("everything else passes untouched — the rail governs three records, not the page", () => {
  for (const p of ["/api/world/walkers", "/WORLD/walk-ledger.md", "/world-engine/spectator/viewer.mjs", "/api/ops/whoami", "/", "/residents/wright/"]) {
    assert.deepEqual(railDecision(p), { kind: "pass" }, p);
  }
});

test("the replay lens (a past crossing, armed by navigation) passes through — that photograph is on purpose", () => {
  for (const record of [...Object.keys(OFFICE_SERVED), ...Object.keys(NO_OFFICE_DOOR)]) {
    assert.deepEqual(railDecision(record, { armed: true }), { kind: "pass" }, record);
  }
});

test("when the office failed first, the refusal carries the office's own status", () => {
  const d = railDecision("/WORLD/world-state.json", { officeFailure: { door: "/api/world/state", status: 502 } });
  assert.equal(d.kind, "refuse");
  assert.match(d.body.defect, /\/api\/world\/state → 502/);
});

test("the receipt reads the office's answer — its own as-of headers and its own counts", () => {
  const a = officeAnswer("/api/world/state", {
    ok: true, status: 200,
    headers: { "x-postmark-as-of": "23a78bafeba8197f7b063472ff1938013b324b3a", "x-postmark-world-store-as-of": "787f42cdbe6cfb5d8a687d04c30378d114b2a031" },
    json: { marks: [
      { id: "a/b", kind: "parcel", image: "https://media.postmark.town/media/x/y.png" },
      { id: "a/c", kind: "parcel" },
      { id: "a/d", kind: "sited", image: "https://media.postmark.town/media/x/z.png" },
      { id: "a/e", kind: "sited" },
    ] },
  });
  assert.equal(a.marks, 4); assert.equal(a.imaged, 2); assert.equal(a.parcels, 2); assert.equal(a.parcelsImaged, 1);
  const r = railReceipt({ answers: [a] });
  assert.equal(r.ok, true);
  assert.equal(r.text, "world from the office API /api/world/state · town as-of 23a78baf · world store as-of 787f42cd · 4 marks · 2 with an image · 1 of 2 parcels with one · nothing from git");
});

test("when the office does not answer, the receipt says so and says no older world is drawn — never a silent fallback", () => {
  const a = officeAnswer("/api/world/state", { ok: false, status: 502 });
  const r = railReceipt({ answers: [a], refused: ["/WORLD/world-state.json"] });
  assert.equal(r.ok, false);
  assert.match(r.text, /the office API did not answer — \/api\/world\/state → 502/);
  assert.match(r.text, /no older world is drawn from a git photograph/);
  assert.match(r.text, /\/WORLD\/world-state\.json refused — no git fallback/);
});

test("the page does not PRELOAD what the rail refuses — the browser never downloads the photograph either", async () => {
  const { worldPreloadPaths } = await import("../town/scripts/world-engine-island.mjs");
  const files = [
    { publicPath: "/world-engine/spectator/viewer.mjs" },
    { publicPath: "/WORLD/world-state.json" },
    { publicPath: "/WORLD/skeleton.json" },
    { publicPath: "/seeding/manifest.json" },
    { publicPath: "/WORLD/settlement-publications.json" },
    { publicPath: "/world-engine/residents-meta.json" },
  ];
  const { modulePaths, fetchPaths } = worldPreloadPaths(files);
  assert.deepEqual(modulePaths, ["/world-engine/spectator/viewer.mjs"]);
  for (const refused of [...Object.keys(OFFICE_SERVED), ...Object.keys(NO_OFFICE_DOOR)])
    assert.ok(!fetchPaths.includes(refused), `${refused} must not be preloaded`);
  // and the records the rail does not govern are still hinted, exactly as before
  assert.ok(fetchPaths.includes("/WORLD/settlement-publications.json"));
  assert.ok(fetchPaths.includes("/world-engine/residents-meta.json"));
  assert.ok(fetchPaths.includes("/atlas/town.html"));
});

test("the receipt with nothing answered yet still names the rule", () => {
  const r = railReceipt({});
  assert.equal(r.ok, false);
  assert.match(r.text, /has not answered/);
  assert.match(r.text, /office API only/);
});
