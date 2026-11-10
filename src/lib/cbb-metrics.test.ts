import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyMetrics, formatRank, formatRankAdvantage, overallAverage, rankAdvantage } from "./cbb-metrics";

test("overall average is the mean of present ranks", () => {
  assert.equal(
    overallAverage({
      ...emptyMetrics("a"),
      kenpom: 1,
      bpi: 3,
      torvik: 2,
      sor: 1,
      kpi: 1,
      wab: 4,
    }),
    2,
  );
});

test("rank 1 vs rank 2 is a +1 advantage for the first team", () => {
  assert.equal(rankAdvantage(1, 2), 1);
  assert.equal(formatRankAdvantage(1), "+1");
  assert.equal(formatRank(1), "1");
  assert.equal(formatRank(12.4, 1), "12.4");
});
