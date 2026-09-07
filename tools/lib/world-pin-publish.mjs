// world-pin-publish.mjs — the one line the office cannot derive for itself.
//
// ── WHY THIS EXISTS (Lane A finding A8, 2026-09-07) ─────────────────────────
//
// The world focus's receipt carries `site_pin`, and it is `null` and cannot be
// anything else today: the office holds no clone of `postmark-site` and no
// record of which `postmark-world` it is pinned to. Lane A's own words:
//
//   "the question it answers is real — 'the world says my mark is published;
//    why does the site not show it?' is a resident question, and it is
//    unanswerable without that sha. But it is the site's to publish."
//
// So the site publishes it, at a path it already builds and already serves
// (`postmark.town/data/pin.json`, beside the manifest), and the office reads it
// the way it reads `panes.postmark.town/windows.json` — a fetch, no coupling,
// honest about its own staleness.
//
// ── TWO CLOCKS, DISCLOSED, NEVER RECONCILED ─────────────────────────────────
//
// `package.json`'s dependency spec is what the repo ASKS for; the installed
// package is what the build actually COMPILED against, and on a rebuild lane
// `resolve-world-pin.mjs` moves the first before the install. They agree in the
// ordinary case and this file does not average them when they do not: it names
// both and says they differ, which is the same discipline the build stamp uses
// for its two shas and the pot board uses for its two dollar figures. A single
// number here could not even express the failure it exists to catch.

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The `#<sha>` a `github:owner/repo#sha` spec pins, or null for anything else. */
export function shaFromSpec(spec) {
  const m = /^github:[^#]+#([0-9a-f]{7,40})$/i.exec(String(spec ?? "").trim());
  return m ? m[1].toLowerCase() : null;
}

/**
 * What this site is pinned to, and what it was actually built against.
 *
 * Every read is guarded independently: a site that cannot read its own
 * node_modules still publishes the spec, and a site that can read neither
 * publishes nulls with a note. An absent pin is a real state — it says the
 * office cannot answer the resident's question from here — and it must never
 * be dressed up as a sha.
 */
export function worldPin({ root = ".", readJson = (p) => JSON.parse(readFileSync(p, "utf8")), builtAt = new Date().toISOString() } = {}) {
  const notes = [];
  let spec = null, pinned = null;
  try {
    const pkg = readJson(join(root, "package.json"));
    spec = pkg?.dependencies?.["postmark-world"] ?? pkg?.devDependencies?.["postmark-world"] ?? null;
    pinned = shaFromSpec(spec);
    if (spec && !pinned) notes.push(`the postmark-world dependency is "${spec}", which names no sha — this site is pinned to a moving target`);
  } catch (e) { notes.push(`package.json could not be read (${String(e?.message ?? e).slice(0, 120)})`); }

  // THREE STATES, NOT TWO, and the falsifier below holds them apart: the
  // package is absent, or it is present and records which commit it came from,
  // or it is present and records nothing. The third is the ORDINARY case here —
  // npm's git installs drop `_resolved`/`gitHead` on reinstall — and the first
  // draft of this file reported it as "could not be read", which is the same
  // false-negative this whole lane is about, committed by the fix for it.
  let installed = null;
  try {
    const dep = readJson(join(root, "node_modules", "postmark-world", "package.json"));
    installed = shaFromSpec(dep?._resolved ?? "") ?? (typeof dep?.gitHead === "string" ? dep.gitHead.toLowerCase() : null);
    if (!installed) notes.push("the installed postmark-world records no commit of its own (npm drops _resolved/gitHead on a git install), so `world_pin` is what this repo asks for rather than proof of what was compiled");
  } catch { notes.push("the installed postmark-world could not be read at all — `world_pin` is what this repo asks for, not proof of what was compiled"); }

  if (pinned && installed && pinned !== installed)
    notes.push(`the spec asks for ${pinned.slice(0, 12)} and the installed copy is ${installed.slice(0, 12)} — the build compiled against the installed one`);

  return {
    what: "the postmark-world this site is pinned to. The office cannot derive this — it holds no clone of the site — so the site says it, and a reader comparing this against the world's own head can tell a stale site from a stale world.",
    world_pin: pinned,
    world_installed: installed,
    world_spec: spec,
    built_at: builtAt,
    ...(notes.length ? { notes } : {}),
  };
}
