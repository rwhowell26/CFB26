import type { PlayoffStatus } from "./types";

/** Spreadsheet Playoff Race tab as of 2026-10-29. */
export const PLAYOFF_SEED_VERSION = 1;

export const PLAYOFF_NOTRE_DAME_SEED = { wins: 6, losses: 1 };

type SeedRow = { wins: number; losses: number; status: PlayoffStatus };

/** ESPN team id → conference W-L and title-race status from Ranker 2026. */
export const PLAYOFF_TEAM_SEED: Record<string, SeedRow> = {
  // Pac-12
  "204": { wins: 3, losses: 0, status: "destiny" }, // Oregon State
  "68": { wins: 3, losses: 0, status: "destiny" }, // Boise State
  "326": { wins: 2, losses: 1, status: "alive" }, // Texas State
  "21": { wins: 2, losses: 2, status: "alive" }, // San Diego State
  "328": { wins: 1, losses: 2, status: "alive" }, // Utah State
  "278": { wins: 1, losses: 2, status: "alive" }, // Fresno State
  "36": { wins: 1, losses: 2, status: "alive" }, // Colorado State
  "265": { wins: 0, losses: 4, status: "alive" }, // Washington State
  "16": { wins: 0, losses: 0, status: "eliminated" }, // Sacramento State

  // Sun Belt East
  "256": { wins: 4, losses: 1, status: "destiny" }, // James Madison
  "290": { wins: 2, losses: 1, status: "alive" }, // Georgia Southern
  "2026": { wins: 2, losses: 1, status: "alive" }, // App State
  "2247": { wins: 1, losses: 2, status: "alive" }, // Georgia State
  "324": { wins: 1, losses: 2, status: "alive" }, // Coastal Carolina
  "276": { wins: 1, losses: 2, status: "alive" }, // Marshall
  "295": { wins: 0, losses: 0, status: "eliminated" }, // Old Dominion

  // Mountain West
  "167": { wins: 3, losses: 0, status: "destiny" }, // New Mexico
  "2751": { wins: 4, losses: 1, status: "alive" }, // Wyoming
  "2439": { wins: 2, losses: 1, status: "alive" }, // UNLV
  "2449": { wins: 3, losses: 2, status: "alive" }, // North Dakota State
  "2005": { wins: 3, losses: 2, status: "alive" }, // Air Force
  "23": { wins: 2, losses: 2, status: "alive" }, // San José State
  "2440": { wins: 2, losses: 2, status: "alive" }, // Nevada
  "2459": { wins: 0, losses: 3, status: "alive" }, // Northern Illinois
  "2638": { wins: 0, losses: 3, status: "alive" }, // UTEP
  "62": { wins: 1, losses: 4, status: "out-loss" }, // Hawai'i

  // MAC
  "195": { wins: 4, losses: 0, status: "destiny" }, // Ohio
  "2711": { wins: 3, losses: 1, status: "alive" }, // Western Michigan
  "193": { wins: 3, losses: 1, status: "alive" }, // Miami (OH)
  "2649": { wins: 3, losses: 1, status: "alive" }, // Toledo
  "2084": { wins: 3, losses: 1, status: "alive" }, // Buffalo
  "2199": { wins: 3, losses: 2, status: "alive" }, // Eastern Michigan
  "189": { wins: 2, losses: 2, status: "alive" }, // Bowling Green
  "2309": { wins: 2, losses: 2, status: "alive" }, // Kent State
  "2050": { wins: 2, losses: 2, status: "alive" }, // Ball State
  "2117": { wins: 1, losses: 3, status: "alive" }, // Central Michigan
  "113": { wins: 1, losses: 3, status: "alive" }, // UMass
  "2006": { wins: 0, losses: 4, status: "out-loss" }, // Akron

  // CUSA
  "55": { wins: 4, losses: 0, status: "destiny" }, // Jacksonville State
  "2335": { wins: 3, losses: 0, status: "destiny" }, // Liberty
  "2393": { wins: 2, losses: 2, status: "alive" }, // Middle Tennessee
  "166": { wins: 2, losses: 2, status: "alive" }, // New Mexico State
  "98": { wins: 2, losses: 2, status: "alive" }, // Western Kentucky
  "2623": { wins: 2, losses: 2, status: "alive" }, // Missouri State
  "48": { wins: 2, losses: 2, status: "alive" }, // Delaware
  "2229": { wins: 1, losses: 2, status: "alive" }, // FIU
  "338": { wins: 1, losses: 3, status: "alive" }, // Kennesaw State
  "2534": { wins: 0, losses: 4, status: "alive" }, // Sam Houston

  // AAC
  "2636": { wins: 4, losses: 0, status: "destiny" }, // UTSA
  "249": { wins: 3, losses: 0, status: "destiny" }, // North Texas
  "349": { wins: 4, losses: 1, status: "alive" }, // Army
  "235": { wins: 3, losses: 1, status: "alive" }, // Memphis
  "5": { wins: 2, losses: 1, status: "alive" }, // UAB
  "2226": { wins: 2, losses: 1, status: "alive" }, // FAU
  "2655": { wins: 1, losses: 2, status: "alive" }, // Tulane
  "151": { wins: 1, losses: 2, status: "alive" }, // East Carolina
  "218": { wins: 1, losses: 2, status: "alive" }, // Temple
  "58": { wins: 1, losses: 2, status: "alive" }, // South Florida
  "2429": { wins: 1, losses: 2, status: "alive" }, // Charlotte
  "202": { wins: 1, losses: 3, status: "alive" }, // Tulsa
  "2426": { wins: 1, losses: 4, status: "out-loss" }, // Navy
  "242": { wins: 0, losses: 4, status: "out-loss" }, // Rice

  // SEC
  "96": { wins: 5, losses: 1, status: "destiny" }, // Kentucky
  "61": { wins: 4, losses: 1, status: "destiny" }, // Georgia
  "333": { wins: 4, losses: 2, status: "alive" }, // Alabama
  "145": { wins: 3, losses: 2, status: "alive" }, // Ole Miss
  "2633": { wins: 3, losses: 2, status: "alive" }, // Tennessee
  "57": { wins: 3, losses: 2, status: "alive" }, // Florida
  "99": { wins: 3, losses: 2, status: "alive" }, // LSU
  "142": { wins: 2, losses: 2, status: "alive" }, // Missouri
  "201": { wins: 2, losses: 2, status: "alive" }, // Oklahoma
  "251": { wins: 2, losses: 2, status: "alive" }, // Texas
  "344": { wins: 2, losses: 3, status: "alive" }, // Mississippi State
  "2": { wins: 2, losses: 3, status: "alive" }, // Auburn
  "2579": { wins: 2, losses: 3, status: "alive" }, // South Carolina
  "8": { wins: 1, losses: 3, status: "alive" }, // Arkansas
  "245": { wins: 1, losses: 4, status: "alive" }, // Texas A&M
  "238": { wins: 0, losses: 0, status: "eliminated" }, // Vanderbilt

  // Big 12
  "254": { wins: 4, losses: 0, status: "destiny" }, // Utah
  "252": { wins: 3, losses: 1, status: "alive" }, // BYU
  "2641": { wins: 3, losses: 1, status: "alive" }, // Texas Tech
  "197": { wins: 3, losses: 1, status: "alive" }, // Oklahoma State
  "12": { wins: 3, losses: 1, status: "alive" }, // Arizona
  "248": { wins: 3, losses: 2, status: "alive" }, // Houston
  "239": { wins: 2, losses: 2, status: "alive" }, // Baylor
  "9": { wins: 2, losses: 2, status: "alive" }, // Arizona State
  "2132": { wins: 2, losses: 2, status: "alive" }, // Cincinnati
  "2116": { wins: 2, losses: 2, status: "alive" }, // UCF
  "277": { wins: 2, losses: 3, status: "alive" }, // West Virginia
  "66": { wins: 1, losses: 3, status: "alive" }, // Iowa State
  "2306": { wins: 1, losses: 3, status: "alive" }, // Kansas State
  "2628": { wins: 1, losses: 3, status: "alive" }, // TCU
  "2305": { wins: 1, losses: 3, status: "alive" }, // Kansas
  "38": { wins: 0, losses: 4, status: "out-loss" }, // Colorado

  // Sun Belt West
  "2348": { wins: 3, losses: 0, status: "destiny" }, // Louisiana Tech
  "6": { wins: 2, losses: 1, status: "alive" }, // South Alabama
  "309": { wins: 2, losses: 2, status: "alive" }, // Louisiana
  "2032": { wins: 2, losses: 2, status: "alive" }, // Arkansas State
  "2653": { wins: 1, losses: 2, status: "alive" }, // Troy
  "2572": { wins: 1, losses: 2, status: "alive" }, // Southern Miss
  "2433": { wins: 1, losses: 2, status: "alive" }, // UL Monroe

  // Big Ten
  "26": { wins: 5, losses: 0, status: "destiny" }, // UCLA
  "194": { wins: 4, losses: 0, status: "destiny" }, // Ohio State
  "84": { wins: 4, losses: 1, status: "alive" }, // Indiana
  "275": { wins: 3, losses: 1, status: "alive" }, // Wisconsin
  "135": { wins: 3, losses: 1, status: "alive" }, // Minnesota
  "77": { wins: 3, losses: 1, status: "alive" }, // Northwestern
  "30": { wins: 3, losses: 2, status: "alive" }, // USC
  "2294": { wins: 2, losses: 2, status: "alive" }, // Iowa
  "2483": { wins: 2, losses: 2, status: "alive" }, // Oregon
  "2509": { wins: 2, losses: 2, status: "alive" }, // Purdue
  "158": { wins: 2, losses: 2, status: "alive" }, // Nebraska
  "356": { wins: 2, losses: 2, status: "alive" }, // Illinois
  "130": { wins: 1, losses: 3, status: "out-loss" }, // Michigan
  "164": { wins: 1, losses: 3, status: "out-loss" }, // Rutgers
  "264": { wins: 1, losses: 3, status: "out-loss" }, // Washington
  "120": { wins: 0, losses: 4, status: "out-loss" }, // Maryland
  "127": { wins: 0, losses: 0, status: "eliminated" }, // Michigan State
  "213": { wins: 0, losses: 0, status: "eliminated" }, // Penn State

  // ACC
  "2390": { wins: 5, losses: 0, status: "destiny" }, // Miami
  "154": { wins: 4, losses: 1, status: "alive" }, // Wake Forest
  "2567": { wins: 4, losses: 1, status: "alive" }, // SMU
  "97": { wins: 3, losses: 2, status: "alive" }, // Louisville
  "259": { wins: 3, losses: 2, status: "alive" }, // Virginia Tech
  "228": { wins: 2, losses: 2, status: "alive" }, // Clemson
  "153": { wins: 2, losses: 2, status: "alive" }, // North Carolina
  "150": { wins: 2, losses: 2, status: "alive" }, // Duke
  "103": { wins: 2, losses: 2, status: "alive" }, // Boston College
  "258": { wins: 2, losses: 3, status: "alive" }, // Virginia
  "221": { wins: 2, losses: 3, status: "alive" }, // Pittsburgh
  "25": { wins: 2, losses: 3, status: "alive" }, // California
  "24": { wins: 2, losses: 3, status: "alive" }, // Stanford
  "59": { wins: 1, losses: 3, status: "alive" }, // Georgia Tech
  "152": { wins: 1, losses: 3, status: "alive" }, // NC State
  "52": { wins: 1, losses: 3, status: "alive" }, // Florida State
  "183": { wins: 1, losses: 4, status: "out-loss" }, // Syracuse
};
