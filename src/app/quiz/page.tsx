import type { Metadata } from "next";
import { QuizApp } from "@/components/QuizApp";

export const metadata: Metadata = {
  title: "ACCY 6100 Exam 1 Quiz",
  description:
    "Practice multiple-choice quiz for ACCY 6100 Exam 1. Questions stay in the deck until you get them right twice in a row.",
};

export default function QuizPage() {
  return (
    <main>
      <QuizApp />
    </main>
  );
}
