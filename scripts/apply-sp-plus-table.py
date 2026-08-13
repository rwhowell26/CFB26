#!/usr/bin/env python3
"""Apply the 2025 SP+ table, add a few high FCS clubs, and reseed tiers."""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

ROOT = Path("/workspace")
TEAMS_PATH = ROOT / "src/data/teams.json"
SP_PATH = ROOT / "src/data/sp-plus-2025.json"
TIER_SIZE = 8

# User-provided 2025 SP+ (name as in the table).
TABLE: list[tuple[int, str, float, str]] = [
    (1, "Indiana", 85.0, "16-0"),
    (2, "Ohio State", 82.7, "12-2"),
    (3, "Texas Tech", 80.2, "12-2"),
    (4, "Oregon", 78.5, "13-2"),
    (5, "Notre Dame", 77.0, "10-2"),
    (6, "Georgia", 76.7, "12-2"),
    (7, "Ole Miss", 76.6, "13-2"),
    (8, "Utah", 74.8, "11-2"),
    (9, "Miami-FL", 73.3, "13-3"),
    (10, "Texas A&M", 73.3, "11-2"),
    (11, "Vanderbilt", 72.9, "10-3"),
    (12, "Iowa", 72.3, "9-4"),
    (13, "Washington", 71.0, "9-4"),
    (14, "Oklahoma", 70.9, "10-3"),
    (15, "Penn State", 70.7, "7-6"),
    (16, "USC", 69.5, "9-4"),
    (17, "Texas", 68.8, "10-3"),
    (18, "BYU", 68.5, "12-2"),
    (19, "Tennessee", 67.6, "8-5"),
    (20, "Alabama", 67.4, "11-4"),
    (21, "Missouri", 67.0, "8-5"),
    (22, "North Texas", 66.4, "12-2"),
    (23, "SMU", 66.0, "9-4"),
    (24, "Illinois", 65.5, "9-4"),
    (25, "Michigan", 65.0, "9-4"),
    (26, "Louisville", 65.0, "9-4"),
    (27, "James Madison", 64.9, "12-2"),
    (28, "Arizona", 64.6, "9-4"),
    (29, "Auburn", 64.2, "5-7"),
    (30, "USF", 64.2, "9-4"),
    (31, "Virginia", 63.7, "11-3"),
    (32, "LSU", 62.9, "7-6"),
    (33, "Iowa State", 62.5, "8-4"),
    (34, "Clemson", 62.1, "7-6"),
    (35, "Georgia Tech", 61.9, "9-4"),
    (36, "Pittsburgh", 61.0, "8-5"),
    (37, "TCU", 60.9, "9-4"),
    (38, "East Carolina", 60.6, "9-4"),
    (39, "Memphis", 60.2, "8-5"),
    (40, "Houston", 60.0, "10-3"),
    (41, "Florida State", 59.8, "5-7"),
    (42, "Kansas State", 59.6, "6-6"),
    (43, "San Diego State", 59.3, "9-4"),
    (44, "Duke", 59.2, "9-5"),
    (45, "Tulane", 58.9, "11-3"),
    (46, "Nebraska", 58.8, "7-6"),
    (47, "Navy", 58.8, "11-2"),
    (48, "Toledo", 58.6, "8-5"),
    (49, "South Carolina", 58.5, "4-8"),
    (50, "Old Dominion", 58.5, "10-3"),
    (51, "Northwestern", 58.4, "7-6"),
    (52, "Wake Forest", 58.3, "9-4"),
    (53, "Connecticut", 57.7, "9-4"),
    (54, "Arkansas", 57.7, "2-10"),
    (55, "NC State", 57.4, "8-5"),
    (56, "Cincinnati", 57.1, "7-6"),
    (57, "UNLV", 56.9, "10-4"),
    (58, "Mississippi State", 56.7, "5-8"),
    (59, "Kansas", 56.7, "5-7"),
    (60, "Arizona State", 56.5, "8-5"),
    (61, "Washington State", 56.4, "7-6"),
    (62, "UTSA", 56.3, "7-6"),
    (63, "Florida", 56.1, "4-8"),
    (64, "Boise State", 55.7, "9-5"),
    (65, "North Dakota State", 55.4, "12-1"),
    (66, "Texas State", 54.9, "7-6"),
    (67, "Fresno State", 54.4, "9-4"),
    (68, "Kentucky", 54.4, "5-7"),
    (69, "Hawaii", 54.3, "9-4"),
    (70, "Western Kentucky", 54.2, "9-4"),
    (71, "Minnesota", 54.1, "8-5"),
    (72, "Baylor", 54.0, "5-7"),
    (73, "Rutgers", 53.6, "5-7"),
    (74, "New Mexico", 53.5, "9-4"),
    (75, "Army", 53.4, "7-6"),
    (76, "Maryland", 53.2, "4-8"),
    (77, "UCF", 51.4, "5-7"),
    (78, "Louisiana Tech", 51.3, "8-5"),
    (79, "Western Michigan", 51.2, "10-4"),
    (80, "Utah State", 49.5, "6-7"),
    (81, "California", 49.4, "7-6"),
    (82, "Air Force", 49.4, "4-8"),
    (83, "Miami-OH", 49.2, "7-7"),
    (84, "Michigan State", 49.2, "4-8"),
    (85, "Ohio", 48.6, "9-4"),
    (86, "Wisconsin", 48.2, "4-8"),
    (87, "Marshall", 48.1, "5-7"),
    (88, "Troy", 47.8, "8-6"),
    (89, "Temple", 47.5, "5-7"),
    (90, "Kennesaw State", 47.2, "10-4"),
    (91, "Purdue", 46.5, "2-10"),
    (92, "North Carolina", 46.0, "4-8"),
    (93, "Jacksonville State", 45.9, "9-5"),
    (94, "West Virginia", 45.8, "4-8"),
    (95, "Southern Miss", 45.5, "7-6"),
    (96, "Buffalo", 45.1, "5-7"),
    (97, "Colorado", 44.3, "3-9"),
    (98, "Boston College", 44.1, "2-10"),
    (99, "UCLA", 43.9, "3-9"),
    (100, "Tarleton State", 43.9, "12-2"),
    (101, "Florida Atlantic", 43.9, "4-8"),
    (102, "Arkansas State", 43.8, "7-6"),
    (103, "Central Michigan", 43.8, "7-6"),
    (104, "Liberty", 43.6, "4-8"),
    (105, "Georgia Southern", 43.2, "7-6"),
    (106, "Montana State", 42.7, "14-2"),
    (107, "Tulsa", 42.6, "4-8"),
    (108, "UL-Lafayette", 42.5, "6-7"),
    (109, "Virginia Tech", 42.5, "3-9"),
    (110, "Florida International", 42.1, "7-6"),
    (111, "Missouri State", 41.9, "7-6"),
    (112, "Delaware", 41.7, "7-6"),
    (113, "Wyoming", 41.3, "4-8"),
    (114, "Lehigh", 41.3, "12-1"),
    (115, "Appalachian State", 41.2, "5-8"),
    (116, "Stanford", 40.8, "4-8"),
    (117, "North Dakota", 40.1, "8-6"),
    (118, "Bowling Green", 40.0, "4-8"),
    (119, "South Alabama", 39.9, "4-8"),
    (120, "Syracuse", 39.5, "3-9"),
    (121, "Montana", 39.4, "13-2"),
    (122, "Nevada", 39.2, "3-9"),
    (123, "Akron", 38.7, "5-7"),
    (124, "Harvard", 38.3, "9-2"),
    (125, "San Jose State", 38.3, "3-9"),
    (126, "Eastern Michigan", 37.9, "4-8"),
    (127, "Rice", 37.8, "5-8"),
    (128, "Oklahoma State", 37.5, "1-11"),
    (129, "Coastal Carolina", 37.5, "6-7"),
    (130, "Stephen F. Austin", 37.3, "11-3"),
    (131, "New Mexico State", 37.1, "4-8"),
    (132, "Colorado State", 37.0, "2-10"),
    (133, "UAB", 36.8, "4-8"),
    (134, "Oregon State", 36.7, "2-10"),
    (135, "Middle Tennessee", 36.6, "3-9"),
    (136, "Northern Illinois", 35.9, "3-9"),
    (137, "South Dakota State", 35.7, "9-5"),
    (138, "UTEP", 35.1, "2-10"),
    (139, "Illinois State", 35.1, "12-5"),
    (140, "Rhode Island", 34.9, "11-3"),
    (142, "Tennessee Tech", 34.2, "11-2"),
    (143, "Southern Illinois", 33.9, "7-5"),
    (144, "Villanova", 33.7, "12-3"),
    (145, "Southeastern Louisiana", 33.5, "9-4"),
    (146, "Kent State", 33.3, "5-7"),
    (147, "Jackson State", 33.2, "10-2"),
    (149, "Youngstown State", 32.0, "8-5"),
    (150, "Alabama State", 32.0, "9-3"),
    (152, "South Dakota", 31.7, "10-5"),
    (153, "Mercer", 31.2, "9-3"),
    (154, "UL-Monroe", 31.0, "3-9"),
    (155, "UC Davis", 30.3, "9-4"),
    (157, "Sacramento State", 30.0, "7-5"),
    (158, "Ball State", 29.6, "4-8"),
    (163, "St. Thomas", 28.4, "7-5"),
    (165, "Georgia State", 28.1, "1-11"),
    (173, "Charlotte", 25.9, "1-11"),
    (180, "Sam Houston", 24.8, "2-10"),
    (181, "William & Mary", 24.8, "7-5"),
    (182, "New Hampshire", 24.4, "8-5"),
    (196, "Richmond", 21.1, "7-5"),
    (198, "Idaho", 20.6, "4-8"),
    (206, "Holy Cross", 18.0, "3-9"),
    (216, "Massachusetts", 16.0, "0-12"),
    (221, "Eastern Washington", 15.6, "5-7"),
    (228, "Furman", 14.5, "6-6"),
    (241, "Chattanooga", 12.8, "4-8"),
    (273, "Florida A&M", 9.2, "6-6"),
]

NAME_TO_ABBR = {
    "Indiana": "IU", "Ohio State": "OSU", "Texas Tech": "TTU", "Oregon": "ORE",
    "Notre Dame": "ND", "Georgia": "UGA", "Ole Miss": "MISS", "Utah": "UTAH",
    "Miami-FL": "MIA", "Texas A&M": "TA&M", "Vanderbilt": "VAN", "Iowa": "IOWA",
    "Washington": "WASH", "Oklahoma": "OU", "Penn State": "PSU", "USC": "USC",
    "Texas": "TEX", "BYU": "BYU", "Tennessee": "TENN", "Alabama": "ALA",
    "Missouri": "MIZ", "North Texas": "UNT", "SMU": "SMU", "Illinois": "ILL",
    "Michigan": "MICH", "Louisville": "LOU", "James Madison": "JMU", "Arizona": "ARIZ",
    "Auburn": "AUB", "USF": "USF", "Virginia": "UVA", "LSU": "LSU",
    "Iowa State": "ISU", "Clemson": "CLEM", "Georgia Tech": "GT", "Pittsburgh": "PITT",
    "TCU": "TCU", "East Carolina": "ECU", "Memphis": "MEM", "Houston": "HOU",
    "Florida State": "FSU", "Kansas State": "KSU", "San Diego State": "SDSU", "Duke": "DUKE",
    "Tulane": "TULN", "Nebraska": "NEB", "Navy": "NAVY", "Toledo": "TOL",
    "South Carolina": "SC", "Old Dominion": "ODU", "Northwestern": "NU", "Wake Forest": "WAKE",
    "Connecticut": "CONN", "Arkansas": "ARK", "NC State": "NCSU", "Cincinnati": "CIN",
    "UNLV": "UNLV", "Mississippi State": "MSST", "Kansas": "KU", "Arizona State": "ASU",
    "Washington State": "WSU", "UTSA": "UTSA", "Florida": "FLA", "Boise State": "BOIS",
    "North Dakota State": "NDSU", "Texas State": "TXST", "Fresno State": "FRES", "Kentucky": "UK",
    "Hawaii": "HAW", "Western Kentucky": "WKU", "Minnesota": "MINN", "Baylor": "BAY",
    "Rutgers": "RUTG", "New Mexico": "UNM", "Army": "ARMY", "Maryland": "MD",
    "UCF": "UCF", "Louisiana Tech": "LT", "Western Michigan": "WMU", "Utah State": "USU",
    "California": "CAL", "Air Force": "AFA", "Miami-OH": "M-OH", "Michigan State": "MSU",
    "Ohio": "OHIO", "Wisconsin": "WIS", "Marshall": "MRSH", "Troy": "TROY",
    "Temple": "TEM", "Kennesaw State": "KENN", "Purdue": "PUR", "North Carolina": "UNC",
    "Jacksonville State": "JVST", "West Virginia": "WVU", "Southern Miss": "USM", "Buffalo": "BUFF",
    "Colorado": "COLO", "Boston College": "BC", "UCLA": "UCLA", "Tarleton State": "TAR",
    "Florida Atlantic": "FAU", "Arkansas State": "ARST", "Central Michigan": "CMU", "Liberty": "LIB",
    "Georgia Southern": "GASO", "Montana State": "MTST", "Tulsa": "TLSA", "UL-Lafayette": "UL",
    "Virginia Tech": "VT", "Florida International": "FIU", "Missouri State": "MOST", "Delaware": "DEL",
    "Wyoming": "WYO", "Lehigh": "LEH", "Appalachian State": "APP", "Stanford": "STAN",
    "North Dakota": "UND", "Bowling Green": "BGSU", "South Alabama": "USA", "Syracuse": "SYR",
    "Montana": "MONT", "Nevada": "NEV", "Akron": "AKR", "Harvard": "HARV",
    "San Jose State": "SJSU", "Eastern Michigan": "EMU", "Rice": "RICE", "Oklahoma State": "OKST",
    "Coastal Carolina": "CCU", "Stephen F. Austin": "SFA", "New Mexico State": "NMSU",
    "Colorado State": "CSU", "UAB": "UAB", "Oregon State": "ORST", "Middle Tennessee": "MTSU",
    "Northern Illinois": "NIU", "South Dakota State": "SDST", "UTEP": "UTEP", "Illinois State": "ILST",
    "Rhode Island": "URI", "Tennessee Tech": "TNTC", "Southern Illinois": "SIU", "Villanova": "VILL",
    "Southeastern Louisiana": "SELA", "Kent State": "KENT", "Jackson State": "JKST",
    "Youngstown State": "YSU", "Alabama State": "ALST", "South Dakota": "SDAK", "Mercer": "MER",
    "UL-Monroe": "ULM", "UC Davis": "UCD", "Sacramento State": "SAC", "Ball State": "BALL",
    "St. Thomas": "STMN", "Georgia State": "GAST", "Charlotte": "CLT", "Sam Houston": "SHSU",
    "William & Mary": "W&M", "New Hampshire": "UNH", "Richmond": "RICH", "Idaho": "IDHO",
    "Holy Cross": "HC", "Massachusetts": "MASS", "Eastern Washington": "EWU", "Furman": "FUR",
    "Chattanooga": "UTC", "Florida A&M": "FAMU",
}

NEW_FCS = [
    {
        "id": "2627", "name": "Tarleton State Texans", "shortName": "Tarleton St",
        "abbreviation": "TAR", "state": "TX", "region": "west", "wins": 12, "losses": 2,
    },
    {
        "id": "2329", "name": "Lehigh Mountain Hawks", "shortName": "Lehigh",
        "abbreviation": "LEH", "state": "PA", "region": "east", "wins": 12, "losses": 1,
    },
    {
        "id": "108", "name": "Harvard Crimson", "shortName": "Harvard",
        "abbreviation": "HARV", "state": "MA", "region": "east", "wins": 9, "losses": 2,
    },
    {
        "id": "2617", "name": "Stephen F. Austin Lumberjacks", "shortName": "SFA",
        "abbreviation": "SFA", "state": "TX", "region": "west", "wins": 11, "losses": 3,
    },
    {
        "id": "2635", "name": "Tennessee Tech Golden Eagles", "shortName": "Tennessee Tech",
        "abbreviation": "TNTC", "state": "TN", "region": "south", "wins": 11, "losses": 2,
    },
    {
        "id": "2545", "name": "SE Louisiana Lions", "shortName": "SE Louisiana",
        "abbreviation": "SELA", "state": "LA", "region": "south", "wins": 9, "losses": 4,
    },
    {
        "id": "79", "name": "Southern Illinois Salukis", "shortName": "S Illinois",
        "abbreviation": "SIU", "state": "IL", "region": "midwest", "wins": 7, "losses": 5,
    },
    {
        "id": "2900", "name": "St. Thomas Tommies", "shortName": "St. Thomas",
        "abbreviation": "STMN", "state": "MN", "region": "midwest", "wins": 7, "losses": 5,
    },
]


def assign_tiers(group: list[dict]) -> None:
    fbs = [t for t in group if t["subdivision"] == "fbs"]
    fcs = [t for t in group if t["subdivision"] == "fcs"]
    key = lambda t: (-(t["spPlus"] if t["spPlus"] is not None else -999), t["spPlusRank"] or 999, t["shortName"])
    fbs.sort(key=key)
    fcs.sort(key=key)
    ordered = fbs[: TIER_SIZE * 2] + sorted(fbs[TIER_SIZE * 2 :] + fcs, key=key)
    for i, team in enumerate(ordered):
        team["tier"] = i // TIER_SIZE + 1
        if team["subdivision"] == "fcs":
            team["tier"] = max(team["tier"], 3)


def main() -> None:
    teams: list[dict] = json.loads(TEAMS_PATH.read_text())
    by_abbr = {t["abbreviation"]: t for t in teams}
    existing_ids = {t["id"] for t in teams}

    for extra in NEW_FCS:
        if extra["abbreviation"] in by_abbr or extra["id"] in existing_ids:
            continue
        row = {
            **extra,
            "logo": f"https://a.espncdn.com/i/teamlogos/ncaa/500/{extra['id']}.png",
            "pf": 0,
            "pa": 0,
            "wins5": extra["wins"],
            "losses5": extra["losses"],
            "tier": 3,
            "subdivision": "fcs",
            "rivals": [],
            "spPlus": None,
            "spPlusRank": None,
        }
        teams.append(row)
        by_abbr[row["abbreviation"]] = row

    payload = []
    matched: set[str] = set()
    for rank, name, rating, record in TABLE:
        payload.append({"rank": rank, "name": name, "rating": rating, "record": record})
        abbr = NAME_TO_ABBR.get(name)
        if not abbr:
            continue
        team = by_abbr.get(abbr)
        if not team:
            raise SystemExit(f"mapped {name} -> {abbr} but team missing")
        team["spPlus"] = rating
        team["spPlusRank"] = rank
        matched.add(abbr)

    missing = [t["abbreviation"] for t in teams if t["abbreviation"] not in matched]
    if missing:
        raise SystemExit(f"teams missing SP+: {missing}")

    for region in ("east", "south", "midwest", "west"):
        assign_tiers([t for t in teams if t["region"] == region])

    teams.sort(key=lambda t: t["shortName"])
    TEAMS_PATH.write_text(json.dumps(teams, indent=2) + "\n")
    SP_PATH.write_text(json.dumps(payload, indent=2) + "\n")

    counts = defaultdict(int)
    for t in teams:
        counts[t["region"]] += 1
    print("wrote", len(teams), "teams", dict(counts))
    for abbr in ("IU", "OSU", "NDSU", "TAR", "HARV", "LEH", "SFA", "TNTC", "SELA", "SIU", "STMN", "FAMU"):
        t = by_abbr[abbr]
        print(abbr, "region", t["region"], "tier", t["tier"], "SP+", t["spPlusRank"], t["spPlus"])


if __name__ == "__main__":
    main()
