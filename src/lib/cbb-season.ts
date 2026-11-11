/** ESPN / NCAA championship year for 2026-27 men's basketball. */
export const CBB_SEASON_YEAR = 2027;
export const CBB_SEASON_LABEL = "2026-27";
export const CBB_STORAGE_KEY = `cbb-bracketology-v1-${CBB_SEASON_YEAR}`;
export const SPORT_STORAGE_KEY = "cfb26-sport";
/**
 * 2026-27 field: 76 teams, 12 Opening Round games, 24 play-in teams.
 * After those games the First Round is the usual 64 (four teams on each seed line).
 * @see https://ncaaorg.s3.amazonaws.com/championships/sports/basketball/d1/men/2026-27MBB_PrinciplesProcedures.pdf
 */
export const FIELD_SIZE = 76;
/** Four teams occupy each seed line in the 64-team First Round. */
export const SEED_LINE_SPOTS = 4;
export const PLAY_IN_GAMES = 12;
export const PLAY_IN_TEAMS = 24;
/** Opening Round games on each seed line. Two play-in teams count as one First Round spot. */
export const SEED_LINE_PLAY_IN_GAMES: Record<number, number> = {
  11: 4,
  12: 2,
  15: 2,
  16: 4,
};
export const FIRST_FOUR_OUT = 4;
export const NEXT_FOUR_OUT = 4;
/** Recommend teams whose overall rank average is this close to the last Next 4 Out. */
export const RECOMMEND_WITHIN = 10;
export const CBB_STORE_SCHEMA_VERSION = 5;
export const LOCK_SIZE = FIELD_SIZE + FIRST_FOUR_OUT + NEXT_FOUR_OUT;
/** Completed seed-list spots shown beside the current compare. */
export const COMPLETED_ABOVE = 8;

export type SportId = "cfb" | "cbb";

export function formatCbbDate(iso: string, now = new Date(iso)): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(now);
}
