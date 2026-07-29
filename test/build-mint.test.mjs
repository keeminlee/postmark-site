import assert from "node:assert/strict";
import test from "node:test";

import { fetchBuiltMintedCumulative } from "../src/lib/build-mint.mjs";

test("build mint snapshot is valid-or-null and never throws", async () => {
  const response = (body, ok = true) => async () => ({
    ok,
    json: async () => body,
  });

  assert.equal(await fetchBuiltMintedCumulative({
    fetchImpl: response({ minted_cumulative: 2878 }),
  }), 2878);
  assert.equal(await fetchBuiltMintedCumulative({
    fetchImpl: response({ minted_cumulative: "2878" }),
  }), null);
  assert.equal(await fetchBuiltMintedCumulative({
    fetchImpl: response({ minted_cumulative: 2878 }, false),
  }), null);
  assert.equal(await fetchBuiltMintedCumulative({
    fetchImpl: async () => { throw new Error("office asleep"); },
  }), null);
});
