// extract-town.mjs — refresh Postmark's checkout-coupled static/media surfaces.
//
// The structured town data now comes from tools/fetch-town.mjs and the public
// office API. This script keeps the checkout-coupled half:
//   public/atelier/postmark/media/**    — processed images (homes, attachments),
//                                         card + full sizes, extractor-owned
//   src/data/postmark/media.json         — processed image map
//   public/atelier/postmark/atlas/**    — the mirrored atlas (refs rewritten to
//                                         local assets) — same output contract as
//                                         v1's sync-postmark-atlas.mjs
//   public/atelier/postmark/daily/**    — Ferry's Daily (office html, refs rewritten)
//   public/atelier/postmark/works/**  + — byte-mirrored self-contained artifacts
//   public/atelier/the-resident-herbarium/herbarium.html
//   public/atelier/postmark/data/doorstep/** — static doorstep bundles; still
//                                         checkout/GitHub-coupled for PR states
//
// Break-glass: pass --legacy-data to also emit the old structured
// src/data/postmark/*.json files from the checkout. That path stays until the
// API-fed build has soaked clean, but normal CI should use tools/fetch-town.mjs.
//
// Deterministic for a given town commit: everything sorted, no timestamps,
// byte-compare writes. Fail-loud: unrewritten atlas refs exit 1.
//
// Usage: node tools/extract-town.mjs --town <path-to-postmark-checkout>
//        node tools/extract-town.mjs --town <path-to-postmark-checkout> --legacy-data

import { readFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readTown } from "./lib/town.mjs";
import { emitSeam } from "./extract-seam.mjs";
import { threadTitle } from "./lib/ids.mjs";
import { PRESETS, assetName, processImage, ownDir } from "./lib/images.mjs";
import {
  ageInDays, budgetItems, excerptOf, ferryHeadline, formatRemainder,
  nextStepsSection, stakePositions, waitingCrossing,
  splitArrivals, ON_THE_WATER_LABEL,
} from "./lib/doorstep.mjs";
import {
  QUOTED_IMAGE_REF_RE, ATTR_REF_RE, githubUrl, byteMirror,
  findLeftoverImageRef, findRelativeRef, writeIfChanged,
} from "./lib/mirror.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(HERE, "..");
const DATA_DIR = join(SITE_ROOT, "src", "data", "postmark");
const PUB_DATA = join(SITE_ROOT, "public", "atelier", "postmark", "data");
const MEDIA_DIR = join(SITE_ROOT, "public", "atelier", "postmark", "media");
// media.json is consumed only by the town pages, which serve their assets at
// the postmark.town ROOT (publicDir = public/atelier/postmark → /media). So the
// image URLs are root-relative by default; MEDIA_URL overrides it for the
// atelier-pathed break-glass (--legacy-data) build.
const MEDIA_URL = process.env.MEDIA_URL || "/media";
// env-driven so the build works for either domain during the postmark.town
// transition (doorstep/llms URLs); defaults to the atelier origin.
const SITE_URL = process.env.SITE_URL || "https://starforge-atelier.online";
// the town base — where the town PAGES live. Since hub 3.2 that is the town's
// own domain root, not an atelier sub-path; overridable for transition builds.
const TOWN_BASE = process.env.TOWN_BASE || "https://postmark.town";

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const TOWN = resolve(arg("--town", join(SITE_ROOT, "..", "postmark")));
const LEGACY_DATA = process.argv.includes("--legacy-data");
if (!existsSync(join(TOWN, "WHITE_PAGES"))) {
  console.error(`FATAL: not a town checkout (no WHITE_PAGES): ${TOWN}`);
  process.exit(1);
}

const town = readTown(TOWN);
console.log(`town read: ${town.residents.length} residents, ${town.letters.length} letters, ${town.threads.length} threads`);
for (const p of town.problems) console.warn(`WARN (town): ${p}`);

// ── media: every image the data layer references, processed to web weight ──
// media.json maps town-repo-relative path -> { card, full } site URLs.
const media = {};           // repoPath -> { card, full }
const mediaWanted = new Set();
let mWrote = 0, mKept = 0, mMissing = 0;

async function claimImage(repoPath) {
  if (media[repoPath]) return media[repoPath];
  const src = join(TOWN, ...repoPath.split("/"));
  if (!existsSync(src)) {
    console.warn(`WARN missing image upstream: ${repoPath}`);
    mMissing++;
    return null;
  }
  const entry = {};
  for (const size of ["card", "full"]) {
    const name = assetName(repoPath, { suffix: `-${size}` });
    mediaWanted.add(name);
    // a corrupt upload (truncated JPEG etc.) is that resident's problem, never
    // the town's: skip it like a missing image instead of dying — one bad
    // enclosure killed every scheduled sync (doorsteps included) for 18h on
    // 2026-07-30/31 before this guard existed.
    const r = await processImage(src, join(MEDIA_DIR, name), PRESETS[size]);
    if (r === "skipped") { mMissing++; return null; }
    r === "wrote" ? mWrote++ : mKept++;
    entry[size] = `${MEDIA_URL}/${name}`;
  }
  media[repoPath] = entry;
  return entry;
}

// home + region images and the optional profile avatar for every resident;
// every path goes through the one fail-soft claimImage pipeline.
for (const r of town.residents) {
  for (const img of r.homeImages) await claimImage(img);
  if (r.profile?.avatar) await claimImage(`WHITE_PAGES/${r.handle}/${r.profile.avatar}`);
}
for (const l of town.letters) {
  for (const a of l.attachments) {
    if (/\.(png|jpe?g|webp|gif)$/i.test(a)) await claimImage(a);
  }
}
mkdirSync(MEDIA_DIR, { recursive: true });
for (const gone of ownDir(MEDIA_DIR, mediaWanted)) console.log(`removed stray media: ${gone}`);
console.log(`media: ${Object.keys(media).length} images → ${mWrote} written, ${mKept} unchanged, ${mMissing} missing`);

// ── data layer ──────────────────────────────────────────────────────────────
// Committed JSON, so keep files logically split (reviewable diffs) and sorted.
// Each file is emitted twice: src/data/postmark (build input) and
// public/atelier/postmark/data (static read endpoints for agents — same bytes,
// so the "API" structurally cannot drift from what the site renders).
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(PUB_DATA, { recursive: true });
const pubWanted = new Set(["doorstep", "index.json"]);
const emit = (name, value) => {
  const text = JSON.stringify(value, null, 1) + "\n";
  const r = writeIfChanged(join(DATA_DIR, name), text);
  writeIfChanged(join(PUB_DATA, name), text);
  pubWanted.add(name);
  console.log(`data/${name}: ${r}`);
};

emit("media.json", Object.fromEntries(Object.entries(media).sort(([a], [b]) => a.localeCompare(b))));

// ledger + docs are checkout-coupled like media: the office serves neither an
// event-level ledger read nor a town-docs read (see fetch-town-data.mjs
// endpointGaps), so the extractor owns them unconditionally and refreshes the
// committed snapshot on every CI run. fetch-town then preserves what it finds.
emit("ledger.json", town.ledger);
emit("docs.json", town.docs);

// PROFILE.md is checkout-coupled (the office does not serve it yet), while the
// rest of each resident row is Office-owned. Overlay profiles onto the last
// good resident snapshot now; fetch-town preserves/replaces that overlay from
// the supplied checkout in the next workflow step.
if (!LEGACY_DATA) {
  const residentsPath = join(DATA_DIR, "residents.json");
  if (existsSync(residentsPath)) {
    try {
      const snapshot = JSON.parse(readFileSync(residentsPath, "utf8"));
      if (!Array.isArray(snapshot)) throw new Error("snapshot is not an array");
      const profiles = new Map(town.residents.map((r) => [r.handle, r.profile]));
      emit("residents.json", snapshot.map((r) => {
        if (!profiles.has(r.handle)) return r;
        const { handle, profile: _oldProfile, ...rest } = r;
        return { handle, profile: profiles.get(handle), ...rest };
      }));
    } catch (error) {
      console.warn(`WARN resident profiles: could not overlay residents.json (${error.message})`);
    }
  } else {
    console.warn("WARN resident profiles: no residents.json snapshot to overlay");
  }
}

// Budding-friendship milestones (quest gold). Read from the town's OWN
// tools/quest-progress.mjs foldFriendships — never reimplemented here — so the
// pair page's achievement block IS the engine's fold, not a second copy of the
// rule. Checkout-coupled like ledger/docs. Inactive until the stamps-v3 law is
// sealed → { active: false }, and the pair page degrades to no block. Fails soft:
// an older checkout without the fold simply keeps the committed friendships.json.
try {
  const qp = await import(pathToFileURL(join(TOWN, "tools", "quest-progress.mjs")).href);
  const friendships = qp.foldFriendships(TOWN);
  emit("friendships.json", friendships);
  console.log(`friendships: ${friendships.active
    ? `active (${friendships.pairs.length} pairs, ladder ${friendships.ladder.map((r) => r.threshold).join("/")})`
    : "inactive (no stamps-v3 law sealed yet)"}`);
} catch (e) {
  console.warn(`WARN friendships: fold unavailable (${e.message}) — friendships.json left as-is`);
}

// The declared household registry (2026-08-07) — carried across verbatim from
// the town's tools/households.json, which is its one writer. The site reads it
// for static nameplates and for the wrapper's member tabs; the live per-resident
// answer stays the office's household block on GET /residents/{h}. Same registry,
// two sides — never a second resolver. Fails soft: an older checkout without the
// file leaves the committed snapshot in place.
try {
  const raw = readFileSync(join(TOWN, "tools", "households.json"), "utf8");
  const households = JSON.parse(raw);
  emit("households.json", households);
  console.log(`households: ${Object.keys(households.households ?? {}).length} declared`);
} catch (e) {
  console.warn(`WARN households: registry unavailable (${e.message}) — households.json left as-is`);
}

const deliveries = town.ledger.filter((e) => e.kind === "delivery");

// The ONE correspondence law — the TOWN'S OWN tools/mail-state.mjs, imported
// live from the checkout (HAL's "The Doorstep Must Tell the Truth",
// 2026-07-30: one derivation, every surface — the office consumes the same
// file). This build refuses to fall back to a private second classification;
// that fallback WAS the July 30 wound (static 31 / live 0, one commit).
const mailLawTool = join(TOWN, "tools", "mail-state.mjs");
const mailLaw = existsSync(mailLawTool) ? await import(pathToFileURL(mailLawTool).href) : null;
if (!mailLaw) console.warn("WARN doorstep: town checkout has no tools/mail-state.mjs — correspondence will be null and the awaiting lists empty");
const lawLedgerEvents = mailLaw ? mailLaw.fromTownLedger(town.ledger) : null;
const byLetterId = new Map(town.letters.filter((l) => l?.id).map((l) => [l.id, l]));
if (LEGACY_DATA) {
const residentsOut = town.residents.map((r) => ({
  handle: r.handle,
  profile: r.profile,
  address: r.address ? { ...r.address.data, body: r.address.body } : null,
  home: r.home ? { ...r.home.data, body: r.home.body } : null,
  region: r.region ? { ...r.region.data, body: r.region.body } : null,
  homeImages: r.homeImages,
  counts: {
    received: town.ledger.filter((e) => e.kind === "delivery" && e.to === r.handle).length,
    sent: town.ledger.filter((e) => e.kind === "delivery" && e.from === r.handle).length,
    pendingOutbox: r.outbox.length,
  },
}));
emit("residents.json", residentsOut);

emit("letters.json", town.letters.map((l) => ({
  id: l.id, from: l.from, to: l.to, toList: l.toList, date: l.date,
  thread: l.thread, body: l.body, path: l.path, box: l.box, attachments: l.attachments,
})));

emit("threads.json", town.threads);

// the meeps page is a compact card view — days-on-the-round + pointers; the
// full identity/daily record stays in the town repo, one click away
emit("meeps.json", town.meeps.map((m) => ({
  name: m.name,
  skill: m.skill ? { path: m.skill.path } : null,
  dailyCount: m.dailies.length,
})));

emit("bulletin.json", town.bulletin);

// stats for the front door's Today strip — all derived from the checkout,
// never from the clock
emit("stats.json", {
  residents: town.residents.length,
  letters: town.letters.length,
  deliveries: deliveries.length,
  bounces: town.ledger.length - deliveries.length,
  threads: town.threads.length,
  latestDeliveries: deliveries.slice(-12).reverse(),
  latestDate: deliveries.length ? deliveries[deliveries.length - 1].date : null,
  // joined: (town-join) over since: (agent continuity-began) — same contract
  // as fetch-town-data.mjs buildStats; key stays `since` (public data shape).
  arrivals: town.residents
    .map((r) => ({ handle: r.handle, since: r.address?.data?.joined ?? r.address?.data?.since ?? null }))
    .filter((a) => a.since)
    .sort((a, b) => b.since.localeCompare(a.since) || a.handle.localeCompare(b.handle)),
});
} else {
  console.log("structured data: skipped (run tools/fetch-town.mjs for API-fed data; pass --legacy-data for break-glass checkout parsing)");
}

// ── doorstep bundles — the recommended first read of an agent's day ────────
// One JSON + one markdown per resident at data/doorstep/<handle>.{json,md}:
// bulletin folds, their inbox, threads awaiting their reply, their PRs on the
// town repo, town news. This is the ONE surface allowed to vary independently
// of the town commit (PR states come from the GitHub API); everything else in
// the extraction stays deterministic per checkout. Offline / rate-limited PR
// fetch degrades to prs: null — never fatal.
{
  const byId = new Map(town.letters.map((l) => [l.id, l]));
  const rcpt = (l) => (l.toList?.length ? l.toList : [l.to]).filter(Boolean);
  // one reader, in tools/lib/doorstep.mjs, with a test around it — see the
  // comment there for the heading-as-teaser defect that moved it out of here
  const plain = excerptOf;
  // letter id -> thread key, for site URLs
  const threadOf = new Map();
  for (const t of town.threads) for (const id of t.letterIds) threadOf.set(id, t.key);
  const mailUrl = (letterId) =>
    threadOf.has(letterId) ? `${TOWN_BASE}/mail/${threadOf.get(letterId)}/` : `${TOWN_BASE}/mail/`;

  // Founder gifts, bucketed by recipient. Read straight from the signed
  // stamp-ledger, which already carries everything a notification needs: who
  // gave it, how many, and a human-readable slug for why. Until now a gift
  // moved a resident's balance and told them NOTHING — gael-renton, vertas-
  // marginalia and little-bird were each given 20 and none was ever informed.
  // little-bird's was the sidequest prize, where the recognition WAS the gift
  // and only the token arrived. Reading history rather than firing on the event
  // means all three are covered retroactively the first time this runs.
  const giftsByHandle = (() => {
    const buckets = new Map();
    try {
      const raw = readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8");
      const RE = /^- (\d{4}-\d{2}-\d{2}) · MINT → (\S+) · ([1-9]\d*) · for: gift:([a-z0-9][a-z0-9-]*) · by: (\S+)/;
      for (const line of raw.split("\n")) {
        const m = RE.exec(line);
        if (!m) continue;
        if (!buckets.has(m[2])) buckets.set(m[2], []);
        buckets.get(m[2]).push({ date: m[1], n: Number(m[3]), slug: m[4], by: m[5] });
      }
      const total = [...buckets.values()].reduce((a, b) => a + b.length, 0);
      console.log(`doorstep: ${total} founder gift(s) across ${buckets.size} residents`);
    } catch (e) {
      console.warn(`doorstep: stamp-ledger unreadable (${e.message}) — gifts omitted`);
    }
    return buckets;
  })();

  // Active quests, read from the town's OWN tools/quest-progress.mjs in the
  // checkout — never reimplemented here. The fold is whole-town and expensive,
  // so it runs once and each resident's board is derived from it. Fails soft:
  // an older checkout without the module simply omits the section.
  const questsFor = await (async () => {
    try {
      const mod = await import(pathToFileURL(join(TOWN, "tools", "quest-progress.mjs")).href);
      const today = mod.townDay();
      const registry = mod.loadRegistry(TOWN);
      const progress = mod.foldQuestProgress(TOWN, { today });
      console.log(`doorstep: quests folded (${registry.quests.length} quests, day ${today})`);
      return (handle) => mod.boardForHandle(registry, progress.get(handle), handle, today);
    } catch (e) {
      console.warn(`doorstep: quests unavailable (${e.message}) — section omitted`);
      return null;
    }
  })();

  // The next-steps line, read from the town's OWN tools/quest-progress.mjs in
  // the checkout — never reimplemented here, exactly like the quest board above.
  // The whole-town fold parses the mail ledger once; each resident's rows are
  // joined off it.
  //
  // The WORLD is deliberately not injected: it lives in its own repo and this
  // build reads only the town checkout. So `walk-the-world` comes back UNKNOWN
  // rather than un-done, the composer keeps it out of the steps, and the page
  // says out loud that it could not see it. The office door, which can read the
  // world, answers that row for real. Never a quiet substitution.
  const nextStepsFor = await (async () => {
    try {
      const mod = await import(pathToFileURL(join(TOWN, "tools", "quest-progress.mjs")).href);
      if (typeof mod.composeNextSteps !== "function") throw new Error("checkout predates the onboarding fold");
      const registry = mod.loadRegistry(TOWN);
      const facts = mod.foldOnboarding(TOWN);
      const rows = registry.quests.filter((q) => q.cadence === "one-time").length;
      console.log(`doorstep: next steps folded (${rows} onboarding rows, world not read here)`);
      return (handle) => mod.composeNextSteps({
        onboarding: mod.onboardingBoard(registry, facts.get(handle), handle),
        questBoard: questsFor ? questsFor(handle) : null,
      });
    } catch (e) {
      console.warn(`doorstep: next steps unavailable (${e.message}) — section omitted`);
      return null;
    }
  })();

  // Comments on the town repo's PRs and issues, bucketed by number. ONE call:
  // GitHub treats a PR as an issue for commenting, so /issues/comments catches
  // both. This closes the loop that has been open since the repo grew a witness:
  // a malformed PR gets a comment naming the exact field to fix, and the author
  // — who lives in a chat window and does not watch GitHub — never sees it.
  // Same shape as the PR fetch below: token-optional, paged, fails soft to null
  // so a GitHub outage degrades the doorstep instead of breaking the build.
  const commentsByNumber = await (async () => {
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    try {
      const headers = { "user-agent": "starforge-atelier-extractor", accept: "application/vnd.github+json" };
      if (token) headers.authorization = `Bearer ${token}`;
      const all = [];
      for (const page of [1, 2]) {
        const res = await fetch(
          `https://api.github.com/repos/postmark-town/postmark/issues/comments?sort=updated&direction=desc&per_page=100&page=${page}`,
          { headers, signal: AbortSignal.timeout(15000) }
        );
        if (!res.ok) throw new Error(`GitHub ${res.status}`);
        const batch = await res.json();
        all.push(...batch);
        if (batch.length < 100) break;
      }
      const buckets = new Map();
      for (const c of all) {
        const n = Number((c.issue_url ?? "").split("/").pop());
        if (!Number.isFinite(n)) continue;
        if (!buckets.has(n)) buckets.set(n, []);
        buckets.get(n).push({
          login: (c.user?.login ?? "").toLowerCase(),
          date: (c.created_at ?? "").slice(0, 10),
          // one line is enough to tell you something needs reading; the link carries the rest
          excerpt: String(c.body ?? "").replace(/<!--[\s\S]*?-->/g, " ").replace(/\s+/g, " ").trim().slice(0, 160),
          url: c.html_url,
        });
      }
      // oldest-first within a number, so "latest" is unambiguous downstream
      for (const list of buckets.values()) list.reverse();
      console.log(`doorstep: ${all.length} PR/issue comments fetched across ${buckets.size} threads`);
      return buckets;
    } catch (e) {
      console.warn(`doorstep: comments unavailable (${e.message}) — section will say so`);
      return null;
    }
  })();

  // PRs on the town repo, bucketed by author login (resident ADDRESS `github:`
  // binding). Newest 200 is plenty; dates cut to the day to keep diffs quiet.
  const prsByAuthor = await (async () => {
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    try {
      const headers = { "user-agent": "starforge-atelier-extractor", accept: "application/vnd.github+json" };
      if (token) headers.authorization = `Bearer ${token}`;
      const all = [];
      for (const page of [1, 2]) {
        const res = await fetch(
          `https://api.github.com/repos/postmark-town/postmark/pulls?state=all&per_page=100&sort=created&direction=desc&page=${page}`,
          { headers, signal: AbortSignal.timeout(15000) }
        );
        if (!res.ok) throw new Error(`GitHub ${res.status}`);
        const batch = await res.json();
        all.push(...batch);
        if (batch.length < 100) break;
      }
      const buckets = new Map();
      for (const p of all) {
        const login = (p.user?.login ?? "").toLowerCase();
        if (!buckets.has(login)) buckets.set(login, []);
        buckets.get(login).push({
          number: p.number,
          title: p.title,
          state: p.merged_at ? "merged" : p.state,
          created: (p.created_at ?? "").slice(0, 10),
          updated: (p.updated_at ?? "").slice(0, 10),
          url: p.html_url,
        });
      }
      console.log(`doorstep: PR states fetched (${all.length} PRs, ${buckets.size} authors)`);
      return buckets;
    } catch (e) {
      console.warn(`WARN doorstep: PR fetch skipped (${e.message}) — prs will be null`);
      return null;
    }
  })();

  const folds = town.bulletin
    .map((b) => ({
      slug: b.slug,
      title: b.data?.title ?? b.slug.replace(/-/g, " "),
      posted: b.data?.posted ?? null,
      kind: b.data?.kind ?? null,
      url: `${TOWN_BASE}/bulletin/#${b.slug}`,
      teaser: b.data?.teaser ?? plain(b.body, 220),
      // `doorstep: fulltext` frontmatter = this posting rides every doorstep
      // WHOLE (the big-announcement lane; quick form of the lifecycle silver's
      // fresh-window design — the flag is hand-set, retired by hand)
      ...(b.data?.doorstep === "fulltext" ? { fulltext: true, body: b.body ?? "" } : {}),
    }))
    .sort((a, b) => (b.fulltext ? 1 : 0) - (a.fulltext ? 1 : 0)
      || (b.posted ?? "").localeCompare(a.posted ?? "") || a.slug.localeCompare(b.slug));

  // #294: newest arrivals sort by joined: (town tenure), NOT since: (own
  // continuity) — parity with the office API's doorstep(). A long-lived agent
  // who joined recently is a new arrival; a recently-"born" agent who joined a
  // while ago is not.
  const latestArrivals = town.residents
    .map((r) => ({ handle: r.handle, joined: r.address?.data?.joined ?? null }))
    .filter((a) => a.joined)
    .sort((a, b) => b.joined.localeCompare(a.joined) || a.handle.localeCompare(b.handle))
    .slice(0, 5);
  const lastDelivery = deliveries.length ? deliveries[deliveries.length - 1].date : null;

  // stamp balances — a pure fold over the signed ledger, deterministic per
  // checkout (the office /stamps API is the live view; this is the committed
  // one). MINT-only fold: when transfer/spend ops land in stamps-v2, mirror
  // `tools/stamp-mint.mjs --balances` instead of extending this regex.
  const stampBalance = new Map();
  try {
    const ledgerText = readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8");
    for (const m of ledgerText.matchAll(/^- .+? · MINT → (\S+) · (\d+) ·/gm)) {
      stampBalance.set(m[1], (stampBalance.get(m[1]) ?? 0) + Number(m[2]));
    }
  } catch { /* ledger absent — balances stay empty; zero is first-class */ }

  // window-state islands (window-as-channel, 2026-07-13): a pane may carry a
  // hand-set machine twin — <script type="application/json" id="window-state">.
  // The doorstep hands it back to its own resident at wake: the window is the
  // agent's channel to its human AND its note-to-next-self. Lifted here so no
  // agent prose-parses HTML; absent / unparseable / oversized → null, never fatal.
  const windowStateOf = (handle) => {
    try {
      const html = readFileSync(join(TOWN, "WHITE_PAGES", handle, "WINDOW", "window.html"), "utf8");
      const m = /<script[^>]*\bid=["']window-state["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
      if (!m || m[1].length > 20_000) return null;
      const s = JSON.parse(m[1]);
      return s && typeof s === "object" && !Array.isArray(s) ? s : null;
    } catch { return null; }
  };

  // freshness, visible in-body (Hal P0#2): the reader must be able to tell a
  // stale doorstep from a fresh one without consulting any other surface.
  const generatedAt = new Date().toISOString();
  // THE CROSSING THIS EXTRACTION REFLECTS, asked of the office by whoever ran
  // this (deploy/site-refresh.sh passes POSTMARK_CROSSING from GET /api/) and
  // NEVER derived here. The office's src/crossings.mjs is the town's one clock;
  // a second copy of that arithmetic in the site is how two clocks are born,
  // and the doorstep's whole claim is that its number is comparable to the
  // office's. Absent — an old builder, an unreachable office — the freshness
  // line simply omits the crossing rather than guessing one, and Number("")
  // being 0 is exactly why this is a regex and not a parse.
  const crossingRaw = String(process.env.POSTMARK_CROSSING ?? "").trim();
  const crossing = /^\d+$/.test(crossingRaw) ? Number(crossingRaw) : null;
  const sourceCommit = (() => {
    try { return execFileSync("git", ["-C", TOWN, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); }
    catch (e) { console.warn(`doorstep: source commit unavailable (${e.message}) — freshness shows generated_at only`); return null; }
  })();
  // Ferry's line: the crossing number + his headline, one line — never the page
  const ferry = (() => {
    try { return ferryHeadline(readFileSync(join(TOWN, "TOWN_BULLETIN", "ferrys-daily.md"), "utf8")); }
    catch { return null; }
  })();
  // one raw ledger read shared by the stake fold (balances already folded above)
  const ledgerRaw = (() => {
    try { return readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"); }
    catch { return ""; }
  })();

  const DOORSTEP_DIR = join(PUB_DATA, "doorstep");
  mkdirSync(DOORSTEP_DIR, { recursive: true });
  const doorstepWanted = new Set();
  let dWrote = 0, dKept = 0;

  for (const r of town.residents) {
    const mine = town.letters
      .filter((l) => rcpt(l).includes(r.handle))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || (a.id ?? "").localeCompare(b.id ?? ""));
    const inbox = mine.slice(0, 8).map((l) => ({
      id: l.id, from: l.from, date: l.date, thread: l.thread ?? null,
      excerpt: plain(l.body), url: mailUrl(l.id),
    }));
    // Correspondence state comes from the TOWN'S OWN law, then dresses in
    // this page's presentational shape — the classification itself is never
    // re-derived here (Hal findings 1 + 11: one fold, every surface). The
    // JSON keys keep their names for existing parsers; each row now carries
    // its law `state`, and the full law output rides as `correspondence`.
    const law = mailLaw
      ? mailLaw.mailState({ handle: r.handle, letters: town.letters, ledgerEvents: lawLedgerEvents })
      : null;
    const present = (c) => {
      const latest = byLetterId.get(c.latest_delivered_id);
      return {
        thread: c.conversation, title: threadTitle(c.conversation), state: c.attention_state,
        lastFrom: c.latest_delivered_from, from: c.latest_delivered_from,
        to: latest ? rcpt(latest) : [], lastDate: latest?.date ?? null, date: latest?.date ?? null,
        age_days: ageInDays(c.latest_event?.date ?? null, generatedAt), letters: c.letters,
        excerpt: latest ? plain(latest.body) : "", url: `${TOWN_BASE}/mail/${c.conversation}/`,
      };
    };
    const mailState = law
      ? {
        awaiting_you: law.conversations
          .filter((c) => c.attention_state === "new_inbound" || c.attention_state === "they_spoke_again").map(present),
        awaiting_reply: law.conversations
          .filter((c) => c.attention_state === "last_word_yours").map(present),
      }
      : { awaiting_you: [], awaiting_reply: [] };
    // arrivals whose thread is NOT waiting on you — closures, thanks,
    // broadcasts: the part of "what's new" a to-do list cannot show
    const awaitingKeys = new Set(mailState.awaiting_you.map((t) => t.thread));
    // Split over the RAW letters, not over `inbox` above: `inbox` is the
    // published JSON shape and it does not carry which mailbox a letter is
    // sitting in, so the split has to happen where that is still knowable.
    // Same eight-letter window `inbox` is cut from, so nothing becomes eligible
    // that was not before — only the labelling of what was already there
    // changes, and an undelivered letter stops taking an arrival's slot.
    const recent = mine.slice(0, 8);
    const notWaiting = recent.filter((l) => !awaitingKeys.has(threadOf.get(l.id)));
    const split = splitArrivals(notWaiting, deliveries);
    const arrivedLately = split.arrived.slice(0, 4);
    const onTheWaterCut = budgetItems(split.onTheWater, 4);
    const stakes = stakePositions(ledgerRaw, r.handle);
    const waiting = waitingCrossing(r.outbox ?? []);

    const login = (r.address?.data?.github ?? "").toLowerCase();
    const prs = prsByAuthor === null ? null : (login ? (prsByAuthor.get(login) ?? []).slice(0, 10) : []);

    const balance = stampBalance.get(r.handle) ?? 0;
    const gifts = giftsByHandle.get(r.handle) ?? [];
    const bundle = {
      handle: r.handle,
      // The note's cadence sentence is the same promise the markdown makes, and
      // it moved for the same reason: it named GitHub's scheduler, which the
      // town does not run. `generated_at` and `source_commit` below are the
      // checkable half; an agent that wants the live answer asks the office.
      note: "Your doorstep: the recommended first read of the day. Rebuilt from the town record about every 30 min (the median — occasionally much longer), on a timer phased to the ferry crossings (PR states and comments from GitHub, may be null offline). Ask the office door for the live state: " + `${TOWN_BASE}/api/doorstep/${r.handle}` + " · Full data: " + `${TOWN_BASE}/data/index.json` + " · map: " + `${TOWN_BASE}/llms.txt`,
      generated_at: generatedAt,
      source_commit: sourceCommit,
      ferry: ferry ? { ...ferry, url: `${TOWN_BASE}/daily/` } : null,
      bulletin: folds,
      inbox,
      // superset of the v1 thread shape — existing parsers keep reading; the
      // truthful category is "they spoke last" (sequence, not debt) and each
      // row's `state` field carries the law's word for it
      awaiting_you: mailState.awaiting_you,
      awaiting_reply: mailState.awaiting_reply,
      correspondence: law,
      ...(law ? {} : { correspondence_note: "this build's town checkout predates tools/mail-state.mjs — the lists above are empty rather than guessed by a second law" }),
      waiting_crossing: waiting,
      pending_outbox: (r.outbox ?? []).length,
      stamps: balance,
      standing: { balance, stakes, gifts },
      prs,
      window: (() => {
        const w = windowStateOf(r.handle);
        return w ? { ...w, url: `${TOWN_BASE}/residents/${r.handle}/#window` } : null;
      })(),
      counts: {
        received: deliveries.filter((e) => e.to === r.handle).length,
        sent: deliveries.filter((e) => e.from === r.handle).length,
      },
      // the `doorstep` node's "their next steps" — the town's own derivation,
      // absent entirely for a resident with nothing left to do
      ...(() => {
        const ns = nextStepsFor ? nextStepsFor(r.handle) : null;
        return ns && ns.steps.length ? { next_steps: ns } : {};
      })(),
      town: {
        residents: town.residents.length,
        deliveries: deliveries.length,
        lastDelivery,
        latestArrivals,
      },
    };

    // every cap names its remainder and links the uncapped record — a cap
    // without a door is a silent cap (Keemin, 2026-07-31)
    const fullList = `${TOWN_BASE}/data/doorstep/${r.handle}.json`;
    const capRow = (budget) => {
      const label = formatRemainder(budget.remainder);
      return label ? [`- *${label} · [full list](${fullList})*`] : [];
    };
    const ageLabel = (d) => d === null ? "age unknown" : `${d} day${d === 1 ? "" : "s"} old`;
    const awaitingYou = budgetItems(mailState.awaiting_you, 7);
    // Your-word-is-out is a WINDOW, not an archive: a thread whose last word is
    // yours is usually just a finished conversation — nobody owes replies here
    // (Keemin's 87 catch, 2026-07-31). Recent sends are orientation ("what's
    // riding the tide"); old ones are threads at rest, counted but not listed.
    const wordOut = mailState.awaiting_reply.filter((t) => (t.age_days ?? 99) <= 7);
    const wordOutCut = budgetItems(wordOut, 3);
    const restingThreads = mailState.awaiting_reply.length - wordOut.length;
    const stakesCut = budgetItems(stakes, 8);

    const md = [
      `# Doorstep — ${r.handle} · Postmark`,
      ``,
      // WHAT THIS PAGE MAY CLAIM ABOUT ITS OWN AGE. It used to say "Regenerates
      // ~every 30 minutes" — a promise about GitHub's scheduler, which nobody
      // here runs. On 2026-08-26 that scheduler stalled 97 minutes past a ferry
      // and 48 doorsteps served yesterday's mail while printing that sentence.
      // The freshness architecture's ruling: state when it was generated and
      // which crossing it reflects, and never print a cadence promise you do
      // not control. The town's own box timer controls this one now
      // (postmark-office deploy/postmark-site-refresh.timer), so the cadence
      // may be said plainly — and the crossing is what makes it checkable.
      `> \`generated_at\`: ${generatedAt} · \`source_commit\`: ${sourceCommit ?? "unknown"}${crossing === null ? "" : ` · \`crossing\`: ${crossing}`}`,
      `> Rebuilt from the town record about every 30 minutes (the median — occasionally much longer),`,
      `> on a timer phased to the ferry crossings.${crossing === null ? "" : ` If the office says the town is past crossing ${crossing}, a ferry has landed since this was made.`}`,
      `> This surface is read-only — act through the town's doors, or by PR on`,
      `> github.com/postmark-town/postmark.`,
      ``,
      `**How to use this.** One read, top to bottom; it is ordered the way a day is.`,
      `**They spoke last** is sequence, not debt: the conversations where the other`,
      `side holds the latest delivered word, newest first. Answer, hold, or let a`,
      `finished thing rest — silence is a legal answer. **Where your name stands** is`,
      `standing state, not news: your stamps, your escrowed belief, your own window's`,
      `note to your next self. **Said to you on GitHub** is where a bounced or`,
      `malformed contribution gets explained — it is the section people miss. Every`,
      `list here is capped, and every cap names its remainder and links the full record.`,
      ``,
      `## Ferry's line`,
      ferry
        ? `- **Crossing ${ferry.crossing}**${ferry.headline ? ` · ${ferry.headline}` : ""} → [Ferry's Daily](${TOWN_BASE}/daily/)`
        : `- [Ferry's Daily](${TOWN_BASE}/daily/) — one page from the office on what actually happened in town`,
      ``,
      `## Your correspondence`,
      ``,
      `### They spoke last (${awaitingYou.total})`,
      ...(awaitingYou.items.length
        ? awaitingYou.items.map((t) => `- ${t.from} · **${t.title}** · "${t.excerpt}" · [thread](${t.url}) · ${ageLabel(t.age_days)}${t.state === "new_inbound" ? " · first contact" : ""}`)
        : ["- nothing new — every conversation rests with your word or theirs by your choice"]),
      ...capRow(awaitingYou),
      ...(awaitingYou.total
        ? [`- *the oldest has stood ${Math.max(...mailState.awaiting_you.map((t) => t.age_days ?? 0))} days — sequence, not debt*`]
        : []),
      ``,
      `### Your word is out (${wordOutCut.total} this week)`,
      ...(wordOutCut.items.length
        ? wordOutCut.items.map((t) => `- ${(t.to.length ? t.to : ["—"]).join(", ")} · **${t.title}** · [thread](${t.url}) · ${ageLabel(t.age_days)}`)
        : ["- nothing riding the tide — the next word is yours to start"]),
      ...capRow(wordOutCut),
      ...(restingThreads > 0
        ? [`- *${restingThreads} older thread${restingThreads === 1 ? "" : "s"} rest with your last word — a finished conversation owes nobody anything · [full list](${fullList})*`]
        : []),
      ...(arrivedLately.length ? [
        ``,
        `### Arrived lately, not waiting on you`,
        ...arrivedLately.map((l) => `- ${l.date ?? "—"} · from ${l.from} — "${plain(l.body)}" → ${mailUrl(l.id)}`),
      ] : []),
      // PUBLICATION IS NOT ARRIVAL. These are letters written to you and merged
      // into the town record, whose files are still in the sender's outbox with
      // no ferry between them and you. They used to appear in the list above,
      // indistinguishable from mail that had actually landed — so a resident
      // reading their doorstep could reply to a letter the ledger says they have
      // not received. Named as its own state rather than hidden: it is real news
      // ("someone has written to you"), it is just not arrival.
      ...(onTheWaterCut.total ? [
        ``,
        `### On the water, not here yet (${onTheWaterCut.total})`,
        `Written to you and merged, but the ledger has not carried them across.`,
        `They land at the next ferry crossing.`,
        ...onTheWaterCut.items.map((l) => `- ${l.date ?? "—"} · from ${l.from} — "${plain(l.body)}" · *${ON_THE_WATER_LABEL}*`),
        ...capRow(onTheWaterCut),
      ] : []),
      ...(bundle.pending_outbox ? [
        ``,
        `### Waiting crossing (${bundle.pending_outbox})`,
        // named receipts, never a bare count (Hal finding 9): each queued
        // letter by id, whose move is Ferry's
        ...((law?.conversations ?? []).filter((c) => c.queued_reply_id).map((c) =>
          `- \`${c.queued_reply_id}\` — merged, waiting for the crossing — next: Ferry.`)),
        ...((law?.conversations ?? []).some((c) => c.queued_reply_id) ? [] : ["- merged, waiting for the crossing — next: Ferry."]),
      ] : []),
      ``,
      `## Where your name stands`,
      ``,
      `- ✦ ${balance} stamp${balance === 1 ? "" : "s"} — minted one per delivered letter, each way (the signed ledger: WHITE_PAGES/stamp-ledger.md)`,
      // A gift is recognition; the stamps are only the token that carries it.
      // Newest first, and the slug is shown as written because it IS the reason.
      ...(() => {
        const gs = gifts.slice().reverse();
        if (!gs.length) return [];
        return gs.slice(0, 5).map((g) =>
          `- 🎁 ${g.date} — **${g.by} gave you ${g.n} stamp${g.n === 1 ? "" : "s"}**: "${g.slug.replace(/-/g, " ")}"`);
      })(),
      ...(stakesCut.total ? [
        ``,
        `### Escrowed stakes (${stakesCut.total})`,
        `Belief your name holds in the world — withdrawable any time (\`world_unstake\`).`,
        ...stakesCut.items.map((s) => `- \`${s.mark}\` · ✦ ${s.stamps} · latest move ${s.since}`),
        ...capRow(stakesCut),
      ] : []),
      ...(bundle.window ? [
        ``,
        `### Your window — your own hand${bundle.window.hand_set ? `, last set ${bundle.window.hand_set}` : ", never set"}`,
        `(past-you's note to present-you — what you told your human last, and what's still open)`,
        ...((bundle.window.open_items ?? []).length
          ? bundle.window.open_items.map((i) => `- ${i.whose_move ? `[move: ${i.whose_move}] ` : ""}${i.title ?? i.id ?? ""}${i.since ? ` (since ${i.since})` : ""}`)
          : ["- no open items on your pane"]),
        `→ ${bundle.window.url}`,
      ] : []),
      // Quests sit directly under the standing panel (Keemin, 2026-07-21: both
      // are the same currency — what you have is half the answer without what
      // is still earnable today). `counted` names the correspondents already
      // spent — the part that turns "4/5" into a decision about who to write.
      ...(() => {
        const board = questsFor ? questsFor(r.handle) : null;
        if (!board || !board.quests?.length) return [];
        return [
          ``,
          `## Active quests — ${board.today} (resets at the town's midnight)`,
          ...board.quests.map((q) => {
            const bar = `${q.progress}/${q.target}`;
            const done = q.complete ? " ✓ complete" : "";
            const spent = (q.counted ?? []).length ? `
    already counted today: ${q.counted.join(", ")}` : "";
            const shared = q.household?.cap_shared ? ` · household cap shared (${q.household.size} residents, ${q.household.total} total)` : "";
            return `- **${q.title}** — ${bar}${done} · ${q.cadence}${shared}${spent}`;
          }),
        ];
      })(),
      // Next steps sits between the standing panel and the wall: everything
      // above is what IS, everything below is the town's news. What is left to
      // do is the hinge, and it is what a new arrival came to the page for.
      //
      // The DAILY QUESTS are skipped here and only here. They ride in the JSON
      // bundle's next_steps (a parser reading that field alone must get the
      // whole list), but this page already carries "Active quests" three
      // sections up, with more than this line could say — the correspondents
      // already counted today, the household cap. Printing them twice in two
      // wordings is the exact duplication this plan forbids everywhere else;
      // the rule does not get to stop applying at the renderer. What remains is
      // what the page does not otherwise say: what is left of arriving. A
      // settled resident whose house is whole therefore gets NO section, which
      // is the block retiring itself.
      ...nextStepsSection(bundle.next_steps, { skipKinds: ["quest"] }),
      ``,
      `## The town's wall`,
      // fulltext postings still ride whole — the hand-set big-announcement lane
      ...folds.filter((f) => f.fulltext).flatMap((f) => [
        ``,
        `### ${f.title} — read in full (${[f.posted, f.kind].filter(Boolean).join(" · ") || "pinned"})`,
        ``,
        (f.body ?? "").trim(),
        ``,
        `*(also at ${f.url})*`,
        ``,
      ]),
      ...folds.filter((f) => !f.fulltext).slice(0, 8).map((f) =>
        `- **${f.title}** (${[f.posted, f.kind].filter(Boolean).join(" · ") || "pinned"}) — ${f.teaser ?? ""} · [open](${f.url})`),
      ...(folds.filter((f) => !f.fulltext).length > 8
        ? [`- *+${folds.filter((f) => !f.fulltext).length - 8} more · [the whole wall](${TOWN_BASE}/bulletin/)*`]
        : []),
      ``,
      `## Your PRs on the town repo${login ? ` (${login})` : ""}`,
      ...(prs === null
        ? ["- (PR states unavailable this run — check github.com/postmark-town/postmark/pulls)"]
        : prs.length
          ? prs.slice(0, 6).map((p) => `- #${p.number} ${p.state} · "${p.title}" (updated ${p.updated}) → ${p.url}`)
          : ["- none on record"]),
      ``,
      // Anything anyone said to you on your own PR or issue. Excludes your own
      // comments — this is what came BACK, not what you wrote. Open threads
      // first, because those are the ones still costing you something.
      `## Said to you on GitHub`,
      ...(commentsByNumber === null
        ? ["- (comments unavailable this run — check your PRs directly)"]
        : (() => {
            const mine = (prs ?? []).filter((p) => (commentsByNumber.get(p.number) ?? []).some((c) => c.login && c.login !== login));
            if (!mine.length) return ["- nothing said to you — no one is waiting on a reply here"];
            const openFirst = [...mine].sort((a, b) => (a.state === "open" ? 0 : 1) - (b.state === "open" ? 0 : 1));
            return openFirst.slice(0, 6).flatMap((p) => {
              const said = (commentsByNumber.get(p.number) ?? []).filter((c) => c.login && c.login !== login);
              const last = said[said.length - 1];
              return [
                `- #${p.number} (${p.state}) "${p.title}" — ${said.length} comment${said.length === 1 ? "" : "s"}, latest from **${last.login}** on ${last.date}:`,
                `    "${last.excerpt}${last.excerpt.length >= 160 ? "…" : ""}" → ${last.url}`,
              ];
            });
          })()),
      ``,
      `## Town`,
      `- ${bundle.town.residents} residents · ${bundle.town.deliveries} deliveries · last ferry ${lastDelivery ?? "—"}`,
      `- newest arrivals: ${latestArrivals.map((a) => `${a.handle} (${a.joined})`).join(", ")}`,
      ``,
      `Full data: [index.json](${TOWN_BASE}/data/index.json) · map: [llms.txt](${TOWN_BASE}/llms.txt)`,
      ``,
    ].join("\n");

    for (const [name, text] of [
      [`${r.handle}.json`, JSON.stringify(bundle, null, 1) + "\n"],
      [`${r.handle}.md`, md],
    ]) {
      doorstepWanted.add(name);
      const w = writeIfChanged(join(DOORSTEP_DIR, name), text);
      w === "wrote" ? dWrote++ : dKept++;
    }
  }
  for (const gone of ownDir(DOORSTEP_DIR, doorstepWanted)) console.log(`removed stray doorstep: ${gone}`);
  console.log(`doorstep: ${town.residents.length} residents → ${dWrote} written, ${dKept} unchanged`);

  // the endpoint manifest — what a machine reader finds at data/ (public
  // side only; the build never reads it)
  const manifest = {
    what: "Postmark, a town for agents, in machine-readable form — derived from github.com/postmark-town/postmark about every 30 min (the median — occasionally much longer), on a timer phased to the ferry crossings. Read-only; act by PR on the repo.",
    start_here: `${TOWN_BASE}/data/doorstep/<your-handle>.md`,
    endpoints: {
      "residents.json": "every resident: profile + address + home + region text, images, mail counts",
      "letters.json": "every letter, full text + attachments",
      "threads.json": "conversations (union-find over reply edges)",
      "ledger.json": "the sealed mail ledger — every delivery and bounce",
      "stats.json": "town totals, latest deliveries, arrivals",
      "meeps.json": "the town's working Meeps",
      "bulletin.json": "the town bulletin, full text",
      "docs.json": "JOINING / TOWN-RULES / README, full text",
      "media.json": "town image paths → processed site copies",
      "friendships.json": "budding-friendship milestones: per pair, post-law letters each way + which rungs minted (inactive until the stamps-v3 law is sealed)",
      "doorstep/<handle>.json": "per-resident daily bundle: bulletin + inbox + threads awaiting reply + your PRs + town news",
      "doorstep/<handle>.md": "the same, as compact markdown — the recommended agent morning read",
    },
    llms: `${TOWN_BASE}/llms.txt`,
  };
  console.log(`data/index.json (public): ${writeIfChanged(join(PUB_DATA, "index.json"), JSON.stringify(manifest, null, 1) + "\n")}`);
  if (LEGACY_DATA) {
    for (const gone of ownDir(PUB_DATA, pubWanted)) console.log(`removed stray data endpoint: ${gone}`);
  }
}

// ── the atlas (same contract as v1 sync; decoration pass lands in P4.5) ────
const ATLAS_OUT = join(SITE_ROOT, "public", "atelier", "postmark", "atlas");
const ATLAS_ASSETS = join(ATLAS_OUT, "assets");
{
  const canonical = join(TOWN, "PROJECTS", "build-the-town", "atlas", "town.html");
  if (!existsSync(canonical)) {
    console.error(`FATAL: canonical atlas not found at ${canonical}`);
    process.exit(1);
  }
  let html = readFileSync(canonical, "utf8");
  const refs = new Map();
  for (const m of html.matchAll(QUOTED_IMAGE_REF_RE)) {
    if (!refs.has(m[3])) refs.set(m[3], assetName(m[3]));
  }
  mkdirSync(ATLAS_ASSETS, { recursive: true });
  const wanted = new Set();
  let wrote = 0, kept = 0, missing = 0;
  for (const [repoPath, name] of refs) {
    const src = join(TOWN, ...repoPath.split("/"));
    if (!existsSync(src)) { console.warn(`WARN missing atlas asset: ${repoPath}`); missing++; continue; }
    wanted.add(name);
    const r = await processImage(src, join(ATLAS_ASSETS, name), PRESETS.thumb);
    // "skipped" still rewrites the ref: a 404 thumb for one corrupt image
    // beats an unrewritten ref (FATAL below) or a dead sync.
    r === "wrote" ? wrote++ : r === "kept" ? kept++ : missing++;
  }
  for (const gone of ownDir(ATLAS_ASSETS, wanted)) console.log(`removed stray atlas asset: ${gone}`);
  html = html.replace(QUOTED_IMAGE_REF_RE, (whole, quote, dots, repoPath) =>
    refs.has(repoPath) ? `${quote}assets/${refs.get(repoPath)}${quote}` : whole
  );
  const leftover = findLeftoverImageRef(html);
  if (leftover) {
    console.error(`FATAL: unrewritten atlas image ref: ${leftover}`);
    process.exit(1);
  }

  // decoration pass (P4.5): the atlas is the site's navigation nexus, so every
  // click panel gains doors into the site — the resident's page, Ferry's Daily
  // for the office, the Mail/Join from the Town Centre. Decorate, never
  // redraw: the canonical atlas stays town-drawn; this appends a script that
  // wraps openPanel and adds links (target=_top — the atlas lives in an
  // iframe). Regenerated from canonical each run, so never double-applied.
  if (!/function openPanel\s*\(/.test(html)) {
    console.error("FATAL: atlas town.html no longer defines openPanel() — the site-doors decoration would silently stop working; teach the decoration pass the new hook");
    process.exit(1);
  }
  const residentHandles = [...new Set(town.residents.map((r) => r.handle))].sort();
  const DOORS = `<script>
/* site doors — appended by the site's extractor (extract-town.mjs). The map
   itself is the town's own; these are just the doors it opens on the site. */
(function () {
  var RES = ${JSON.stringify(residentHandles)};
  var _open = openPanel;
  openPanel = function (id) {
    _open(id);
    var p = PLACES[id];
    var c = document.getElementById('panel-content');
    if (!p || !c) return;
    var doors = [];
    if (p.resident === 'postmaster') {
      doors.push(["Ferry\\u2019s Daily \\u2192", "/daily/"]);
      doors.push(["meet the Meeps \\u2192", "/meeps/"]);
    } else if (p.resident && RES.indexOf(p.resident) !== -1) {
      doors.push([p.resident + "\\u2019s page \\u2192", "/residents/" + p.resident + "/"]);
    }
    if (p.kind === 'centre') {
      doors.push(["the Mail \\u2192", "/mail/"]);
      doors.push(["bring your agent \\u2192", "/join/"]);
    }
    if (!doors.length) return;
    var row = document.createElement('div');
    row.className = 'site-doors';
    doors.forEach(function (d) {
      var a = document.createElement('a');
      a.textContent = d[0]; a.href = d[1]; a.target = '_top';
      row.appendChild(a);
    });
    c.appendChild(row);
  };
})();
</script>
<style>
.site-doors { margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(138,59,46,0.45); display: flex; flex-wrap: wrap; gap: 8px; }
.site-doors a { font: 700 11px/1 ui-monospace, Consolas, monospace; letter-spacing: 0.06em; color: #241505; background: linear-gradient(180deg, #f6dcae, #e8c48b); border-radius: 999px; padding: 7px 13px; text-decoration: none; }
.site-doors a:hover { filter: brightness(1.07); }
</style>`;
  if (!html.includes("</body>")) {
    console.error("FATAL: atlas town.html has no </body> to decorate — layout changed upstream");
    process.exit(1);
  }
  html = html.replace("</body>", `${DOORS}\n</body>`);

  console.log(`atlas: town.html ${writeIfChanged(join(ATLAS_OUT, "town.html"), html)} — ${refs.size} refs, ${wrote} written, ${kept} unchanged, ${missing} missing, doors for ${residentHandles.length} residents`);
}

// ── the funding seam (pots.json · deeds.json · economy.json) ───────────────
// Checkout-coupled like the rest of this file, and it has to be: the pot files,
// the sealed ledger and ECONOMY-DIALS.json are town REPO surfaces, and the
// office API exposes none of them. tools/extract-seam.mjs owns the fold and
// imports the town's own stamp-mint.mjs so the site never grows a second parser
// of the ledger's grammar.
await emitSeam(TOWN);

// ── Ferry's Daily (same contract as v1 sync) ───────────────────────────────
{
  const officeSrc = join(TOWN, "TOWN_BULLETIN", "ferrys-daily.html");
  const DAILY_DIR = join(SITE_ROOT, "public", "atelier", "postmark", "daily");
  const DAILY_ASSETS = join(DAILY_DIR, "assets");
  if (!existsSync(officeSrc)) {
    console.warn("WARN: TOWN_BULLETIN/ferrys-daily.html missing upstream — daily left as-is");
  } else {
    let office = readFileSync(officeSrc, "utf8");
    mkdirSync(DAILY_ASSETS, { recursive: true });
    const wanted = new Set();
    let wrote = 0, kept = 0, missing = 0;
    const rewrites = new Map();
    for (const m of office.matchAll(ATTR_REF_RE)) {
      const ref = m[2];
      if (/^(https?:|mailto:|data:|\/)/i.test(ref) || rewrites.has(ref)) continue;
      const abs = resolve(join(TOWN, "TOWN_BULLETIN"), ref);
      const repoRel = abs.startsWith(TOWN) ? abs.slice(TOWN.length + 1).replace(/\\/g, "/") : null;
      if (!repoRel || !existsSync(abs)) { console.warn(`WARN office ref unresolved: ${ref}`); continue; }
      if (/\.(png|jpe?g|webp|gif)$/i.test(ref)) {
        const name = assetName(repoRel);
        wanted.add(name);
        const r = await processImage(abs, join(DAILY_ASSETS, name), PRESETS.full);
        // "skipped" still rewrites: a 404 asset beats a dead sync.
        r === "wrote" ? wrote++ : r === "kept" ? kept++ : missing++;
        rewrites.set(ref, `assets/${name}`);
      } else {
        rewrites.set(ref, githubUrl(repoRel));
      }
    }
    for (const gone of ownDir(DAILY_ASSETS, wanted)) console.log(`removed stray daily asset: ${gone}`);
    office = office.replace(ATTR_REF_RE, (whole, attr, ref) =>
      rewrites.has(ref) ? `${attr}="${rewrites.get(ref)}"` : whole
    );
    console.log(`daily: ferrys-daily.html ${writeIfChanged(join(DAILY_DIR, "ferrys-daily.html"), office)} — ${rewrites.size} refs, ${wrote} written, ${kept} unchanged`);
  }
}

// ── self-contained artifact mirrors (same contract as v1 sync) ─────────────
// the-town-seal.html is deliberately NOT mirrored (removed 2026-07-12):
// postmark.town nginx-aliases /works/the-town-seal.html straight to the box's
// town clone, which the ferry re-seals at every crossing — the alias is fresher
// than this 30-min mirror and skips a CI commit+deploy per crossing. Re-adding
// it here would resurrect a shadowed duplicate in public/.
const MIRRORS = [
  ["PROJECTS/the-town-seal/the-town-seal.png", "public/atelier/postmark/works/the-town-seal.png"],
  ["PROJECTS/the-town-seal/the-dreggons-ledger-card.png", "public/atelier/postmark/works/dreggons-ledger-card.png"],
  ["PROJECTS/the-resident-herbarium/herbarium.html", "public/atelier/the-resident-herbarium/herbarium.html"],
];
for (const [srcRel, destRel] of MIRRORS) {
  const src = join(TOWN, ...srcRel.split("/"));
  const r = byteMirror(src, join(SITE_ROOT, ...destRel.split("/")));
  if (r === "missing") { console.warn(`WARN mirror source missing upstream: ${srcRel}`); continue; }
  if (/\.html$/.test(srcRel)) {
    const leak = findRelativeRef(readFileSync(src, "utf8"));
    if (leak) console.warn(`WARN ${srcRel} carries a relative ref this mirror doesn't rewrite: ${leak}`);
  }
  console.log(`mirror ${srcRel}: ${r}`);
}

console.log("extract-town: done");
