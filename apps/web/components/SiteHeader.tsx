import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[#070b14]/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-[0.18em] uppercase">
          New site
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-5 text-sm text-[var(--muted)]">
          <Link className="transition-colors hover:text-[var(--ink)]" href="/">
            Home
          </Link>
          <Link className="transition-colors hover:text-[var(--ink)]" href="/setup">
            Vercel setup
          </Link>
        </nav>
      </div>
    </header>
  );
}
