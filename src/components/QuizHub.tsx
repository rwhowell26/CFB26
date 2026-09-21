import Link from "next/link";
import { quizzes } from "@/lib/quizzes";

export function QuizHub() {
  return (
    <div className="quiz-shell">
      <header className="quiz-top">
        <div>
          <p className="eyebrow">Practice tests</p>
          <h1 className="quiz-title">Choose a quiz</h1>
          <p className="tagline">
            Same rules on every test: one question at a time, and a question stays in the shuffle
            until you get it right twice in a row.
          </p>
        </div>
        <div className="quiz-top-actions">
          <Link className="ghost-btn" href="/">
            Rankings
          </Link>
        </div>
      </header>

      <div className="quiz-hub-grid">
        {quizzes.map((quiz) => (
          <Link key={quiz.id} href={quiz.href} className="quiz-hub-card">
            <p className="eyebrow">{quiz.title}</p>
            <h2>{quiz.subtitle}</h2>
            <p>{quiz.source}</p>
            <p className="quiz-hub-meta">{quiz.questions.length} questions</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
