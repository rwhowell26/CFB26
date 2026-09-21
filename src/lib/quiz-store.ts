"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  createInitialState,
  loadQuizState,
  writeQuizState,
  type QuizState,
} from "@/lib/quiz";
import { quizQuestionIds, type QuizDefinition } from "@/lib/quizzes";

type QuizBucket = {
  listeners: Set<() => void>;
  serverSnapshot: QuizState;
  memory: QuizState;
  didHydrate: boolean;
};

const buckets = new Map<string, QuizBucket>();

function getBucket(quiz: QuizDefinition): QuizBucket {
  const existing = buckets.get(quiz.id);
  if (existing) {
    return existing;
  }
  const ids = quizQuestionIds(quiz);
  const serverSnapshot = createInitialState(ids, () => 0.5);
  const created: QuizBucket = {
    listeners: new Set(),
    serverSnapshot,
    memory: serverSnapshot,
    didHydrate: false,
  };
  buckets.set(quiz.id, created);
  return created;
}

function emit(quizId: string): void {
  const bucket = buckets.get(quizId);
  if (!bucket) {
    return;
  }
  for (const listener of bucket.listeners) {
    listener();
  }
}

export function saveQuizState(quiz: QuizDefinition, state: QuizState): void {
  const bucket = getBucket(quiz);
  bucket.memory = state;
  if (typeof window !== "undefined") {
    writeQuizState(quiz.storageKey, state);
  }
  emit(quiz.id);
}

export function useQuizStore(quiz: QuizDefinition): [QuizState, (next: QuizState) => void] {
  const subscribe = useCallback(
    (listener: () => void) => {
      const bucket = getBucket(quiz);
      bucket.listeners.add(listener);
      return () => {
        bucket.listeners.delete(listener);
      };
    },
    [quiz],
  );

  const getSnapshot = useCallback(() => {
    const bucket = getBucket(quiz);
    if (!bucket.didHydrate) {
      bucket.didHydrate = true;
      bucket.memory = loadQuizState(quiz.storageKey, quizQuestionIds(quiz));
    }
    return bucket.memory;
  }, [quiz]);

  const getServerSnapshot = useCallback(() => getBucket(quiz).serverSnapshot, [quiz]);

  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setStore = useCallback(
    (next: QuizState) => {
      saveQuizState(quiz, next);
    },
    [quiz],
  );
  return [store, setStore];
}

const noopSubscribe = () => () => {};

export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
