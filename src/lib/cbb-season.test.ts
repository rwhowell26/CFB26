import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCbbDate } from "./cbb-season";

test("snapshot labels are the creation date with no time", () => {
  const label = formatCbbDate("2026-11-05T18:41:00.000Z");
  assert.match(label, /Nov 5, 2026/);
  assert.doesNotMatch(label, /\d:\d{2}/);
  assert.doesNotMatch(label, /AM|PM/i);
});
