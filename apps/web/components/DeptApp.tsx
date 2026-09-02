"use client";

import { useEffect, useMemo, useState } from "react";
import type { SeasonPayload, Sport } from "@/lib/types";
import { AVAILABLE_YEARS, DEFAULT_YEAR } from "@/lib/season";
import { applyOpinionOrder, moveTeam } from "@/lib/ranking";
import { clearSeasonOrder, loadOpinion, saveSeasonOrder } from "@/lib/storage";
import { AllTimeTab } from "./AllTimeTab";
import { BoardTab } from "./BoardTab";
import { ConferenceTab } from "./ConferenceTab";
import { HistoryTab } from "./HistoryTab";
import { SportTab } from "./SportTab";
import { TeamTab } from "./TeamTab";

type Tab =
  | "board"
  | "football"
  | "basketball"
  | "baseball"
  | "team"
  | "history"
  | "allTime"
  | "conferences";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "board", label: "Board" },
  { id: "football", label: "Football" },
  { id: "basketball", label: "M Basketball" },
  { id: "baseball", label: "Baseball" },
  { id: "conferences", label: "Conferences" },
  { id: "team", label: "Team history" },
  { id: "history", label: "Rankings history" },
  { id: "allTime", label: "All-time" },
];

export function DeptApp() {
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [tab, setTab] = useState<Tab>("board");
  const [seasons, setSeasons] = useState<Record<number, SeasonPayload>>({});
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  const season = seasons[year];
  const loading = !season && !error;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/season/${year}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Could not load season");
        return body as SeasonPayload;
      })
      .then((payload) => {
        if (cancelled) return;
        setSeasons((prev) => ({ ...prev, [payload.year]: payload }));
        const stored = loadOpinion().seasons[String(payload.year)]?.order;
        const next = applyOpinionOrder(payload.autoRankIds, stored);
        setOrder(next);
        setDirty(Boolean(stored?.length));
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  useEffect(() => {
    const missing = AVAILABLE_YEARS.filter((y) => y !== year && !seasons[y]);
    if (!missing.length) return;
    missing.forEach((y) => {
      fetch(`/api/season/${y}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((payload: SeasonPayload | null) => {
          if (payload) setSeasons((prev) => ({ ...prev, [payload.year]: payload }));
        })
        .catch(() => undefined);
    });
  }, [year, seasons]);

  const loadedSeasons = useMemo(
    () => AVAILABLE_YEARS.map((y) => seasons[y]).filter(Boolean),
    [seasons],
  );

  function handleMove(id: string, toIndex: number) {
    setOrder((prev) => {
      const next = moveTeam(prev, id, toIndex);
      saveSeasonOrder(year, next);
      return next;
    });
    setDirty(true);
  }

  function handleReset() {
    if (!season) return;
    setOrder(season.autoRankIds);
    clearSeasonOrder(year);
    setDirty(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-[var(--accent)]">
            Athletic department tracker
          </p>
          <h1
            className="mt-2 max-w-3xl text-4xl leading-tight sm:text-5xl"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Football, men’s basketball, and baseball — one board.
          </h1>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Academic year</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-[var(--line)] bg-[#0b1220] px-3 py-2"
          >
            {AVAILABLE_YEARS.map((y) => (
              <option key={y} value={y}>
                {y - 1}–{String(y).slice(2)}
              </option>
            ))}
          </select>
        </label>
      </header>

      <nav aria-label="Sections" className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              tab === item.id ? "bg-[var(--accent)] text-[#070b14]" : "border border-[var(--line)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {loading && !season ? <p className="text-[var(--muted)]">Loading ESPN results…</p> : null}
      {error ? <p className="text-[#ffb4b4]">{error}</p> : null}

      {season ? (
        <>
          {tab === "board" ? (
            <BoardTab season={season} order={order} dirty={dirty} onMove={handleMove} onReset={handleReset} />
          ) : null}
          {tab === "football" || tab === "basketball" || tab === "baseball" ? (
            <SportTab season={season} sport={tab as Sport} />
          ) : null}
          {tab === "conferences" ? <ConferenceTab season={season} order={order} /> : null}
          {tab === "team" ? <TeamTab seasons={loadedSeasons.length ? loadedSeasons : [season]} currentYear={year} /> : null}
          {tab === "history" ? (
            <HistoryTab seasons={loadedSeasons.length ? loadedSeasons : [season]} />
          ) : null}
          {tab === "allTime" ? (
            <AllTimeTab seasons={loadedSeasons.length ? loadedSeasons : [season]} />
          ) : null}
        </>
      ) : null}

      <aside className="rounded-2xl border border-[var(--line)] bg-[#10182a]/70 p-4 text-sm leading-6 text-[var(--muted)]">
        <p>
          Assumptions: bowls do not count; football postseason is the CFP and FCS playoffs,
          with FBS and FCS titles in the same champion tier and FBS conference champions
          below first-round teams. Basketball is the NCAA tournament only (not the NIT).
          Baseball is the NCAA tournament through the CWS. Department rank is the average
          of a school’s ranks in the sports it plays. Opinion edits stay in this browser.
        </p>
      </aside>
    </main>
  );
}
