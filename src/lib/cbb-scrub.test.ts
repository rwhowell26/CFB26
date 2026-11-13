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
  const question = nextScrubQuestion(emptyDraft(["a", "b", "c"], null));
  assert.deepEqual(question, {
    leftId: "a",
    rightId: "b",
    leftRank: 1,
    rightRank: 2,
    phase: "at-large",
  });
});

test("picking the lower team swaps them and moves to the new neighbor", () => {
  let draft = emptyDraft(["a", "b", "c"], null);
  draft = applyScrubChoice(draft, "b", "a");
  assert.deepEqual(draft.rankedIds, ["b", "a", "c"]);
  const next = nextScrubQuestion(draft);
  assert.equal(next?.leftId, "a");
  assert.equal(next?.rightId, "c");
});

test("keeping the higher team confirms the pair and continues down", () => {
  let draft = emptyDraft(["a", "b", "c"], null);
  draft = applyScrubChoice(draft, "a", "b");
  assert.deepEqual(draft.rankedIds, ["a", "b", "c"]);
  const next = nextScrubQuestion(draft);
  assert.equal(next?.leftId, "b");
  assert.equal(next?.rightId, "c");
});

test("skip remaining finishes the lock and starts recommended climbs", () => {
  const draft = skipRemainingScrub(emptyDraft(["a", "b", "c", "d"], null), ["e"]);
  assert.equal(draft.phase, "recommend");
  assert.equal(draft.climbingId, "e");
  assert.ok(draft.rankedIds.includes("e"));
  const question = nextScrubQuestion(draft);
  assert.equal(question?.phase, "recommend");
  assert.equal(question?.rightId, "e");
});

test("a recommended team climbs while it keeps winning", () => {
  let draft = skipRemainingScrub(emptyDraft(["a", "b", "c"], null), ["x"]);
  draft = applyScrubChoice(draft, "x", "c", ["x"]);
  assert.deepEqual(draft.rankedIds.slice(0, 4), ["a", "b", "x", "c"]);
  draft = applyScrubChoice(draft, "b", "x", ["x"]);
  assert.equal(draft.climbingId, null);
  assert.equal(nextScrubQuestion(draft), null);
});

test("undo restores the previous S-curve", () => {
  let draft = emptyDraft(["a", "b"], null);
  draft = applyScrubChoice(draft, "b", "a");
  const undone = undoScrubChoice(draft);
  assert.ok(undone);
  assert.deepEqual(undone.rankedIds, ["a", "b"]);
  assert.equal(undone.confirmedPairs.length, 0);
});

test("remaining at-large count is adjacent pairs on the at-large board", () => {
  const ids = Array.from({ length: 52 }, (_, i) => `t${i}`);
  const draft = emptyDraft(ids, null);
  assert.equal(remainingScrubCount(draft), 51);
});

test("a recommended team starts below the last Next 4 Out and climbs until it loses", () => {
  let draft = skipRemainingScrub(emptyDraft(["in1", "in2", "firstOut", "nextOut"], null), ["newTeam"]);
  assert.equal(draft.phase, "recommend");
  assert.deepEqual(draft.rankedIds.slice(-2), ["nextOut", "newTeam"]);
  const question = nextScrubQuestion(draft);
  assert.equal(question?.leftId, "nextOut");
  assert.equal(question?.rightId, "newTeam");
  draft = applyScrubChoice(draft, "newTeam", "nextOut", ["newTeam"]);
  assert.deepEqual(draft.rankedIds.slice(-3), ["firstOut", "newTeam", "nextOut"]);
  draft = applyScrubChoice(draft, "firstOut", "newTeam", ["newTeam"]);
  assert.equal(draft.climbingId, null);
});

test("after recommended climbs, auto-bids scrub on their own 12-16 list", () => {
  let draft = skipRemainingScrub(emptyDraft(["a", "b"], null), [], ["x", "y", "z"]);
  assert.equal(draft.phase, "auto-bid");
  assert.deepEqual(draft.rankedIds, ["a", "b"]);
  assert.deepEqual(draft.autoBidIds, ["x", "y", "z"]);
  const question = nextScrubQuestion(draft);
  assert.equal(question?.phase, "auto-bid");
  assert.equal(question?.leftId, "x");
  assert.equal(question?.rightId, "y");
  assert.equal(question?.leftRank, 3);
  draft = applyScrubChoice(draft, "y", "x", [], ["x", "y", "z"]);
  assert.deepEqual(draft.autoBidIds, ["y", "x", "z"]);
  assert.deepEqual(draft.rankedIds, ["a", "b"]);
});

test("skip remaining on at-large with no recommends goes straight to auto-bids", () => {
  const draft = skipRemainingScrub(emptyDraft(["a", "b"], null), [], ["m", "n"]);
  assert.equal(draft.phase, "auto-bid");
  assert.deepEqual(draft.autoBidIds, ["m", "n"]);
  assert.equal(nextScrubQuestion(draft)?.leftId, "m");
});
