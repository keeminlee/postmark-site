// cockpit-harness.mjs — a static server for qa-shots/cockpit-harness.html.
//
//   node qa-shots/cockpit-harness.mjs [port]
//
// Serves the worktree root so `/src/lib/*.mjs` import as modules, and falls back
// to the town build's publicDir so `/birthday/darko-token.png` resolves the way
// the built site resolves it. That directory is `public/atelier/postmark`, NOT
// `public` — astro.config.town.mjs sets it, and a harness that served plain
// `public/` would have shown a picture the built site does not have. Nothing here
// is bundled: the browser loads the same source files node --test loads, which is
// what makes a shot of this page evidence about the shipped module rather than
// about a copy of it.

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.argv[2] ?? 4318);
// Read from the config rather than written down here, so the harness cannot drift
// away from what the build actually serves.
const PUBLIC_DIR = publicDirFromConfig();

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".css": "text/css; charset=utf-8",
};

function publicDirFromConfig() {
  const src = readFileSync(join(ROOT, "astro.config.town.mjs"), "utf8");
  const m = /publicDir:\s*['"]([^'"]+)['"]/.exec(src);
  if (!m) throw new Error("astro.config.town.mjs no longer states a publicDir — the harness cannot guess it");
  return m[1];
}

async function tryRead(p) {
  try {
    const s = await stat(p);
    if (!s.isFile()) return null;
    return await readFile(p);
  } catch { return null; }
}

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  if (path.includes("..")) { res.writeHead(400).end("no"); return; }
  const target = path || "qa-shots/cockpit-harness.html";
  const body = (await tryRead(join(ROOT, target))) ?? (await tryRead(join(ROOT, PUBLIC_DIR, target)));
  if (!body) { res.writeHead(404, { "content-type": "text/plain" }).end("not here: " + target); return; }
  res.writeHead(200, { "content-type": TYPES[extname(target)] ?? "application/octet-stream", "cache-control": "no-store" });
  res.end(body);
}).listen(PORT, () => console.log(`harness on http://127.0.0.1:${PORT}/qa-shots/cockpit-harness.html`));
