import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyScrubChoice,
  emptyDraft,
  nextScrubQuestion,
  remainingScrubCount,
  skipRemainingScrub,
  undoScrubChoice,
} from "./cbb-scrub";

test("scrub starts at the 1-seed vs the 2-seed", () => {
  const question = nextScrubQuestion(["a", "b", "c"], []);
  assert.deepEqual(question, { leftId: "a", rightId: "b", leftRank: 1, rightRank: 2 });
});

test("picking the lower team swaps them and moves to the new neighbor", () => {
  let draft = emptyDraft(["a", "b", "c"], null);
  draft = applyScrubChoice(draft, "b", "a");
  assert.deepEqual(draft.rankedIds, ["b", "a", "c"]);
  const next = nextScrubQuestion(draft.rankedIds, draft.confirmedPairs);
  assert.deepEqual(next, { leftId: "a", rightId: "c", leftRank: 2, rightRank: 3 });
});

test("keeping the higher team confirms the pair and continues down", () => {
  let draft = emptyDraft(["a", "b", "c"], null);
  draft = applyScrubChoice(draft, "a", "b");
  assert.deepEqual(draft.rankedIds, ["a", "b", "c"]);
  const next = nextScrubQuestion(draft.rankedIds, draft.confirmedPairs);
  assert.deepEqual(next, { leftId: "b", rightId: "c", leftRank: 2, rightRank: 3 });
});

test("skip remaining marks every adjacent pair done", () => {
  const draft = skipRemainingScrub(emptyDraft(["a", "b", "c", "d"], null));
  assert.equal(nextScrubQuestion(draft.rankedIds, draft.confirmedPairs), null);
  assert.equal(remainingScrubCount(draft.rankedIds, draft.confirmedPairs), 0);
});

test("undo restores the previous S-curve", () => {
  let draft = emptyDraft(["a", "b"], null);
  draft = applyScrubChoice(draft, "b", "a");
  const undone = undoScrubChoice(draft);
  assert.ok(undone);
  assert.deepEqual(undone.rankedIds, ["a", "b"]);
  assert.equal(undone.confirmedPairs.length, 0);
});
