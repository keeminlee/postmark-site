// picture-door.test.mjs — the site's picture button lands at the office route.
//
// The ruling, quoted: "the SITE's upload buttons … are repointed to that office
// route, so the site is a human path to the MCP" (Keemin, 2026-09-09). The
// falsifier: the button's request lands at the office route — a fixture server
// that records what arrived — and what it carries is the household apex's own
// envelope (`do: "upload"`), never a second grammar.
//
//   node --test test/picture-door.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { pictureUploadRequest, readUploadAnswer, sendPicture } from "../src/lib/picture-door.mjs";

const PAGE = readFileSync(new URL("../town/components/Household.astro", import.meta.url), "utf8");

test("THE WIRING — the button lives on the HOME door, in the prose door's own pattern, and sends through the lib (no second request shape on the page)", () => {
  assert.match(PAGE, /import \{ sendPicture \} from "@\/lib\/picture-door\.mjs"/, "the page imports the one door");
  assert.match(PAGE, /if \(kind === "home"\) \{\s*\n\s*const pic = document\.createElement\("div"\);/, "the button is built only for the home door");
  assert.match(PAGE, /sendPicture\(fetch, \{ officeBase: OFFICE_BASE, token: tok\.access_token, handle, image: btoa\(bin\) \}\)/, "and it sends through the lib, to the office base the prose door uses");
  assert.doesNotMatch(PAGE, /\/media"|\/media'|"\/household"/, "the page never spells the office's media path itself — the lib owns the route");
  assert.match(PAGE, /1\.5 \* 1024 \* 1024/, "the door's cap is checked before the bytes travel");
});

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const URL_ON_WALL = "https://media.postmark.town/media/testers/aaaabbbbccccddddeeeeffff0000111122223333444455556666777788889999.png";

// A fixture office: records every request, answers like the household apex.
function fixtureOffice(answer) {
  const seen = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      seen.push({ method: req.method, path: req.url, headers: req.headers, body });
      const a = typeof answer === "function" ? answer(seen.length) : answer;
      res.writeHead(a.status, { "content-type": "application/json" });
      res.end(JSON.stringify(a.body));
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ seen, base: `http://127.0.0.1:${server.address().port}/api`, close: () => new Promise((r) => server.close(r)) })));
}

test("the request IS the household apex's envelope: POST <office>/household, do: upload, the picture in args, the key as Bearer", () => {
  const { url, init } = pictureUploadRequest({ officeBase: "https://postmark.town/api/", token: "tok-1", handle: "wright", image: PNG });
  assert.equal(url, "https://postmark.town/api/household", "the office route, trailing slash trimmed");
  assert.equal(init.method, "POST");
  assert.equal(init.headers.authorization, "Bearer tok-1");
  assert.deepEqual(JSON.parse(init.body), { do: "upload", args: { image: PNG, by: "wright" } }, "the apex's own grammar — no second door, no second envelope");
  assert.throws(() => pictureUploadRequest({ officeBase: "/api", token: "", image: PNG }), /sign in/, "no key, no request");
  assert.throws(() => pictureUploadRequest({ officeBase: "/api", token: "t", image: "" }), /no picture/);
});

test("THE FALSIFIER — the button's request lands at the office route, recorded by a fixture server, and the answer's URL is read back", async () => {
  const office = await fixtureOffice({ status: 200, body: { did: "upload", dispatched_to: "upload_media", result: { url: URL_ON_WALL, bytes: 68, type: "image/png", sha: "aaaa", quota: { used: 68, ceiling: 20971520 } } } });
  try {
    const got = await sendPicture(fetch, { officeBase: office.base, token: "tok-2", handle: "wright", image: PNG });
    assert.equal(office.seen.length, 1, "exactly one request reached the office");
    const [req] = office.seen;
    assert.equal(req.method, "POST");
    assert.equal(req.path, "/api/household", "the household apex route");
    assert.equal(req.headers.authorization, "Bearer tok-2");
    assert.equal(req.headers["content-type"], "application/json");
    assert.deepEqual(JSON.parse(req.body), { do: "upload", args: { image: PNG, by: "wright" } });
    assert.equal(got.ok, true);
    assert.equal(got.url, URL_ON_WALL, "the permanent media URL, read from result.url");
    assert.match(got.next, /leave-mark/, "and the one act that hangs it is named");
  } finally { await office.close(); }
});

test("a refusal is read back BY NAME — the office's defect and hint, never a bare status", async () => {
  const office = await fixtureOffice({ status: 413, body: { error: "bounce", code: 413, defect: "mark is larger than 1.5 MB", hint: "shrink it" } });
  try {
    const got = await sendPicture(fetch, { officeBase: office.base, token: "tok-3", handle: "wright", image: PNG });
    assert.equal(got.ok, false);
    assert.equal(got.url, null);
    assert.match(got.line, /larger than 1\.5 MB — shrink it/);
  } finally { await office.close(); }
  assert.match(readUploadAnswer(500, {}).line, /the office said no \(500\)/, "a body-less failure still says the status");
  const twice = readUploadAnswer(200, { result: { url: URL_ON_WALL, already: true } });
  assert.equal(twice.already, true);
  assert.match(twice.line, /already on your wall/);
});
