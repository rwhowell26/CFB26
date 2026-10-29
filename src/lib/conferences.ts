/** Canonical short labels for FBS conference display. */
const CONFERENCE_SHORT: Record<string, string> = {
  "Atlantic Coast Conference": "ACC",
  "Big 12 Conference": "Big 12",
  "Big Ten Conference": "Big 10",
  "Southeastern Conference": "SEC",
  "American Conference": "AAC",
  "Conference USA": "CUSA",
  "Mid-American Conference": "MAC",
  "Mountain West Conference": "MW",
  "Pac-12 Conference": "P12",
  "Sun Belt Conference": "SBC",
  "Sun Belt - East": "SBC",
  "Sun Belt - West": "SBC",
  "FBS Independents": "Independents",
};

export function normalizeConferenceName(name: string): string {
  if (name.startsWith("Sun Belt")) return "Sun Belt Conference";
  return name;
}

export function shortConferenceName(name: string): string {
  const normalized = normalizeConferenceName(name);
  return CONFERENCE_SHORT[normalized] ?? CONFERENCE_SHORT[name] ?? name.replace(" Conference", "");
}

export function playoffTableLabel(conference: string): string {
  if (conference === "Sun Belt - East") return "SBC East";
  if (conference === "Sun Belt - West") return "SBC West";
  return shortConferenceName(conference);
}

export function isIndependentConference(name: string): boolean {
  return /independent/i.test(name);
}

const TABLE_ORDER = [
  "ACC",
  "Big 10",
  "SEC",
  "Big 12",
  "AAC",
  "CUSA",
  "MAC",
  "MW",
  "P12",
  "SBC East",
  "SBC West",
];

export function playoffTableSortKey(conference: string): number {
  const label = playoffTableLabel(conference);
  const idx = TABLE_ORDER.indexOf(label);
  return idx === -1 ? 100 + label.localeCompare("") : idx;
}
