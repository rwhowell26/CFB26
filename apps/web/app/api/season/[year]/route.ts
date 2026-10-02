import { NextRequest, NextResponse } from "next/server";
import { buildSeason } from "@/lib/build-season";
import { AVAILABLE_YEARS } from "@/lib/season";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CACHE_VERSION = 3;
const cache = new Map<string, { expires: number; payload: unknown }>();

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ year: string }> },
) {
  const { year: raw } = await context.params;
  const year = Number(raw);
  if (!AVAILABLE_YEARS.includes(year as (typeof AVAILABLE_YEARS)[number])) {
    return NextResponse.json({ error: "Unsupported season year" }, { status: 400 });
  }
  const cacheKey = `${CACHE_VERSION}:${year}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) {
    return NextResponse.json(hit.payload);
  }
  try {
    const payload = await buildSeason(year);
    cache.set(cacheKey, { expires: Date.now() + 30 * 60 * 1000, payload });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build season";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
