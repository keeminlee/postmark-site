// world-preload.mjs — WHICH of the staged world files the /world/ page tells the
// browser to fetch before anyone asks for it.
//
// ── WHAT WENT WRONG ────────────────────────────────────────────────────────
//
// `town/scripts/world-engine-island.mjs` hinted the staging walk: a
// `modulepreload` for every `.mjs` it staged and a `preload as=fetch` for every
// `.json`, plus `/atlas/town.html` appended by hand. Staging and hinting are
// not the same question, and answering the second with the first cost every
// reader about 2.2 MB per load of bytes nothing in the page ever read.
// Measured on prod 2026-09-15 and again on this pin 2026-09-16:
//
//   • 54 modules were modulepreloaded; the viewer's static import closure is 13.
//     The other 41 (0.68 MB) are engine tools the browser never imports — a
//     settlement sweep, a coordinate migration, a seed generator.
//   • `/WORLD/world-state.json` (0.93 MB) was preloaded, and the viewer reads
//     the fold from the OFFICE first (`/api/world/state`), so the preloaded URL
//     is never the URL requested.
//   • `/atlas/town.html` (0.45 MB) was preloaded, and the viewer draws the
//     ground from `/atlas/ground.html` (0.06 MB) — a different file.
//   • `/WORLD/settlement-publications.json` (0.07 MB) was preloaded and NO
//     reader in either repo fetches it; it is staged as a published-URL floor.
//   • `/WORLD/skeleton.json` was preloaded and is read office-first too.
//
// The browser said all of this out loud on every load — four "preloaded using
// link preload but not used" warnings — for as long as the hints existed.
//
// ── THE CHANNEL ────────────────────────────────────────────────────────────
//
// A preload pays only when the browser goes on to ask for THAT URL, early. So
// the hint list is derived from the code that does the asking, exactly as
// `world-staging.mjs` derives the staging list from the code that does the
// reading — and for the same reason: a hand list is kept in step by nobody, and
// this file's own directory has been bitten twice by one (`mark-class.mjs`
// 404'd in prod 2026-07-28; `WORLD/walk-ledger.md` 404'd for weeks).
//
//   MODULES — the viewer's static import closure, walked from the entry modules
//   the town's own pages and the served spectator shell name. A module the
//   browser will not import is not hinted; a module it WILL import and that the
//   build did not stage is a hard failure rather than a 404 at import time.
//
//   RECORDS — a same-origin path is hinted when the readers ask THIS ORIGIN for
//   it first. A record the viewer asks an office for before falling back here
//   (`recordSources(path, { office })`) is never hinted: the fallback leg is the
//   one that would use the preload, and it is the leg that does not run.
//
// Pure and I/O-free: every seam that touches a disk is injected, so the hint
// list can be falsified without standing up a build.

/**
 * Source text with its comments removed.
 *
 * NOT `world-staging.mjs`'s `stripComments`, and the difference is load-bearing:
 * that one removes `/* … *\/` FIRST, so a `/*` written inside a LINE comment
 * opens a block that runs to the next `*\/` anywhere below. The served viewer
 * has exactly that — a header line reading "`/WORLD/*` off disk" — and it
 * swallows the next 66 lines, which is every `import` the file has. A walk that
 * used it found a closure of one.
 *
 * Line comments go first here, so a `/*` inside one is gone before any block
 * can open. The `://` exception is kept: a `//` after a colon is a URL scheme,
 * and half the comments in both repos discuss URLs.
 */
export function withoutComments(source) {
  return String(source ?? "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
}

/** The public root the world package's modules are served under. */
export const ENGINE_ROOT = "/world-engine";

/** A served engine module as source code writes one: quoted and absolute. */
const MODULE_LITERAL = new RegExp(`["'](${ENGINE_ROOT}/[A-Za-z0-9._\\-/]+\\.mjs)["']`, "g");

/** A same-origin path as source code writes one, any extension. */
const SAME_ORIGIN_LITERAL = /["'](\/[A-Za-z0-9._\-/]+\.[A-Za-z0-9]+)["']/g;

/**
 * A `recordSources("/some/record", …)` call and the rest of its statement, so
 * an `office:` leg in the SAME call can be seen. The window ends at the first
 * `;` — one statement, never the next reader's.
 */
const RECORD_SOURCES_CALL = /recordSources\(\s*["'](\/[A-Za-z0-9._\-/]+)["']([^;]{0,240})/g;

/** A static `import`/`export … from "…"`, including the side-effect form. */
const IMPORT_SPECIFIER = /(?:^|[\s;}])(?:import|export)\s+(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/g;

/**
 * Every served engine module the given sources name as an entry — the modules a
 * browser is told to import by a page of this town or by the spectator shell
 * this town serves verbatim.
 *
 * `sources` is `[{ name, text }]`, the same shape `world-staging.mjs` takes, so
 * a failure can say which file named the module.
 */
export function moduleEntryPaths(sources) {
  const found = new Map();
  for (const { name, text } of sources ?? []) {
    for (const match of withoutComments(text).matchAll(MODULE_LITERAL)) {
      if (!found.has(match[1])) found.set(match[1], new Set());
      found.get(match[1]).add(name);
    }
  }
  return [...found.entries()]
    .map(([path, names]) => ({ path, namedBy: [...names].sort() }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Resolve a relative specifier against a served module's public path.
 * Returns null for a bare specifier — the browser cannot resolve one of those
 * from a URL, so it is not part of any closure this page can preload.
 */
function resolveSpecifier(fromPublicPath, specifier) {
  if (!specifier.startsWith(".")) return null;
  const segments = fromPublicPath.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") { segments.pop(); continue; }
    segments.push(part);
  }
  return segments.join("/");
}

/**
 * The transitive static-import closure of `entries`, as public paths.
 *
 * `readModule(publicPath)` is the one seam that touches a file — it returns the
 * module's source text, or null when this build staged no such module.
 *
 * Dynamic `import()` is deliberately NOT walked: the browser resolves it when
 * the code runs, long after the head's hints have paid or not, so hinting it
 * would be a guess rather than a closure. None exists today.
 */
export function importClosure({ entries, readModule }) {
  const closure = new Set();
  const unstaged = [];
  const queue = [...(entries ?? [])];
  while (queue.length) {
    const publicPath = queue.shift();
    if (closure.has(publicPath)) continue;
    closure.add(publicPath);
    const text = readModule(publicPath);
    if (text == null) { unstaged.push(publicPath); continue; }
    for (const match of withoutComments(text).matchAll(IMPORT_SPECIFIER)) {
      const resolved = resolveSpecifier(publicPath, match[1]);
      if (resolved && !closure.has(resolved)) queue.push(resolved);
    }
  }
  return { closure: [...closure].sort(), unstaged: unstaged.sort() };
}

/**
 * Every record path the readers ask an OFFICE for before they ask this origin.
 *
 * These can never spend a preload: the same-origin URL is the fallback leg, and
 * the fallback leg runs only when the office refused — which is the load where
 * a warmed cache is the least of anyone's problems.
 */
export function officeFirstRecords(sources) {
  const found = new Set();
  for (const { text } of sources ?? []) {
    for (const match of withoutComments(text).matchAll(RECORD_SOURCES_CALL)) {
      if (/\boffice\b/.test(match[2])) found.add(match[1]);
    }
  }
  return [...found].sort();
}

/**
 * Every same-origin RECORD the readers ask THIS ORIGIN for, office-first reads
 * removed. The set a staged file must be in to earn a fetch preload.
 *
 * Modules are excluded by construction: a `.mjs` is imported, not fetched, and
 * `as="fetch"` is the wrong destination for one — the browser would warm a cache
 * entry the module loader never looks in and fetch the file a second time.
 */
export function sameOriginDemands(sources) {
  const officeFirst = new Set(officeFirstRecords(sources));
  const found = new Map();
  for (const { name, text } of sources ?? []) {
    for (const match of withoutComments(text).matchAll(SAME_ORIGIN_LITERAL)) {
      const path = match[1];
      if (path.endsWith(".mjs") || path.endsWith(".js")) continue;
      if (officeFirst.has(path)) continue;
      if (!found.has(path)) found.set(path, new Set());
      found.get(path).add(name);
    }
  }
  return [...found.entries()]
    .map(([path, names]) => ({ path, askedBy: [...names].sort() }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** The one sentence a build throws when a module the browser will import was not staged. */
export function unstagedModuleFailure(unstaged) {
  return new Error(
    `[world-engine-island] the viewer imports ${unstaged.length} module(s) this build did not stage:\n`
    + unstaged.map((path) => `  • ${path}`).join("\n")
    + `\n  The browser would resolve that import against this origin and get a 404, with a green build behind it.`
    + ` That is the mark-class.mjs failure of 2026-07-28; it is a hard failure now.`);
}

/** The one sentence a build throws when no page names an engine module to import. */
export function noEntryFailure() {
  return new Error(
    `[world-engine-island] no page of this town, and no served spectator shell, names a module under ${ENGINE_ROOT}/ to import.`
    + ` The world page would emit with an empty preload chain and the viewer would have no entry at all.`);
}

/**
 * THE HINT CHAIN, as tags, in emitted order: the closure's modules in staging
 * order, then the records this origin is asked for in staging order.
 *
 * `files` is the staging walk's own output (`[{ publicPath }]`), so a file that
 * was not staged is never hinted and the emitted order follows the staged order.
 */
export function preloadTags({ files, modules, records }) {
  const inModules = new Set(modules ?? []);
  const inRecords = new Set(records ?? []);
  const staged = files ?? [];
  return [
    ...staged.filter((file) => inModules.has(file.publicPath))
      .map((file) => `<link rel="modulepreload" href="${file.publicPath}">`),
    ...staged.filter((file) => inRecords.has(file.publicPath))
      .map((file) => `<link rel="preload" as="fetch" href="${file.publicPath}" crossorigin>`),
  ];
}
