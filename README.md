# CFB26 regional schedule model

A conference-free map: **four regions**, **8-team tiers** (as many as a region needs), optional protected rivals, a 13-week calendar with a league-wide bye, promotion/relegation, and a **24-team all-autobid playoff** for Tiers I–III.

The pool is **160 clubs**. Starting tiers use **2025 SP+** (Bill Connelly’s final ratings). Former FCS programs are not in SP+ and cannot occupy Tiers I–II. 2025 records still drive in-season rankings, the playoff, and movement.

## Schedule (12 games + 1 bye, no 13th contest)

- Full **round-robin inside the 8-team tier** (7 games). A protected rival in that tier counts toward those 7.
- Teams may have **0–3 protected rivals**, and only **named college football series** (Iron Bowl, Army–Navy, Apple Cup, etc.). Slots are not padded with nearby clubs.
- **One balanced crossover** from each of the other three regions (strong vs weak mixed with same-band and offset pairings so SOS is closer to even).
- Open slots fill with **other clubs in the same region, different tier**.
- **Weeks 1–5:** games outside the tier. **Week 6:** bye for every team. **Weeks 7–13:** the round-robin. Dated rivalries (Egg Bowl on Thanksgiving week, Alabama–Tennessee on the Third Saturday in October, Red River, Iron Bowl, and the rest) stay on those traditional Saturdays.

## Playoff (24, all autobids)

Each region sends **3 Tier I, 2 Tier II, and 1 Tier III** (place in the 8-team standings). Seeds are by **tier and place**, not record: the four Tier I champions are 1–4, then Tier I runners-up, then 3rd place, then Tier II, then the four Tier III champions. Opening games are **cross-region**. Seeds 1–8 get a bye. Tiers IV+ play for promotion only.

## Movement

- Champion always goes up; last place always goes down.
- Playoff teams from a lower playoff tier also go up (max 3 movers per boundary).
- Remaining bubble clubs play relegation games (projected from 2025 records). Apply the offseason on the Movement tab.

## Run

```bash
npm install
npm run dev
npm test
```
