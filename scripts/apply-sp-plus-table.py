#!/usr/bin/env python3
"""Apply the 2025 SP+ table, add a few high FCS clubs, and reseed tiers."""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

ROOT = Path("/workspace")
TEAMS_PATH = ROOT / "src/data/teams.json"
SP_PATH = ROOT / "src/data/sp-plus-2025.json"
RIVALRIES = ROOT / "src/data/rivalries.json"
TIER_SIZE = 8
MAX_RIVALS = 3

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
    (141, "Yale", 36.8, "9-3"),
    (148, "Dartmouth", 35.0, "7-3"),
    (151, "Monmouth", 33.8, "9-3"),
    (156, "Lafayette", 32.8, "8-4"),
    (159, "South Carolina State", 32.3, "10-3"),
    (160, "UT Rio Grande Valley", 32.1, "9-3"),
    (161, "Abilene Christian", 31.3, "9-5"),
    (162, "West Georgia", 30.7, "8-3"),
    (164, "San Diego", 30.4, "8-4"),
    (166, "Drake", 29.9, "8-4"),
    (167, "Northern Arizona", 29.3, "7-5"),
    (168, "Grambling", 28.9, "7-5"),
    (169, "Austin Peay", 28.6, "7-5"),
    (170, "Dayton", 28.5, "7-4"),
    (171, "East Tennessee State", 27.9, "7-5"),
    (172, "Southern Utah", 27.5, "7-5"),
    (174, "Towson", 26.2, "6-6"),
    (179, "Weber State", 23.5, "4-8"),
    (184, "Northern Iowa", 22.8, "3-9"),
    (197, "Southeast Missouri", 19.4, "4-8"),
    (199, "Nicholls", 18.2, "4-8"),
    (207, "Western Illinois", 17.0, "4-8"),
    (215, "Indiana State", 16.2, "3-9"),
    (227, "Southern Jaguars", 14.8, "2-10"),
    (175, "Penn", 31.0, "6-4"),
    (176, "Incarnate Word", 28.0, "5-7"),
    (177, "UT Martin", 26.8, "6-6"),
    (178, "Idaho State", 25.5, "6-6"),
    (183, "Butler", 24.8, "6-6"),
    (185, "Lindenwood", 24.0, "6-6"),
    (186, "Bethune-Cookman", 23.2, "6-6"),
    (187, "Alcorn State", 21.5, "5-7"),
    (188, "McNeese", 20.8, "5-7"),
    (189, "Cal Poly", 19.0, "4-8"),
    (190, "Alabama A&M", 18.6, "4-8"),
    (191, "Northern Colorado", 17.8, "4-8"),
    (193, "Eastern Illinois", 15.5, "3-9"),
    (194, "Samford", 15.0, "1-11"),
    (200, "Murray State", 13.5, "1-11"),
    (205, "Portland State", 12.0, "1-11"),
    (192, "Lamar", 27.2, "8-5"),
    (208, "Maine", 22.0, "6-6"),
    (209, "Elon", 21.8, "6-6"),
    (210, "Stony Brook", 21.2, "6-6"),
    (211, "Morehead State", 20.5, "6-6"),
    (212, "Wofford", 20.0, "6-6"),
    (213, "Colgate", 19.5, "5-7"),
    (214, "Howard", 19.2, "5-7"),
    (217, "Eastern Kentucky", 18.8, "5-7"),
    (218, "Robert Morris", 16.0, "3-9"),
    (219, "Albany", 14.0, "2-10"),
    (220, "North Alabama", 13.8, "2-10"),
    (222, "Valparaiso", 13.2, "2-10"),
    (223, "Utah Tech", 12.5, "2-10"),
    (224, "Houston Christian", 11.8, "2-10"),
    (225, "Fordham", 11.5, "1-11"),
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
    "Yale": "YALE", "Dartmouth": "DART", "Monmouth": "MONM", "Lafayette": "LAF",
    "South Carolina State": "SCST", "UT Rio Grande Valley": "RGV", "Abilene Christian": "ACU",
    "West Georgia": "WES", "San Diego": "USD", "Drake": "DRKE", "Northern Arizona": "NAU",
    "Grambling": "GRAM", "Austin Peay": "APSU", "Dayton": "DAY",
    "East Tennessee State": "ETSU", "Southern Utah": "SUU", "Towson": "TOW",
    "Weber State": "WEB", "Northern Iowa": "UNI", "Southeast Missouri": "SEMO",
    "Nicholls": "NICH", "Western Illinois": "WIU", "Indiana State": "INST",
    "Southern Jaguars": "SOU",
    "Penn": "PENN", "Incarnate Word": "UIW", "UT Martin": "UTM", "Idaho State": "IDST",
    "Butler": "BUT", "Lindenwood": "LIN", "Bethune-Cookman": "BCU", "Alcorn State": "ALCN",
    "McNeese": "MCN", "Cal Poly": "CP", "Alabama A&M": "AAMU", "Northern Colorado": "UNCO",
    "Eastern Illinois": "EIU", "Samford": "SAM", "Murray State": "MUR", "Portland State": "PRST",
    "Lamar": "LAM", "Maine": "ME", "Elon": "ELON", "Stony Brook": "STBK",
    "Morehead State": "MORE", "Wofford": "WOF", "Colgate": "COLG", "Howard": "HOW",
    "Eastern Kentucky": "EKU", "Robert Morris": "RMU", "Albany": "ALB",
    "North Alabama": "UNA", "Valparaiso": "VAL", "Utah Tech": "UTU",
    "Houston Christian": "HCU", "Fordham": "FOR",
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
    {
        "id": "322", "name": "Lafayette Leopards", "shortName": "Lafayette",
        "abbreviation": "LAF", "state": "PA", "region": "east", "wins": 8, "losses": 4,
        "pf": 403, "pa": 345, "wins5": 30, "losses5": 28,
    },
    {
        "id": "43", "name": "Yale Bulldogs", "shortName": "Yale",
        "abbreviation": "YALE", "state": "CT", "region": "east", "wins": 9, "losses": 3,
        "pf": 352, "pa": 235, "wins5": 36, "losses5": 16,
    },
    {
        "id": "159", "name": "Dartmouth Big Green", "shortName": "Dartmouth",
        "abbreviation": "DART", "state": "NH", "region": "east", "wins": 7, "losses": 3,
        "pf": 264, "pa": 213, "wins5": 33, "losses5": 17,
    },
    {
        "id": "2405", "name": "Monmouth Hawks", "shortName": "Monmouth",
        "abbreviation": "MONM", "state": "NJ", "region": "east", "wins": 9, "losses": 3,
        "pf": 480, "pa": 333, "wins5": 31, "losses5": 26,
    },
    {
        "id": "119", "name": "Towson Tigers", "shortName": "Towson",
        "abbreviation": "TOW", "state": "MD", "region": "east", "wins": 6, "losses": 6,
        "pf": 321, "pa": 301, "wins5": 28, "losses5": 29,
    },
    {
        "id": "2569", "name": "South Carolina State Bulldogs", "shortName": "SC State",
        "abbreviation": "SCST", "state": "SC", "region": "east", "wins": 10, "losses": 3,
        "pf": 421, "pa": 354, "wins5": 33, "losses5": 25,
    },
    {
        "id": "2755", "name": "Grambling Tigers", "shortName": "Grambling",
        "abbreviation": "GRAM", "state": "LA", "region": "south", "wins": 7, "losses": 5,
        "pf": 289, "pa": 313, "wins5": 24, "losses5": 33,
    },
    {
        "id": "2582", "name": "Southern Jaguars", "shortName": "Southern",
        "abbreviation": "SOU", "state": "LA", "region": "south", "wins": 2, "losses": 10,
        "pf": 223, "pa": 433, "wins5": 27, "losses5": 32,
    },
    {
        "id": "2046", "name": "Austin Peay Governors", "shortName": "Austin Peay",
        "abbreviation": "APSU", "state": "TN", "region": "south", "wins": 7, "losses": 5,
        "pf": 421, "pa": 328, "wins5": 33, "losses5": 25,
    },
    {
        "id": "2193", "name": "East Tennessee State Buccaneers", "shortName": "ETSU",
        "abbreviation": "ETSU", "state": "TN", "region": "south", "wins": 7, "losses": 5,
        "pf": 390, "pa": 346, "wins5": 31, "losses5": 28,
    },
    {
        "id": "2698", "name": "West Georgia Wolves", "shortName": "West Georgia",
        "abbreviation": "WES", "state": "GA", "region": "south", "wins": 8, "losses": 3,
        "pf": 281, "pa": 233, "wins5": 12, "losses5": 10,
    },
    {
        "id": "2447", "name": "Nicholls Colonels", "shortName": "Nicholls",
        "abbreviation": "NICH", "state": "LA", "region": "south", "wins": 4, "losses": 8,
        "pf": 219, "pa": 299, "wins5": 23, "losses5": 34,
    },
    {
        "id": "2460", "name": "Northern Iowa Panthers", "shortName": "Northern Iowa",
        "abbreviation": "UNI", "state": "IA", "region": "midwest", "wins": 3, "losses": 9,
        "pf": 207, "pa": 321, "wins5": 24, "losses5": 34,
    },
    {
        "id": "282", "name": "Indiana State Sycamores", "shortName": "Indiana State",
        "abbreviation": "INST", "state": "IN", "region": "midwest", "wins": 3, "losses": 9,
        "pf": 254, "pa": 475, "wins5": 15, "losses5": 42,
    },
    {
        "id": "2181", "name": "Drake Bulldogs", "shortName": "Drake",
        "abbreviation": "DRKE", "state": "IA", "region": "midwest", "wins": 8, "losses": 4,
        "pf": 304, "pa": 212, "wins5": 29, "losses5": 27,
    },
    {
        "id": "2168", "name": "Dayton Flyers", "shortName": "Dayton",
        "abbreviation": "DAY", "state": "OH", "region": "midwest", "wins": 7, "losses": 4,
        "pf": 306, "pa": 191, "wins5": 31, "losses5": 23,
    },
    {
        "id": "2710", "name": "Western Illinois Leathernecks", "shortName": "Western Illinois",
        "abbreviation": "WIU", "state": "IL", "region": "midwest", "wins": 4, "losses": 8,
        "pf": 277, "pa": 417, "wins5": 10, "losses5": 47,
    },
    {
        "id": "2546", "name": "Southeast Missouri State Redhawks", "shortName": "SE Missouri",
        "abbreviation": "SEMO", "state": "MO", "region": "midwest", "wins": 4, "losses": 8,
        "pf": 278, "pa": 361, "wins5": 30, "losses5": 29,
    },
    {
        "id": "301", "name": "San Diego Toreros", "shortName": "San Diego",
        "abbreviation": "USD", "state": "CA", "region": "west", "wins": 8, "losses": 4,
        "pf": 341, "pa": 292, "wins5": 32, "losses5": 23,
    },
    {
        "id": "2000", "name": "Abilene Christian Wildcats", "shortName": "Abilene Christian",
        "abbreviation": "ACU", "state": "TX", "region": "west", "wins": 9, "losses": 5,
        "pf": 414, "pa": 370, "wins5": 35, "losses5": 26,
    },
    {
        "id": "292", "name": "UT Rio Grande Valley Vaqueros", "shortName": "UTRGV",
        "abbreviation": "RGV", "state": "TX", "region": "west", "wins": 9, "losses": 3,
        "pf": 475, "pa": 226, "wins5": 9, "losses5": 3,
    },
    {
        "id": "2464", "name": "Northern Arizona Lumberjacks", "shortName": "Northern Arizona",
        "abbreviation": "NAU", "state": "AZ", "region": "west", "wins": 7, "losses": 5,
        "pf": 380, "pa": 375, "wins5": 28, "losses5": 30,
    },
    {
        "id": "253", "name": "Southern Utah Thunderbirds", "shortName": "Southern Utah",
        "abbreviation": "SUU", "state": "UT", "region": "west", "wins": 7, "losses": 5,
        "pf": 405, "pa": 355, "wins5": 26, "losses5": 31,
    },
    {
        "id": "2692", "name": "Weber State Wildcats", "shortName": "Weber State",
        "abbreviation": "WEB", "state": "UT", "region": "west", "wins": 4, "losses": 8,
        "pf": 277, "pa": 460, "wins5": 30, "losses5": 29,
    },
    {
        "id": "219", "name": "Pennsylvania Quakers", "shortName": "Penn",
        "abbreviation": "PENN", "state": "PA", "region": "east", "wins": 6, "losses": 4,
        "pf": 271, "pa": 265, "wins5": 27, "losses5": 23,
    },
    {
        "id": "2535", "name": "Samford Bulldogs", "shortName": "Samford",
        "abbreviation": "SAM", "state": "AL", "region": "south", "wins": 1, "losses": 11,
        "pf": 175, "pa": 455, "wins5": 26, "losses5": 32,
    },
    {
        "id": "2016", "name": "Alcorn State Braves", "shortName": "Alcorn State",
        "abbreviation": "ALCN", "state": "MS", "region": "south", "wins": 5, "losses": 7,
        "pf": 291, "pa": 278, "wins5": 29, "losses5": 28,
    },
    {
        "id": "2010", "name": "Alabama A&M Bulldogs", "shortName": "Alabama A&M",
        "abbreviation": "AAMU", "state": "AL", "region": "south", "wins": 4, "losses": 8,
        "pf": 281, "pa": 401, "wins5": 26, "losses5": 30,
    },
    {
        "id": "2377", "name": "McNeese Cowboys", "shortName": "McNeese",
        "abbreviation": "MCN", "state": "LA", "region": "south", "wins": 5, "losses": 7,
        "pf": 282, "pa": 306, "wins5": 19, "losses5": 37,
    },
    {
        "id": "2630", "name": "UT Martin Skyhawks", "shortName": "UT Martin",
        "abbreviation": "UTM", "state": "TN", "region": "south", "wins": 6, "losses": 6,
        "pf": 248, "pa": 287, "wins5": 40, "losses5": 21,
    },
    {
        "id": "2065", "name": "Bethune-Cookman Wildcats", "shortName": "Bethune-Cookman",
        "abbreviation": "BCU", "state": "FL", "region": "south", "wins": 6, "losses": 6,
        "pf": 356, "pa": 392, "wins5": 15, "losses5": 42,
    },
    {
        "id": "93", "name": "Murray State Racers", "shortName": "Murray State",
        "abbreviation": "MUR", "state": "KY", "region": "midwest", "wins": 1, "losses": 11,
        "pf": 228, "pa": 463, "wins5": 12, "losses5": 45,
    },
    {
        "id": "2197", "name": "Eastern Illinois Panthers", "shortName": "Eastern Illinois",
        "abbreviation": "EIU", "state": "IL", "region": "midwest", "wins": 3, "losses": 9,
        "pf": 210, "pa": 350, "wins5": 17, "losses5": 40,
    },
    {
        "id": "2086", "name": "Butler Bulldogs", "shortName": "Butler",
        "abbreviation": "BUT", "state": "IN", "region": "midwest", "wins": 6, "losses": 6,
        "pf": 274, "pa": 304, "wins5": 32, "losses5": 25,
    },
    {
        "id": "2815", "name": "Lindenwood Lions", "shortName": "Lindenwood",
        "abbreviation": "LIN", "state": "MO", "region": "midwest", "wins": 6, "losses": 6,
        "pf": 297, "pa": 324, "wins5": 21, "losses5": 23,
    },
    {
        "id": "304", "name": "Idaho State Bengals", "shortName": "Idaho State",
        "abbreviation": "IDST", "state": "ID", "region": "west", "wins": 6, "losses": 6,
        "pf": 396, "pa": 327, "wins5": 16, "losses5": 41,
    },
    {
        "id": "13", "name": "Cal Poly Mustangs", "shortName": "Cal Poly",
        "abbreviation": "CP", "state": "CA", "region": "west", "wins": 4, "losses": 8,
        "pf": 330, "pa": 378, "wins5": 14, "losses5": 42,
    },
    {
        "id": "2502", "name": "Portland State Vikings", "shortName": "Portland State",
        "abbreviation": "PRST", "state": "OR", "region": "west", "wins": 1, "losses": 11,
        "pf": 194, "pa": 512, "wins5": 18, "losses5": 38,
    },
    {
        "id": "2458", "name": "Northern Colorado Bears", "shortName": "Northern Colorado",
        "abbreviation": "UNCO", "state": "CO", "region": "west", "wins": 4, "losses": 8,
        "pf": 243, "pa": 341, "wins5": 11, "losses5": 46,
    },
    {
        "id": "2916", "name": "Incarnate Word Cardinals", "shortName": "Incarnate Word",
        "abbreviation": "UIW", "state": "TX", "region": "west", "wins": 5, "losses": 7,
        "pf": 308, "pa": 306, "wins5": 46, "losses5": 16,
    },
    {
        "id": "311", "name": "Maine Black Bears", "shortName": "Maine",
        "abbreviation": "ME", "state": "ME", "region": "east", "wins": 6, "losses": 6,
        "pf": 290, "pa": 291, "wins5": 21, "losses5": 36,
    },
    {
        "id": "2210", "name": "Elon Phoenix", "shortName": "Elon",
        "abbreviation": "ELON", "state": "NC", "region": "east", "wins": 6, "losses": 6,
        "pf": 345, "pa": 297, "wins5": 32, "losses5": 26,
    },
    {
        "id": "2142", "name": "Colgate Raiders", "shortName": "Colgate",
        "abbreviation": "COLG", "state": "NY", "region": "east", "wins": 5, "losses": 7,
        "pf": 340, "pa": 372, "wins5": 21, "losses5": 36,
    },
    {
        "id": "47", "name": "Howard Bison", "shortName": "Howard",
        "abbreviation": "HOW", "state": "DC", "region": "east", "wins": 5, "losses": 7,
        "pf": 238, "pa": 295, "wins5": 23, "losses5": 34,
    },
    {
        "id": "399", "name": "UAlbany Great Danes", "shortName": "UAlbany",
        "abbreviation": "ALB", "state": "NY", "region": "east", "wins": 2, "losses": 10,
        "pf": 201, "pa": 387, "wins5": 22, "losses5": 38,
    },
    {
        "id": "2619", "name": "Stony Brook Seawolves", "shortName": "Stony Brook",
        "abbreviation": "STBK", "state": "NY", "region": "east", "wins": 6, "losses": 6,
        "pf": 336, "pa": 309, "wins5": 21, "losses5": 35,
    },
    {
        "id": "2230", "name": "Fordham Rams", "shortName": "Fordham",
        "abbreviation": "FOR", "state": "NY", "region": "east", "wins": 1, "losses": 11,
        "pf": 191, "pa": 397, "wins5": 24, "losses5": 34,
    },
    {
        "id": "2747", "name": "Wofford Terriers", "shortName": "Wofford",
        "abbreviation": "WOF", "state": "SC", "region": "south", "wins": 6, "losses": 6,
        "pf": 274, "pa": 207, "wins5": 17, "losses5": 40,
    },
    {
        "id": "2453", "name": "North Alabama Lions", "shortName": "North Alabama",
        "abbreviation": "UNA", "state": "AL", "region": "south", "wins": 2, "losses": 10,
        "pf": 303, "pa": 470, "wins5": 12, "losses5": 45,
    },
    {
        "id": "2674", "name": "Valparaiso Beacons", "shortName": "Valparaiso",
        "abbreviation": "VAL", "state": "IN", "region": "midwest", "wins": 2, "losses": 10,
        "pf": 244, "pa": 427, "wins5": 18, "losses5": 39,
    },
    {
        "id": "2413", "name": "Morehead State Eagles", "shortName": "Morehead State",
        "abbreviation": "MORE", "state": "KY", "region": "midwest", "wins": 6, "losses": 6,
        "pf": 254, "pa": 358, "wins5": 26, "losses5": 31,
    },
    {
        "id": "2198", "name": "Eastern Kentucky Colonels", "shortName": "Eastern Kentucky",
        "abbreviation": "EKU", "state": "KY", "region": "midwest", "wins": 5, "losses": 7,
        "pf": 232, "pa": 292, "wins5": 32, "losses5": 27,
    },
    {
        "id": "2523", "name": "Robert Morris Colonials", "shortName": "Robert Morris",
        "abbreviation": "RMU", "state": "PA", "region": "midwest", "wins": 3, "losses": 9,
        "pf": 182, "pa": 299, "wins5": 18, "losses5": 38,
    },
    {
        "id": "3101", "name": "Utah Tech Trailblazers", "shortName": "Utah Tech",
        "abbreviation": "UTU", "state": "UT", "region": "west", "wins": 2, "losses": 10,
        "pf": 192, "pa": 352, "wins5": 10, "losses5": 47,
    },
    {
        "id": "2320", "name": "Lamar Cardinals", "shortName": "Lamar",
        "abbreviation": "LAM", "state": "TX", "region": "west", "wins": 8, "losses": 5,
        "pf": 292, "pa": 299, "wins5": 23, "losses5": 34,
    },
    {
        "id": "2277", "name": "Houston Christian Huskies", "shortName": "Houston Christian",
        "abbreviation": "HCU", "state": "TX", "region": "west", "wins": 2, "losses": 10,
        "pf": 202, "pa": 363, "wins5": 14, "losses5": 42,
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


def apply_real_rivals(teams: list[dict]) -> None:
    pairs: list[list[str]] = json.loads(RIVALRIES.read_text())
    abbr_to_id = {t["abbreviation"]: t["id"] for t in teams}
    unknown = [
        pair for pair in pairs if pair[0] not in abbr_to_id or pair[1] not in abbr_to_id
    ]
    if unknown:
        raise SystemExit(f"Unknown rivalry abbreviations: {unknown[:8]}")
    adj: dict[str, list[str]] = {t["id"]: [] for t in teams}
    kept = skipped = 0
    seen: set[tuple[str, str]] = set()
    for a, b in pairs:
        key = (a, b) if a < b else (b, a)
        if key in seen:
            continue
        seen.add(key)
        u, v = abbr_to_id[a], abbr_to_id[b]
        if u == v or v in adj[u]:
            continue
        if len(adj[u]) >= MAX_RIVALS or len(adj[v]) >= MAX_RIVALS:
            skipped += 1
            continue
        adj[u].append(v)
        adj[v].append(u)
        kept += 1
    id_to_team = {t["id"]: t for t in teams}
    for t in teams:
        t["rivals"] = sorted(adj[t["id"]], key=lambda rid: id_to_team[rid]["shortName"])
    print(f"named rivalries kept={kept} capped={skipped}")


def main() -> None:
    teams: list[dict] = json.loads(TEAMS_PATH.read_text())
    by_abbr = {t["abbreviation"]: t for t in teams}
    existing_ids = {t["id"] for t in teams}

    for extra in NEW_FCS:
        if extra["abbreviation"] in by_abbr or extra["id"] in existing_ids:
            continue
        row = {
            **extra,
            "logo": extra.get("logo") or f"https://a.espncdn.com/i/teamlogos/ncaa/500/{extra['id']}.png",
            "pf": extra.get("pf", 0),
            "pa": extra.get("pa", 0),
            "wins5": extra.get("wins5", extra["wins"]),
            "losses5": extra.get("losses5", extra["losses"]),
            "tier": 3,
            "subdivision": "fcs",
            "rivals": [],
            "spPlus": None,
            "spPlusRank": None,
        }
        teams.append(row)
        by_abbr[row["abbreviation"]] = row
        existing_ids.add(row["id"])

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

    apply_real_rivals(teams)
    fields = [
        "id", "name", "shortName", "abbreviation", "logo", "state",
        "wins", "losses", "pf", "pa", "wins5", "losses5",
        "spPlus", "spPlusRank", "region", "tier", "subdivision", "rivals",
    ]
    teams = [{key: team[key] for key in fields} for team in teams]
    by_abbr = {t["abbreviation"]: t for t in teams}

    teams.sort(key=lambda t: t["shortName"])
    TEAMS_PATH.write_text(json.dumps(teams, indent=2) + "\n")
    SP_PATH.write_text(json.dumps(payload, indent=2) + "\n")

    counts = defaultdict(int)
    for t in teams:
        counts[t["region"]] += 1
    print("wrote", len(teams), "teams", dict(counts))
    sizes = defaultdict(list)
    for t in teams:
        sizes[(t["region"], t["tier"])].append(t["abbreviation"])
    for region in ("east", "south", "midwest", "west"):
        tiers = sorted({tier for (reg, tier) in sizes if reg == region})
        print(region, " ".join(f"T{tier}={len(sizes[(region, tier)])}" for tier in tiers))
    for abbr in ("IU", "YALE", "LAF", "GRAM", "UNI", "USD", "WEB", "NDSU"):
        t = by_abbr[abbr]
        print(abbr, "region", t["region"], "tier", t["tier"], "SP+", t["spPlusRank"], t["spPlus"], "rivals", len(t["rivals"]))


if __name__ == "__main__":
    main()
