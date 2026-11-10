/** ESPN / NCAA championship year for 2026-27 men's basketball. */
export const CBB_SEASON_YEAR = 2027;
export const CBB_SEASON_LABEL = "2026-27";
export const CBB_STORAGE_KEY = `cbb-bracketology-v1-${CBB_SEASON_YEAR}`;
export const SPORT_STORAGE_KEY = "cfb26-sport";
export const FIELD_SIZE = 68;
export const FIRST_FOUR_OUT = 4;
export const NEXT_FOUR_OUT = 4;
/** Recommend teams whose overall rank average is this close to the last Next 4 Out. */
export const RECOMMEND_WITHIN = 10;
export const CBB_STORE_SCHEMA_VERSION = 3;
export const LOCK_SIZE = FIELD_SIZE + FIRST_FOUR_OUT + NEXT_FOUR_OUT;

export type SportId = "cfb" | "cbb";

export function formatCbbDate(iso: string, now = new Date(iso)): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(now);
}
