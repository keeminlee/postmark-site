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
// If the postmark-world pin lacks spectator/viewer.mjs (pre-bump), the copy warns
// and skips — the page still builds; the island viewer just won't load until the
// dependency is bumped (Wright's step).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { houseName } from "../../src/lib/houses.mjs";
import { REPLAY_DIR, replayFiles } from "./replay-record.mjs";

const META_PATH = "/world-engine/residents-meta.json";

const MIME = { ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };
const RECORD_FILES = [
  "WORLD/world-state.json",
  "WORLD/skeleton.json",
  "seeding/manifest.json",
  // which marks the keeper has blessed — the viewer reads it to say what has
  // been published, and it is staged like any other record file
  "WORLD/settlement-publications.json",
  // the crossings — occupancy (who is inside what) derives from this
  // client-side, exactly as position derives from the walk ledger
  "WORLD/threshold-ledger.md",
  // the walks. MISSING FROM THIS LIST UNTIL 2026-08-26, and the cost was not
  // a blank panel: the viewer answers a 404 here by fetching the world repo's
  // raw main tip, so `https://postmark.town/WORLD/walk-ledger.md` returned 404
  // in production and every departure the town displayed was read from
  // UNBLESSED MAIN — the one source the release lane's world-pin guardrail
  // exists to keep out ("tags only, never main tip", founder-ruled 2026-08-25,
  // WORLD-PIN.md § The three guardrails).
  "WORLD/walk-ledger.md",
];

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

// One walk defines both surfaces: what the build copies and what dev may serve.
// Public paths deliberately match the viewer's existing same-origin-first fetches.
function stagingWalk(pkg) {
  const viewer = join(pkg, "spectator", "viewer.mjs");
  if (!existsSync(viewer)) {
    console.warn("[world-engine-island] postmark-world has no spectator/viewer.mjs — island viewer will not load until the dependency pin is bumped.");
    return [];
  }
  const files = [
    { source: viewer, publicPath: "/world-engine/spectator/viewer.mjs" },
  ];
  // Every non-test engine module — a NAMED list here was the drift: a new module
  // the viewer imports (mark-class.mjs, 2026-07-28) 404'd in prod while dev,
  // serving straight from node_modules, never noticed. The browser only imports
  // what the viewer references; staging the rest is inert public source.
  for (const f of readdirSync(join(pkg, "tools")).filter((f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs")))
    files.push({ source: join(pkg, "tools", f), publicPath: `/world-engine/tools/${f}` });
  for (const rel of RECORD_FILES) {
    const source = join(pkg, ...rel.split("/"));
    if (existsSync(source)) files.push({ source, publicPath: `/${rel}` });
    else console.warn(`[world-engine-island] postmark-world has no ${rel} — viewer fallback remains active.`);
  }
  return files;
}

function stage(pkg, dest, projectRoot) {
  const files = stagingWalk(pkg);
  for (const file of files) {
    const output = join(dest, ...file.publicPath.slice(1).split("/"));
    mkdirSync(dirname(output), { recursive: true });
    cpSync(file.source, output);
  }
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
          const file = stagingWalk(pkg).find((entry) => entry.publicPath === pathname);
          if (!file) return next();
          res.setHeader("content-type", MIME[extname(file.source)] ?? "application/octet-stream");
          res.end(readFileSync(file.source));
        });
      },
      // build: copy into the emitted output so the same paths are served statically
      "astro:build:done": ({ dir }) => {
        const pkg = pkgRoot(projectRoot);
        if (!pkg) { console.warn("[world-engine-island] postmark-world not installed — skipping island stage."); return; }
        const dest = fileURLToPath(dir);
        const files = stage(pkg, dest, projectRoot);
        if (files.length) {
          const hintCount = emitWorldPreloads(dest, files);
          console.log(`[world-engine-island] staged ${files.length} files and emitted ${hintCount} world preloads → dist/`);
        }
      },
    },
  };
}
