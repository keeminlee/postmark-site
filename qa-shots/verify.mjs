// Does the replay actually replay? Three claims, each probed so it could fail.
//
//  1. The map is the world AS IT STOOD, not today's world with old dots on it.
//     Receipt: the page must fetch WORLD/world-state.json from raw.githubusercontent
//     pinned to that crossing's own `as_of_world` commit — and two different
//     crossings must produce two different shas AND different mark counts.
//  2. The replay cannot write. Receipt: a POST at the office is refused by the
//     lens, not merely absent from the UI.
//  3. The viewer's own crossing readout agrees with the page's.
import { createRequire } from "node:module";
const require = createRequire("G:/Wright-HQ/package.json");
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:4321";
const browser = await chromium.launch();
const fails = [];
const check = (ok, label, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
  if (!ok) fails.push(label);
};

async function frame(n) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const raw = [];
  let foldMarks = null;
  page.on("request", (r) => { if (r.url().includes("raw.githubusercontent.com")) raw.push(r.url()); });
  // the fold the viewer actually received, counted off the wire rather than
  // inferred from what happened to be inside the viewport
  page.on("response", async (res) => {
    if (!res.url().includes("raw.githubusercontent.com/") || !res.url().endsWith("/WORLD/world-state.json")) return;
    try { foldMarks = (await res.json()).marks?.length ?? null; } catch { /* not fatal */ }
  });
  await page.goto(`${BASE}/replay/#${n}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.locator(".wv-tour-skip").first().click({ timeout: 3000 }).catch(() => {});
  // Measure only once the map has actually painted. The earlier version slept a
  // fixed 2.5 s and caught one crossing mid-render, reporting 0 walkers — which
  // reads exactly like a broken frame instead of a hasty probe.
  await page.waitForFunction(() => document.querySelectorAll(".wv-walker-hit").length > 0, null, { timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(800);
  const seen = await page.evaluate(() => ({
    // the page's own claim
    when: document.querySelector("[data-when]")?.textContent?.trim(),
    sha: document.querySelector("[data-provenance]")?.textContent?.match(/commit ([0-9a-f]{8})/)?.[1],
    // the viewer's own claim, read off the caption it paints for a spectator
    caption: document.querySelector(".wv-crossline, .wv-telling")?.textContent?.match(/crossing\s*(\d+)\s*·?\s*([a-z-]*)/i)?.slice(1).join(" ")
      || (document.body.textContent.match(/crossing\s+(\d+)\s*·\s*(live|time-travelling)/i) || []).slice(1).join(" "),
    // The discriminator between two folds. Counting overlay children proves
    // nothing — they are viewport-culled, so both crossings render the same 15
    // and an equal count reads as "the map never changed" when it did. The pips
    // carry their mark id, so the honest question is whether a mark that exists
    // in one fold and not the other is DRAWN in one frame and not the other:
    // `alden/the-fox-hearth` was founded between crossing 120 and 126.
    pips: document.querySelectorAll("#wv-overlay > *").length,
    marksDrawn: document.querySelectorAll("[data-id]").length,
    hasFoxHearth: !!document.querySelector('[data-id="alden/the-fox-hearth"]'),
    walkers: document.querySelectorAll(".wv-walker-hit").length,
    // acts must be off: the spectator path, not a hidden button
    actButtons: document.querySelectorAll(".wv-act-confirm:not([disabled])").length,
  }));
  const stateUrl = raw.find((u) => u.endsWith("/WORLD/world-state.json"));
  return { page, seen, stateUrl, foldMarks, rawCount: raw.length };
}

const a = await frame(120);
const b = await frame(126);

console.log("120:", JSON.stringify(a.seen), "\n     raw:", a.stateUrl);
console.log("126:", JSON.stringify(b.seen), "\n     raw:", b.stateUrl);

check(!!a.stateUrl && !!b.stateUrl, "each crossing fetches a pinned historical world-state");
check(a.stateUrl !== b.stateUrl, "two crossings read two DIFFERENT world commits",
  `${a.stateUrl?.split("/")[5]?.slice(0, 8)} vs ${b.stateUrl?.split("/")[5]?.slice(0, 8)}`);
check(b.seen.hasFoxHearth && !a.seen.hasFoxHearth,
  "a mark founded between the two crossings is drawn in the later frame ONLY",
  `alden/the-fox-hearth — 120:${a.seen.hasFoxHearth} 126:${b.seen.hasFoxHearth}`);
// The two folds must be genuinely different worlds, counted off the wire. (The
// tempting symmetric check — a mark present at 120 and gone by 126 — is not
// available: every mark unique to 120 is `kind: predicated` with no coordinates,
// so it is undrawable by construction and asserting on it would fail forever
// while proving nothing.)
check(a.foldMarks && b.foldMarks && a.foldMarks !== b.foldMarks,
  "the two crossings load genuinely different folds",
  `${a.foldMarks} marks at 120 vs ${b.foldMarks} at 126`);
check(a.seen.walkers > 0 && b.seen.walkers > 0, "walkers are drawn from the frozen snapshot",
  `${a.seen.walkers} vs ${b.seen.walkers}`);
check(/120/.test(a.seen.caption || "") && /126/.test(b.seen.caption || ""),
  "the viewer's own caption names the crossing being replayed, not the live one",
  `caption reads "${a.seen.caption}" / "${b.seen.caption}"`);
check(a.seen.actButtons === 0 && b.seen.actButtons === 0, "no live act control is enabled");

// the write refusal, exercised rather than asserted
const refused = await a.page.evaluate(async () => {
  const r = await fetch("/api/world/say", { method: "POST", body: JSON.stringify({ text: "probe" }) });
  return { status: r.status, body: await r.text() };
});
check(refused.status === 403, "a write at the office is REFUSED from a past frame", `HTTP ${refused.status} ${refused.body.slice(0, 60)}`);

// and the control: the same shim must not break ordinary GETs
const getOk = await a.page.evaluate(async () => (await fetch("/world-engine/replay/index.json")).status);
check(getOk === 200, "ordinary GETs still pass through the lens", `HTTP ${getOk}`);

await browser.close();
console.log("\n" + (fails.length ? `${fails.length} FAILED: ${fails.join("; ")}` : "all checks passed"));
process.exit(fails.length ? 1 : 0);
