// world-engine-island — the ONE wiring that lets postmark.town serve the told-world
// viewer as a standalone island, from the SAME files a clone runs.
//
// The viewer (spectator/viewer.mjs) and the engine (tools/*.mjs) live in the
// postmark-world package — one source of truth. This integration makes them serve
// at `/world-engine/**` on the town, WITHOUT copying any engine source into this
// repo's tracked tree (no drift): it copies from node_modules into the BUILD OUTPUT
// (dist-town/world-engine/) at build, and serves them from node_modules via a dev
// middleware in `astro dev`. So world.astro can emit spectator/index.html verbatim
// and its `import "/world-engine/spectator/viewer.mjs"` resolves in both.
//
// A PIN THAT CANNOT SERVE THIS BUILD FAILS IT. Until 2026-08-26 a package with
// no spectator/viewer.mjs warned and skipped — the page built green and rendered
// nothing — and a record file the package did not carry warned too, which is how
// WORLD/walk-ledger.md 404'd in production for weeks while every build passed.
// Both are hard failures now; `tools/lib/world-staging.mjs` carries the reasons.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, extname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { houseName } from "../../src/lib/houses.mjs";
import { REPLAY_DIR, replayFiles } from "./replay-record.mjs";
import { recordsToStage, stagingComplaints, stagingFailure } from "../../tools/lib/world-staging.mjs";

const META_PATH = "/world-engine/residents-meta.json";

const MIME = { ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

// ── which record files get staged, and why it is no longer a list ───────────
//
// It WAS a list — five paths typed by hand, kept in step with the world package
// by nothing. `WORLD/walk-ledger.md` was not on it, `postmark.town/WORLD/walk-ledger.md`
// answered 404, and the viewer answers a 404 for a record by reading the world
// repo's raw MAIN TIP. So the town's departures were told from an unblessed
// branch while the release lane's guardrail said "tags only, never main tip"
// (founder-ruled 2026-08-25; WORLD-PIN.md § The three guardrails).
//
// The engine modules a dozen lines below had already been through this exact
// failure and were fixed by walking the package instead of naming its files.
// The records now have a channel too, and it is the honest one: a record is
// staged because some reader ASKS THIS ORIGIN FOR IT. The demand is read off the
// package's own viewer and off this repo's own pages, so a reader that starts
// fetching a new record causes it to be staged, with nobody to remember.
//
// Reading the sources is a few dozen small files once per build, next to a build
// that emits three thousand pages.
const SOURCE_DIRS = ["town", "src"];
const SOURCE_EXT = new Set([".mjs", ".js", ".astro", ".ts"]);

function readSources(dir, base, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) { readSources(abs, base, out); continue; }
    if (!SOURCE_EXT.has(extname(entry.name))) continue;
    out.push({ name: relative(base, abs).split(sep).join("/"), text: readFileSync(abs, "utf8") });
  }
  return out;
}

/** every reader whose same-origin record demands this build must satisfy */
function recordReaders(pkg, projectRoot) {
  const readers = [];
  const viewer = join(pkg, "spectator", "viewer.mjs");
  // the package's own viewer FIRST — it is the module both habitats run, and it
  // is its unmet demand that caused the leak
  if (existsSync(viewer)) readers.push({ name: "postmark-world/spectator/viewer.mjs", text: readFileSync(viewer, "utf8") });
  for (const dir of SOURCE_DIRS) {
    const abs = join(projectRoot, dir);
    if (existsSync(abs)) readSources(abs, projectRoot, readers);
  }
  return readers;
}

// ── the faces the viewer draws (2026-08-08) ─────────────────────────────────
//
// The walker dots became circles carrying each resident's avatar, so the viewer
// needs a handle → {name, avatar, color, household} map. It is built HERE, from
// this repo's own extracted data, and not asked of the office — the office's
// database carries no profile fields at all (hydrate never reads PROFILE.md),
// while residents.json and media.json already hold every name, colour, and
// RESOLVED avatar URL. Deriving it anywhere else would mean a second copy of the
// avatar-URL convention that this repo's media pipeline owns.
//
// Emitted as one small record file beside the engine, fetched same-origin by the
// viewer exactly like world-state.json. Build-time freshness, which is the same
// freshness as the world the map is drawn from.
function residentsMeta(projectRoot) {
  const read = (rel) => {
    try { return JSON.parse(readFileSync(join(projectRoot, "src", "data", "postmark", rel), "utf8")); }
    catch { return null; }
  };
  const residents = read("residents.json");
  if (!Array.isArray(residents)) return null;
  const media = read("media.json") ?? {};
  const registry = read("households.json") ?? {};
  // handle → the house's own name, so the card can say which house someone
  // keeps. houseName is this repo's one slug→name rule (src/lib/houses.mjs) —
  // imported rather than re-spelled, so "cadaeic.space" keeps its dot and
  // "the-rookery" reads as The Rookery here exactly as it does on every page.
  const houseOf = new Map();
  for (const [slug, dec] of Object.entries(registry.households ?? {}))
    for (const h of dec.residents ?? []) houseOf.set(h, houseName(slug));

  const out = {};
  for (const r of residents) {
    if (!r?.handle) continue;
    const avatarKey = r.profile?.avatar ? `WHITE_PAGES/${r.handle}/${r.profile.avatar}` : null;
    const entry = {
      name: r.address?.agent ?? r.handle,
      avatar: (avatarKey && media[avatarKey]?.card) || null,
      color: r.profile?.color ?? null,
      household: houseOf.get(r.handle) ?? null,
    };
    // a resident with nothing to add is not worth a row — the viewer's fallback
    // (monogram of the handle, town gold) is already the right answer for them
    if (entry.name !== r.handle || entry.avatar || entry.color || entry.household) out[r.handle] = entry;
  }
  return { generated: new Date().toISOString(), residents: out };
}

function pkgRoot(projectRoot) {
  const p = join(projectRoot, "node_modules", "postmark-world");
  return existsSync(p) ? p : null;
}

/** does the pinned package carry this file? the one seam the checks touch */
const packageHas = (pkg) => (rel) => existsSync(join(pkg, ...rel.split("/")));

// THE GATE. Called from the build hook, where a throw stops the release rather
// than scrolling past in a log. Everything it can complain about used to be a
// console.warn beside a green build.
function assertPackageCanServe(pkg, projectRoot) {
  const complaints = stagingComplaints({
    sources: recordReaders(pkg, projectRoot),
    exists: packageHas(pkg),
    // the records THIS build writes itself, off the door — the pin is not asked
    // to carry what it no longer supplies. Same set `stage()` writes, so a record
    // that stops being written stops being exempt.
    supplied: [...DOOR_RECORDS, PROVENANCE_PATH],
  });
  if (complaints.length) throw stagingFailure(complaints);
}

// One walk defines both surfaces: what the build copies and what dev may serve.
// Public paths deliberately match the viewer's own same-origin fetches, because
// they are now DERIVED from them.
function stagingWalk(pkg, projectRoot) {
  const viewer = join(pkg, "spectator", "viewer.mjs");
  // In a build this is unreachable — assertPackageCanServe has already thrown.
  // In `astro dev` it is the honest answer to a request for a file that is not
  // there: nothing to serve, and the browser's own 404 says so where a developer
  // is already looking.
  if (!existsSync(viewer)) return [];
  const files = [
    { source: viewer, publicPath: "/world-engine/spectator/viewer.mjs" },
  ];
  // Every non-test engine module — a NAMED list here was the drift: a new module
  // the viewer imports (mark-class.mjs, 2026-07-28) 404'd in prod while dev,
  // serving straight from node_modules, never noticed. The browser only imports
  // what the viewer references; staging the rest is inert public source.
  for (const f of readdirSync(join(pkg, "tools")).filter((f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs")))
    files.push({ source: join(pkg, "tools", f), publicPath: `/world-engine/tools/${f}` });
  // and every record some reader asks this origin for — derived, not listed
  for (const { record } of recordsToStage(recordReaders(pkg, projectRoot))) {
    const source = join(pkg, ...record.split("/"));
    if (existsSync(source)) files.push({ source, publicPath: `/${record}` });
  }
  return files;
}

// ── THE TWO RECORDS THAT NOW COME OFF THE DOOR ──────────────────────────────
//
// Gold plan §2 rules the bake a KILL: "the site queries the door (MCP-first law
// finally made structurally true)". `world-state.json` and `skeleton.json` were
// this integration's most load-bearing copies — a fold wrote them into the world
// repo, the pin froze a sha of that repo, and `cpSync` below carried the frozen
// bytes into the build. Freshness was therefore a pipeline with four moving
// parts and a sentinel watching it. They are now COMPOSED FROM THE DOOR
// (tools/world2-door.mjs) and written, exactly like the faces and the replay
// frames are written — the same public paths, the same bytes-shaped contract, so
// the viewer is untouched and does not know the difference.
//
// `walk-ledger.md` is deliberately NOT in this set and still comes off the pin:
// the door serves no LIVE-lane read at all, so there is nothing to point it at.
// Leaving it visibly baked is the honest state of the repoint — see the report.
const DOOR_RECORDS = new Set(["/WORLD/world-state.json", "/WORLD/skeleton.json"]);
const PROVENANCE_PATH = "/WORLD/door-provenance.json";

// One compose per process. In a build that is once; in `astro dev` it means the
// first request for either record pays and every reload after it is free.
let doorPromise = null;
function doorRecords() {
  if (doorPromise) return doorPromise;
  doorPromise = (async () => {
    const { doorWorldState, doorSkeleton, doorGaps, doorUrl } = await import("../../tools/world2-door.mjs");
    const [world, terrain] = [await doorWorldState(), await doorSkeleton()];
    const gaps = doorGaps();
    console.log(`[world-engine-island] the world page reads ${doorUrl()} — ` +
      `${world.provenance.counts.marks} marks, ${world.provenance.counts.parcels} parcels, law ${String(terrain.law_sha).slice(0, 8)}.`);
    // Never silent. Every field the door could not fill is named at build time,
    // where the person changing the door is looking.
    for (const g of gaps) console.warn(`[world-engine-island] DOOR GAP · ${g.field} — ${g.why}`);
    return {
      "/WORLD/world-state.json": JSON.stringify(world.state),
      "/WORLD/skeleton.json": JSON.stringify(terrain.skeleton),
      provenance: { ...world.provenance, gaps },
    };
  })();
  return doorPromise;
}

async function stage(pkg, dest, projectRoot) {
  const files = stagingWalk(pkg, projectRoot);
  const door = await doorRecords();
  for (const file of files) {
    if (DOOR_RECORDS.has(file.publicPath)) continue;   // written below, from the door
    const output = join(dest, ...file.publicPath.slice(1).split("/"));
    mkdirSync(dirname(output), { recursive: true });
    cpSync(file.source, output);
  }
  // Written whether or not the pin carries them: that the package still HAS a
  // baked world-state is now irrelevant to this build, which is the point.
  for (const publicPath of DOOR_RECORDS) {
    const output = join(dest, ...publicPath.slice(1).split("/"));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, door[publicPath]);
    if (!files.some((f) => f.publicPath === publicPath)) files.push({ source: null, publicPath });
  }
  // The record's own provenance, beside it — what door answered, when, at which
  // law sha, and what it could not answer. A reader of the built site can check
  // where the world came from without asking anyone.
  const provOut = join(dest, ...PROVENANCE_PATH.slice(1).split("/"));
  mkdirSync(dirname(provOut), { recursive: true });
  writeFileSync(provOut, JSON.stringify(door.provenance, null, 1));
  files.push({ source: null, publicPath: PROVENANCE_PATH });
  // the faces: derived, not copied, so it is written rather than staged. Absent
  // data means no file, and the viewer's own fallback (monograms) is already the
  // right answer — never a half-written map.
  const meta = residentsMeta(projectRoot);
  if (meta) {
    const output = join(dest, ...META_PATH.slice(1).split("/"));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify(meta));
    files.push({ source: null, publicPath: META_PATH });
  } else {
    console.warn("[world-engine-island] no residents.json — the map draws monograms rather than faces.");
  }
  // the replay's frames: derived from the package's own STATE record, same as the
  // faces above — written, not copied, because the jsonl is an engine-internal
  // format and staging it verbatim would freeze it into a public contract
  for (const file of replayFiles(pkg)) {
    const output = join(dest, ...file.publicPath.slice(1).split("/"));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, file.body);
    files.push({ source: null, publicPath: file.publicPath });
  }
  return files;
}

function emitWorldPreloads(dest, files) {
  const page = join(dest, "world", "index.html");
  if (!existsSync(page)) {
    console.warn("[world-engine-island] built world page missing — preload chain was not emitted.");
    return 0;
  }
  const modulePaths = files
    .filter((file) => extname(file.publicPath) === ".mjs")
    .map((file) => file.publicPath);
  const fetchPaths = [
    ...files.filter((file) => extname(file.publicPath) === ".json").map((file) => file.publicPath),
    "/atlas/town.html",
  ];
  const hints = [
    ...modulePaths.map((href) => `<link rel="modulepreload" href="${href}">`),
    ...fetchPaths.map((href) => `<link rel="preload" as="fetch" href="${href}" crossorigin>`),
  ].join("\n");
  const html = readFileSync(page, "utf8");
  if (!/<\/head>/i.test(html)) {
    console.warn("[world-engine-island] built world page has no </head> — preload chain was not emitted.");
    return 0;
  }
  writeFileSync(page, html.replace(/<\/head>/i, `${hints}\n</head>`));
  return modulePaths.length + fetchPaths.length;
}

export default function worldEngineIsland() {
  let projectRoot;
  return {
    name: "world-engine-island",
    hooks: {
      "astro:config:setup": ({ config, command, updateConfig }) => {
        projectRoot = fileURLToPath(config.root);
        // Windows cannot emit sibling /world and /WORLD directories. Astro's
        // static preview also matches URL case strictly, so proxy the public
        // uppercase record URL once to its on-disk page-directory neighbor.
        // Linux builds keep their genuinely distinct /WORLD directory.
        if (command === "preview" && process.platform === "win32") {
          updateConfig({
            vite: {
              preview: {
                proxy: {
                  "/WORLD": {
                    target: `http://127.0.0.1:${config.server.port}`,
                    rewrite: (path) => path.replace(/^\/WORLD/, "/world"),
                  },
                },
              },
            },
          });
        }
      },
      // dev: serve the staged public surface straight from node_modules (no copy)
      "astro:server:setup": ({ server }) => {
        server.middlewares.use((req, res, next) => {
          if (!req.url) return next();
          const pkg = pkgRoot(projectRoot);
          if (!pkg) return next();
          const pathname = req.url.split("?")[0];
          // the two records the door owns — composed once per dev server, then
          // answered from that compose, so a reload never re-pays the budget
          if (DOOR_RECORDS.has(pathname) || pathname === PROVENANCE_PATH) {
            return doorRecords().then((door) => {
              res.setHeader("content-type", MIME[".json"]);
              res.end(pathname === PROVENANCE_PATH
                ? JSON.stringify(door.provenance, null, 1)
                : door[pathname]);
            }, (e) => { res.statusCode = 503; res.end(String(e?.message ?? e)); });
          }
          // the derived one has no source file to read — it is computed per
          // request in dev so an edit to residents.json shows up on reload
          if (pathname === META_PATH) {
            const meta = residentsMeta(projectRoot);
            if (!meta) return next();
            res.setHeader("content-type", MIME[".json"]);
            return res.end(JSON.stringify(meta));
          }
          // the replay frames are derived too, so dev computes them per request —
          // a newly-saved crossing shows up on reload without a rebuild
          if (pathname.startsWith(`${REPLAY_DIR}/`)) {
            const file = replayFiles(pkg).find((entry) => entry.publicPath === pathname);
            if (!file) return next();
            res.setHeader("content-type", MIME[".json"]);
            return res.end(file.body);
          }
          const file = stagingWalk(pkg, projectRoot).find((entry) => entry.publicPath === pathname);
          if (!file) return next();
          res.setHeader("content-type", MIME[extname(file.source)] ?? "application/octet-stream");
          res.end(readFileSync(file.source));
        });
      },
      // build: copy into the emitted output so the same paths are served statically
      "astro:build:done": async ({ dir }) => {
        const pkg = pkgRoot(projectRoot);
        // NOT A SKIP. A build with no world package emits a world page whose
        // every module and record 404s — the widest version of the same hole the
        // gate below closes, and it used to print one line and exit 0.
        if (!pkg) throw stagingFailure(["postmark-world is not installed — run `npm ci` (the world page would emit with no engine and no record at all)."]);
        assertPackageCanServe(pkg, projectRoot);
        const dest = fileURLToPath(dir);
        const files = await stage(pkg, dest, projectRoot);
        if (files.length) {
          const hintCount = emitWorldPreloads(dest, files);
          console.log(`[world-engine-island] staged ${files.length} files and emitted ${hintCount} world preloads → dist/`);
        }
      },
    },
  };
}
