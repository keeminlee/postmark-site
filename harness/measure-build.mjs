// measure-build.mjs — build one site tree and measure what it emits.
// Usage: node harness/measure-build.mjs --tree <path> --label <name> --out <json>
// Emits: wall ms, emitted file count, total bytes, ten largest files,
// the doorstep static row-file bytes, per-route page counts.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const TREE = arg("--tree");
const LABEL = arg("--label", "unlabeled");
const OUT = arg("--out", null);
if (!TREE) { console.error("need --tree"); process.exit(2); }

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.isFile()) acc.push({ path: p, bytes: statSync(p).size });
  }
  return acc;
}

const t0 = Date.now();
const r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
  cwd: TREE, encoding: "utf8", shell: process.platform === "win32",
  env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=8192" },
});
const wall_ms = Date.now() - t0;

const dist = join(TREE, "dist-town");
const ok = r.status === 0 && existsSync(dist);
const files = ok ? walk(dist) : [];
const total_bytes = files.reduce((s, f) => s + f.bytes, 0);
const rel = (f) => relative(dist, f.path).split(sep).join("/");
const largest = [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 10).map((f) => ({ file: rel(f), bytes: f.bytes }));

// route families: how many HTML pages each dynamic route emitted
const routes = {};
for (const f of files) {
  if (!f.path.endsWith(".html")) continue;
  const r2 = rel(f);
  const fam = r2.split("/")[0] || "(root)";
  routes[fam] = (routes[fam] ?? 0) + 1;
}
const doorstep = files.filter((f) => rel(f).startsWith("data/doorstep/"));
const doorstep_bytes = doorstep.reduce((s, f) => s + f.bytes, 0);

const out = {
  label: LABEL, tree: TREE, stamped: new Date().toISOString(),
  build_ok: ok, exit: r.status, wall_ms,
  emitted_files: files.length, total_bytes,
  html_pages: files.filter((f) => f.path.endsWith(".html")).length,
  largest, routes,
  doorstep_files: doorstep.length, doorstep_bytes,
  stderr_tail: ok ? null : String(r.stderr ?? "").slice(-4000),
  stdout_tail: String(r.stdout ?? "").slice(-1500),
};
console.log(JSON.stringify(out, null, 2));
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2));
