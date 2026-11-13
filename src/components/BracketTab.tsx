"use client";

import { Fragment } from "react";
import { TeamLogo } from "@/components/TeamLogo";
import { assignField, bestTeamByConference } from "@/lib/cbb-bracket";
import {
  type FirstRoundSlot,
  type RegionBracket,
  type RegionId,
  placeBracket,
  REGION_META,
} from "@/lib/cbb-place-bracket";
import { formatRecord } from "@/lib/cbb-metrics";
import { PLAY_IN_GAMES } from "@/lib/cbb-season";
import type { CbbSnapshot, CbbTeam, CbbTeamMetrics } from "@/lib/cbb-types";

const FIRST_ROUND_PAIRS: Array<[number, number]> = [
  [1, 16],
  [8, 9],
  [4, 13],
  [5, 12],
  [2, 15],
  [7, 10],
  [3, 14],
  [6, 11],
];

const COL = {
  or: 1,
  feed: 2,
  r64: 3,
  j32: 4,
  r32: 5,
  j16: 6,
  s16: 7,
  j8: 8,
  e8: 9,
} as const;

const ROUND_LABELS = [
  "Opening Round",
  "",
  "Round of 64",
  "",
  "Round of 32",
  "",
  "Sweet 16",
  "",
  "Elite Eight",
] as const;

type Props = {
  teams: CbbTeam[];
  metrics: Map<string, CbbTeamMetrics>;
  conferences: string[];
  snapshots: CbbSnapshot[];
  viewingId: string | null;
  onViewingId: (id: string | null) => void;
};

type RowModel = {
  seed: number | string;
  team?: CbbTeam;
  trueSeed?: number;
  placeholder?: string;
  playIn?: boolean;
  receivesPlayIn?: boolean;
};

function slotBySeed(region: RegionBracket, seed: number): FirstRoundSlot {
  return (
    region.slots.find((slot) => slot.seed === seed) ?? {
      seed,
      region: region.id,
      teamId: null,
      playIn: null,
      role: null,
      trueSeeds: [],
    }
  );
}

function chipColor(team: CbbTeam | undefined): string | undefined {
  if (!team?.color) return undefined;
  return team.color.startsWith("#") ? team.color : `#${team.color}`;
}

/** 1-based grid row for one of the 16 first-round games; row 9 is the region split. */
function gameRow(index: number): number {
  return index < 8 ? index + 1 : index + 2;
}

function TeamRow({ seed, team, trueSeed, placeholder, playIn, receivesPlayIn }: RowModel) {
  const color = chipColor(team);
  return (
    <div
      className={`cbb-br-row${team ? "" : " is-open"}${receivesPlayIn ? " is-recv" : ""}`}
      style={color ? { ["--chip-color" as string]: color } : undefined}
    >
      {seed !== "" ? <span className="cbb-br-seed">{seed}</span> : null}
      {team ? <TeamLogo team={team} /> : null}
      <span className="cbb-br-name">
        {team ? <strong>{team.shortName}</strong> : null}
        <em>
          {placeholder
            ? placeholder
            : team
              ? `${formatRecord(team.wins, team.losses)}${trueSeed ? ` · #${trueSeed}` : ""}${
                  playIn ? " · OR" : ""
                }`
              : ""}
        </em>
      </span>
    </div>
  );
}

function GameBubble({
  top,
  bottom,
  playIn,
  label,
}: {
  top: RowModel;
  bottom: RowModel;
  playIn?: boolean;
  label?: string;
}) {
  return (
    <article className={`cbb-br-bubble${playIn ? " is-or" : ""}`} aria-label={label}>
      <TeamRow {...top} />
      <TeamRow {...bottom} />
    </article>
  );
}

function EmptyBubble() {
  return (
    <div className="cbb-br-bubble is-open">
      <TeamRow seed="" />
      <TeamRow seed="" />
    </div>
  );
}

function BracketJoin({ column, row, span }: { column: number; row: number; span: number }) {
  return (
    <div
      className="cbb-br-join"
      style={{ gridColumn: column, gridRow: `${row} / span ${span}` }}
      aria-hidden
    >
      <span className="cbb-br-join-arm is-top" />
      <span className="cbb-br-join-arm is-bot" />
      <span className="cbb-br-join-out" />
    </div>
  );
}

function PlayInBubble({ slot, teamsById }: { slot: FirstRoundSlot; teamsById: Map<string, CbbTeam> }) {
  if (!slot.playIn) return null;
  const [leftId, rightId] = slot.playIn.teamIds;
  return (
    <GameBubble
      playIn
      label={`Opening Round · ${slot.seed} seed`}
      top={{
        seed: slot.seed,
        team: teamsById.get(leftId),
        trueSeed: slot.trueSeeds[0],
      }}
      bottom={{
        seed: slot.seed,
        team: teamsById.get(rightId),
        trueSeed: slot.trueSeeds[1],
      }}
    />
  );
}

function FirstRoundBubble({
  region,
  high,
  low,
  teamsById,
}: {
  region: RegionBracket;
  high: number;
  low: number;
  teamsById: Map<string, CbbTeam>;
}) {
  const top = slotBySeed(region, high);
  const bottom = slotBySeed(region, low);
  const topTeam = top.teamId ? teamsById.get(top.teamId) : undefined;
  const bottomTeam = bottom.teamId ? teamsById.get(bottom.teamId) : undefined;
  return (
    <GameBubble
      label={`${region.label} ${high} vs ${low}`}
      top={{ seed: high, team: topTeam, trueSeed: top.trueSeeds[0] }}
      bottom={
        bottom.playIn
          ? { seed: low, placeholder: "OR winner", receivesPlayIn: true }
          : { seed: low, team: bottomTeam, trueSeed: bottom.trueSeeds[0] }
      }
    />
  );
}

function HalfBracket({
  top,
  bottom,
  teamsById,
  flip,
}: {
  top: RegionBracket;
  bottom: RegionBracket;
  teamsById: Map<string, CbbTeam>;
  flip?: boolean;
}) {
  const regions = [top, bottom];
  return (
    <div className={`cbb-br-half${flip ? " is-flip" : ""}`}>
      <ol className="cbb-br-round-labels">
        {ROUND_LABELS.map((label, index) => (
          <li key={`${label}-${index}`}>{label}</li>
        ))}
      </ol>
      <div className="cbb-br-tree">
        {regions.flatMap((region, regionIndex) =>
          FIRST_ROUND_PAIRS.map(([high, low], pairIndex) => {
            const index = regionIndex * 8 + pairIndex;
            const row = gameRow(index);
            const lowSlot = slotBySeed(region, low);
            return (
              <Fragment key={`${region.id}-${high}-${low}`}>
                <div className="cbb-br-or-cell" style={{ gridColumn: COL.or, gridRow: row }}>
                  <PlayInBubble slot={lowSlot} teamsById={teamsById} />
                </div>
                <div
                  className={`cbb-br-feed${lowSlot.playIn ? " is-on" : ""}`}
                  style={{ gridColumn: COL.feed, gridRow: row }}
                  aria-hidden
                >
                  {lowSlot.playIn ? (
                    <svg viewBox="0 0 24 40" preserveAspectRatio="none">
                      <path d="M0 20 H12 V30 H24" />
                    </svg>
                  ) : null}
                </div>
                <div className="cbb-br-r64-cell" style={{ gridColumn: COL.r64, gridRow: row }}>
                  <FirstRoundBubble region={region} high={high} low={low} teamsById={teamsById} />
                </div>
              </Fragment>
            );
          }),
        )}

        {Array.from({ length: 8 }, (_, index) => {
          const start = index * 2;
          const row = gameRow(start);
          const span = gameRow(start + 1) - row + 1;
          return (
            <Fragment key={`r32-${index}`}>
              <BracketJoin column={COL.j32} row={row} span={span} />
              <div
                className="cbb-br-later"
                style={{ gridColumn: COL.r32, gridRow: `${row} / span ${span}` }}
              >
                <EmptyBubble />
              </div>
            </Fragment>
          );
        })}

        {Array.from({ length: 4 }, (_, index) => {
          const start = index * 4;
          const row = gameRow(start);
          const span = gameRow(start + 3) - row + 1;
          return (
            <Fragment key={`s16-${index}`}>
              <BracketJoin column={COL.j16} row={row} span={span} />
              <div
                className="cbb-br-later"
                style={{ gridColumn: COL.s16, gridRow: `${row} / span ${span}` }}
              >
                <EmptyBubble />
              </div>
            </Fragment>
          );
        })}

        {regions.map((region, regionIndex) => {
          const start = regionIndex * 8;
          const row = gameRow(start);
          const span = gameRow(start + 7) - row + 1;
          return (
            <Fragment key={`e8-${region.id}`}>
              <BracketJoin column={COL.j8} row={row} span={span} />
              <div
                className="cbb-br-e8-cell"
                style={{ gridColumn: COL.e8, gridRow: `${row} / span ${span}` }}
              >
                <p className="cbb-br-region-name">{region.label}</p>
                <p className="cbb-br-region-meta">
                  {region.site} · {region.venue}
                </p>
                <EmptyBubble />
              </div>
            </Fragment>
          );
        })}

        <div className="cbb-br-split" style={{ gridColumn: "1 / -1", gridRow: 9 }} aria-hidden />
      </div>
    </div>
  );
}

export function BracketTab({
  teams,
  metrics,
  conferences,
  snapshots,
  viewingId,
  onViewingId,
}: Props) {
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const latest = snapshots[0] ?? null;
  const viewing = snapshots.find((item) => item.id === viewingId) ?? latest;

  if (!viewing) {
    return (
      <div className="cbb-bracket-tab">
        <section className="panel">
          <header className="panel-header">
            <p className="eyebrow">Bracket</p>
            <h2>No seed list yet</h2>
            <p>
              Save a Bracketology projection, then this tab places that 76-team field into the 2027
              championship bracket — Opening Round through the Final Four.
            </p>
          </header>
        </section>
      </div>
    );
  }

  const assignment = assignField(
    viewing.sCurve,
    teamsById,
    conferences,
    bestTeamByConference(teams, teamsById, metrics),
  );
  const placed = placeBracket(assignment.field, teamsById);
  const sums = Object.values(placed.regions).map((region) => region.trueSeedSum);
  const spread = Math.max(...sums) - Math.min(...sums);

  return (
    <div className="cbb-bracket-tab">
      <section className="panel cbb-br-bar">
        <header className="panel-header">
          <p className="eyebrow">2027 NCAA bracket · {viewing.label}</p>
          <p>
            {placed.playInCount}/{PLAY_IN_GAMES} Opening Round games on the edges · Round of 64
            inward · overall 1 vs 4 and 2 vs 3 in Detroit · true-seed spread {spread} (prefer ≤6)
          </p>
        </header>
        <label className="week-select">
          Seed list
          <select value={viewing.id} onChange={(event) => onViewingId(event.target.value || null)}>
            {snapshots.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
                {item.id === latest?.id ? " · latest" : ""}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="cbb-br-frame">
        <HalfBracket
          top={placed.regions.east}
          bottom={placed.regions.midwest}
          teamsById={teamsById}
        />
        <aside className="cbb-br-ff">
          <p>Final Four · Detroit</p>
          <div className="cbb-br-bubble cbb-br-ff-semi">
            <TeamRow seed="" placeholder={REGION_META.east.label} />
            <TeamRow seed="" placeholder={REGION_META.midwest.label} />
          </div>
          <div className="cbb-br-bubble cbb-br-champ is-open">
            <TeamRow seed="" placeholder="Championship" />
            <TeamRow seed="" placeholder="April · Detroit" />
          </div>
          <div className="cbb-br-bubble cbb-br-ff-semi">
            <TeamRow seed="" placeholder={REGION_META.west.label} />
            <TeamRow seed="" placeholder={REGION_META.south.label} />
          </div>
          <ol className="cbb-br-balance">
            {(["east", "west", "south", "midwest"] as RegionId[]).map((id) => (
              <li key={id}>
                {placed.regions[id].label} {placed.regions[id].trueSeedSum}
              </li>
            ))}
          </ol>
        </aside>
        <HalfBracket
          top={placed.regions.west}
          bottom={placed.regions.south}
          teamsById={teamsById}
          flip
        />
      </div>
    </div>
  );
}
