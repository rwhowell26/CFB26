#!/usr/bin/env python3
"""Build seeded FBS team data: geography, 2025 records, and 3 protected rivals."""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

ESPN = Path("/tmp/espn_teams.json")
OUT = Path("/workspace/src/data/teams.json")

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
}

EAST = {
    "CONN", "MASS", "BC", "SYR", "ARMY", "NAVY", "RUTG", "TEM", "PSU", "PITT",
    "WVU", "MD", "DEL", "UVA", "VT", "JMU", "ODU", "LIB", "DUKE", "UNC", "NCSU",
    "WAKE", "ECU", "CLT", "APP", "CLEM", "SC", "CCU", "MRSH", "BUFF", "CIN",
    "LOU", "UK", "WKU",
}
SOUTH = {
    "MIA", "FSU", "FLA", "UCF", "USF", "FAU", "FIU", "UGA", "GT", "GASO", "GAST",
    "KENN", "AUB", "ALA", "USA", "TROY", "JVST", "MISS", "MSST", "USM", "LSU",
    "UL", "ULM", "LT", "TULN", "ARK", "ARST", "MEM", "TENN", "VAN", "MTSU",
    "UAB", "TA&M", "HOU",
}
MIDWEST = {
    "OSU", "OHIO", "AKR", "KENT", "BGSU", "TOL", "M-OH", "MICH", "MSU", "WMU",
    "CMU", "EMU", "BALL", "IU", "PUR", "ND", "ILL", "NU", "WIS", "MINN", "IOWA",
    "ISU", "MIZ", "MOST", "KU", "KSU", "NEB", "OU", "OKST", "NIU", "TLSA",
    "UNT", "BAY", "TCU",
}

PRIORITY_PAIRS = [
    ("ARMY", "NAVY"), ("AFA", "ARMY"), ("AFA", "NAVY"),
    ("OSU", "MICH"), ("MICH", "MSU"), ("OSU", "PSU"),
    ("ALA", "AUB"), ("UGA", "FLA"), ("UGA", "GT"), ("UGA", "AUB"),
    ("FLA", "FSU"), ("FSU", "MIA"), ("MIA", "USF"),
    ("CLEM", "SC"), ("UNC", "NCSU"), ("UNC", "DUKE"), ("DUKE", "WAKE"),
    ("UVA", "VT"), ("PITT", "WVU"), ("UK", "LOU"),
    ("TEX", "OU"), ("TEX", "TA&M"), ("OU", "OKST"),
    ("USC", "UCLA"), ("CAL", "STAN"), ("ORE", "ORST"), ("WASH", "WSU"),
    ("UTAH", "BYU"), ("ARIZ", "ASU"), ("COLO", "CSU"),
    ("IU", "PUR"), ("IOWA", "ISU"), ("KU", "KSU"), ("MINN", "WIS"),
    ("MISS", "MSST"), ("TENN", "VAN"), ("LSU", "ARK"),
    ("BAY", "TCU"), ("SMU", "TCU"), ("HOU", "RICE"),
    ("NEV", "UNLV"), ("UNM", "NMSU"), ("SDSU", "SJSU"),
    ("ND", "USC"), ("ND", "MICH"), ("PSU", "PITT"),
    ("ALA", "TENN"), ("ALA", "LSU"), ("AUB", "LSU"),
    ("FSU", "CLEM"), ("SC", "CLEM"),
    ("TA&M", "LSU"), ("TA&M", "ARK"),
    ("TEX", "TTU"), ("TTU", "BAY"), ("TTU", "TCU"),
    ("SMU", "HOU"), ("UNT", "SMU"), ("UTSA", "TXST"),
    ("UCF", "USF"), ("UCF", "FLA"), ("FAU", "FIU"),
    ("GT", "CLEM"), ("NCSU", "WAKE"), ("NCSU", "ECU"),
    ("JMU", "ODU"), ("UVA", "MD"), ("VT", "W&M"),
    ("MRSH", "WVU"), ("MRSH", "OHIO"), ("CIN", "LOU"),
    ("CIN", "OSU"), ("UK", "TENN"), ("LOU", "UK"),
    ("IOWA", "MINN"), ("IOWA", "WIS"), ("NEB", "IOWA"),
    ("ILL", "NU"), ("ILL", "PUR"), ("ND", "PUR"),
    ("MICH", "OSU"), ("MSU", "PENN"),
    ("WMU", "CMU"), ("CMU", "EMU"), ("TOL", "BGSU"),
    ("AKR", "KENT"), ("OHIO", "M-OH"), ("BALL", "IU"),
    ("MIZ", "KU"), ("MIZ", "ARK"), ("MOST", "MIZ"),
    ("OKST", "TLSA"), ("UNT", "TLSA"), ("BAY", "TEX"),
    ("ORE", "WASH"), ("USC", "STAN"), ("CAL", "UCLA"),
    ("UTAH", "COLO"), ("BYU", "USU"), ("BOIS", "USU"),
    ("FRES", "SJSU"), ("FRES", "HAW"), ("SDSU", "UNLV"),
    ("WYO", "CSU"), ("WYO", "AFA"), ("NEV", "FRES"),
    ("ARIZ", "UNM"), ("ASU", "UA"), ("UTEP", "NMSU"),
    ("UTEP", "UNM"), ("SHSU", "TXST"), ("RICE", "UH"),
    ("GASO", "GAST"), ("GASO", "APP"), ("APP", "CLT"),
    ("CCU", "APP"), ("KENN", "GAST"), ("TROY", "USA"),
    ("JVST", "TROY"), ("USM", "MEM"), ("UAB", "MEM"),
    ("UAB", "AUB"), ("UL", "ULM"), ("UL", "LT"), ("LT", "USM"),
    ("ARST", "ARK"), ("MTSU", "VAN"), ("WKU", "MTSU"),
    ("LIB", "VT"), ("DEL", "MD"), ("CONN", "MASS"),
    ("BC", "SYR"), ("SYR", "PITT"), ("RUTG", "PSU"),
    ("TEM", "PSU"), ("ARMY", "ND"), ("NAVY", "ND"),
    ("BUFF", "SYR"), ("ECU", "CLT"), ("WAKE", "UVA"),
    ("ODU", "ECU"), ("JMU", "LIB"), ("CIN", "M-OH"),
    ("TOL", "OHIO"), ("BGSU", "KENT"), ("EMU", "WMU"),
    ("NIU", "ILL"), ("WIS", "NU"), ("MINN", "NEB"),
    ("ISU", "KU"), ("KSU", "NEB"), ("OU", "MIZ"),
    ("OKST", "KU"), ("TCU", "HOU"), ("SMU", "RICE"),
    ("UTSA", "HOU"), ("TXST", "UTSA"), ("SHSU", "RICE"),
    ("COLO", "UTAH"), ("CSU", "AFA"), ("BOIS", "FRES"),
    ("HAW", "SDSU"), ("ORST", "WSU"), ("WASH", "STAN"),
    ("UCLA", "CAL"), ("USC", "ORE"), ("BYU", "UTAH"),
    ("USU", "WYO"), ("UNLV", "BOIS"), ("SJSU", "STAN"),
    ("NMSU", "UTEP"), ("UNM", "CSU"), ("ARIZ", "COLO"),
    ("ASU", "UTAH"), ("TLSA", "HOU"), ("UNT", "TXST"),
    ("BAY", "HOU"), ("MEM", "MISS"), ("TULN", "LSU"),
    ("TULN", "USF"), ("FAU", "MIA"), ("FIU", "USA"),
    ("KENN", "GT"), ("GASO", "TROY"), ("JVST", "UAB"),
    ("MSST", "UAB"), ("VAN", "UGA"), ("TENN", "UGA"),
    ("FLA", "TENN"), ("AUB", "MSST"), ("MISS", "LSU"),
    ("ARK", "MISS"), ("TA&M", "TEX"), ("HOU", "TA&M"),
    ("WKU", "LOU"), ("UK", "CIN"), ("LIB", "JMU"),
    ("ODU", "UVA"), ("MD", "PSU"), ("WVU", "PITT"),
    ("MRSH", "APP"), ("SC", "UGA"), ("CLEM", "UGA"),
    ("FSU", "UCF"), ("MIA", "FLA"), ("USF", "FAU"),
    ("CONN", "BC"), ("MASS", "BC"), ("ARMY", "RUTG"),
    ("NAVY", "TEM"), ("DEL", "TEMPLE"), ("BUFF", "RUTG"),
    ("CLT", "SC"), ("ECU", "APP"), ("WAKE", "DUKE"),
    ("NCSU", "UNC"), ("VT", "UVA"), ("JMU", "VT"),
    ("IU", "ND"), ("PUR", "ILL"), ("OSU", "MICH"),
    ("MSU", "ND"), ("WMU", "MSU"), ("CMU", "MSU"),
    ("BALL", "PUR"), ("NIU", "NU"), ("WIS", "IOWA"),
    ("MINN", "IOWA"), ("NEB", "WIS"), ("ISU", "NEB"),
    ("KU", "OU"), ("KSU", "OU"), ("MIZ", "OKST"),
    ("MOST", "KU"), ("TCU", "TEX"), ("BAY", "SMU"),
    ("UNT", "RICE"), ("TLSA", "OKST"),
]


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


def add_edge(adj: dict[str, set[str]], a: str, b: str) -> bool:
    if a == b:
        return False
    if b in adj[a] or a in adj[b]:
        return False
    if len(adj[a]) >= 3 or len(adj[b]) >= 3:
        return False
    adj[a].add(b)
    adj[b].add(a)
    return True


def main() -> None:
    raw = json.loads(ESPN.read_text())
    by_abbr = {t["abbreviation"]: t for t in raw}
    missing_state = [t["id"] for t in raw if t["id"] not in STATE]
    if missing_state:
        raise SystemExit(f"Missing state for ids: {missing_state}")

    for abbr in EAST | SOUTH | MIDWEST:
        if abbr not in by_abbr:
            raise SystemExit(f"Unknown abbreviation in region sets: {abbr}")

    teams = []
    for t in raw:
        wins, losses = t["wins"], t["losses"]
        if t.get("overall"):
            wins, losses = parse_overall(t["overall"])
        pf = int(t.get("pf") or 0)
        pa = int(t.get("pa") or 0)
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
            "winPct": round(wins / (wins + losses), 4) if wins + losses else 0,
            "pointDiff": pf - pa,
            "region": region_for(t["abbreviation"]),
        })

    counts = defaultdict(int)
    for t in teams:
        counts[t["region"]] += 1
    print("region counts", dict(counts))
    if set(counts.values()) != {34}:
        raise SystemExit(f"Regions not balanced: {dict(counts)}")

    # Default tiers by last-year record within region
    for region in ("east", "south", "midwest", "west"):
        group = [t for t in teams if t["region"] == region]
        group.sort(key=lambda t: (-t["winPct"], -t["wins"], -t["pointDiff"], t["shortName"]))
        n = len(group)
        t1 = (n + 2) // 3
        t2 = (n + 1) // 3
        for i, t in enumerate(group):
            if i < t1:
                t["tier"] = 1
            elif i < t1 + t2:
                t["tier"] = 2
            else:
                t["tier"] = 3

    abbr_to_id = {t["abbreviation"]: t["id"] for t in teams}
    id_to_team = {t["id"]: t for t in teams}
    region_order = {"east": 0, "south": 1, "midwest": 2, "west": 3}
    ids = [
        t["id"]
        for t in sorted(teams, key=lambda t: (region_order[t["region"]], t["state"], t["shortName"]))
    ]
    n = len(ids)
    adj: dict[str, set[str]] = {tid: set() for tid in ids}
    locked: set[tuple[str, str]] = set()

    def key(a: str, b: str) -> tuple[str, str]:
        return (a, b) if a < b else (b, a)

    def is_locked(a: str, b: str) -> bool:
        return key(a, b) in locked

    # 3-regular seed: Hamiltonian cycle + opposite matching.
    for i, tid in enumerate(ids):
        add_edge(adj, tid, ids[(i + 1) % n])
        add_edge(adj, tid, ids[(i + n // 2) % n])

    def remove_edge(a: str, b: str) -> None:
        adj[a].discard(b)
        adj[b].discard(a)

    def insert_rival(u: str, v: str) -> bool:
        if u == v:
            return False
        if v in adj[u]:
            locked.add(key(u, v))
            return True
        # 2-swap using unlocked edges only, so earlier rivalries stay put.
        for x in list(adj[u]):
            if is_locked(u, x):
                continue
            for y in list(adj[v]):
                if is_locked(v, y):
                    continue
                if x == y or x == v or y == u:
                    continue
                if y in adj[x]:
                    continue
                remove_edge(u, x)
                remove_edge(v, y)
                add_edge(adj, u, v)
                add_edge(adj, x, y)
                locked.add(key(u, v))
                return True
        return False

    inserted = 0
    skipped = 0
    for a, b in PRIORITY_PAIRS:
        if a not in abbr_to_id or b not in abbr_to_id:
            continue
        if insert_rival(abbr_to_id[a], abbr_to_id[b]):
            inserted += 1
        else:
            skipped += 1
    print(f"priority rival inserts={inserted} skipped={skipped} locked={len(locked)}")

    leftover = [(id_to_team[i]["abbreviation"], len(adj[i])) for i in ids if len(adj[i]) != 3]
    if leftover:
        raise SystemExit(f"Rival graph is not 3-regular: {leftover}")

    for t in teams:
        rivals = sorted(adj[t["id"]], key=lambda rid: id_to_team[rid]["shortName"])
        if len(rivals) != 3:
            raise SystemExit(f"{t['abbreviation']} has {len(rivals)} rivals")
        t["rivals"] = rivals

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
            "region": t["region"],
            "tier": t["tier"],
            "rivals": t["rivals"],
        })
    out.sort(key=lambda t: t["shortName"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2) + "\n")
    print(f"wrote {len(out)} teams to {OUT}")
    # sample rivals
    for abbr in ("ALA", "OSU", "UGA", "TEX", "ND", "USC"):
        t = next(x for x in out if x["abbreviation"] == abbr)
        names = [id_to_team[r]["abbreviation"] for r in t["rivals"]]
        print(abbr, "->", names, "region", t["region"], "tier", t["tier"], f"{t['wins']}-{t['losses']}")


if __name__ == "__main__":
    main()
