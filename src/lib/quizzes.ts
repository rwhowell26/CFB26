import accy from "@/data/accy-6100-questions.json";
import itAudit from "@/data/it-audit-1-questions.json";
import type { QuizQuestion } from "@/lib/quiz";

export type QuizDefinition = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  source: string;
  storageKey: string;
  questions: QuizQuestion[];
};

export const quizzes: QuizDefinition[] = [
  {
    id: "accy-6100",
    href: "/quiz/accy-6100",
    title: accy.title,
    subtitle: accy.subtitle,
    source: accy.source,
    storageKey: "accy6100-exam1-quiz-v1",
    questions: accy.questions,
  },
  {
    id: "it-audit-1",
    href: "/quiz/it-audit-1",
    title: itAudit.title,
    subtitle: itAudit.subtitle,
    source: itAudit.source,
    storageKey: "it-audit-1-quiz-v1",
    questions: itAudit.questions,
  },
];

export function getQuiz(id: string): QuizDefinition | undefined {
  return quizzes.find((quiz) => quiz.id === id);
}

export function quizQuestionIds(quiz: QuizDefinition): number[] {
  return quiz.questions.map((question) => question.id);
}

export function quizQuestionMap(quiz: QuizDefinition): Map<number, QuizQuestion> {
  return new Map(quiz.questions.map((question) => [question.id, question]));
}
