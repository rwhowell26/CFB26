import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[#070b14]/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[88rem] items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-[0.18em] uppercase">
          Dept success
        </Link>
        <p className="hidden text-sm text-[var(--muted)] sm:block">
          D1 football · men’s basketball · baseball
        </p>
      </div>
    </header>
  );
}
