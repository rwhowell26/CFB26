import { NextResponse } from "next/server";
import { fetchCbbSchedules } from "@/lib/cbb-espn";
import { CBB_SEASON_YEAR } from "@/lib/cbb-season";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const ids = new URL(request.url).searchParams.get("ids") ?? "";
  const teamIds = ids
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 4);
  if (!teamIds.length) {
    return NextResponse.json({ games: [] });
  }
  try {
    const games = await fetchCbbSchedules(teamIds, CBB_SEASON_YEAR);
    const response = NextResponse.json({ games });
    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load schedules";
    return NextResponse.json({ error: message, games: [] }, { status: 500 });
  }
}
