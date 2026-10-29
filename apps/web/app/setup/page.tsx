import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Vercel setup",
  description: "How to deploy this app as a second Vercel project without replacing rankings.",
};

const steps = [
  {
    title: "Leave the rankings project alone",
    body: "The existing Vercel project should keep Root Directory empty (repository root). Do not point it at apps/web.",
  },
  {
    title: "Add a new Vercel project",
    body: "In Vercel, choose Add New → Project and import github.com/rwhowell26/CFB26 a second time.",
  },
  {
    title: "Set Root Directory to apps/web",
    body: "Before deploying, click Edit next to Root Directory and select apps/web. Framework should stay Next.js.",
  },
  {
    title: "Deploy",
    body: "That project gets its own production URL. Rankings keep theirs. Future pushes only update this site when apps/web changes.",
  },
];

export default function SetupPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <div>
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.22em] text-[var(--accent)]">
          Deploy without replacing rankings
        </p>
        <h1
          className="text-4xl leading-tight tracking-tight sm:text-5xl"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Second Vercel project
        </h1>
        <p className="mt-5 text-lg leading-8 text-[var(--muted)]">
          Two sites in one GitHub repo works when each Vercel project has a
          different Root Directory. The rankings app is the repo root. This
          app is <code className="text-[var(--ink)]">apps/web</code>.
        </p>
      </div>

      <ol className="space-y-4">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              Step {index + 1}
            </p>
            <h2 className="mt-2 text-lg font-semibold">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{step.body}</p>
          </li>
        ))}
      </ol>

      <p className="text-sm text-[var(--muted)]">
        Local preview:{" "}
        <code className="text-[var(--ink)]">cd apps/web && npm run dev</code>{" "}
        on port 3001. Rankings stay on 3000.{" "}
        <Link href="/" className="text-[var(--accent)] underline-offset-2 hover:underline">
          Back home
        </Link>
      </p>
    </main>
  );
}
