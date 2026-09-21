"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  applyAnswer,
  createInitialState,
  displayChoices,
  isComplete,
  MASTERY_STREAK,
  pendingStreakCount,
  type DisplayChoice,
} from "@/lib/quiz";
import { quizQuestionIds, quizQuestionMap, type QuizDefinition } from "@/lib/quizzes";
import { saveQuizState, useIsClient, useQuizStore } from "@/lib/quiz-store";

type Feedback = {
  correct: boolean;
  masteredNow: boolean;
  streak: number;
};

export function QuizApp({ quiz }: { quiz: QuizDefinition }) {
  const isClient = useIsClient();
  const [state, setState] = useQuizStore(quiz);
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [deal, setDeal] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const ids = useMemo(() => quizQuestionIds(quiz), [quiz]);
  const questions = useMemo(() => quizQuestionMap(quiz), [quiz]);
  const activeId = reviewId ?? state.queue[0] ?? null;
  const question = activeId != null ? questions.get(activeId) ?? null : null;
  const choices = useMemo((): DisplayChoice[] => {
    if (activeId == null) {
      return [];
    }
    const nextQuestion = questions.get(activeId);
    if (!nextQuestion) {
      return [];
    }
    void deal;
    return displayChoices(nextQuestion.choices);
  }, [activeId, deal, questions]);

  const completed = state.mastered.length;
  const total = quiz.questions.length;
  const oneAway = pendingStreakCount(state, ids);
  const complete = isComplete(state, total);
  const currentStreak = activeId != null ? (state.streaks[String(activeId)] ?? 0) : 0;
  const progressLabel = `${completed} of ${total} questions completed`;

  const onSubmit = () => {
    if (selected == null || !question || feedback) {
      return;
    }
    const result = applyAnswer(state, selected, questions);
    setReviewId(result.questionId);
    setState(result.state);
    setFeedback({
      correct: result.correct,
      masteredNow: result.masteredNow,
      streak: result.streak,
    });
  };

  const onNext = () => {
    setFeedback(null);
    setSelected(null);
    setReviewId(null);
    setDeal((value) => value + 1);
  };

  const onReset = () => {
    if (!window.confirm("Reset all quiz progress? Completed questions will return to the deck.")) {
      return;
    }
    setFeedback(null);
    setSelected(null);
    setReviewId(null);
    setDeal((value) => value + 1);
    saveQuizState(quiz, createInitialState(ids));
  };

  if (!isClient) {
    return (
      <div className="quiz-shell">
        <p className="boot">Loading quiz…</p>
      </div>
    );
  }

  return (
    <div className="quiz-shell">
      <header className="quiz-top">
        <div>
          <p className="eyebrow">{quiz.title}</p>
          <h1 className="quiz-title">{quiz.subtitle}</h1>
          <p className="tagline">{quiz.source}</p>
        </div>
        <div className="quiz-top-actions">
          <Link className="ghost-btn" href="/quiz">
            All quizzes
          </Link>
          <Link className="ghost-btn" href="/">
            Rankings
          </Link>
          <button type="button" className="ghost-btn" onClick={onReset}>
            Reset quiz
          </button>
        </div>
      </header>

      <section className="quiz-progress" aria-label="Quiz progress">
        <div className="quiz-progress-copy">
          <p className="section-label">Questions completed</p>
          <p className="quiz-progress-count">{progressLabel}</p>
          <p className="quiz-progress-hint">
            A question stays in the shuffle until you get it right {MASTERY_STREAK} times in a
            row. Miss it and the streak resets.
            {oneAway ? ` ${oneAway} question${oneAway === 1 ? "" : "s"} one correct away.` : ""}
          </p>
        </div>
        <div
          className="quiz-progress-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={completed}
          aria-label={progressLabel}
        >
          <span style={{ width: `${total ? (completed / total) * 100 : 0}%` }} />
        </div>
      </section>

      {(complete || !question) && !feedback ? (
        <section className="quiz-card quiz-complete">
          <p className="eyebrow">Deck cleared</p>
          <h2>You completed every question twice in a row.</h2>
          <p>All {total} questions are done. Reset the quiz whenever you want another pass.</p>
          <button type="button" className="primary-btn" onClick={onReset}>
            Start over
          </button>
        </section>
      ) : question ? (
        <section className="quiz-card">
          <p className="eyebrow">{question.module}</p>
          <p className="quiz-item-meta">
            Question {question.id} of {total}
            {feedback ? null : ` · ${Math.min(currentStreak, MASTERY_STREAK)}/${MASTERY_STREAK} in a row`}
          </p>
          <h2 id="quiz-prompt" className="quiz-prompt">
            {question.prompt}
          </h2>

          <div
            className="quiz-choices"
            role="radiogroup"
            aria-labelledby="quiz-prompt"
            aria-disabled={Boolean(feedback)}
            onKeyDown={(event) => {
              if (feedback) {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onNext();
                }
                return;
              }
              const index = ["1", "2", "3", "4", "a", "b", "c", "d", "A", "B", "C", "D"].indexOf(
                event.key,
              );
              if (index >= 0) {
                const choice = choices[index % 4];
                if (choice) {
                  setSelected(choice.originalLetter);
                }
              }
              if (event.key === "Enter" && selected != null) {
                event.preventDefault();
                onSubmit();
              }
            }}
          >
            {choices.map((choice) => {
              const isSelected = selected === choice.originalLetter;
              const showCorrect = Boolean(feedback && choice.originalLetter === question.answer);
              const showWrong = Boolean(feedback && isSelected && !feedback.correct);
              return (
                <button
                  key={choice.originalLetter}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={[
                    "quiz-choice",
                    isSelected ? "selected" : "",
                    showCorrect ? "correct" : "",
                    showWrong ? "wrong" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={Boolean(feedback)}
                  onClick={() => setSelected(choice.originalLetter)}
                >
                  <span className="quiz-choice-letter">{choice.letter}</span>
                  <span>{choice.text}</span>
                </button>
              );
            })}
          </div>

          {feedback ? (
            <div className={`quiz-feedback ${feedback.correct ? "ok" : "bad"}`}>
              <p className="quiz-feedback-title">
                {feedback.correct
                  ? feedback.masteredNow
                    ? "Correct — completed"
                    : "Correct"
                  : "Incorrect"}
              </p>
              <p>
                {feedback.correct
                  ? feedback.masteredNow
                    ? "Two in a row. This question is removed from the deck."
                    : `Nice. Get it right one more time in a row to complete it (${feedback.streak}/${MASTERY_STREAK}).`
                  : "Streak reset. This question goes back into the shuffle."}
              </p>
              <p className="quiz-explanation">{question.explanation}</p>
              <button type="button" className="primary-btn" onClick={onNext}>
                {state.queue.length ? "Next question" : "See results"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="primary-btn"
              onClick={onSubmit}
              disabled={selected == null}
            >
              Check answer
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}
