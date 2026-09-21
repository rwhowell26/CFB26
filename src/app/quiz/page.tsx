import type { Metadata } from "next";
import { QuizHub } from "@/components/QuizHub";

export const metadata: Metadata = {
  title: "Practice quizzes",
  description: "Choose a practice quiz. Questions stay in the deck until you get them right twice in a row.",
};

export default function QuizIndexPage() {
  return (
    <main>
      <QuizHub />
    </main>
  );
}
