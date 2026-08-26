// cockpit-harness.mjs — a static server for qa-shots/cockpit-harness.html.
//
//   node qa-shots/cockpit-harness.mjs [port]
//
// Serves the worktree root so `/src/lib/*.mjs` import as modules, and falls back
// to `public/` so `/birthday/darko-token.png` resolves the way Astro's dev server
// resolves it. Nothing is built and nothing is bundled: the browser loads the
// same source files node --test loads, which is what makes a shot of this page
// evidence about the shipped module rather than about a copy of it.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.argv[2] ?? 4318);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".css": "text/css; charset=utf-8",
};

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
  const body = (await tryRead(join(ROOT, target))) ?? (await tryRead(join(ROOT, "public", target)));
  if (!body) { res.writeHead(404, { "content-type": "text/plain" }).end("not here: " + target); return; }
  res.writeHead(200, { "content-type": TYPES[extname(target)] ?? "application/octet-stream", "cache-control": "no-store" });
  res.end(body);
}).listen(PORT, () => console.log(`harness on http://127.0.0.1:${PORT}/qa-shots/cockpit-harness.html`));
