const ALIASES: Record<string, string> = {
  uconn: "connecticut",
  connecticut: "connecticut",
  unc: "north carolina",
  "nc state": "north carolina state",
  "n.c. state": "north carolina state",
  "north carolina st.": "north carolina state",
  "north carolina st": "north carolina state",
  "miami fl": "miami",
  "miami (fl)": "miami",
  "miami florida": "miami",
  "miami oh": "miami ohio",
  "miami (oh)": "miami ohio",
  "miami ohio": "miami ohio",
  "st. john's": "st johns",
  "st john's": "st johns",
  "saint john's": "st johns",
  "saint johns": "st johns",
  "st johns": "st johns",
  "st. mary's": "saint marys",
  "saint mary's": "saint marys",
  "st mary's": "saint marys",
  "st. marys": "saint marys",
  "st marys": "saint marys",
  "saint marys": "saint marys",
  "st marys college": "saint marys",
  "saint marys college": "saint marys",
  "mary's": "saint marys",
  pitt: "pittsburgh",
  "penn st.": "penn state",
  "penn st": "penn state",
  "ohio st.": "ohio state",
  "ohio st": "ohio state",
  "michigan st.": "michigan state",
  "iowa st.": "iowa state",
  "iowa st": "iowa state",
  "kansas st.": "kansas state",
  "florida st.": "florida state",
  "arizona st.": "arizona state",
  "oklahoma st.": "oklahoma state",
  "oregon st.": "oregon state",
  "washington st.": "washington state",
  "colorado st.": "colorado state",
  "mississippi st.": "mississippi state",
  "san diego st.": "san diego state",
  "san diego st": "san diego state",
  "boise st.": "boise state",
  "utah st.": "utah state",
  "fresno st.": "fresno state",
  "wichita st.": "wichita state",
  "murray st.": "murray state",
  "morehead st.": "morehead state",
  "norfolk st.": "norfolk state",
  "jackson st.": "jackson state",
  "grambling st.": "grambling",
  grambling: "grambling",
  "texas a&m": "texas am",
  "texas aandm": "texas am",
  "tamu": "texas am",
  "east texas am": "east texas am",
  "east texas a&m": "east texas am",
  "east texas aandm": "east texas am",
  "texas am commerce": "east texas am",
  "ole miss": "mississippi",
  "lsu": "louisiana state",
  "louisiana state": "louisiana state",
  "smu": "southern methodist",
  "unlv": "nevada las vegas",
  "vcu": "virginia commonwealth",
  "ucf": "central florida",
  "usc": "southern california",
  "ucla": "ucla",
  "byu": "byu",
  "tcu": "tcu",
  "utep": "texas el paso",
  "utsa": "texas san antonio",
  "ut arlington": "texas arlington",
  "uta": "texas arlington",
  "app state": "appalachian state",
  "appalachian st.": "appalachian state",
  "georgia st.": "georgia state",
  "georgia st": "georgia state",
  "kennesaw st.": "kennesaw state",
  "jacksonville st.": "jacksonville state",
  "mcneese st.": "mcneese",
  mcneese: "mcneese",
  "g washington": "george washington",
  "george washington": "george washington",
  "gw": "george washington",
  "western ky": "western kentucky",
  "wku": "western kentucky",
  "c arkansas": "central arkansas",
  "central ark": "central arkansas",
  "n kentucky": "northern kentucky",
  "nku": "northern kentucky",
  "e washington": "eastern washington",
  "ewu": "eastern washington",
  "md eastern": "maryland eastern shore",
  "maryland eastern": "maryland eastern shore",
  umes: "maryland eastern shore",
  fdu: "fairleigh dickinson",
  "fairleigh dickinson": "fairleigh dickinson",
  "st thomas": "st thomas",
  "saint thomas": "st thomas",
  "boston u": "boston university",
  "boston univ": "boston university",
  "boston university": "boston university",
  "grambling state": "grambling",
  "grambling st": "grambling",
  "se louisiana": "southeastern louisiana",
  "southeastern la": "southeastern louisiana",
  "cal baptist": "california baptist",
  "ca baptist": "california baptist",
  "california baptist": "california baptist",
  "csu northridge": "cal state northridge",
  "csun": "cal state northridge",
  "cal st. northridge": "cal state northridge",
  "cal state fullerton": "cal state fullerton",
  "csu fullerton": "cal state fullerton",
  "long beach st.": "long beach state",
  "uc santa barbara": "uc santa barbara",
  ucsb: "uc santa barbara",
  "uc irvine": "uc irvine",
  uci: "uc irvine",
  "uc san diego": "uc san diego",
  ucsd: "uc san diego",
  "uc davis": "uc davis",
  "uc riverside": "uc riverside",
  "st. bonaventure": "saint bonaventure",
  "saint bonaventure": "saint bonaventure",
  "st. joseph's": "saint josephs",
  "saint joseph's": "saint josephs",
  "st. louis": "saint louis",
  "saint louis": "saint louis",
  "st. peter's": "saint peters",
  "saint peter's": "saint peters",
  "mt. st. mary's": "mount st marys",
  "mount st. mary's": "mount st marys",
  "mount saint mary's": "mount st marys",
  "liu": "long island",
  "liu brooklyn": "long island",
  "fiu": "florida international",
  "fau": "florida atlantic",
  "fgcu": "florida gulf coast",
  "umbc": "maryland baltimore county",
  "uab": "alabama birmingham",
  "utrgv": "texas rio grande valley",
  "ut rio grande valley": "texas rio grande valley",
  "texas a&m corpus christi": "texas am corpus christi",
  "a&m-corpus christi": "texas am corpus christi",
  "sam houston": "sam houston",
  "sam houston st.": "sam houston",
  "stephen f. austin": "stephen f austin",
  sfa: "stephen f austin",
  "nicholls st.": "nicholls",
  nicholls: "nicholls",
  "se missouri st.": "southeast missouri state",
  "se missouri": "southeast missouri state",
  "se missouri st": "southeast missouri state",
  "southeast missouri": "southeast missouri state",
  "siu edwardsville": "siu edwardsville",
  siue: "siu edwardsville",
  "little rock": "arkansas little rock",
  "ark. little rock": "arkansas little rock",
  "ualr": "arkansas little rock",
  "lmu": "loyola marymount",
  "loyola chicago": "loyola chicago",
  "loyola-chicago": "loyola chicago",
  "indiana st.": "indiana state",
  "illinois st.": "illinois state",
  "missouri st.": "missouri state",
  "murray st": "murray state",
  "north dakota st.": "north dakota state",
  "south dakota st.": "south dakota state",
  "ndsu": "north dakota state",
  "sdsu": "san diego state",
  "south dakota st": "south dakota state",
  "omaha": "nebraska omaha",
  "neb. omaha": "nebraska omaha",
  "tennessee st.": "tennessee state",
  "tennessee tech": "tennessee tech",
  "east tennessee st.": "east tennessee state",
  etsu: "east tennessee state",
  "unc greensboro": "unc greensboro",
  uncg: "unc greensboro",
  "unc asheville": "unc asheville",
  "unc wilmington": "unc wilmington",
  uncw: "unc wilmington",
  "nc central": "north carolina central",
  "n.c. central": "north carolina central",
  "charleston": "college of charleston",
  "col. of charleston": "college of charleston",
  "college of charleston": "college of charleston",
  "stony brook": "stony brook",
  "umass": "massachusetts",
  "massachusetts": "massachusetts",
  "umass lowell": "massachusetts lowell",
  "boston u.": "boston university",
  "boston univ.": "boston university",
  "american": "american",
  "american univ.": "american",
  "loyola md": "loyola maryland",
  "loyola (md)": "loyola maryland",
  "saint francis": "saint francis",
  "st. francis pa": "saint francis",
  "st. francis (pa)": "saint francis",
  "liu sharks": "long island",
};

export function normalizeTeamName(name: string): string {
  let value = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/university of /g, "")
    .replace(/^the /g, "")
    .replace(/a\s*&\s*m/g, "am")
    .replace(/&/g, "and")
    .replace(/['’.]/g, "")
    .replace(/[()]/g, " ")
    .replace(/-/g, " ")
    .replace(/\bsaint\b/g, "st")
    .replace(/\s+college$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  value = value.replace(/\s+and\s+/g, " ");
  return ALIASES[value] ?? value;
}

export function teamMatchKeys(team: {
  name: string;
  shortName: string;
  abbreviation: string;
}): string[] {
  const keys = new Set<string>();
  for (const raw of [team.name, team.shortName, team.abbreviation]) {
    const normalized = normalizeTeamName(raw);
    keys.add(normalized);
    keys.add(normalized.replace(/ state$/g, " st"));
    keys.add(normalized.replace(/ st$/g, " state"));
  }
  return [...keys];
}

export function buildTeamNameIndex<T extends { name: string; shortName: string; abbreviation: string; id: string }>(
  teams: T[],
): Map<string, T> {
  const index = new Map<string, T>();
  for (const team of teams) {
    for (const key of teamMatchKeys(team)) {
      if (!index.has(key)) index.set(key, team);
    }
  }
  return index;
}

export function lookupTeamByName<T>(name: string, index: Map<string, T>): T | undefined {
  const normalized = normalizeTeamName(name);
  return (
    index.get(normalized) ??
    index.get(normalized.replace(/ state$/g, " st")) ??
    index.get(normalized.replace(/ st$/g, " state"))
  );
}
