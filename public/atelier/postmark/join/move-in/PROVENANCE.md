# `/join/move-in/` — the packaged assets

Two files sit here and they are not the same kind of thing.

## `mcp-proto.js` — COPIED FROM THE OFFICE. Never edited here.

| | |
|---|---|
| source | `postmark-office`, `ops/mcp-prototype/mcp-proto.js` |
| office commit read | `2fb0bc0efb6897e24424b11bfdb3b1ef489142f8` (2026-09-11) |
| last commit to touch it | `4672a03a6aaf67ba5927fa87e47f50b5f3e2f1c2` (2026-08-30) |
| git blob sha1 | `b09f7763d69981384198c3fc46568c1455ebbd5e` |
| sha256, LF-normalized | `bdb6446ff4b8c05c8431df3d9f703c57ca2c6856801fa8d67929b52b40df4e67` |

Everything after this file's 27-line provenance header is byte-for-byte the
office's file. To check:

```sh
tail -n +28 mcp-proto.js | tr -d '\r' | sha256sum
```

`test/join-move-in.test.mjs` runs that same check against the sha256 the header
itself carries, so a hand-edit here goes red rather than quiet.

**The rule: copied, not forked.** A change to how the machinery behaves goes to
the office first. It arrives here as a fresh copy with the four facts above
re-stamped — in the header and in this table. Nothing below the header is edited
in place, not a default, not a selector, not a string.

**Why a copy at all.** The generator inside renders a door's own schema — a
tool's `inputSchema`, or an apex act's `fields` block — through one code path
that names no door. That is exactly what this page needs, and the site has no
build-time path into another repo. The script is a classic (non-module) script
by the office's design, so the page loads it with `<script is:inline src>` and
Astro leaves it alone.

**Where site-side behaviour lives:** `town/pages/join/move-in.astro` (the
wrapper) and `src/lib/join-move-in.mjs` (the decisions). The wrapper drives
`window.MCPProto` and adds the human packaging around the form the script
generates. It never reaches inside the script to change it.

## The form's stylesheet — `src/styles/join-move-in-form.css`

Not here, and deliberately: it is the site's own file, not a copied one, so it
lives where the site's stylesheets live and is imported by the page's frontmatter
(bundled, scoped to nothing, no flash of an unstyled form). Only the **selector
list** in it comes from the office's `ops/mcp-prototype/mcp-proto.css` — the
class names `buildForm`/`buildField` emit. Every value is the town's: the
prototype's chrome is the ops look (gold on night) and this form stands on paper.

If the generator's selectors ever drift, fix that stylesheet. Never the copied
script.

## What the page does with it

1. Reads the household apex bare (`household {}`) with the site's own OAuth
   token as Bearer at `<officeBase>/mcp`. That answer carries `tier`.
2. `tier` names the act (the one small map, in `src/lib/join-move-in.mjs`).
3. Reads that act's own card (`household { read: <act> }`) for the typed
   fields — the bare answer is `abridged` by its own word and carries field
   names without types.
4. `MCPProto._internals.buildForm(fieldsSchema(card.fields))` renders it.
5. Submit sends `household { do: <act>, args: <the form's own read()> }`.
   A field left empty is unsent; the door names its own missing fields.
