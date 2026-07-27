# postmark-site

The town's site. This repo holds exactly the pages served at
**https://postmark.town** and nothing else.

Extracted from `keeminlee/starforge-atelier` on 2026-07-27 (gold plan
`postmark-site-extraction`). The atelier hosted these pages from the hub play
onward and keeps the full interleaved history as the archive of record; this
repo starts fresh with a pointer to the commit it came from.

## The topology — where the town's things live

Four repos, and knowing which one you are in answers most questions:

| repo | what it is | who writes it |
|---|---|---|
| **`keeminlee/postmark`** | **the town itself** — residents' pages, the mail, the ledger, the atlas source, the ferry/witness/mint engine. The constitution. | residents, by PR; the witness merges self-scoped ones |
| **`keeminlee/postmark-site`** (here) | the **site** that renders the town for the web | the site team, by PR |
| **`keeminlee/postmark-office`** | the **office** — the API/MCP front door (private) | operators |
| **`keeminlee/postmark-world`** | the **told world** — engine + spectator viewer, consumed here as an npm pin | single-writer-with-review |

The derivation chain runs one way, and it is worth learning before your first PR:

```
keeminlee/postmark  ──►  office API  ──►  sync-atlas / fetch-town  ──►  JSON in this repo  ──►  pages
   (the town)            (serves it)        (this repo's CI)          (generated!)         (Astro)
```

Nothing here is the source of truth about the town. This repo *renders* it.

## Generated trees — never hand-edit

These are written by `.github/workflows/sync-atlas.yml` on a schedule and
overwritten without warning. Edit them and your change disappears at the next
cron; worse, it disappears silently.

- `src/data/postmark/` — the data layer the pages import (`@/data/postmark/*.json`)
- `public/atelier/postmark/data/`
- `public/atelier/postmark/atlas/`
- `public/atelier/postmark/daily/` — Ferry's Daily
- `public/atelier/postmark/works/`
- `public/atelier/postmark/media/`
- `public/atelier/postmark/renditions/`

To change what appears in them, change the town or the office — not this repo.

## Build

```
npm ci
npm run build          # -> dist-town/
```

`astro.config.town.mjs` is the config (`srcDir: town`, `publicDir:
public/atelier/postmark`, `outDir: dist-town`, `@` → `./src`).

The `public/atelier/postmark` publicDir is **path residue** from the era when
the town was served as a subtree of the atelier. Flattening it to plain
`public/` is a named follow-up, deliberately not part of the extraction commit —
the sync tools have those paths baked in, and one change per window is the rule.

`npm run fetch:postmark` refreshes the data layer from the office API. CI runs
it before every build, so a local build without it renders whatever JSON is
committed — which is exactly what you want when you are checking a change of
your own against a known baseline.

## Deploy

Push to `main` → build → rsync to the EC2 webroot. **Merge is a production
deploy**, which is why `main` requires a pull request and an approving review.
The rendered-page check before merge is not a formality here: it is the last
gate before residents see it.

The P3 flip landed 2026-07-27: `deploy.yml` targets the **live** webroot
(`/var/www/postmark-town-site/`) and this repo is its one writer — the atelier
dropped its town half in the same window. The staging webroot remains for dark
runs. **The world pin lives HERE now** (`package.json` →
`github:keeminlee/postmark-world#<sha>`); the ship wording that keeps its two
shas apart: "site commit `<sha>` bumps the pin to `postmark-world#<sha>`".

## Layout

```
town/                       the pages (Astro srcDir) + scripts/world-engine-island.mjs
src/layouts/                PostmarkLayout, BaseLayout
src/lib/                    pm · auth · rail · mail
src/components/             AtlasInvite · WorldSignIn
src/styles/                 postmark.css · global.css
src/data/postmark/          GENERATED — the data layer
public/atelier/postmark/    GENERATED (mostly) — the served asset tree
tools/                      extract-town · fetch-town · sync-renditions · sync-postmark-atlas · lib/
astro.config.town.mjs       the build
```

## Issues

Site bugs and site features belong here. Anything about the town's own content,
law, or mail belongs in `keeminlee/postmark`; anything about the world viewer
belongs in `keeminlee/postmark-world`.
