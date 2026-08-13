# CFB26 regional schedule model

A conference-free FBS map: **four regions**, **three tiers**, protected rivals, a 12-game standing-based schedule, and a **24-team playoff**.

2025 overall records come from ESPN standings. Regions start geographic; tiers start as the top / middle / bottom third of each region by that record. Drag teams on the Regions tab to rewrite the rest of the model.

## Schedule shape (12 games)

- **3 protected rivals** every year (classic matchups where possible; every team has exactly three)
- **6 other teams in the same region + tier**, rotated over a 10-year cycle
- **1 team from each of the other three regions**, paired by last year’s regional standing (East #1 vs South #1 vs Midwest #1 vs West #1, and so on)

## Playoff (24)

- Autobid: champion of each of the 12 region-tiers
- Extra top-tier access: Tier I runner-up in each region
- 8 at-large
- Seeds 1–8 receive a first-round bye (9 vs 24, 10 vs 23, …)

Later rounds on the Playoff tab are a **projection** that advances the better 2025 record.

## Run locally

```bash
npm install
npm run dev
```

`npm test` checks invariants (136 teams, 3-regular rival graph, mutual schedules, 24-team field).

## Open questions

These are the defaults this first cut used — easy to change:

1. If a protected rival is already in your tier, should that game count toward the six in-tier slots, or stay extra (current: extra, so you still play six *other* tier-mates)?
2. Do you want a week-by-week calendar and home/away constraints (no three-road-trips-in-a-row, protected rival in rivalry week)?
3. Should tiers reshuffle every year by record, or stay as a league you manage by hand?
4. Inter-region pairing is same-standing (strong vs strong). Prefer a snake so everyone has similar crossover strength of schedule?
5. Playoff: keep 16 autobids (12 champs + 4 Tier I runners-up) or only 12 champs plus 12 at-large? Reseed after each round?
6. Add an FCS / 13th game?
7. Should protected rivals be editable in the UI?
8. Region borders: Kentucky is East; Texas A&M and Houston are South; most of Texas is West. Want different lines?
