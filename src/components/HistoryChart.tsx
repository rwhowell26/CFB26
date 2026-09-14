"use client";

import { useMemo } from "react";
import { FBS_TEAM_COUNT, formatGameWeekShort } from "@/lib/season";
import type { TeamRankPoint } from "@/lib/storage";

export type HistorySeries = {
  teamId: string;
  name: string;
  color: string;
  points: TeamRankPoint[];
  focused: boolean;
};

type Props = {
  weeks: number[];
  series: HistorySeries[];
  hoveredWeek: number | null;
  onHoverWeek: (week: number | null) => void;
  onFocusTeam: (teamId: string) => void;
};

const WIDTH = 640;
const HEIGHT = 360;
const PAD = { top: 18, right: 18, bottom: 36, left: 44 };

function yTicks(min: number, max: number): number[] {
  const span = Math.max(1, max - min);
  const step = span <= 8 ? 1 : span <= 20 ? 2 : span <= 40 ? 5 : 10;
  const ticks: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max; v += step) ticks.push(v);
  if (!ticks.includes(min)) ticks.unshift(min);
  if (!ticks.includes(max)) ticks.push(max);
  return ticks;
}

function rankDomain(series: HistorySeries[]): { min: number; max: number } {
  const ranks = series.flatMap((s) => s.points.map((p) => p.rank).filter((r): r is number => r != null));
  if (!ranks.length) return { min: 1, max: 25 };
  const lo = Math.min(...ranks);
  const hi = Math.max(...ranks);
  return {
    min: Math.max(1, lo - 2),
    max: Math.min(FBS_TEAM_COUNT, Math.max(hi + 2, lo + 4)),
  };
}

function linePaths(
  xs: number[],
  ys: Array<number | null>,
): string[] {
  const segs: string[] = [];
  let d = "";
  for (let i = 0; i < xs.length; i++) {
    const y = ys[i];
    if (y == null) {
      if (d) {
        segs.push(d);
        d = "";
      }
      continue;
    }
    d += d ? ` L ${xs[i]} ${y}` : `M ${xs[i]} ${y}`;
  }
  if (d) segs.push(d);
  return segs;
}

export function HistoryChart({ weeks, series, hoveredWeek, onHoverWeek, onFocusTeam }: Props) {
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const { min, max } = useMemo(() => rankDomain(series), [series]);
  const ticks = useMemo(() => yTicks(min, max), [min, max]);

  const xs = useMemo(() => {
    if (weeks.length <= 1) return weeks.map(() => PAD.left + innerW / 2);
    return weeks.map((_, i) => PAD.left + (i / (weeks.length - 1)) * innerW);
  }, [weeks, innerW]);

  const plotted = useMemo(() => {
    const yFor = (rank: number) => PAD.top + ((rank - min) / (max - min || 1)) * innerH;
    return series.map((s) => {
      const byWeek = new Map(s.points.map((p) => [p.week, p.rank]));
      const ys = weeks.map((w) => {
        const rank = byWeek.get(w);
        return rank == null ? null : yFor(rank);
      });
      return { ...s, ys, paths: linePaths(xs, ys) };
    });
  }, [series, weeks, xs, min, max, innerH]);

  const yFor = (rank: number) => PAD.top + ((rank - min) / (max - min || 1)) * innerH;

  const hoverIndex = hoveredWeek == null ? -1 : weeks.indexOf(hoveredWeek);

  function weekFromClientX(clientX: number, target: SVGSVGElement) {
    const rect = target.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * WIDTH;
    let best = 0;
    let bestDist = Infinity;
    xs.forEach((px, i) => {
      const dist = Math.abs(px - x);
      if (dist < bestDist) {
        best = i;
        bestDist = dist;
      }
    });
    return weeks[best] ?? null;
  }

  if (!weeks.length) {
    return <div className="empty-state">No weekly ballots to plot yet.</div>;
  }

  return (
    <svg
      className="history-chart-svg"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Team rank by week, with rank 1 at the top"
      onMouseLeave={() => onHoverWeek(null)}
      onMouseMove={(e) => onHoverWeek(weekFromClientX(e.clientX, e.currentTarget))}
    >
      {ticks.map((tick) => {
        const y = yFor(tick);
        return (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y}
              y2={y}
              className="history-grid"
            />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" className="history-axis">
              #{tick}
            </text>
          </g>
        );
      })}

      {weeks.map((week, i) => (
        <text
          key={week}
          x={xs[i]}
          y={HEIGHT - 12}
          textAnchor="middle"
          className="history-axis"
        >
          {formatGameWeekShort(week)}
        </text>
      ))}

      {hoverIndex >= 0 ? (
        <line
          x1={xs[hoverIndex]}
          x2={xs[hoverIndex]}
          y1={PAD.top}
          y2={HEIGHT - PAD.bottom}
          className="history-hover-line"
        />
      ) : null}

      {plotted.map((s) =>
        s.paths.map((d, i) => (
          <path
            key={`${s.teamId}-${i}`}
            d={d}
            fill="none"
            stroke={s.color}
            strokeWidth={s.focused ? 3.2 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={s.focused ? 1 : 0.42}
            onClick={() => onFocusTeam(s.teamId)}
          />
        )),
      )}

      {plotted.map((s) =>
        s.ys.map((y, i) =>
          y == null ? null : (
            <circle
              key={`${s.teamId}-pt-${weeks[i]}`}
              cx={xs[i]}
              cy={y}
              r={s.focused || weeks[i] === hoveredWeek ? 5 : 3.5}
              fill={s.color}
              opacity={s.focused ? 1 : 0.55}
              onClick={() => onFocusTeam(s.teamId)}
            />
          ),
        ),
      )}
    </svg>
  );
}
