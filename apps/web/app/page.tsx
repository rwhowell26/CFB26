import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-16">
      <section className="max-w-2xl">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.22em] text-[var(--accent)]">
          Separate Vercel project
        </p>
        <h1
          className="text-5xl leading-[1.05] tracking-tight sm:text-6xl"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          This is a new webapp, not the rankings site.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">
          It lives in <code className="text-[var(--ink)]">apps/web</code> so
          the existing CFB26 rankings app at the repo root stays untouched.
          Give it its own Vercel project and both sites can stay live.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/setup"
            className="inline-flex h-12 items-center rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-[#070b14] transition-opacity hover:opacity-90"
          >
            Connect a second Vercel project
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] p-5">
          <h2 className="text-base font-semibold">Own folder</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Rankings stay at the repository root. This app is only{" "}
            <code className="text-[var(--ink)]">apps/web</code>.
          </p>
        </article>
        <article className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] p-5">
          <h2 className="text-base font-semibold">Own Vercel project</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Import this GitHub repo again and set Root Directory to{" "}
            <code className="text-[var(--ink)]">apps/web</code>.
          </p>
        </article>
        <article className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] p-5">
          <h2 className="text-base font-semibold">Own domain</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            The rankings production URL does not change. This site gets a
            different <code className="text-[var(--ink)]">*.vercel.app</code>{" "}
            address.
          </p>
        </article>
      </section>
    </main>
  );
}
