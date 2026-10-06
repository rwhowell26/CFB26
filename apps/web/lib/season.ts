/** Academic year is labeled by its spring (baseball / basketball) year. */
export function seasonLabel(year: number): string {
  return `${year - 1}–${String(year).slice(2)}`;
}

export function footballYearFor(year: number): number {
  return year - 1;
}

export const AVAILABLE_YEARS = [2024, 2025, 2026] as const;

export const DEFAULT_YEAR = 2026;

export const SPORTS = ["football", "basketball", "baseball"] as const;
