// tools/qa/doorstep-size.mjs — the size receipt for a static doorstep, by section.
//
// THE SAME INSTRUMENT ON BOTH SIDES OF THE CHANGE. The method here is copied
// from the office lane's tools/qa/doorstep-size.mjs (postmark-office branch
// jetto/doorstep-first-words @ 2621dd5d, 2026-09-09), which took the "before":
// per-key bytes are `JSON.stringify(value).length` — the founder's own unit —
// the file total is its utf8 byte length, and `body` bytes are the sum of every
// string under a key named `body`, anywhere in the tree. This is the site-side
// half of that script (files only; the --db half needs the office's index), so
// the before and the after are read by one method rather than two.
//
// What it measured, and why it exists: on 2026-09-09 the static doorstep for
// one resident was 309,329 bytes with no letter bodies in it at all. The bytes
// were 474 unbounded rows of already-excerpted mail state, because the site was
// building its own doorstep out of a git checkout instead of mirroring the
// office's. Keep this script: it is how anyone checks that the file has not
// started growing a second time.
//
//   node tools/qa/doorstep-size.mjs public/atelier/postmark/data/doorstep/wright.json ...
//   node tools/qa/doorstep-size.mjs --dir public/atelier/postmark/data/doorstep
//
// Read-only: nothing is written.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };

const bytes = (s) => Buffer.byteLength(String(s), "utf8");
const jsonLen = (v) => (v === undefined ? 0 : JSON.stringify(v).length);
/** Sum of the string lengths under every key named `body`, anywhere in the tree. */
const bodyBytes = (v) => {
  if (Array.isArray(v)) return v.reduce((n, x) => n + bodyBytes(x), 0);
  if (v && typeof v === "object") {
    return Object.entries(v).reduce((n, [k, x]) => n + (k === "body" && typeof x === "string" ? x.length : bodyBytes(x)), 0);
  }
  return 0;
};

function report(label, obj, raw) {
  const total = raw !== undefined ? bytes(raw) : jsonLen(obj);
  const rows = Object.entries(obj)
    .map(([k, v]) => ({ key: k, bytes: jsonLen(v), body: bodyBytes(v) }))
    .sort((a, b) => b.bytes - a.bytes);
  console.log(`\n== ${label}: ${total} bytes total · ${bodyBytes(obj)} under \`body\``);
  for (const r of rows.filter((r) => r.bytes >= 1000)) {
    console.log(`  ${r.key.padEnd(22)} ${String(r.bytes).padStart(8)}${r.body ? `   body: ${r.body}` : ""}`);
  }
  const rest = rows.filter((r) => r.bytes < 1000).reduce((n, r) => n + r.bytes, 0);
  if (rest) console.log(`  ${"(everything under 1 KB)".padEnd(22)} ${String(rest).padStart(8)}`);
}

const dir = opt("--dir");
if (dir) {
  // the whole-town number: the repo cost of the doorstep surface, which is what
  // an unbounded per-resident bundle actually spends
  const root = resolve(dir);
  let json = 0, md = 0, nJson = 0, nMd = 0, biggest = { name: null, bytes: 0 };
  for (const name of readdirSync(root)) {
    const size = statSync(join(root, name)).size;
    if (name.endsWith(".json")) { json += size; nJson++; if (size > biggest.bytes) biggest = { name, bytes: size }; }
    else if (name.endsWith(".md")) { md += size; nMd++; }
  }
  console.log(`\n== ${root}`);
  console.log(`  ${nJson} json  ${json} bytes   (mean ${Math.round(json / Math.max(1, nJson))})`);
  console.log(`  ${nMd} md    ${md} bytes   (mean ${Math.round(md / Math.max(1, nMd))})`);
  console.log(`  largest json: ${biggest.name} ${biggest.bytes}`);
  console.log(`  TOTAL ${json + md} bytes`);
}

for (const spec of args.filter((a) => !a.startsWith("--") && a !== dir)) {
  const path = resolve(spec);
  const raw = readFileSync(path, "utf8");
  if (path.endsWith(".json")) report(path, JSON.parse(raw), raw);
  else console.log(`\n== ${path}: ${bytes(raw)} bytes total · ${raw.split(/\r?\n/).length} lines`);
}
