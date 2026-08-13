#!/usr/bin/env python3
"""Build seeded FBS + FCS team data: geography, 2025 records, and named-rivalry slots."""

from __future__ import annotations

import json
import urllib.request
from collections import defaultdict
from pathlib import Path

OUT = Path("/workspace/src/data/teams.json")
RIVALRIES = Path("/workspace/src/data/rivalries.json")
TIER_SIZE = 8
MAX_RIVALS = 3

STATE = {
    "2005": "CO", "2006": "OH", "333": "AL", "2026": "NC", "12": "AZ", "9": "AZ",
    "8": "AR", "2032": "AR", "349": "NY", "2": "AL", "252": "UT", "2050": "IN",
    "239": "TX", "68": "ID", "103": "MA", "189": "OH", "2084": "NY", "2117": "MI",
    "25": "CA", "2429": "NC", "2132": "OH", "228": "SC", "324": "SC", "38": "CO",
    "36": "CO", "48": "DE", "150": "NC", "2199": "MI", "151": "NC", "2226": "FL",
    "2229": "FL", "57": "FL", "52": "FL", "278": "CA", "290": "GA", "61": "GA",
    "2247": "GA", "59": "GA", "62": "HI", "248": "TX", "356": "IL", "84": "IN",
    "2294": "IA", "66": "IA", "256": "VA", "55": "AL", "2305": "KS", "2306": "KS",
    "338": "GA", "2309": "OH", "96": "KY", "99": "LA", "2335": "VA", "309": "LA",
    "2348": "LA", "97": "KY", "2393": "TN", "276": "WV", "120": "MD", "235": "TN",
    "2390": "FL", "193": "OH", "130": "MI", "127": "MI", "135": "MN", "344": "MS",
    "142": "MO", "2623": "MO", "2459": "IL", "152": "NC", "2426": "MD", "158": "NE",
    "2440": "NV", "167": "NM", "166": "NM", "153": "NC", "249": "TX", "77": "IL",
    "87": "IN", "195": "OH", "194": "OH", "201": "OK", "197": "OK", "295": "VA",
    "145": "MS", "2483": "OR", "204": "OR", "213": "PA", "221": "PA", "2509": "IN",
    "242": "TX", "164": "NJ", "2567": "TX", "2534": "TX", "21": "CA", "23": "CA",
    "6": "AL", "2579": "SC", "58": "FL", "2572": "MS", "24": "CA", "183": "NY",
    "2628": "TX", "218": "PA", "2633": "TN", "251": "TX", "245": "TX", "326": "TX",
    "2641": "TX", "2649": "OH", "2653": "AL", "2655": "LA", "202": "OK", "5": "AL",
    "2116": "FL", "26": "CA", "41": "CT", "2433": "LA", "113": "MA", "2439": "NV",
    "30": "CA", "2638": "TX", "2636": "TX", "254": "UT", "328": "UT", "238": "TN",
    "258": "VA", "259": "VA", "2711": "MI", "154": "NC", "264": "WA", "265": "WA",
    "277": "WV", "98": "KY", "275": "WI", "2751": "WY",
    # FCS additions
    "222": "PA", "257": "VA", "2729": "VA", "160": "NH", "107": "MA", "227": "RI",
    "231": "SC", "236": "TN", "2382": "GA", "2296": "MS", "50": "FL", "2011": "AL",
    "2449": "ND", "2571": "SD", "233": "SD", "155": "ND", "2287": "IL", "2754": "OH",
    "149": "MT", "147": "MT", "70": "ID", "331": "WA", "16": "CA", "302": "CA",
}

EAST = {
    "CONN", "MASS", "BC", "SYR", "ARMY", "NAVY", "RUTG", "TEM", "PSU", "PITT",
    "WVU", "MD", "DEL", "UVA", "VT", "JMU", "ODU", "LIB", "DUKE", "UNC", "NCSU",
    "WAKE", "ECU", "CLT", "APP", "CLEM", "SC", "CCU", "MRSH", "BUFF", "CIN",
    "LOU", "UK", "WKU",
    "VILL", "RICH", "W&M", "UNH", "HC", "URI",
}
SOUTH = {
    "MIA", "FSU", "FLA", "UCF", "USF", "FAU", "FIU", "UGA", "GT", "GASO", "GAST",
    "KENN", "AUB", "ALA", "USA", "TROY", "JVST", "MISS", "MSST", "USM", "LSU",
    "UL", "ULM", "LT", "TULN", "ARK", "ARST", "MEM", "TENN", "VAN", "MTSU",
    "UAB", "TA&M", "HOU",
    "FUR", "UTC", "MER", "JKST", "FAMU", "ALST",
}
MIDWEST = {
    "OSU", "OHIO", "AKR", "KENT", "BGSU", "TOL", "M-OH", "MICH", "MSU", "WMU",
    "CMU", "EMU", "BALL", "IU", "PUR", "ND", "ILL", "NU", "WIS", "MINN", "IOWA",
    "ISU", "MIZ", "MOST", "KU", "KSU", "NEB", "OU", "OKST", "NIU", "TLSA",
    "UNT", "BAY", "TCU",
    "NDSU", "SDST", "SDAK", "UND", "ILST", "YSU",
}
WEST_FCS = {"MONT", "MTST", "IDHO", "EWU", "SAC", "UCD"}


def apply_real_rivals(teams: list[dict]) -> None:
    """Fill protected-rival slots from named series only. 0–3 per team; no padding."""
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
    counts = [len(t["rivals"]) for t in teams]
    print(
        f"named rivalries kept={kept} capped={skipped} "
        f"slots 0/1/2/3={counts.count(0)}/{counts.count(1)}/{counts.count(2)}/{counts.count(3)}"
    )


def region_for(abbr: str) -> str:
    if abbr in EAST:
        return "east"
    if abbr in SOUTH:
        return "south"
    if abbr in MIDWEST:
        return "midwest"
    return "west"


def parse_overall(overall: str | None) -> tuple[int, int]:
    if not overall or "-" not in str(overall):
        return 0, 0
    a, b = str(overall).replace("–", "-").split("-")[:2]
    return int(a), int(b)


def fetch_standings(group: int, year: int) -> list[dict]:
    url = (
        "https://site.api.espn.com/apis/v2/sports/football/college-football/"
        f"standings?group={group}&season={year}&seasontype=2"
    )
    with urllib.request.urlopen(url) as response:
        data = json.load(response)
    teams: list[dict] = []

    def walk(node: dict, conf: str | None = None) -> None:
        name = node.get("name") or conf
        for entry in (node.get("standings") or {}).get("entries") or []:
            team = entry.get("team") or {}
            overall = None
            pf = pa = None
            for stat in entry.get("stats") or []:
                if stat.get("name") == "overall" or stat.get("abbreviation") == "overall":
                    overall = stat.get("displayValue")
                if stat.get("name") == "pointsFor" and pf is None:
                    pf = stat.get("value")
                if stat.get("name") == "pointsAgainst" and pa is None:
                    pa = stat.get("value")
            logos = team.get("logos") or []
            logo = next((item.get("href") for item in logos if "500" in (item.get("href") or "")), None)
            if not logo and logos:
                logo = logos[0].get("href")
            teams.append({
                "id": str(team.get("id")),
                "name": team.get("displayName"),
                "shortName": team.get("shortDisplayName") or team.get("displayName"),
                "abbreviation": team.get("abbreviation") or team.get("shortDisplayName"),
                "logo": logo or f"https://a.espncdn.com/i/teamlogos/ncaa/500/{team.get('id')}.png",
                "overall": overall,
                "pf": pf,
                "pa": pa,
            })
        for child in node.get("children") or []:
            walk(child, child.get("name") or name)

    walk(data)
    return teams


def assign_tiers(group: list[dict]) -> None:
    """Rank by 5-year record. FCS cannot occupy Tiers I–II."""
    fbs = [t for t in group if t["subdivision"] == "fbs"]
    fcs = [t for t in group if t["subdivision"] == "fcs"]
    key = lambda t: (-t["winPct5"], -t["wins5"], -t["pointDiff5"], t["shortName"])
    fbs.sort(key=key)
    fcs.sort(key=key)
    top = fbs[: TIER_SIZE * 2]
    rest = sorted(fbs[TIER_SIZE * 2 :] + fcs, key=key)
    ordered = top + rest
    for i, team in enumerate(ordered):
        team["tier"] = i // TIER_SIZE + 1
        if team["subdivision"] == "fcs":
            team["tier"] = max(team["tier"], 3)


def main() -> None:
    years = [2021, 2022, 2023, 2024, 2025]
    fcs_keep = {
        "VILL", "RICH", "W&M", "UNH", "HC", "URI",
        "FUR", "UTC", "MER", "JKST", "FAMU", "ALST",
        "NDSU", "SDST", "SDAK", "UND", "ILST", "YSU",
        "MONT", "MTST", "IDHO", "EWU", "SAC", "UCD",
    }
    latest_fbs = fetch_standings(80, 2025)
    latest_fcs = [row for row in fetch_standings(81, 2025) if row["abbreviation"] in fcs_keep]
    raw = [{**row, "subdivision": "fbs"} for row in latest_fbs]
    raw += [{**row, "subdivision": "fcs"} for row in latest_fcs]
    keep_ids = {row["id"] for row in raw}

    totals: dict[str, dict[str, int]] = {
        row["id"]: {"wins": 0, "losses": 0, "pf": 0, "pa": 0} for row in raw
    }
    for year in years:
        for group in (80, 81):
            for row in fetch_standings(group, year):
                if row["id"] not in keep_ids:
                    continue
                wins, losses = parse_overall(row.get("overall"))
                totals[row["id"]]["wins"] += wins
                totals[row["id"]]["losses"] += losses
                totals[row["id"]]["pf"] += int(row.get("pf") or 0)
                totals[row["id"]]["pa"] += int(row.get("pa") or 0)

    by_abbr = {t["abbreviation"]: t for t in raw}
    missing_state = [t["id"] for t in raw if t["id"] not in STATE]
    if missing_state:
        raise SystemExit(f"Missing state for ids: {missing_state}")

    wanted = EAST | SOUTH | MIDWEST | WEST_FCS
    missing_abbr = [abbr for abbr in wanted if abbr not in by_abbr]
    if missing_abbr:
        raise SystemExit(f"Unknown abbreviation in region sets: {missing_abbr}")

    teams = []
    for t in raw:
        wins, losses = parse_overall(t.get("overall"))
        pf = int(t.get("pf") or 0)
        pa = int(t.get("pa") or 0)
        five = totals[t["id"]]
        games5 = five["wins"] + five["losses"]
        teams.append({
            "id": t["id"],
            "name": t["name"],
            "shortName": t["shortName"],
            "abbreviation": t["abbreviation"],
            "logo": t["logo"],
            "state": STATE[t["id"]],
            "wins": wins,
            "losses": losses,
            "pf": pf,
            "pa": pa,
            "wins5": five["wins"],
            "losses5": five["losses"],
            "winPct": round(wins / (wins + losses), 4) if wins + losses else 0,
            "winPct5": round(five["wins"] / games5, 4) if games5 else 0,
            "pointDiff": pf - pa,
            "pointDiff5": five["pf"] - five["pa"],
            "region": region_for(t["abbreviation"]),
            "subdivision": t["subdivision"],
        })

    counts = defaultdict(int)
    for t in teams:
        counts[t["region"]] += 1
    print("region counts", dict(counts), "total", len(teams))
    if set(counts.values()) != {40}:
        raise SystemExit(f"Regions not balanced to 40: {dict(counts)}")

    for region in ("east", "south", "midwest", "west"):
        assign_tiers([t for t in teams if t["region"] == region])
    fcs_high = [t["abbreviation"] for t in teams if t["subdivision"] == "fcs" and t["tier"] < 3]
    if fcs_high:
        raise SystemExit(f"FCS above Tier III: {fcs_high}")

    apply_real_rivals(teams)
    id_to_team = {t["id"]: t for t in teams}

    # Drop helper fields that the app recomputes
    out = []
    for t in teams:
        out.append({
            "id": t["id"],
            "name": t["name"],
            "shortName": t["shortName"],
            "abbreviation": t["abbreviation"],
            "logo": t["logo"],
            "state": t["state"],
            "wins": t["wins"],
            "losses": t["losses"],
            "pf": t["pf"],
            "pa": t["pa"],
            "wins5": t["wins5"],
            "losses5": t["losses5"],
            "region": t["region"],
            "tier": t["tier"],
            "subdivision": t["subdivision"],
            "rivals": t["rivals"],
        })
    out.sort(key=lambda t: t["shortName"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2) + "\n")
    print(f"wrote {len(out)} teams to {OUT}")
    # sample rivals
    for abbr in ("ALA", "OSU", "UGA", "TEX", "ND", "NDSU", "MONT", "VILL"):
        t = next(x for x in out if x["abbreviation"] == abbr)
        names = [id_to_team[r]["abbreviation"] for r in t["rivals"]]
        print(abbr, "->", names, "region", t["region"], "tier", t["tier"], f"2025 {t['wins']}-{t['losses']}", f"5yr {t['wins5']}-{t['losses5']}")


if __name__ == "__main__":
    main()
