// serve.mjs — the smallest static server that serves an Astro dist-town the way
// the box's nginx does: /path -> /path/index.html, no compression (so the byte
// counts the payload probe reports are the bytes on the wire before any
// transport encoding, which is the number the ceiling is measured against).
// Usage: node harness/serve.mjs --root <dist-town> --port 4321
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync, readFileSync } from "node:fs";
import { join, extname, normalize } from "node:path";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const ROOT = arg("--root");
const PORT = Number(arg("--port", "4321"));
if (!ROOT) { console.error("need --root"); process.exit(2); }

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".mp3": "audio/mpeg", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
};

// THE OFFICE DOOR STUB, and why the dev branch cannot be measured without one.
// `wright/atlas-dev-fold-site` reads the world from the office API and refuses
// the staged git photograph by design (src/lib/world-api-rail.mjs: "this page
// reads the office API and only that"). A static server alone gives that branch
// a blank map and a named 503 — which measures the absence of an office, not the
// site. So --api-state / --api-skeleton answer /api/world/state and
// /api/world/skeleton with the same fold bytes the build staged, which is the
// contract record-sources.mjs describes (the office answers with the record).
// These bytes are read from disk once and held, so the door does not add its own
// I/O to the page's clock.
const API_ROUTES = new Map();
for (const [flag, route] of [["--api-state", "/api/world/state"], ["--api-skeleton", "/api/world/skeleton"]]) {
  const f = arg(flag, null);
  if (f && existsSync(f)) API_ROUTES.set(route, readFileSync(f));
}

createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (API_ROUTES.has(url)) {
    const body = API_ROUTES.get(url);
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "content-length": String(body.length),
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    });
    res.end(body);
    return;
  }
  const safe = normalize(url).split(/[\\/]+/).filter((s) => s && s !== "." && s !== "..").join("/");
  let p = join(ROOT, safe);
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!existsSync(p)) {
    const alt = p.endsWith(".html") ? p : p + ".html";
    if (existsSync(alt)) p = alt;
    else { res.writeHead(404, { "content-type": "text/plain" }); res.end("404 " + url); return; }
  }
  const size = statSync(p).size;
  res.writeHead(200, {
    "content-type": TYPES[extname(p).toLowerCase()] ?? "application/octet-stream",
    "content-length": String(size),
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  createReadStream(p).pipe(res);
}).listen(PORT, "127.0.0.1", () => console.log(`serving ${ROOT} on http://127.0.0.1:${PORT}`));
