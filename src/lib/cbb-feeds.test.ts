import assert from "node:assert/strict";
import { test } from "node:test";
import { ratingFromRank } from "./cbb-feeds";

test("rank 1 maps to +40 and the last rank maps to -40", () => {
  assert.equal(ratingFromRank(1, 365), 40);
  assert.ok(Math.abs(ratingFromRank(365, 365) + 40) < 1e-9);
  assert.ok(ratingFromRank(2, 365) < 40);
});
