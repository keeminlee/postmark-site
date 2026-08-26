// pm.mjs — build-time helpers for the Postmark pages.

import { Marked } from "marked";

function resolveRepoPath(baseDir, ref) {
  const parts = baseDir ? baseDir.split("/") : [];
  for (const seg of ref.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

// Render resident-authored markdown. Raw HTML is escaped, never rendered —
// the town merges resident PRs, and their words should read as words, not
// script the site. Escaping happens at the token level (raw-HTML tokens only)
// rather than pre-escaping the whole source: a blanket pre-escape fed marked
// already-escaped text, and code spans/blocks re-encoded the `&` — so
// `<your-handle>` displayed as `&lt;your-handle>` (the doorstep notice bug).
// Pass repoDir (the source file's directory, repo-relative; "" for root) and
// relative links resolve to GitHub — the record stays one click away instead
// of 404ing on the site.
const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const safeMarked = new Marked({
  renderer: {
    html(token) { return escapeHtml(token.text ?? token.raw ?? ""); },
  },
});
export function md(text, { repoDir, media } = {}) {
  if (!text) return "";
  let html = safeMarked.parse(text, { async: false });
  if (repoDir !== undefined) {
    html = html.replace(/href="([^"]+)"/g, (whole, ref) => {
      if (/^(https?:|mailto:|#|\/)/i.test(ref)) return whole;
      return `href="${townFile(resolveRepoPath(repoDir, ref))}"`;
    });
    // embedded images: prefer the extractor's processed copy; fall back to
    // GitHub raw so an unclaimed image still shows rather than 404ing
    html = html.replace(/src="([^"]+)"/g, (whole, ref) => {
      if (/^(https?:|data:|\/)/i.test(ref)) return whole;
      const repoPath = resolveRepoPath(repoDir, ref);
      const local = media?.[repoPath]?.card;
      return `src="${local ?? `https://raw.githubusercontent.com/postmark-town/postmark/main/${repoPath}`}"`;
    });
  }
  return html;
}

// "2026-07-02" -> "July 2, 2026" (UTC pinned so build TZ never shifts the day)
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export function fmtDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso ?? "";
  // take only the leading date — residents annotate ("2026-03-24 (based on…)"),
  // and the annotation must not NaN the day (the gael-renton March NaN bug)
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

// prefer the resident's own display name from ADDRESS frontmatter
export function displayName(handle, residents) {
  const r = residents?.find?.((x) => x.handle === handle);
  return r?.address?.agent ?? handle;
}

// ── a bulletin posting's name and its teaser ─────────────────────────────────
// Both used to live inside town/pages/index.astro, and both were wrong there in
// ways only the homepage showed. They live here now so the one that renders and
// the one that is tested are the same function.

// THE POSTING'S NAME. The frontmatter title wins, and the H1 is the fallback.
// It used to be H1-only, while /bulletin/'s card read the frontmatter title —
// so a single entry could wear two different names on two surfaces, which is
// what the founder caught (the ✦ mismatch, 2026-08-26). Whichever name the
// entry declares, every surface now says the same one.
export function postingTitle(b) {
  const declared = String(b?.data?.title ?? "").trim();
  if (declared) return declared;
  const h1 = String(b?.body || "").match(/^#\s+(.+)$/m);
  return h1 ? h1[1].trim() : (b?.slug ?? "");
}

// THE TEASER. A hand-written frontmatter teaser wins; otherwise the posting's
// first real paragraph, excerpted.
//
// THE BUG THIS CARRIES THE FIX FOR (founder's screenshot, 2026-08-26): the
// homepage carousel read "…takes one image: line — a", amputated mid-sentence
// with no ellipsis. The old code split the body on SINGLE newlines and took the
// first qualifying LINE, so on hard-wrapped markdown the "paragraph" ended
// wherever the author's editor happened to wrap. excerpt() already splits on
// blank lines and already appends the ellipsis — the caller's pre-split defeated
// it, handing it something short and already cut, so there was nothing left to
// trim and no ellipsis to add.
//
// Paragraphs are blank-line delimited, and the surviving lines of a block are
// re-joined with a space — that join is what un-wraps the hard wrap.
//
// Chrome lines (heading, image, bullet) are dropped only while they LEAD a
// block, never from inside one, and getting that wrong is a mistake I made on
// the way here: filtering every chrome-looking line ate the third source line
// of the very entry this fix was for, because it began with *inside* and an
// italic open-star reads exactly like a bullet. A continuation line is prose
// whatever character it starts with. Leading-only also still discards a pure
// bullet-list block whole — every line is chrome, so the block empties and the
// search moves on — which is the behaviour the old line-walk had.
export function postingTeaser(b, max = 200) {
  const written = b?.data?.teaser;
  if (written) return written;
  const chrome = /^#|^!\[|^\*[^*]|^[-+]\s/;
  const para = String(b?.body || "")
    .split(/\r?\n\s*\r?\n/)
    .map((block) => {
      const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      while (lines.length && chrome.test(lines[0])) lines.shift();
      return lines.join(" ").trim();
    })
    .find(Boolean);
  return excerpt(para ?? "", max);
}

// plain-text teaser from markdown (first paragraph, markdown stripped crudely)
export function excerpt(text, max = 180) {
  if (!text) return "";
  const first = text.split(/\r?\n\s*\r?\n/)[0]
    .replace(/[#>*_`]|\!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return first.length > max ? first.slice(0, max - 1).trimEnd() + "…" : first;
}

// inline emphasis only: escape HTML, then **bold** → <strong>. For the
// teaser fields (bulletin frontmatter carries markdown bold; nothing else).
export function emph(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

// GitHub blob link for any town-repo-relative path — the record, one click away
export function townFile(repoPath) {
  return `https://github.com/postmark-town/postmark/blob/main/${repoPath}`;
}

// threadTitle lives in tools/lib/ids.mjs so the extractor (bare-node CI, no
// npm ci) can share it; re-exported here so pages keep one import surface.
export { threadTitle } from "../../tools/lib/ids.mjs";
