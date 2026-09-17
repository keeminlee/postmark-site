// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import worldEngineIsland from './town/scripts/world-engine-island.mjs';

// The TOWN build — the Postmark pages served at the postmark.town ROOT.
//
// One repo, two outputs. This config shares src/ (layout, lib, data,
// components) with the atelier build via the @ alias; its pages live in
// town/pages at root (mail/, residents/, atlas, …), and its publicDir is the
// existing Postmark asset tree, so /media, /data, /atlas, /daily, /works,
// /hero, /thumbs, /banner.png all serve at the town root with zero asset
// duplication and no change to the 3.1 data pipeline.
//
// Build: `astro build --config astro.config.town.mjs` (see package.json
// build:town). The atelier build (astro.config.mjs) is unchanged.
//
// PREVIEW_BASE — the branch-preview deploy target (office repo
// tools/preview-deploy.mjs) sets this to `/preview/<branch>/` so a branch
// build's bundled assets (the CSS/JS under _astro/) resolve under that path
// instead of the root. Unset → no prefix, so the normal town build (and the
// deploy.yml CI build, which never sets it) is byte-identical to before.
//
// Why `build.assetsPrefix` and not Astro `base`: base rewrites routing, and
// Astro 6.4.0's static build fails to strip the base prefix from the pathname
// before matching it against a route pattern (core/render/params-and-props.js
// getParams) — so EVERY prerendered getStaticPaths route throws "Missing
// parameter" and the whole town build dies (verified: base '/' builds 912
// pages, base '/preview/x/' builds 7). assetsPrefix touches only the emitted
// asset URLs, never routing, so the build completes AND the bundled CSS/JS
// load under the preview path — the exact win base was meant to give, without
// the bug. Caveat, same as base would have: hand-written root-relative refs
// (/data, /media, nav hrefs) still resolve to prod on a preview, which is fine
// for reveal-bundle QA (the render is driven by the bundled assets that DO get
// the prefix).
const PREVIEW_BASE = process.env.PREVIEW_BASE || '';
const DEV = process.argv.includes('dev');

export default defineConfig({
  site: 'https://postmark.town',
  ...(PREVIEW_BASE ? { build: { assetsPrefix: PREVIEW_BASE } } : {}),
  srcDir: 'town',
  publicDir: 'public/atelier/postmark',
  outDir: 'dist-town',
  // Internal navigation warms on intent without spending bandwidth on every
  // visible link; Astro automatically skips off-site and current-page targets.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  // stage the told-world viewer + engine at /world-engine/** from the postmark-world
  // package (build output + dev middleware) so /world serves the SAME file locally
  integrations: [worldEngineIsland()],
  redirects: {
    // v1's Town Archive folded into the Works; old links stay alive (rebased to root)
    '/archive/': '/works/',
    // The Bounty Board folded into the Stamps hub — the founder, 2026-08-23:
    // "not just the guide about Stamps — the central hub for all things
    // stamps." The board's content MOVED; it was not copied, so a pointer page
    // would leave two surfaces both looking like the board. Every off-site link
    // stays alive and lands on the real thing.
    //
    // EXACT-PATH, and that is load-bearing here: /board/ is also a public asset
    // directory (public/atelier/postmark/board/quest-board-wood.jpg, which
    // /daily/ uses as a background). Astro matches this route and nothing
    // beneath it, so the images keep serving from the same prefix.
    //
    // RE-AIMED 2026-08-30, when The Town absorbed Stamps: these point at the
    // hub DIRECTLY rather than through /stamps/. Chaining would have worked —
    // the forwarder reads whatever fragment the browser carried into it — but
    // it spends two navigations and a visible flash to arrive at the same
    // place, and every extra hop is another thing that can break silently.
    '/board/': '/town/#board',
    // The Guide lived at its own route for a few hours on 2026-08-23 before the
    // portal absorbed it. Nothing outside the repo links it yet, but the route
    // existed and cost nothing to keep alive.
    //
    // RE-AIMED TWICE IN ONE DAY, which is worth saying rather than hiding: it
    // pointed at /town/#rules while The Town held the teaching, and comes back
    // to /stamps/ now that the teaching does. The guide's content and this
    // route's target have been the same thing throughout; only the address of
    // that thing moved, and back.
    '/stamps/guide/': '/stamps/',
    // THE ATLAS RETIRES (the founder, 2026-09-14: "Atlas page retirement can be
    // for w39, no rush"; postmark-town/postmark#2800). The World replaced it on
    // 2026-09-08 — the ground is drawn from the record now — so what /atlas/
    // served was the stale layer, and the bug sweep measured what that cost: 7
    // of 319 evidence quotes drifted from their own source files, Fox Hearth
    // drawn 6×, Pinehaven 4×, Spruce Cabin 3× (#944, #1368, #1860, #2293, #2664,
    // all reproduced 09-13/14 against this served page).
    //
    // EXACT-PATH, and here it is load-bearing in exactly the way /board/ above
    // is — only more so. /atlas/ is ALSO a public asset directory, and one of
    // the files under it is not the atlas's at all:
    //
    //   · /atlas/ground.html  — THE WORLD'S OWN GROUND. The pinned viewer reads
    //     it same-origin at boot (`ATLAS_GROUND_URL`, spectator/viewer.mjs), on
    //     the founder's word of 2026-09-11: "the pre-drawn-and-loaded ground
    //     looks *better*. so we *should* do that." It shares this prefix for
    //     historical reasons and nothing else.
    //   · /atlas/assets/**    — the region art, nine files of which ground.html
    //     itself references.
    //
    // Astro matches this route and nothing beneath it, so the World's ground
    // and its art keep serving from the same prefix while the page a reader
    // arrives at forwards to the map that is actually current.
    '/atlas/': '/world/',
    // `/atlas/town.html': '/world/'` BELONGS HERE AND CANNOT SHIP YET, which is
    // worth writing down where the next person will look for it rather than
    // leaving them to rediscover it. Astro emits a redirect as a DIRECTORY
    // route — dist-town/atlas/town.html/index.html — and publicDir has already
    // copied the file dist-town/atlas/town.html into that same path. The build
    // does not warn; it dies:
    //
    //   EEXIST: file already exists, mkdir '…/dist-town/atlas/town.html'
    //
    // Deleting the public copy would clear it, and would not hold: the town
    // sync owns that file. `tools/extract-town.mjs` mirrors town.html from the
    // town's own PROJECTS/build-the-town/atlas/ on every run, so the next sync
    // restores it — and with this line present, the restored file breaks the
    // BUILD, which takes the whole site's deploy down rather than one page.
    //
    // Retiring the path for real therefore means teaching extract-town.mjs to
    // stop mirroring town.html while it keeps mirroring ground.html, and that
    // is not a one-line removal: the assets prune (`ownDir(ATLAS_ASSETS,
    // wanted)`) seeds `wanted` from town.html's own image refs and runs BEFORE
    // the ground pass, so a build input removed without re-seeding it takes the
    // World's ground art with it. Reported on #2800 rather than attempted here.
  },
  vite: {
    ...(DEV ? {
      server: {
        proxy: {
          '/api': {
            target: 'https://postmark.town/api',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api(?=\/|$)/, ''),
          },
        },
      },
    } : {}),
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  },
});
