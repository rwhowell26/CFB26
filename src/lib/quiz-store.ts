"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  createInitialState,
  loadQuizState,
  quizQuestionIds,
  writeQuizState,
  type QuizState,
} from "@/lib/quiz";

const listeners = new Set<() => void>();
const serverSnapshot = createInitialState(quizQuestionIds, () => 0.5);
let memoryStore: QuizState = serverSnapshot;
let didHydrate = false;

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function saveQuizState(state: QuizState): void {
  memoryStore = state;
  if (typeof window !== "undefined") {
    writeQuizState(state);
  }
  emit();
}

function getSnapshot(): QuizState {
  if (!didHydrate) {
    didHydrate = true;
    memoryStore = loadQuizState();
  }
  return memoryStore;
}

function getServerSnapshot(): QuizState {
  return serverSnapshot;
}

export function useQuizStore(): [QuizState, (next: QuizState) => void] {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setStore = useCallback((next: QuizState) => {
    saveQuizState(next);
  }, []);
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
