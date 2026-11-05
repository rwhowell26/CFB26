import { NextResponse } from "next/server";
import { fetchCbbPayload } from "@/lib/cbb-espn";
import { CBB_SEASON_LABEL, CBB_SEASON_YEAR } from "@/lib/cbb-season";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchCbbPayload(CBB_SEASON_YEAR);
    const response = NextResponse.json({
      seasonLabel: CBB_SEASON_LABEL,
      ...data,
    });
    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load basketball data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
