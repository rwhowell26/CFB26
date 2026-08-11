import { NextResponse } from "next/server";
import { currentSeasonWeek, fetchAllGames } from "@/lib/espn";
import { SEASON_YEAR } from "@/lib/season";

export async function GET() {
  try {
    const data = await fetchAllGames(SEASON_YEAR);
    return NextResponse.json({
      season: SEASON_YEAR,
      currentWeek: currentSeasonWeek(data.weeks),
      ...data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load games";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
