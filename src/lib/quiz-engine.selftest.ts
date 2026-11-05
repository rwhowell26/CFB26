import {
  applyAnswer,
  answersEqual,
  createInitialState,
  insertIntoShuffle,
  parseStoredState,
  type QuizQuestion,
} from "./quiz";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const questions = new Map<number, QuizQuestion>([
  [
    1,
    {
      id: 1,
      module: "Test",
      prompt: "One?",
      choices: [
        { letter: "A", text: "no" },
        { letter: "B", text: "yes" },
      ],
      answer: "B",
      explanation: "B is right",
    },
  ],
  [
    2,
    {
      id: 2,
      module: "Test",
      prompt: "Two?",
      choices: [
        { letter: "A", text: "no" },
        { letter: "B", text: "yes" },
      ],
      answer: "B",
      explanation: "B is right",
    },
  ],
]);

const start = createInitialState([1, 2], () => 0);
assert(start.queue.length === 2, "initial queue should include both questions");

const inserted = insertIntoShuffle([2], 1, () => 0);
assert(JSON.stringify(inserted) === JSON.stringify([2, 1]), `unexpected insert ${inserted}`);

const first = applyAnswer({ ...start, queue: [1, 2] }, "B", questions, () => 0);
assert(first.correct, "first answer should be correct");
assert(!first.masteredNow, "one correct should not complete the question");
assert(first.state.queue.includes(1), "correct-once question should stay in the shuffle");
assert(first.state.queue[0] !== 1, "should not immediately repeat when another question remains");

const second = applyAnswer(first.state, first.state.queue[0] === 2 ? "B" : "A", questions, () => 0);
assert(second.state.queue.includes(1), "unfinished question should remain after another item");

const pass1 = applyAnswer({ ...start, queue: [1, 2] }, "B", questions, () => 0);
const pass2 = applyAnswer(
  { ...pass1.state, queue: [1, ...pass1.state.queue.filter((id) => id !== 1)] },
  "B",
  questions,
  () => 0,
);
assert(pass2.masteredNow, "two consecutive correct answers should complete the question");
assert(!pass2.state.queue.includes(1), "completed question should leave the deck");
assert(pass2.state.mastered.includes(1), "completed question should count as mastered");

const miss = applyAnswer({ ...start, queue: [1, 2] }, "A", questions, () => 0);
assert(!miss.correct, "wrong answer should not count");
assert(miss.streak === 0, "wrong answer should reset the streak");
assert(miss.state.queue.includes(1), "wrong answer should return the question to the shuffle");

const restored = parseStoredState(
  JSON.stringify({
    streaks: { "1": 1, "2": 0 },
    mastered: [999],
    queue: [1],
  }),
  [1, 2],
);
assert(restored, "valid stored state should parse");
assert(!restored?.mastered.includes(999), "unknown mastered ids should be dropped");
assert(restored?.queue.includes(1), "saved queue should be kept");
assert(restored?.queue.includes(2), "missing live questions should be added back");

assert(answersEqual("B,A", "A,B"), "multi-answer order should not matter");
assert(!answersEqual("A,B", "A"), "partial multi-answer should be wrong");

const multiQuestions = new Map<number, QuizQuestion>([
  [
    3,
    {
      id: 3,
      module: "Test",
      prompt: "Pick both?",
      choices: [
        { letter: "A", text: "yes" },
        { letter: "B", text: "yes" },
        { letter: "C", text: "no" },
      ],
      answer: "A,B",
      selectAll: true,
      explanation: "A and B",
    },
  ],
]);
const multiMiss = applyAnswer(
  { streaks: { "3": 0 }, mastered: [], queue: [3] },
  "A",
  multiQuestions,
  () => 0,
);
assert(!multiMiss.correct, "select-all should require every correct letter");
const multiHit = applyAnswer(
  { streaks: { "3": 0 }, mastered: [], queue: [3] },
  "B,A",
  multiQuestions,
  () => 0,
);
assert(multiHit.correct, "select-all should accept the full set in any order");

console.log("quiz engine self-test passed");
