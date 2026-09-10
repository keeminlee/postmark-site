// find-build-ceiling.mjs — the N at which the site stops building at all.
//
// At 10x the build does not get slow; it DIES. Astro/Vite turns
// `import letters from "@/data/postmark/letters.json"` into a JavaScript module
// and hands it to V8's parser, and a 137 MB module fails in V8's ZONE allocator
// — a compiler arena, not the JS heap — so --max-old-space-size does not move it.
//
// This walks the scale factor and reports, for each, whether the bundle stage
// survived. A run is called PASSED_BUNDLE the moment the build prints its first
// route line: the modules parsed, and everything after that is wall, not life or
// death. The child is killed at that instant so the walk costs a minute a step
// instead of a quarter of an hour.
//
// Usage: node harness/find-build-ceiling.mjs --tree <tree> --factors 2,4,6,8,10
import { spawn, spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { join } from "node:path";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const TREE = arg("--tree");
const FACTORS = String(arg("--factors", "2,4,6,8,10")).split(",").map(Number);
const HERE = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
if (!TREE) { console.error("need --tree"); process.exit(2); }

const isWin = process.platform === "win32";
const results = [];

for (const f of FACTORS) {
  spawnSync(process.execPath, [join(HERE, "scale-data.mjs"), "--tree", TREE, "--factor", String(f)], { encoding: "utf8" });
  const lettersBytes = statSync(join(TREE, "src", "data", "postmark", "letters.json")).size;

  const t0 = Date.now();
  const outcome = await new Promise((resolve) => {
    const child = spawn(isWin ? "npm.cmd" : "npm", ["run", "build"], {
      cwd: TREE, shell: isWin,
      env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" },
    });
    let done = false, tail = "";
    const finish = (v) => { if (done) return; done = true; try { child.kill(); } catch {} resolve(v); };
    const scan = (buf) => {
      const s = String(buf); tail = (tail + s).slice(-4000);
      if (s.includes("├─") || s.includes("page(s) built")) finish({ verdict: "PASSED_BUNDLE" });
      if (/FATAL ERROR|out of memory|Allocation failed/.test(s)) finish({ verdict: "OOM", note: (s.match(/FATAL ERROR:[^\n]*/) ?? [""])[0] });
    };
    child.stdout.on("data", scan);
    child.stderr.on("data", scan);
    child.on("close", (code) => finish({ verdict: code === 0 ? "PASSED_BUNDLE" : "FAILED", exit: code, note: (tail.match(/FATAL ERROR:[^\n]*/) ?? [""])[0] }));
    setTimeout(() => finish({ verdict: "TIMEOUT" }), 300000);
  });
  const row = { factor: f, letters_bytes: lettersBytes, ms_to_verdict: Date.now() - t0, ...outcome };
  results.push(row);
  console.error(JSON.stringify(row));
}
console.log(JSON.stringify({ tree: TREE, stamped: new Date().toISOString(), results }, null, 2));
