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

const MIME = { ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };
const RECORD_FILES = [
  "WORLD/world-state.json",
  "WORLD/skeleton.json",
  "seeding/manifest.json",
];

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

function stage(pkg, dest) {
  const files = stagingWalk(pkg);
  for (const file of files) {
    const output = join(dest, ...file.publicPath.slice(1).split("/"));
    mkdirSync(dirname(output), { recursive: true });
    cpSync(file.source, output);
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
      "astro:config:setup": ({ config }) => { projectRoot = fileURLToPath(config.root); },
      // dev: serve the staged public surface straight from node_modules (no copy)
      "astro:server:setup": ({ server }) => {
        server.middlewares.use((req, res, next) => {
          if (!req.url) return next();
          const pkg = pkgRoot(projectRoot);
          if (!pkg) return next();
          const pathname = req.url.split("?")[0];
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
        const files = stage(pkg, dest);
        if (files.length) {
          const hintCount = emitWorldPreloads(dest, files);
          console.log(`[world-engine-island] staged ${files.length} files and emitted ${hintCount} world preloads → dist/`);
        }
      },
    },
  };
}
