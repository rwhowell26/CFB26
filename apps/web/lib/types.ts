export type Sport = "football" | "basketball" | "baseball";

export type Subdivision = "FBS" | "FCS";

export type School = {
  id: string;
  name: string;
  location: string;
  abbreviation: string;
  logo: string | null;
  conferences: Partial<Record<Sport, string>>;
  espnIds: Partial<Record<Sport, string>>;
  sports: Sport[];
};

export type SportResult = {
  schoolId: string;
  sport: Sport;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  tier: number;
  roundKey: string;
  roundLabel: string;
  conference: string | null;
  subdivision?: Subdivision;
};

export type SeasonPayload = {
  year: number;
  label: string;
  footballYear: number;
  basketballSeason: number;
  baseballSeason: number;
  schools: School[];
  results: Record<Sport, SportResult[]>;
  autoRankIds: string[];
  generatedAt: string;
};

export type OpinionStore = {
  schemaVersion: number;
  seasons: Record<
    string,
    {
      order: string[];
      savedAt: string;
    }
  >;
};
