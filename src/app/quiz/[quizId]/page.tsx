import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuizApp } from "@/components/QuizApp";
import { getQuiz, quizzes } from "@/lib/quizzes";

export function generateStaticParams() {
  return quizzes.map((quiz) => ({ quizId: quiz.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/quiz/[quizId]">): Promise<Metadata> {
  const { quizId } = await params;
  const quiz = getQuiz(quizId);
  if (!quiz) {
    return { title: "Quiz not found" };
  }
  return {
    title: `${quiz.title} quiz`,
    description: `${quiz.subtitle}. Questions stay in the deck until you get them right twice in a row.`,
  };
}

export default async function QuizDetailPage({ params }: PageProps<"/quiz/[quizId]">) {
  const { quizId } = await params;
  const quiz = getQuiz(quizId);
  if (!quiz) {
    notFound();
  }

  return (
    <main>
      <QuizApp quiz={quiz} />
    </main>
  );
}
