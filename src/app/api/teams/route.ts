import { NextResponse } from "next/server";
import { fetchFbsTeams } from "@/lib/espn";
import { SEASON_YEAR } from "@/lib/season";

export async function GET() {
  try {
    const teams = await fetchFbsTeams(SEASON_YEAR);
    return NextResponse.json({ season: SEASON_YEAR, teams });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load teams";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
