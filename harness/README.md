# harness/ — what the site does when the world goes 10x

Measurement only. Nothing here is site code, nothing here runs in a build, and
nothing here is imported by a page. Written for the 2026-09-09 load lane
(founder's ask: "simulate what happens to the *site* when the world goes 10x").

Run every script from a **scratch copy** of the site tree, never from a working
clone: `scale-data.mjs` and `scale-world.mjs` overwrite the data layer and the
installed world fold in place (they keep a 1x backup beside each, so a scratch
tree can be walked up and down the scale, but a real tree would end up with a
ten-times town committed into it).

## The scripts

| script | answers |
|---|---|
| `measure-build.mjs` | build wall, emitted file count, total bytes, ten largest files, pages per route family, the doorstep bundles |
| `scale-data.mjs` | multiplies the data layer (residents, letters, threads, ledger, households, friendships, bulletin, stats) by cloning the town into `-cN` cohorts |
| `scale-world.mjs` | multiplies the world fold — `--mode tiled` (ten times the land) or `--mode dense` (ten times the crowd in the same land) |
| `make-10x-dist.mjs` | swaps a 10x fold and faces record into an already-built 1x `dist-town`, so the world page can be rendered at 10x even where the 10x build will not complete |
| `serve.mjs` | serves a `dist-town` the way the box's nginx does, and stubs `/api/world/state` + `/api/world/skeleton` — the dev branch reads the office API and only that, so without the stub it measures the absence of an office |
| `render-probe.mjs` | headless Chromium: first paint, settle, DOM/SVG node counts, JS heap, frame times through one scripted pan + three zoom steps, screenshots, every fetch and its bytes |
| `list-pages.mjs` | the pages that render a whole collection, their bytes, and whether any of them pages |
| `find-build-ceiling.mjs` | the N at which the build stops surviving its own bundle stage |
| `parcel-crowding.mjs` | nearest-neighbour parcel spacing against the viewer's own `PARCEL_ART_MIN_M`, per scale factor |

## A full pass, 1x and 10x, one branch

```sh
SCRATCH=/c/tmp/site-load                       # never on the network drive
git -C <clone> archive origin/main | tar -x -C $SCRATCH/main-1x
cp -r <clone>/node_modules $SCRATCH/main-1x/   # copy; do not link
( cd $SCRATCH/main-1x && npm install )         # resolve the branch's own world pin

node harness/measure-build.mjs --tree $SCRATCH/main-1x --label main-1x --out out/main-1x.json
node harness/serve.mjs --root $SCRATCH/main-1x/dist-town --port 4321 \
  --api-state    $SCRATCH/main-1x/node_modules/postmark-world/WORLD/world-state.json \
  --api-skeleton $SCRATCH/main-1x/node_modules/postmark-world/WORLD/skeleton.json &
node harness/render-probe.mjs --url http://127.0.0.1:4321/world/ --label main-1x \
  --out out/render-main-1x.json --shot-settled out/main-1x.png

cp -r $SCRATCH/main-1x $SCRATCH/main-10x
node harness/scale-data.mjs  --tree $SCRATCH/main-10x --factor 10
node harness/scale-world.mjs --tree $SCRATCH/main-10x --factor 10 --mode dense
node harness/measure-build.mjs --tree $SCRATCH/main-10x --label main-10x --out out/main-10x.json
```

Run each timed instrument twice and read the second: the first build of a tree
pays for Astro's type generation and Vite's cold module graph.

## What the numbers are worth

Every script reports the count it derived a number from, so a reading can be
checked rather than believed. Three limits are worth knowing before quoting any
of them:

- **The clones share their images.** `scale-data.mjs` points a cloned resident
  at the original's avatar and home art, so image *fetches* multiply but image
  *bytes* do not. Any payload number at 10x is therefore a floor; a real town of
  ten times the residents has ten times the pictures.
- **`--mode` is a modelling choice, not a measurement.** Tiled and dense give
  materially different answers for the map, and the report has to say which one
  it quoted.
- **The build and the render fail at different N.** `make-10x-dist.mjs` exists
  because of that gap; a render number taken through it is a number about the
  world page, not about a build that succeeded.
