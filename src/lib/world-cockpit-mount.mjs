// world-cockpit-mount.mjs — the cockpit's pixels.
//
// DOM only. Nothing here fetches, and nothing here decides what may be done: the
// caller hands it an ANSWER (the apex door's), an identity, the map's grid, and a
// `dispatch` function, and this draws exactly what those say. Split from the
// component so the renderer can be mounted against a fixture answer — which is the
// only way to look at a portal cockpit before any portal exists.
//
// Every word the bar shows about an act comes off the door's entry, through
// `world-cockpit.mjs`. There is no verb list here.

import {
  HUMAN_ACTOR, actorsFor, barSlots, cockpitShows, dialLine, dispatchEnvelope,
  portalOf, readBounce, statedLimit, termsFromRead, termsRows, tokenFor, tokenPlacement,
  wantsTextarea, worldToPx,
} from "./world-cockpit.mjs";

const NS = "http://www.w3.org/2000/svg";

// The mockup's palette, and the reason it is repeated here rather than borrowed:
// the world page renders NO site layout (it is a verbatim passthrough of the
// viewer shell), so there are no site tokens on this page to inherit. These are
// the values from the cockpit mockup — panel/gold/ink — and they are the viewer's
// own family, not a second visual language.
//
// ⚠ NO BACKTICKS BELOW, INCLUDING IN THE COMMENTS. This is a template literal, and
// a backtick in prose ENDS IT — the rest of the stylesheet then parses as JS and
// the whole module throws at import. It happened twice in one evening, the second
// time inside the comment written about the first, which is why the export and the
// falsifier below exist: care was not enough, so the last rule in this block is
// now something a test can look for.
export const COCKPIT_CSS = `
.pmc, .pmc * { box-sizing: border-box; }
.pmc {
  --pmc-ink:#e8e4da; --pmc-dim:#9aa1ad; --pmc-gold:#d9a860; --pmc-gold-dim:#8a6a30;
  --pmc-panel:rgba(14,18,26,.90); --pmc-line:rgba(217,168,96,.45);
  --pmc-live:#e0b25c;
  position: fixed; inset: 0; z-index: 7000; pointer-events: none;
  font: 15px/1.5 Georgia, "Times New Roman", serif; color: var(--pmc-ink);
}
/* The cockpit is dark in every theme on purpose: it is chrome over a night map,
   and a light panel here would be a hole punched in the painting. */
.pmc-plate {
  background: var(--pmc-panel); border: 1px solid var(--pmc-line); border-radius: 8px;
  box-shadow: 0 2px 14px rgba(0,0,0,.55); pointer-events: auto;
}
.pmc-cap {
  color: var(--pmc-dim); font: 0.62rem/1 ui-monospace, Consolas, monospace;
  letter-spacing: .18em; margin-bottom: .55em; text-align: center;
}

/* ── the roster ── */
.pmc-roster { position: absolute; left: 14px; top: 30%; width: 5.6em; padding: .6em .4em .5em; text-align: center; }
/* THE PICTURE IS CLIPPED, NOT THE BUTTON. An overflow:hidden here rounded the
   token off nicely and also ate the name box, which hangs outside the circle by
   design: the box was in the DOM with opacity 1 and a 239px width, and no reader
   could see a pixel of it. The machine twin read the text and reported it present;
   the screenshot is what caught it. */
.pmc-face {
  width: 3em; height: 3em; margin: 0 auto .55em; border-radius: 50%; padding: 0;
  background: #1b2230; border: 2px solid rgba(154,161,173,.35); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--pmc-dim); font: 1em/1 ui-monospace, Consolas, monospace; position: relative;
}
.pmc-face img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 50%; }
.pmc-face[aria-pressed="true"] { border-color: var(--pmc-gold); box-shadow: 0 0 12px rgba(217,168,96,.5); color: var(--pmc-gold); }
.pmc-face[disabled] { opacity: .4; cursor: not-allowed; }
.pmc-face:focus-visible { outline: 2px solid var(--pmc-gold); outline-offset: 2px; }
.pmc-rule { border-top: 1px dotted rgba(154,161,173,.4); margin: .2em .3em .6em; }
.pmc-law { color: var(--pmc-dim); font-size: .6rem; font-style: italic; line-height: 1.4; margin-top: .3em; }
.pmc-nm {
  position: absolute; left: calc(100% + .5em); top: 50%; transform: translateY(-50%);
  background: var(--pmc-panel); border: 1px solid var(--pmc-line); border-radius: 5px;
  padding: .15em .55em; font: .68rem/1.4 Georgia, serif; color: var(--pmc-ink);
  white-space: nowrap; max-width: 22em; opacity: 0; transition: opacity .12s; pointer-events: none;
}
.pmc-face:hover .pmc-nm, .pmc-face:focus-visible .pmc-nm { opacity: 1; }
/* the hovered face rises, so its name box is never painted under the next face */
.pmc-face:hover, .pmc-face:focus-visible { z-index: 2; }
.pmc-nm.wrap { white-space: normal; width: 16em; }

/* ── the bar ── */
/* THE BAR IS A ROW, and it stays one. Wrapping was the default and the first
   shot showed what it costs: six fixed seats on one line, the HERE divider
   stranded with ENTER after it, and the afforded tray on a second line below —
   which is the taxonomy the whole bar exists to show, broken. So it does not
   wrap; where a ground grants more than fits, the row scrolls, and the fixed
   seats stay where the hand expects them. */
.pmc-bar {
  position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%);
  display: flex; align-items: stretch; gap: .45em;
  max-width: calc(100vw - 28px); flex-wrap: nowrap;
  justify-content: flex-start; pointer-events: none;
  overflow-x: auto; overflow-y: visible; scrollbar-width: thin;
  padding: 0 .2em 2px;
}
/* A SCROLLPORT CLIPS BOTH AXES — set overflow-x and overflow-y computes to auto
   with it — so a bar that can scroll would eat the very cards that hang above it.
   That is why the card and the form are not children of a slot: they live in the
   overlay and are positioned against the hovered seat, which also lets a card near
   the screen edge stay on screen instead of hanging off it. */
.pmc-bar { scroll-padding-inline: 1em; }
.pmc-slot { flex: 0 0 auto; }
/* A ROW THAT SCROLLS MUST SAY SO. At 390 the bar showed five seats and no sign
   there were five more — a reader on a phone would never find the afforded-here
   tray, which on this surface is the half that is actually about where they are
   standing. The classes are set by the script from a real measurement, so the
   cue appears only when something is genuinely off the edge. */
.pmc-bar.more-right { mask-image: linear-gradient(to right, #000 calc(100% - 3.5em), transparent 100%); }
.pmc-bar.more-left { mask-image: linear-gradient(to right, transparent 0, #000 3.5em); }
.pmc-bar.more-left.more-right { mask-image: linear-gradient(to right, transparent 0, #000 3.5em, #000 calc(100% - 3.5em), transparent 100%); }
.pmc-more {
  position: fixed; z-index: 5; pointer-events: none;
  color: var(--pmc-gold); font: .8rem/1 ui-monospace, Consolas, monospace;
  text-shadow: 0 0 8px rgba(0,0,0,.9);
}
.pmc-more[hidden] { display: none; }
.pmc-slot {
  background: var(--pmc-panel); border: 1px solid var(--pmc-line); border-radius: 8px;
  min-width: 6.2em; padding: .95em .7em .5em; text-align: center; position: relative;
  cursor: pointer; pointer-events: auto; color: inherit; font: inherit;
  display: flex; flex-direction: column; justify-content: flex-end;
}
.pmc-slot:hover:not([disabled]), .pmc-slot:focus-visible { border-color: var(--pmc-gold); box-shadow: 0 0 14px rgba(217,168,96,.35); }
.pmc-slot:focus-visible { outline: none; }
.pmc-slot[disabled] { opacity: .38; cursor: not-allowed; }
.pmc-key { position: absolute; top: .3em; left: .45em; color: var(--pmc-dim); font: .68rem/1 ui-monospace, Consolas, monospace; }
.pmc-name { color: var(--pmc-ink); font-size: .95em; letter-spacing: .04em; }
/* Capped, because one verbose class can otherwise set the width of the whole row
   — a two-dial class (reach_m 3 · burns_crossings 2) made KINDLE twice its
   neighbours' width in the first shot. The full dials are on the card, which is
   where detail belongs. NOTE: this whole block is a JS template literal, so it
   can hold no backticks — one here silently ended the string and the module threw
   on the CSS that followed. */
.pmc-dial {
  color: var(--pmc-dim); font: .68rem/1.3 ui-monospace, Consolas, monospace; margin-top: .2em;
  max-width: 9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.pmc-slot.afford { border-style: dashed; }
.pmc-slot.afford .pmc-name { color: var(--pmc-gold); }
.pmc-gap { width: .7em; border-left: 1px dotted rgba(154,161,173,.4); margin: 0 .25em; align-self: stretch; display: flex; align-items: flex-end; }
.pmc-gap span { writing-mode: vertical-rl; color: var(--pmc-dim); font: .6rem/1 ui-monospace, Consolas, monospace; letter-spacing: .2em; padding-bottom: .4em; }

/* ── the card ── */
/* THE CARD TAKES NO POINTER, and this is a correctness rule rather than a nicety.
   A card is 24em wide over a 6.2em seat, so it hangs across four of its
   neighbours; with pointer-events on, sliding the mouse along the bar puts the
   previous slot's card under the cursor and the hover never reaches the seat
   beneath it. Caught by the shot runner, which could not hover SAY at all while
   EXIT's card was up. It is role="tooltip" — nothing in it was ever clickable. */
.pmc-card {
  position: fixed; width: 24em; max-width: calc(100vw - 24px);
  background: var(--pmc-panel); border: 1px solid var(--pmc-gold);
  border-radius: 8px; padding: .75em .9em; text-align: left; box-shadow: 0 4px 20px rgba(0,0,0,.6);
  z-index: 3; pointer-events: none;
}
.pmc-card[hidden] { display: none; }
.pmc-blurb { font-style: italic; color: var(--pmc-ink); font-size: .88rem; line-height: 1.45; margin: 0; }
.pmc-blurb.none { font-style: normal; color: var(--pmc-dim); }
.pmc-from { color: var(--pmc-dim); font-size: .7rem; margin: .35em 0 .5em; line-height: 1.45; }
.pmc-row { font: .74rem/1.65 ui-monospace, Consolas, monospace; color: var(--pmc-dim); margin: 0; }
.pmc-row b { color: var(--pmc-gold); font-weight: normal; }

/* ── the act form ── */
/* The form lives in the overlay, not in the bar, for the scrollport reason above.
   Bottom is set by the script against the bar's measured top edge, so it sits over
   the row whatever height the row turns out to be. */
.pmc-form { position: fixed; left: 50%; transform: translateX(-50%); width: 26em; max-width: calc(100vw - 24px); padding: .9em 1em 1em; text-align: left; z-index: 4; }
.pmc-form h3 { margin: 0 0 .2em; font: .8rem/1.3 ui-monospace, Consolas, monospace; letter-spacing: .12em; color: var(--pmc-gold); font-weight: normal; }
.pmc-form label { display: block; margin: .6em 0 0; font-size: .72rem; color: var(--pmc-dim); }
.pmc-form label .req { color: var(--pmc-gold); }
.pmc-form input, .pmc-form textarea, .pmc-form select {
  width: 100%; margin-top: .25em; padding: .4em .5em; font: .82rem/1.4 Georgia, serif;
  color: var(--pmc-ink); background: rgba(0,0,0,.35); border: 1px solid rgba(154,161,173,.35); border-radius: 5px;
}
.pmc-form textarea { min-height: 4.5em; resize: vertical; }
.pmc-desc { margin: .25em 0 0; font-size: .66rem; line-height: 1.5; color: rgba(154,161,173,.85); }
.pmc-actions { display: flex; gap: .5em; margin-top: .9em; align-items: center; }
.pmc-btn { font: .74rem/1 Georgia, serif; padding: .55em 1em; border-radius: 999px; cursor: pointer; border: 1px solid var(--pmc-line); background: transparent; color: var(--pmc-gold); }
.pmc-btn.go { background: linear-gradient(180deg,#f0d5a8,#e8c48b); color: #0d1426; border-color: #f0d5a8; }
.pmc-btn[disabled] { opacity: .5; cursor: default; }
.pmc-said { margin: .8em 0 0; font-size: .74rem; line-height: 1.55; color: var(--pmc-ink); }
.pmc-said.bad { color: var(--pmc-live); }
.pmc-said .hint { display: block; color: var(--pmc-dim); font-size: .92em; margin-top: .3em; }
.pmc-terms { margin: .6em 0 0; padding: .5em .7em; border-left: 2px solid var(--pmc-gold-dim); font-size: .72rem; line-height: 1.55; color: var(--pmc-dim); }

/* ── the standpoint plate ── */
.pmc-here { position: absolute; left: 14px; top: 14px; max-width: 24em; padding: .55em .8em; }
.pmc-here .who { color: var(--pmc-gold); font-size: .95rem; }
.pmc-here .spine { color: var(--pmc-dim); font-size: .78rem; margin-top: .25em; line-height: 1.45; }

@media (max-width: 720px) {
  .pmc-roster { top: auto; bottom: 46%; left: 8px; width: 4.4em; }
  .pmc-face { width: 2.4em; height: 2.4em; }
  .pmc-here { display: none; }
  .pmc-bar { bottom: 10px; gap: .3em; }
  .pmc-slot { min-width: 4.9em; padding: .85em .45em .45em; font-size: .86rem; }
  .pmc-card { width: 18em; }
}
`;

let cssInstalled = false;
function installCss(doc) {
  // Injected at MOUNT, never at page load: outside portal ground this file adds
  // no rule to the document at all, which is the founder's scope ruling kept
  // literally rather than only visually.
  if (cssInstalled) return;
  const el = doc.createElement("style");
  el.id = "pmc-style";
  el.textContent = COCKPIT_CSS;
  doc.head.appendChild(el);
  cssInstalled = true;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * Mount the cockpit.
 *
 * @param {object} o
 * @param {Document} o.document
 * @param {Element} o.host          where the overlay is appended
 * @param {SVGElement|null} o.svg   the map's svg, for the token; null = no token
 * @param {object} o.answer         the apex door's answer
 * @param {object|null} o.me        `GET /api/me`
 * @param {object|null} o.grid      `gridFrom(skeleton)`
 * @param {(envelope:object)=>Promise<{ok:boolean,status:number,body:any}>} o.dispatch
 * @param {(()=>Promise<object>)|null} o.refresh  re-read the door after an act
 * @returns {{destroy:()=>void, update:(answer:object)=>void}|null}
 */
export function mountCockpit(o) {
  const doc = o.document;
  if (!cockpitShows(o.answer)) return null;
  installCss(doc);

  const state = {
    answer: o.answer,
    acting: null,      // handle | HUMAN_ACTOR
    open: null,        // the action whose form is open
    said: null,        // the last thing the door said back
  };

  const root = doc.createElement("div");
  root.className = "pmc";
  root.setAttribute("data-pmc", "");
  o.host.appendChild(root);

  let tokenLayer = null;
  if (o.svg) {
    tokenLayer = doc.createElementNS(NS, "g");
    tokenLayer.setAttribute("id", "pmc-token-layer");
    tokenLayer.setAttribute("pointer-events", "none");
    o.svg.appendChild(tokenLayer);
  }

  // ── the roster ────────────────────────────────────────────────────────────
  function faces() {
    return actorsFor(state.answer, o.me, { acting: state.acting });
  }

  /**
   * Who the bar is serving when nobody has chosen yet.
   *
   * The door's `stance` decides it, not the roster's order: where the record says
   * a HUMAN is the one embodied, the map is already showing that person standing
   * there, and a bar quietly serving one of their residents would contradict the
   * figure on the map. Resolved before the first paint rather than inside the
   * roster's draw — the standpoint plate is painted first and read `null` for its
   * whole first frame, which is what "a spectator · inside a-hall/the-lit-door"
   * in the first QA shot was.
   */
  function resolveActing() {
    if (state.acting) return;
    const list = faces();
    const human = list.find((f) => f.kind === "human" && f.allowed);
    if (human && state.answer?.standpoint?.stance === "embodied-human") { state.acting = HUMAN_ACTOR; return; }
    const first = list.find((f) => f.kind === "resident" && f.allowed) ?? null;
    state.acting = first ? first.handle : (human ? HUMAN_ACTOR : null);
  }

  function drawRoster() {
    const list = faces();
    const residents = list.filter((f) => f.kind === "resident");
    const humans = list.filter((f) => f.kind === "human");
    const face = (f) => {
      const id = f.kind === "human" ? HUMAN_ACTOR : f.handle;
      const on = state.acting === id;
      // the roster's face and the map's token are the same picture, read once
      const token = f.kind === "human" ? tokenFor(f) : null;
      const inner = token?.src
        ? `<img src="${esc(token.src)}" alt="">`
        : esc((f.label ?? "?").slice(0, 1).toUpperCase());
      // The name box carries the REASON when a face is refused — a greyed circle
      // that will not say why is the surface refusing to explain the law it is
      // enforcing, which is the opposite of what this page is for.
      const words = f.allowed
        ? (f.kind === "human" ? `${esc(f.label)} · yourself — ${esc(f.because ?? "where ground allows")}` : esc(f.label))
        : `${esc(f.label)} — ${esc(f.reason ?? "not here")}`;
      // The box wraps when its words are a SENTENCE rather than a handle — keyed
      // on the length, not on whether the face was refused. Keyed on refusal, an
      // allowed human's "yourself — a portal's ground seats a human" ran straight
      // out through the right-hand border under nowrap + max-width, which the
      // screenshot showed and no DOM read would have.
      const wrap = words.replace(/&[a-z#0-9]+;/g, "x").length > 28 ? " wrap" : "";
      return `<button type="button" class="pmc-face" data-actor="${esc(id)}"
        aria-pressed="${on}"${f.allowed ? "" : " disabled"}
        aria-label="${esc(f.label)}">${inner}<span class="pmc-nm${wrap}">${words}</span></button>`;
    };
    return `<div class="pmc-plate pmc-roster">
      <div class="pmc-cap">ACT AS</div>
      ${residents.map(face).join("")}
      ${humans.length ? `<div class="pmc-rule"></div>${humans.map(face).join("")}` : ""}
      <p class="pmc-law">the hand journals on every act — recorded, never gated</p>
    </div>`;
  }

  // ── the bar ───────────────────────────────────────────────────────────────
  /** The card's CONTENTS. The `.pmc-card` box itself is a single host element in
   *  the overlay, filled on hover — see showCard. */
  function cardHtml(card) {
    if (!card) return "";
    const fields = card.fields.length
      ? `<p class="pmc-row"><b>fields</b> ${card.fields.map((f) => esc(f.name) + (f.required ? "*" : "")).join(" · ")}</p>`
      : `<p class="pmc-row"><b>fields</b> none — this act takes no arguments</p>`;
    const dials = card.dials
      ? `<p class="pmc-row"><b>dials</b> ${esc(Object.entries(card.dials).map(([k, v]) => `${k} ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · "))}</p>`
      : "";
    const blurb = card.blurb
      ? `<p class="pmc-blurb">“${esc(card.blurb)}”</p>`
      : `<p class="pmc-blurb none">the class mark that defines this act carries no blurb</p>`;
    const from = card.blurbFrom
      ? `<p class="pmc-from">quoted from the class mark that defines it — ${esc(card.blurbFrom)}${card.grantedBy && card.grantedBy !== card.blurbFrom ? `<br>granted here by ${esc(card.grantedBy)}` : ""}</p>`
      : "";
    const via = card.via || card.grant
      ? `<p class="pmc-row"><b>reached you</b> ${esc([card.via, card.grant === "here" ? "granted by the ground" : card.grant === "yours" ? "travels with what you are" : null].filter(Boolean).join(" · "))}</p>`
      : "";
    // THE TERMS, ON THE CARD, BEFORE ANYTHING IS DONE. The bare standpoint read
    // does not carry them; the act's SHADOW does — `read: <action>` returns the
    // act's full card with the terms that would bind it, and performs nothing
    // ("A read never performs", the apex's own law). So the card asks for them
    // once per act, caches the answer, and shows them where the law says they
    // belong: at the door, ahead of the act.
    const known = termsCache.get(card.action);
    const terms = known === undefined
      ? `<p class="pmc-row"><b>terms</b> reading the act's shadow…</p>`
      : known === null ? ""
      : `<div class="pmc-terms"><b>terms</b> — what would bind this act${termsHtml(known)}</div>`;
    return `${blurb}${from}${dials}${fields}${via}${terms}`;
  }

  /** One row per key, whatever keys the door sent. */
  function termsHtml(terms) {
    return termsRows(terms).map((r) => `<p class="pmc-row"><b>${esc(r.key)}</b> ${esc(r.value)}</p>`).join("");
  }

  function slotHtml(s, extraClass) {
    const label = `${s.label}${s.afforded ? "" : " — not afforded where you stand"}`;
    return `<button type="button" class="pmc-slot${extraClass ? " " + extraClass : ""}" data-action="${esc(s.action)}"
      ${s.afforded ? "" : "disabled"} aria-label="${esc(label)}"
      ${s.afforded ? 'aria-describedby="pmc-card"' : ""}>
      ${s.key ? `<span class="pmc-key">${s.key}</span>` : ""}
      <span class="pmc-name">${esc(s.label)}</span>
      <span class="pmc-dial">${esc(s.afforded ? dialLine(s.card) : "not here")}</span>
    </button>`;
  }

  function drawBar() {
    const { fixed, tray } = barSlots(state.answer);
    return `<div class="pmc-bar" role="toolbar" aria-label="what can be done from here">
      ${fixed.map((s) => slotHtml(s)).join("")}
      ${tray.length ? `<div class="pmc-gap"><span>HERE</span></div>` : ""}
      ${tray.map((s) => slotHtml(s, "afford")).join("")}
    </div>
    <span class="pmc-more" data-more="left" aria-hidden="true" hidden>‹</span>
    <span class="pmc-more" data-more="right" aria-hidden="true" hidden>›</span>
    <div class="pmc-card" id="pmc-card" role="tooltip" hidden></div>
    ${state.open ? formHtml(state.open) : ""}`;
  }

  /** Measured, never assumed: the arrows and the edge fade come and go with the
   *  bar's real scroll position. */
  function markOverflow() {
    const bar = root.querySelector(".pmc-bar");
    if (!bar) return;
    const left = bar.scrollLeft > 2;
    const right = bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 2;
    bar.classList.toggle("more-left", left);
    bar.classList.toggle("more-right", right);
    const box = bar.getBoundingClientRect();
    const h = doc.defaultView?.innerHeight ?? 0;
    for (const el of root.querySelectorAll(".pmc-more")) {
      const isRight = el.getAttribute("data-more") === "right";
      el.hidden = isRight ? !right : !left;
      el.style.bottom = `${Math.max(4, h - box.bottom + box.height / 2 - 8)}px`;
      el.style.left = isRight ? `${box.right - 16}px` : `${box.left + 4}px`;
    }
  }

  /** Put a fixed-position panel above the bar, clamped into the viewport. Reading
   *  the bar's own box rather than assuming its height, because a row that can
   *  scroll may or may not be showing a scrollbar. */
  function placeAbove(el, anchor) {
    if (!el || !anchor) return;
    const a = anchor.getBoundingClientRect();
    const w = doc.defaultView?.innerWidth ?? 0;
    el.style.bottom = `${Math.max(8, (doc.defaultView?.innerHeight ?? 0) - a.top + 10)}px`;
    if (el.classList.contains("pmc-card")) {
      const box = el.getBoundingClientRect();
      const want = a.left + a.width / 2 - box.width / 2;
      el.style.left = `${Math.min(Math.max(12, want), Math.max(12, w - box.width - 12))}px`;
      el.style.transform = "none";
    }
  }

  /** action → terms | null (asked and the door had none, or the read failed).
   *  `undefined` means not asked yet, which is what the card's "reading…" line
   *  is showing. One request per act, for the life of the mount. */
  const termsCache = new Map();

  function askTerms(action) {
    if (termsCache.has(action) || !o.readTerms) return;
    termsCache.set(action, undefined);
    o.readTerms(action).then((body) => {
      termsCache.set(action, termsFromRead(body));
      // Re-render only if this act is still the one under the pointer — a card
      // that repaints for an act the reader has already moved off is a flicker.
      const still = root.querySelector(".pmc-slot:hover, .pmc-slot:focus-visible");
      if (still?.getAttribute("data-action") === action) showCard(still);
    }).catch(() => { termsCache.set(action, null); });
  }

  function showCard(slotEl) {
    const host = root.querySelector("#pmc-card");
    if (!host || !slotEl) return;
    // A card behind an open form says the act's blurb twice, in two panels that
    // overlap — seen in QA. The form IS the card, opened: while one is up, the
    // tooltip stands down.
    if (state.open) return;
    const all = barSlots(state.answer);
    const s = [...all.fixed, ...all.tray].find((x) => x.action === slotEl.getAttribute("data-action"));
    if (!s?.card) return;
    askTerms(s.action);
    host.innerHTML = cardHtml(s.card);
    host.hidden = false;
    placeAbove(host, slotEl);
  }

  function hideCard() {
    const host = root.querySelector("#pmc-card");
    if (host) { host.hidden = true; host.innerHTML = ""; }
  }

  // ── the act form ──────────────────────────────────────────────────────────
  function formHtml(action) {
    const all = barSlots(state.answer);
    const slot = [...all.fixed, ...all.tray].find((s) => s.action === action);
    if (!slot?.card) return "";
    const c = slot.card;
    const inputs = c.fields.map((f) => {
      const id = `pmc-f-${esc(f.name)}`;
      const req = f.required ? ` <span class="req" title="required">*</span>` : "";
      let control;
      if (f.enum && f.enum.length) {
        control = `<select id="${id}" data-field="${esc(f.name)}">${f.enum.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("")}</select>`;
      } else if (f.type === "boolean") {
        control = `<select id="${id}" data-field="${esc(f.name)}"><option value="">—</option><option value="true">true</option><option value="false">false</option></select>`;
      } else if (f.type === "number") {
        control = `<input id="${id}" data-field="${esc(f.name)}" type="number" inputmode="decimal">`;
      } else {
        // The door states its own limits in the field's own words; the control
        // honours them rather than guessing at a shape.
        const cap = statedLimit(f.description);
        const max = cap ? ` maxlength="${cap}"` : "";
        control = wantsTextarea(f)
          ? `<textarea id="${id}" data-field="${esc(f.name)}"${max}></textarea>`
          : `<input id="${id}" data-field="${esc(f.name)}" type="text"${max}>`;
      }
      // The door's own description under the field, whole. It is where the door
      // tells a caller what the act will do with the value, and shortening it
      // here would be the site editing law to fit a box.
      const desc = f.description ? `<p class="pmc-desc">${esc(f.description)}</p>` : "";
      const more = f.enumCount && !f.enum ? `<p class="pmc-desc">${f.enumCount} values — read the card at the door</p>` : "";
      return `<label for="${id}">${esc(f.name)}${req}${control}</label>${desc}${more}`;
    }).join("");

    const said = state.said
      ? `<p class="pmc-said${state.said.ok ? "" : " bad"}">${esc(state.said.text)}${state.said.hint ? `<span class="hint">${esc(state.said.hint)}</span>` : ""}</p>`
      : "";
    // The terms the door has stated for this act — from the shadow read if the
    // card already asked for them, and replaced by whatever the door hands back
    // at the act itself, which is the authoritative delivery.
    const shown = state.said?.terms ?? termsCache.get(action) ?? null;
    const terms = shown
      ? `<div class="pmc-terms"><b>terms</b> — delivered before the act binds, because you cannot be bound by law you were not shown at the door${termsHtml(shown)}</div>`
      : "";
    const actorWords = state.acting === HUMAN_ACTOR ? "as yourself" : `as ${esc(state.acting ?? "—")}`;
    return `<form class="pmc-plate pmc-form" data-form="${esc(action)}">
      <h3>${esc(action.toUpperCase())} <span style="color:var(--pmc-dim);letter-spacing:0">${actorWords}</span></h3>
      ${c.blurb ? `<p class="pmc-blurb">“${esc(c.blurb)}”</p>` : ""}
      ${inputs || `<p class="pmc-desc">This act takes no arguments.</p>`}
      ${terms}${said}
      <div class="pmc-actions">
        <button type="submit" class="pmc-btn go">do it</button>
        <button type="button" class="pmc-btn" data-close>close</button>
      </div>
    </form>`;
  }

  // ── the standpoint plate ──────────────────────────────────────────────────
  function drawHere() {
    const p = portalOf(state.answer);
    const spine = (state.answer.within ?? []).map((w) => w?.id).filter(Boolean).reverse();
    return `<div class="pmc-plate pmc-here">
      <div class="who">${esc(state.acting === HUMAN_ACTOR ? "yourself" : state.acting ?? "a spectator")} <span style="color:var(--pmc-dim)">· inside</span> ${esc(p?.id ?? "")}</div>
      <div class="spine">the read roots at <b>${esc(p?.value ?? "—")}</b>${spine.length ? `<br>within: ${esc(spine.join(" ‹ "))}` : ""}</div>
    </div>`;
  }

  // ── the token on the map ──────────────────────────────────────────────────
  /** Map units per CSS pixel, right now. The viewBox IS the camera on this map
   *  (the viewer's own words), so its width against the element's width is the
   *  whole of the zoom — no viewer internal is reached for. */
  function unitsPerPx() {
    const svg = o.svg;
    if (!svg) return 1;
    const vb = (svg.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
    const w = svg.getBoundingClientRect?.().width || svg.clientWidth || 0;
    if (vb.length !== 4 || !isFinite(vb[2]) || vb[2] <= 0 || !w) return 1;
    return vb[2] / w;
  }

  function drawToken() {
    if (!tokenLayer) return;
    tokenLayer.textContent = "";
    const human = faces().find((f) => f.kind === "human");
    const place = tokenPlacement(state.answer, o.grid, human);
    if (!place) return;
    const { at, token } = place;
    // THE TOKEN IS SIZED IN SCREEN PIXELS, NOT MAP UNITS — measured, after the
    // first shot drew it two hundred metres across. A fixed map size is invisible
    // at journey width and swallows the town at close zoom, and the walkers this
    // figure stands beside are already screen-constant (`r = 11 / markerScale(k)`
    // in the viewer's drawWalkers). A face that changed size relative to the
    // people around it would be saying something about the person.
    const r = 26 * unitsPerPx();
    const g = doc.createElementNS(NS, "g");
    g.setAttribute("class", "pmc-token");
    g.setAttribute("transform", `translate(${at.x} ${at.y})`);
    const clipId = "pmc-token-clip";
    // A steady gold ring and one soft radiance. Distinct from a resident's dot
    // without shouting: the map's motion language (green still / pink moving) is
    // the walkers', and borrowing it would say something untrue about this figure.
    g.innerHTML =
      `<defs><clipPath id="${clipId}"><circle cx="0" cy="0" r="${r}"/></clipPath>` +
      `<radialGradient id="pmc-token-glow"><stop offset="55%" stop-color="#d9a860" stop-opacity="0.34"/><stop offset="100%" stop-color="#d9a860" stop-opacity="0"/></radialGradient></defs>` +
      `<circle cx="0" cy="0" r="${r * 2.1}" fill="url(#pmc-token-glow)"/>` +
      (token.src
        ? `<image href="${esc(token.src)}" x="${-r}" y="${-r}" width="${r * 2}" height="${r * 2}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`
        : `<circle cx="0" cy="0" r="${r}" fill="#1b2230"/><text x="0" y="${r * 0.34}" text-anchor="middle" font-size="${r}" fill="#d9a860" font-family="ui-monospace,Consolas,monospace">${esc(token.monogram ?? "")}</text>`) +
      `<circle cx="0" cy="0" r="${r}" fill="none" stroke="#d9a860" stroke-width="${r * 0.11}"/>` +
      `<circle cx="0" cy="0" r="${r * 1.22}" fill="none" stroke="#d9a860" stroke-width="${r * 0.045}" stroke-opacity="0.55"/>` +
      // the star off his own cap, set above the ring — a mark of whose figure this
      // is, drawn small enough that the face stays the thing you read
      `<path transform="translate(0 ${-r * 1.62}) scale(${r * 0.030})" fill="#d9a860"
         d="M0,-10 L2.2,-2.6 L10,0 L2.2,2.6 L0,10 L-2.2,2.6 L-10,0 L-2.2,-2.6 Z"/>` +
      `<title>${esc(token.label)} — standing here</title>`;
    tokenLayer.appendChild(g);
  }

  // ── painting ──────────────────────────────────────────────────────────────
  function paint() {
    resolveActing();
    const active = doc.activeElement;
    const keepAction = active?.closest?.("[data-form]") ? active.getAttribute?.("data-field") : null;
    const values = readForm();
    root.innerHTML = drawHere() + drawRoster() + drawBar();
    const form = root.querySelector("[data-form]");
    if (form) placeAbove(form, root.querySelector(".pmc-bar"));
    root.querySelector(".pmc-bar")?.addEventListener("scroll", markOverflow, { passive: true });
    markOverflow();
    if (state.open && values) writeForm(values);
    if (keepAction) root.querySelector(`[data-field="${CSS.escape ? CSS.escape(keepAction) : keepAction}"]`)?.focus();
    drawToken();
  }

  let formValues = null;
  function readForm() {
    const form = root.querySelector("[data-form]");
    if (!form) return formValues;
    const v = {};
    form.querySelectorAll("[data-field]").forEach((el) => { v[el.getAttribute("data-field")] = el.value; });
    formValues = v;
    return v;
  }
  function writeForm(v) {
    const form = root.querySelector("[data-form]");
    if (!form) return;
    form.querySelectorAll("[data-field]").forEach((el) => {
      const name = el.getAttribute("data-field");
      if (v[name] != null) el.value = v[name];
    });
  }

  // ── the wiring ────────────────────────────────────────────────────────────
  function onClick(ev) {
    const faceBtn = ev.target.closest?.(".pmc-face");
    if (faceBtn && root.contains(faceBtn)) {
      state.acting = faceBtn.getAttribute("data-actor");
      state.said = null;
      paint();
      return;
    }
    const closeBtn = ev.target.closest?.("[data-close]");
    if (closeBtn && root.contains(closeBtn)) { state.open = null; state.said = null; formValues = null; paint(); return; }
    const slot = ev.target.closest?.(".pmc-slot");
    if (slot && root.contains(slot) && !slot.disabled) {
      const action = slot.getAttribute("data-action");
      state.open = state.open === action ? null : action;
      state.said = null;
      formValues = null;
      paint();
      root.querySelector("[data-form] [data-field]")?.focus();
    }
  }

  async function onSubmit(ev) {
    const form = ev.target.closest?.("[data-form]");
    if (!form || !root.contains(form)) return;
    ev.preventDefault();
    const action = form.getAttribute("data-form");
    const args = {};
    form.querySelectorAll("[data-field]").forEach((el) => {
      const name = el.getAttribute("data-field");
      const raw = el.value;
      if (raw === "" || raw == null) return;
      if (el.type === "number") { const n = Number(raw); if (isFinite(n)) args[name] = n; return; }
      if (raw === "true" || raw === "false") { args[name] = raw === "true"; return; }
      args[name] = raw;
    });
    const go = form.querySelector(".pmc-btn.go");
    if (go) { go.disabled = true; go.textContent = "…"; }
    try {
      const res = await o.dispatch(dispatchEnvelope({ action, args, acting: state.acting }));
      if (res.ok) {
        state.said = { ok: true, text: "done — the door took it." };
        formValues = null;
        if (o.refresh) { const fresh = await o.refresh().catch(() => null); if (fresh) state.answer = fresh; }
      } else {
        const b = readBounce(res.body, res.status);
        state.said = { ok: false, text: b.defect, hint: b.hint, terms: b.terms };
      }
    } catch (err) {
      state.said = { ok: false, text: "the door could not be reached", hint: String(err?.message ?? err).slice(0, 200) };
    }
    paint();
  }

  function onKey(ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const t = ev.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
      if (ev.key === "Escape" && state.open) { state.open = null; state.said = null; formValues = null; paint(); }
      return;
    }
    if (ev.key === "Escape" && state.open) { state.open = null; state.said = null; formValues = null; paint(); return; }
    if (!/^[1-9]$/.test(ev.key)) return;
    const n = Number(ev.key);
    const { fixed, tray } = barSlots(state.answer);
    const slot = [...fixed, ...tray].find((s) => s.key === n);
    if (!slot || !slot.afforded) return;
    ev.preventDefault();
    state.open = state.open === slot.action ? null : slot.action;
    state.said = null;
    formValues = null;
    paint();
    // DELIBERATELY NO FOCUS INTO THE FORM on the keyboard path. Focus belongs in
    // the field only when the reader has committed to filling it, and a digit
    // typed into a focused text box must type a digit — so auto-focusing here
    // killed the numbered bar the moment it was used: measured, pressing 1 then
    // 2 then 9 left slot 1 open the whole time and put "29" in its first field.
    // Clicking a seat is the committing gesture and still dives in; the numbers
    // stay the bar's own navigation, which is what makes them worth having.
    root.querySelector("[data-form]")?.scrollIntoView?.({ block: "nearest" });
  }

  // The card follows the pointer AND the keyboard, because a bar with numbered
  // slots is a keyboard surface first: tabbing to a seat must show the same card
  // hovering it does, or the law is readable only with a mouse.
  const onOver = (ev) => {
    const slot = ev.target.closest?.(".pmc-slot");
    if (slot && root.contains(slot) && !slot.disabled) showCard(slot); else hideCard();
  };
  root.addEventListener("pointerover", onOver);
  root.addEventListener("pointerleave", hideCard);
  root.addEventListener("focusin", onOver);
  root.addEventListener("focusout", hideCard);

  root.addEventListener("click", onClick);
  root.addEventListener("submit", onSubmit);
  doc.addEventListener("keydown", onKey);

  // The camera moves without anything of ours firing — the viewer pans and zooms
  // by writing the viewBox, and a screen-sized token has to be re-drawn when it
  // does. Watching the attribute is the seam that needs no viewer internal.
  let camera = null;
  if (o.svg && typeof MutationObserver === "function") {
    camera = new MutationObserver(() => drawToken());
    camera.observe(o.svg, { attributes: true, attributeFilter: ["viewBox"] });
  }
  const onResize = () => { drawToken(); markOverflow(); };
  (doc.defaultView ?? globalThis).addEventListener?.("resize", onResize);

  paint();

  return {
    update(answer) {
      state.answer = answer;
      if (!cockpitShows(answer)) { this.destroy(); return; }
      paint();
    },
    destroy() {
      doc.removeEventListener("keydown", onKey);
      (doc.defaultView ?? globalThis).removeEventListener?.("resize", onResize);
      camera?.disconnect();
      root.remove();
      tokenLayer?.remove();
    },
  };
}

export { worldToPx };
