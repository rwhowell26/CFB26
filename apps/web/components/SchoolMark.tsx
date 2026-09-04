import type { School } from "@/lib/types";

export function SchoolMark({ school, size = 28 }: { school: School; size?: number }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {school.logo ? (
        // ESPN CDN logos; unoptimized <img> avoids remote image config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={school.logo}
          alt=""
          width={size}
          height={size}
          className="rounded-sm bg-white/90 object-contain"
        />
      ) : (
        <span
          className="grid place-items-center rounded-sm bg-white/10 text-[10px] font-semibold"
          style={{ width: size, height: size }}
        >
          {school.abbreviation.slice(0, 3)}
        </span>
      )}
      <span className="min-w-0 truncate font-medium">{school.location}</span>
    </span>
  );
}
