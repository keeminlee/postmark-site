// rail-feed-shots.mjs — rendered QA for the side-rail lane (2026-08-29).
//
//   node qa-shots/cockpit-harness.mjs 4321 &
//   BASE=http://127.0.0.1:4321 node qa-shots/rail-feed-shots.mjs
//
// WHY A SHOT RUNNER. All three of this lane's rulings are about a thing landing
// on a screen: a section that has to defeat the viewer's own `hidden`, a list
// whose ORDER is flipped in CSS, a scrollport that must follow or hold, and a
// picture that either loads from a real URL or does not. None of that is
// reachable from a unit test, and this repo has been caught by exactly that gap
// before — "the machine twin read the text and reported it present; the
// screenshot is what caught it".
//
// So these read GEOMETRY: measured rectangles, scroll positions, naturalWidth.
// The shots beside them are for the pair of eyes; the checks are what can fail.
//
// Playwright is resolved out of G:/Wright-HQ, the same as the runner next door.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("G:/Wright-HQ/package.json");
const { chromium } = require("playwright");

// NOT 4321. That is Astro's own default and a preview server sitting on it will
// answer every path with the built site's 404 page — which looks exactly like a
// harness that mounted nothing, and cost an hour the first time.
const BASE = process.env.BASE ?? "http://127.0.0.1:4399";
const OUT = join(process.cwd(), "qa-shots", "rail-feed");
mkdirSync(OUT, { recursive: true });

const checks = [];
const record = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}  —  ${detail}`);
};
const shot = (page, name) => page.screenshot({ path: join(OUT, `${name}.png`) });

const openHarness = async (browser, query, size = { width: 1440, height: 900 }) => {
  const page = await browser.newPage({ viewport: size });
  page.on("pageerror", (e) => record("no page error", false, String(e)));
  await page.goto(`${BASE}/qa-shots/cockpit-harness.html?${query}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__cockpitReady?.mounted === true, null, { timeout: 10_000 });
  return page;
};

const run = async () => {
  const browser = await chromium.launch();
  // A THROW MUST STILL CLOSE THE BROWSER. Without this a failed wait leaves
  // chromium open, node never exits, and the run looks like a hang rather than
  // like the failure it is.
  process.on("uncaughtException", async (e) => { console.error(e); await browser.close(); process.exit(1); });
  try {

  // ── ① the rail: shape, order, scroll ──────────────────────────────────────
  {
    const page = await openHarness(browser, "fixture=vault&rail=1&fight=1");
    // four poll ticks at 2.5s, plus slack for the last derivation to draw
    await page.waitForTimeout(12_000);
    await shot(page, "01-rail-feed-desktop");

    const m = await page.evaluate(() => {
      const box = document.querySelector(".wv .wv-activity");
      const acts = [...document.querySelectorAll(".wv-acts .wv-act-line")];
      const feed = document.querySelector(".pmc-feed");
      const lines = [...document.querySelectorAll(".pmc-fline")].map((el) => el.textContent.trim());
      const r = (el) => (el ? el.getBoundingClientRect().toJSON() : null);
      return {
        sectionHidden: box?.hasAttribute("hidden") ?? null,
        sectionShown: box ? getComputedStyle(box).display : null,
        canScroll: box ? box.scrollHeight > box.clientHeight + 2 : false,
        scrollTop: box?.scrollTop ?? null,
        scrollBottom: box ? box.scrollHeight - box.clientHeight : null,
        sectionTop: box ? box.getBoundingClientRect().top : null,
        h2: r(box?.querySelector("h2")),
        firstAct: r(acts[0]), lastAct: r(acts[acts.length - 1]),
        feedTop: r(feed)?.top ?? null,
        lines,
        htmlAttr: document.documentElement.getAttribute("data-pmc-feed"),
      };
    });

    record("the reshape hangs on one attribute", m.htmlAttr === "1", `data-pmc-feed=${m.htmlAttr}`);
    record("the viewer's own hidden section is still hidden, and shown anyway",
      m.sectionHidden === true && m.sectionShown === "flex",
      `hidden attribute ${m.sectionHidden}, computed display ${m.sectionShown}`);
    // ⚑ THE FLIP. renderActivity writes newest FIRST into the DOM; column-reverse
    // draws that same DOM oldest-at-top. So the DOM-first line must sit LOWER on
    // the screen than the DOM-last one.
    record("Lately reads oldest-at-top — the viewer's newest-first DOM, flipped",
      m.firstAct && m.lastAct && m.firstAct.top > m.lastAct.top,
      `newest row at y=${Math.round(m.firstAct?.top)}, oldest at y=${Math.round(m.lastAct?.top)}`);
    record("the cockpit's half sits under the record, not over it",
      m.feedTop != null && m.firstAct && m.feedTop > m.firstAct.top,
      `feed at y=${Math.round(m.feedTop)}, newest record row at y=${Math.round(m.firstAct?.top)}`);
    record("the section is a scrollport", m.canScroll,
      `scrollHeight - clientHeight = ${m.scrollBottom}`);
    record("and it is pinned to the bottom, because the reader never scrolled up",
      m.canScroll && Math.abs(m.scrollTop - m.scrollBottom) <= 24,
      `scrollTop ${Math.round(m.scrollTop)} of ${Math.round(m.scrollBottom)}`);
    // ⚑ NO STRIP ABOVE THE STICKY HEADING. Sticky pins at the CONTENT box, so
    // the section's own top padding stayed transparent and a scrolling row
    // printed through it — a line of the record sliced in half above the word
    // LATELY. The invariant is that the heading IS the top of the scrollport.
    record("the sticky heading is the top of the scrollport, with no strip above it",
      m.h2 != null && m.sectionTop != null && m.h2.top - m.sectionTop <= 2,
      `heading top ${Math.round(m.h2?.top)}, section top ${Math.round(m.sectionTop)}`);
    record("the fight is in the feed", m.lines.some((t) => /takes \d/.test(t)),
      `${m.lines.length} lines; last: ${JSON.stringify(m.lines.slice(-3))}`);
    record("and what is being said is in it too", m.lines.some((t) => /mind the ninth tier/.test(t)),
      `says present: ${m.lines.some((t) => /ninth tier/.test(t))}`);

    // ⚑ THE OLDEST ROW MUST BE REACHABLE. "you can scroll UP to see older
    // things" is half the ruling, and it was the half that broke: a
    // column-reverse list that shrinks overflows out of its START edge, and
    // overflow above a scrollport's top cannot be scrolled to at all. The rows
    // were painted, present in the DOM, and unreachable — which no assertion
    // about their existence would have caught.
    await page.evaluate(() => { document.querySelector(".wv .wv-activity").scrollTop = 0; });
    await page.waitForTimeout(200);
    await shot(page, "01b-rail-scrolled-to-oldest");
    const top = await page.evaluate(() => {
      const box = document.querySelector(".wv .wv-activity").getBoundingClientRect();
      const acts = [...document.querySelectorAll(".wv-acts .wv-act-line")];
      const oldest = acts[acts.length - 1].getBoundingClientRect();
      return { boxTop: Math.round(box.top), boxBottom: Math.round(box.bottom), oldestTop: Math.round(oldest.top) };
    });
    record("scrolled all the way up, the oldest row is inside the section",
      top.oldestTop >= top.boxTop - 1 && top.oldestTop < top.boxBottom,
      `oldest row at y=${top.oldestTop}, section ${top.boxTop}..${top.boxBottom}`);

    // ── the other half of the chat contract: scrolled up, it HOLDS ──────────
    //
    // ⚑ THE ARRIVAL IS A REAL ONE. The first cut of this check appended an <li>
    // to the feed by hand and set the pill's hidden attribute itself — which
    // proved the CSS and nothing about the contract, and then failed for a
    // reason that was entirely its own doing (nothing had marked anything
    // pending, so the next tick correctly hid a pill nothing had earned). So
    // somebody SAYS something instead, and it arrives down the page's own road:
    // the conversations poll, the merge, the draw.
    await page.evaluate(() => { document.querySelector(".wv .wv-activity").scrollTop = 0; });
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      window.__spoken.push({ handle: "wright", said: "a line that arrived while you were reading history",
        at_ms: Date.now(), x: 1090, y: -787 });
    });
    // the voices poll runs on a seven second clock
    await page.waitForFunction(
      () => { const p = document.querySelector(".pmc-feed-new"); return p && !p.hidden; },
      null, { timeout: 12_000 },
    ).catch(() => {});
    await shot(page, "02-rail-scrolled-up");
    const held = await page.evaluate(() => {
      const box = document.querySelector(".wv .wv-activity");
      const pill = document.querySelector(".pmc-feed-new");
      const lines = [...document.querySelectorAll(".pmc-fline")].map((e) => e.textContent);
      return {
        top: Math.round(box.scrollTop),
        arrived: lines.some((t) => /reading history/.test(t)),
        pillShown: Boolean(pill && !pill.hidden && pill.getClientRects().length > 0),
      };
    });
    record("a line said while the reader is scrolled up does arrive", held.arrived,
      `the said line is in the feed: ${held.arrived}`);
    record("scrolled up, the feed holds where the reader left it", held.top === 0,
      `scrollTop ${held.top}`);
    record("and says there is something new below", held.pillShown === true,
      `the new-below pill is ${held.pillShown ? "visible" : "not visible"}`);

    await page.close();
  }

  // ── ①b the tail: whole attributed lines, and the delta stood down ────────
  {
    const page = await openHarness(browser, "fixture=vault&rail=1&fight=1&tail=1");
    await page.waitForTimeout(12_000);
    await shot(page, "06-rail-feed-tail");
    const lines = await page.evaluate(() =>
      [...document.querySelectorAll(".pmc-fline")].map((el) => el.textContent.trim()));
    // The sentence the receiving voice was standing in for.
    record("a tail gives the founder's own sample line, whole",
      lines.some((t) => /^the unlit cake strikes jetto-of-starforge — 2\./.test(t) && /is down\./.test(t) && /clatters to the floor\./.test(t)),
      JSON.stringify(lines.filter((t) => /clatters/.test(t))));
    record("and it names the hand on every beat, not just the effect",
      lines.some((t) => /^jetto-of-starforge strikes the unlit cake — 11 \(the good lighter, \+3\)\. 38 left\.$/.test(t)),
      JSON.stringify(lines.filter((t) => /38 left/.test(t))));
    record("a miss is in the tail too", lines.some((t) => /vermillion casts at .* and misses — 4\./.test(t)),
      JSON.stringify(lines.filter((t) => /misses/.test(t))));
    // ⚑ THE DELTA MUST HAVE STOOD DOWN. Its lines are recognisable by their
    // voice — "X takes N" with no hand on it — and by the unseen confession,
    // which belongs to that road alone.
    record("the delta stood down — no receiving-voice line, no unseen confession",
      !lines.some((t) => /^(jetto-of-starforge|vermillion) takes \d/.test(t))
      && !lines.some((t) => /no door to read/.test(t)),
      JSON.stringify(lines.filter((t) => / takes \d|no door to read/.test(t))));
    // The one thing switching roads quietly lost, caught by reading the two
    // shots side by side: the round divider was a delta-only line.
    record("the round rule survives on the tail road",
      lines.filter((t) => /^—\s*round 4\s*—$/i.test(t.replace(/\s+/g, " "))).length === 1,
      JSON.stringify(lines.filter((t) => /round/i.test(t))));
    record("and nothing is told twice",
      new Set(lines).size === lines.length, `${lines.length} lines, ${new Set(lines).size} distinct`);
    await page.close();
  }

  // ── ①c THE LIVE BUG: a rail that arrives in waves ────────────────────────
  //
  // The founder on dev, after a hard reload: "lately isn't scrolled down
  // correctly". A static fixture cannot produce it — the real viewer fills
  // Lately from three async loads, each rewriting .wv-acts long after the
  // cockpit drew and pinned. ?waves=1 reproduces that shape.
  {
    const page = await openHarness(browser, "fixture=vault&rail=1&fight=1&tail=1&waves=1");
    // one wave lands at 1.2s, then 3.8s, then 6.4s; wait past the last with slack
    await page.waitForTimeout(11_000);
    await shot(page, "07-rail-waves");
    const m = await page.evaluate(() => {
      const box = document.querySelector(".wv .wv-activity");
      const feed = document.querySelector(".pmc-feed");
      const last = feed?.lastElementChild;
      const br = box.getBoundingClientRect();
      const lr = last?.getBoundingClientRect();
      return {
        rows: document.querySelectorAll(".wv-acts .wv-act-line").length,
        scrollTop: Math.round(box.scrollTop),
        scrollBottom: Math.round(box.scrollHeight - box.clientHeight),
        lastVisible: lr ? lr.bottom <= br.bottom + 2 && lr.top >= br.top - 2 : false,
        lastText: last?.textContent.trim() ?? null,
      };
    });
    // ⚑ THE PAGE MUST STILL BE ANSWERING. The first cut of the watch pinned on
    // its own pill toggle and spun the tab into an unbreakable loop — it did not
    // fail a check, it hung the runner. Asked explicitly so that failure has a
    // name next time.
    const alive = await Promise.race([
      page.evaluate(() => 1 + 1),
      new Promise((r) => setTimeout(() => r("timed out"), 4000)),
    ]);
    record("the page is still responsive — the watch is not pinning on its own writes",
      alive === 2, String(alive));
    record("all three waves landed", m.rows === 5, `${m.rows} record rows`);
    // ⚑ THE ACTUAL COMPLAINT. Every wave grows the content ABOVE the feed while
    // the section keeps its scrollTop, walking the reader off the bottom.
    record("the feed is still pinned to the bottom after the rail arrives in waves",
      Math.abs(m.scrollTop - m.scrollBottom) <= 2,
      `scrollTop ${m.scrollTop} of ${m.scrollBottom}`);
    record("and the newest line is actually on screen",
      m.lastVisible, `last line "${m.lastText}" visible: ${m.lastVisible}`);

    // and the other half still holds: scrolled up, a late wave must NOT yank
    // the reader back down
    await page.evaluate(() => { document.querySelector(".wv .wv-activity").scrollTop = 0; });
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      const list = document.querySelector(".wv-acts");
      list.innerHTML = '<li class="wv-act-line is-walk"><span class="who">a late wave</span> set out</li>' + list.innerHTML;
    });
    await page.waitForTimeout(400);
    const held = await page.evaluate(() => Math.round(document.querySelector(".wv .wv-activity").scrollTop));
    record("a wave landing while the reader is scrolled up does not yank them down",
      held === 0, `scrollTop ${held}`);
    await page.close();
  }

  // ── ② the dock's pictures ────────────────────────────────────────────────
  {
    const page = await openHarness(browser, "fixture=vault&rail=1");
    // the profile reads are a fetch to the real town repo — give them room
    await page.waitForTimeout(6000);
    await shot(page, "03-dock-portraits");
    const faces = await page.evaluate(() => [...document.querySelectorAll(".pmc-face")].map((b) => {
      const img = b.querySelector("img");
      return {
        actor: b.getAttribute("data-actor"),
        src: img?.getAttribute("src") ?? null,
        loaded: img ? img.naturalWidth > 0 : false,
        letter: b.querySelector(".pmc-mono")?.textContent ?? b.textContent.trim().slice(0, 1),
        box: b.getBoundingClientRect().toJSON(),
      };
    }));
    const wright = faces.find((f) => f.actor === "wright");
    const jetto = faces.find((f) => f.actor === "jetto-of-starforge");
    const human = faces.find((f) => f.actor === "human:self");
    record("a resident with an avatar wears it, from the URL the derivation builds",
      Boolean(wright?.loaded) && /raw\.githubusercontent\.com\/postmark-town\/postmark\/main\/WHITE_PAGES\/wright\/avatar\.jpg$/.test(wright?.src ?? ""),
      `${wright?.src} loaded=${wright?.loaded}`);
    record("a resident with none wears the letter, which is not a failure",
      jetto && !jetto.src && jetto.letter === "J", `jetto: src=${jetto?.src} letter=${jetto?.letter}`);
    record("the human keeps the token the stage serves",
      Boolean(human?.loaded) && human?.src === "/birthday/darko-token.png", `${human?.src} loaded=${human?.loaded}`);
    // ⚑ AND THE WHEEL TOO — for every hand in the room, not only the ones this
    // key can act as. vermillion is on the wheel and not in the dock; resolving
    // pictures through the roster alone left her wearing a letter beside two
    // portraits, which is the same inconsistency one surface along.
    const pips = await page.evaluate(() => [...document.querySelectorAll(".pmc-turn")].map((li) => {
      const img = li.querySelector("img");
      return { nm: li.querySelector(".nm")?.textContent ?? "", src: img?.getAttribute("src") ?? null, loaded: img ? img.naturalWidth > 0 : false };
    }));
    const verm = pips.find((r) => r.nm === "vermillion");
    const cake = pips.find((r) => /cake/.test(r.nm));
    record("a hand on the wheel who is not on this key still gets her face",
      Boolean(verm?.loaded) && /WHITE_PAGES\/vermillion\/avatar\.jpg$/.test(verm?.src ?? ""),
      `vermillion pip: ${verm?.src} loaded=${verm?.loaded}`);
    record("and the creature is not given one — it is not a resident",
      cake != null && cake.src === null, `cake pip src: ${cake?.src}`);

    // ── ONE HOVER, ONE CARD (founder, live 2026-08-29, screenshot-verified) ──
    //
    // Reproduced here before it was fixed: the standpoint plate at 642..741 and
    // the human face's name box at 738..789, stacked, the box also covering the
    // ACT AS caption — plus the dock's native `title` tooltip as a third, on the
    // browser's own clock.
    await page.hover('.pmc-face[data-actor="human:self"]');
    await page.waitForTimeout(1200); // past the browser's own tooltip delay
    await shot(page, "08-human-hover");
    const cards = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll(".pmc-nm, .pmc-here")) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (cs.opacity !== "0" && cs.display !== "none" && r.width > 0)
          out.push({ cls: el.className, txt: el.textContent.trim(), box: r.toJSON() });
      }
      return { out, titles: [...document.querySelectorAll("[data-pmc] [title]")].map((e) => e.getAttribute("title")) };
    });
    record("hovering the human face shows exactly one card",
      cards.out.length === 1 && /pmc-nm/.test(cards.out[0]?.cls ?? ""),
      cards.out.map((c) => c.cls).join(" + ") || "(none)");
    record("and no native tooltip rides under it",
      cards.titles.length === 0, JSON.stringify(cards.titles));
    record("the card is the name and one short line — no grants recitation",
      (cards.out[0]?.txt.length ?? 999) <= 110 && !/grants them/.test(cards.out[0]?.txt ?? ""),
      `${cards.out[0]?.txt.length} chars: ${JSON.stringify(cards.out[0]?.txt)}`);
    // the long form is not lost — it moved to the panel
    await page.hover(".pmc-roster .pmc-cap");
    await page.waitForTimeout(400);
    const plate = await page.evaluate(() => {
      const el = document.querySelector(".pmc-here");
      return { op: getComputedStyle(el).opacity, txt: el.textContent.trim() };
    });
    record("hovering the dock itself still opens the standpoint plate",
      plate.op === "1", `opacity ${plate.op}`);
    record("and the plate carries the door's whole sentence, verbatim",
      /a portal's ground seats a human/.test(plate.txt) && /journals on every act/.test(plate.txt),
      plate.txt.slice(0, 120));

    record("every face is drawn at the same size",
      faces.length > 1 && new Set(faces.map((f) => Math.round(f.box.width))).size === 1,
      faces.map((f) => `${f.actor}:${Math.round(f.box.width)}`).join(" "));
    await page.close();
  }

  // ── ③ auto-select on the turn ────────────────────────────────────────────
  {
    // The vault fixture's wheel rests on the human, so the dock must NOT take a
    // resident's seat for it. Then the turn is moved to a handle this key holds,
    // and the dock must follow — through pm:act-as, which is listened for here.
    const page = await openHarness(browser, "fixture=vault&rail=1");
    await page.waitForTimeout(1200);
    const before = await page.evaluate(() => document.querySelector('.pmc-face[aria-pressed="true"]')?.getAttribute("data-actor"));
    record("a turn belonging to nobody on this key moves no seat",
      before !== "wright" && before !== "jetto-of-starforge",
      `selected: ${before}`);

    const after = await page.evaluate(async () => {
      const seen = [];
      window.addEventListener("pm:act-as", (e) => seen.push(e.detail?.actor));
      // the door's next answer, with the wheel come round to a handle this key holds
      const handle = window.__cockpitHandle;
      if (!handle) return { error: "the harness does not expose the mount handle" };
      const base = window.__cockpitAnswer;
      handle.update({ ...base, encounter: { ...base.encounter, turn: "wright" } });
      await new Promise((r) => setTimeout(r, 300));
      return {
        seen,
        selected: document.querySelector('.pmc-face[aria-pressed="true"]')?.getAttribute("data-actor"),
      };
    });
    record("the dock takes the seat when the turn becomes a handle this key holds",
      after.selected === "wright", `selected: ${after.selected}${after.error ? ` (${after.error})` : ""}`);
    record("and it speaks pm:act-as rather than writing the viewer's choice",
      Array.isArray(after.seen) && after.seen.includes("wright"), `events: ${JSON.stringify(after.seen)}`);
    await shot(page, "04-turn-autoselect");
    await page.close();
  }

  // ── the phone: the viewer hides the rail below 720, so nothing must break ──
  {
    const page = await openHarness(browser, "fixture=vault&rail=1", { width: 390, height: 780 });
    await page.waitForTimeout(1500);
    await shot(page, "05-phone");
    const ok = await page.evaluate(() => {
      const bar = document.querySelector(".pmc-barrow");
      const nav = document.querySelector(".wv-nav");
      return {
        barShown: Boolean(bar?.getClientRects().length),
        overflowX: document.documentElement.scrollWidth <= window.innerWidth + 1,
        railShown: Boolean(nav?.getClientRects().length),
        feedMounted: Boolean(document.querySelector(".pmc-feed")),
      };
    });
    record("the bar still stands at 390", ok.barShown, `bar visible: ${ok.barShown}`);
    record("and nothing pushes the page sideways", ok.overflowX, `no horizontal overflow: ${ok.overflowX}`);
    // ⚑ A LIMITATION, NAMED. The viewer hides its whole rail below 720px, so on
    // a phone there is no Lately section — and therefore no feed. This is the
    // viewer's own responsive rule, not something this lane can reach from the
    // site repo; the check exists so the day it changes, this says so.
    record("on a phone the viewer has no rail, so the feed has no home",
      !ok.railShown, `rail visible at 390: ${ok.railShown}, feed element present: ${ok.feedMounted}`);
    await page.close();
  }

  } finally {
    await browser.close();
  }
  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length} of ${checks.length} pass · shots in ${OUT}`);
  if (failed.length) process.exitCode = 1;
};

run().catch((e) => { console.error(e); process.exitCode = 1; });
