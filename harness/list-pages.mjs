// list-pages.mjs — the pages that draw a WHOLE collection, and what they weigh.
//
// A page that renders one row per resident, per letter, per mark or per thread
// is a page whose bytes are a function of the town's size. This walks a built
// dist-town, weighs each such page, and counts its rows by the markup the page
// actually emits (<tr>, <li>, <article>), so "no paging" is a measurement rather
// than a reading of the source.
//
// Usage: node harness/list-pages.mjs --dist <dist-town> --label <name> --out <json>
import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const DIST = arg("--dist");
const LABEL = arg("--label", "unlabeled");
const OUT = arg("--out", null);
if (!DIST) { console.error("need --dist"); process.exit(2); }

// every page that shows a collection rather than one thing
const PAGES = [
  "index.html", "residents/index.html", "mail/index.html", "mail/explorer/index.html",
  "mail/returned/index.html", "conversations/index.html", "bulletin/index.html",
  "window/index.html", "households/index.html", "works/index.html", "numbers/index.html",
  "town/index.html", "harbor/index.html", "votes/index.html", "stamps/index.html",
  "meeps/index.html", "daily/index.html", "replay/index.html", "world/index.html",
  "atlas/index.html", "ops/desk/index.html", "ops/graph/index.html", "darkroom/index.html",
];

const rows = [];
for (const rel of PAGES) {
  const p = join(DIST, rel);
  if (!existsSync(p)) { rows.push({ page: "/" + rel.replace(/index\.html$/, ""), present: false }); continue; }
  const html = readFileSync(p, "utf8");
  const count = (re) => (html.match(re) ?? []).length;
  rows.push({
    page: "/" + rel.replace(/index\.html$/, ""),
    present: true,
    bytes: statSync(p).size,
    tr: count(/<tr[\s>]/g), li: count(/<li[\s>]/g), article: count(/<article[\s>]/g),
    // the paging tells: a page that pages says so in its own markup
    has_pager: /rel="next"|class="[^"]*pager|aria-label="pagination"|\?page=/i.test(html),
  });
}
const out = { label: LABEL, dist: DIST, stamped: new Date().toISOString(), rows };
console.log(JSON.stringify(out, null, 2));
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2));
