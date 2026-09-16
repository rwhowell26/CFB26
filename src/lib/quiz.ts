import bank from "@/data/accy-6100-questions.json";

export const MASTERY_STREAK = 2;
export const QUIZ_STORAGE_KEY = "accy6100-exam1-quiz-v1";

export type QuizChoice = {
  letter: string;
  text: string;
};

export type QuizQuestion = {
  id: number;
  module: string;
  prompt: string;
  choices: QuizChoice[];
  answer: string;
  explanation: string;
};

export type QuizState = {
  streaks: Record<string, number>;
  mastered: number[];
  queue: number[];
};

export type AnswerResult = {
  state: QuizState;
  questionId: number;
  correct: boolean;
  masteredNow: boolean;
  streak: number;
};

const LETTERS = ["A", "B", "C", "D"] as const;

export const quizMeta = {
  title: bank.title,
  subtitle: bank.subtitle,
  source: bank.source,
};

export const quizQuestions: QuizQuestion[] = bank.questions;
export const quizQuestionMap = new Map(quizQuestions.map((question) => [question.id, question]));
export const quizQuestionIds = quizQuestions.map((question) => question.id);

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/** Put a question back into the remaining deck, avoiding an immediate repeat when possible. */
export function insertIntoShuffle(
  queue: readonly number[],
  id: number,
  random: () => number = Math.random,
): number[] {
  if (queue.length === 0) {
    return [id];
  }
  const index = 1 + Math.floor(random() * queue.length);
  const next = [...queue];
  next.splice(index, 0, id);
  return next;
}

export function createInitialState(
  ids: readonly number[] = quizQuestionIds,
  random: () => number = Math.random,
): QuizState {
  return {
    streaks: Object.fromEntries(ids.map((id) => [String(id), 0])),
    mastered: [],
    queue: shuffle(ids, random),
  };
}

export function currentQuestionId(state: QuizState): number | null {
  return state.queue[0] ?? null;
}

export function isComplete(state: QuizState, total = quizQuestionIds.length): boolean {
  return state.mastered.length >= total && state.queue.length === 0;
}

export function applyAnswer(
  state: QuizState,
  selectedLetter: string,
  questions = quizQuestionMap,
  random: () => number = Math.random,
): AnswerResult {
  const questionId = state.queue[0];
  if (questionId == null) {
    return {
      state,
      questionId: -1,
      correct: false,
      masteredNow: false,
      streak: 0,
    };
  }

  const question = questions.get(questionId);
  if (!question) {
    throw new Error(`Unknown question ${questionId}`);
  }

  const rest = state.queue.slice(1);
  const correct = selectedLetter === question.answer;
  const streaks = { ...state.streaks };
  const key = String(questionId);
  let streak = streaks[key] ?? 0;
  const mastered = [...state.mastered];
  let masteredNow = false;

  if (correct) {
    streak += 1;
    streaks[key] = streak;
    if (streak >= MASTERY_STREAK) {
      masteredNow = true;
      if (!mastered.includes(questionId)) {
        mastered.push(questionId);
      }
    }
  } else {
    streak = 0;
    streaks[key] = 0;
  }

  const queue =
    masteredNow || mastered.includes(questionId)
      ? rest
      : insertIntoShuffle(rest, questionId, random);

  return {
    state: { streaks, mastered, queue },
    questionId,
    correct,
    masteredNow,
    streak,
  };
}

export type DisplayChoice = QuizChoice & { originalLetter: string };

export function displayChoices(
  choices: readonly QuizChoice[],
  random: () => number = Math.random,
): DisplayChoice[] {
  return shuffle(choices, random).map((choice, index) => ({
    letter: LETTERS[index] ?? choice.letter,
    text: choice.text,
    originalLetter: choice.letter,
  }));
}

export function parseStoredState(raw: string | null): QuizState | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<QuizState>;
    if (!parsed || !Array.isArray(parsed.queue) || !Array.isArray(parsed.mastered) || !parsed.streaks) {
      return null;
    }
    const known = new Set(quizQuestionIds);
    const queue = parsed.queue.filter((id) => known.has(id) && !parsed.mastered?.includes(id));
    const mastered = parsed.mastered.filter((id) => known.has(id));
    const streaks: Record<string, number> = {};
    for (const id of quizQuestionIds) {
      const value = parsed.streaks[String(id)];
      streaks[String(id)] = mastered.includes(id)
        ? MASTERY_STREAK
        : Math.max(0, Math.min(MASTERY_STREAK - 1, Number(value) || 0));
    }
    const missing = quizQuestionIds.filter(
      (id) => !mastered.includes(id) && !queue.includes(id),
    );
    return {
      streaks,
      mastered,
      queue: [...queue, ...shuffle(missing)],
    };
  } catch {
    return null;
  }
}

export function loadQuizState(): QuizState {
  if (typeof window === "undefined") {
    return createInitialState(quizQuestionIds, () => 0.5);
  }
  return parseStoredState(window.localStorage.getItem(QUIZ_STORAGE_KEY)) ?? createInitialState();
}

export function writeQuizState(state: QuizState): void {
  window.localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(state));
}

export function pendingStreakCount(state: QuizState): number {
  return quizQuestionIds.filter((id) => {
    if (state.mastered.includes(id)) {
      return false;
    }
    return (state.streaks[String(id)] ?? 0) === 1;
  }).length;
}
