/** ESPN / NCAA championship year for 2026-27 men's basketball. */
export const CBB_SEASON_YEAR = 2027;
export const CBB_SEASON_LABEL = "2026-27";
export const CBB_STORAGE_KEY = `cbb-bracketology-v1-${CBB_SEASON_YEAR}`;
export const SPORT_STORAGE_KEY = "cfb26-sport";
/** 2026-27 expanded field: 76 teams, 8 play-in games, 16 play-in teams. */
export const FIELD_SIZE = 76;
/** Four 16-seed games and four last-at-large games. */
export const PLAY_IN_GAMES = 8;
export const PLAY_IN_TEAMS = 16;
export const PLAY_IN_16_TEAMS = 8;
export const PLAY_IN_AT_LARGE_TEAMS = 8;
/** 16-seed and last-at-large lines hold 2 byes + 8 play-in teams. */
export const PLAY_IN_SEED_LINE_SIZE = 10;
export const FIRST_FOUR_OUT = 4;
export const NEXT_FOUR_OUT = 4;
/** Recommend teams whose overall rank average is this close to the last Next 4 Out. */
export const RECOMMEND_WITHIN = 10;
export const CBB_STORE_SCHEMA_VERSION = 4;
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
