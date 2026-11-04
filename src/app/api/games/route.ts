import { NextResponse } from "next/server";
import { currentSeasonWeek, fetchAllGames } from "@/lib/espn";
import { SEASON_YEAR } from "@/lib/season";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const live = new URL(request.url).searchParams.get("live") === "1";
    const data = await fetchAllGames(SEASON_YEAR, { live });
    const response = NextResponse.json({
      season: SEASON_YEAR,
      currentWeek: currentSeasonWeek(data.weeks),
      ...data,
    });
    response.headers.set(
      "Cache-Control",
      live
        ? "private, no-store"
        : "public, s-maxage=30, stale-while-revalidate=60",
    );
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load games";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
