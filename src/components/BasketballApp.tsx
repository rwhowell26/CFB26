"use client";

import { useEffect, useMemo, useState } from "react";
import { BracketologyTab } from "@/components/BracketologyTab";
import { EliminatorTab } from "@/components/EliminatorTab";
import { CBB_SEASON_LABEL, CBB_SEASON_YEAR, FIELD_SIZE, PLAY_IN_GAMES, PLAY_IN_TEAMS } from "@/lib/cbb-season";
import { emptyMetrics } from "@/lib/cbb-metrics";
import {
  hydrateCbbStoreFromLocalStorage,
  latestSnapshot,
  useCbbStore,
} from "@/lib/cbb-storage";
import type { CbbDraft, CbbSnapshot, CbbTeam, CbbTeamMetrics } from "@/lib/cbb-types";

type Payload = {
  season: number;
  seasonLabel: string;
  teams: CbbTeam[];
  metrics: Record<string, CbbTeamMetrics>;
  conferences: string[];
  error?: string;
};

export function BasketballApp() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useCbbStore();
  const [tab, setTab] = useState<"bracketology" | "eliminator">("bracketology");

  useEffect(() => {
    hydrateCbbStoreFromLocalStorage();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45000);

    (async () => {
      try {
        const res = await fetch("/api/cbb", { cache: "no-store", signal: controller.signal });
        const json = (await res.json()) as Payload;
        if (!res.ok) throw new Error(json.error || "Failed to load basketball data");
        if (cancelled) return;
        setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error && err.name === "AbortError"
              ? "Timed out loading D1 basketball. Refresh to try again."
              : err instanceof Error
                ? err.message
                : "Failed to load data",
          );
        }
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, []);

  const teams = data?.teams ?? [];
  const conferences = data?.conferences ?? [];
  const metrics = useMemo(() => {
    const map = new Map<string, CbbTeamMetrics>();
    for (const team of teams) {
      map.set(team.id, data?.metrics[team.id] ?? emptyMetrics(team.id));
    }
    return map;
  }, [data, teams]);

  const patchStore = (next: {
    snapshots?: CbbSnapshot[];
    draft?: CbbDraft | null;
    viewingId?: string | null;
    eliminatorLockedIds?: string[];
    eliminatorEliminatedIds?: string[];
  }) => {
    setStore({
      ...store,
      snapshots: next.snapshots ?? store.snapshots,
      draft: next.draft === undefined ? store.draft : next.draft,
      viewingId: next.viewingId === undefined ? store.viewingId : next.viewingId,
      eliminatorLockedIds: next.eliminatorLockedIds ?? store.eliminatorLockedIds,
      eliminatorEliminatedIds: next.eliminatorEliminatedIds ?? store.eliminatorEliminatedIds,
    });
  };

  if (loading) {
    return <div className="boot">Loading {CBB_SEASON_LABEL} men&apos;s basketball…</div>;
  }

  if (error || !data) {
    return (
      <div className="boot error">
        <p>Could not load basketball data.</p>
        <p>{error}</p>
        <button type="button" className="primary-btn" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  const latest = latestSnapshot(store);

  return (
    <div className={`app-shell cbb-mode${store.draft && tab === "bracketology" ? " is-scrub" : ""}`}>
      <header className="topbar">
        <div className="brand-block">
          <p className="brand">CBB{String(CBB_SEASON_YEAR).slice(2)}</p>
          <h1>{tab === "eliminator" ? "Eliminator" : "Bracketology"}</h1>
          <p className="tagline">
            {CBB_SEASON_LABEL} · {teams.length} D1 teams · {conferences.length} auto-bids ·{" "}
            {Math.max(0, FIELD_SIZE - conferences.length)} at-large · {PLAY_IN_TEAMS} play-in · {PLAY_IN_GAMES}{" "}
            Opening Round games
            {latest ? ` · last saved ${latest.label}` : ""}
          </p>
        </div>
      </header>

      <nav className="tabs" aria-label="Basketball">
        <button
          type="button"
          className={tab === "bracketology" ? "active" : ""}
          onClick={() => setTab("bracketology")}
        >
          Bracketology
        </button>
        <button
          type="button"
          className={tab === "eliminator" ? "active" : ""}
          onClick={() => setTab("eliminator")}
        >
          Eliminator
        </button>
      </nav>

      {tab === "eliminator" ? (
        <EliminatorTab
          teams={teams}
          metrics={metrics}
          lockedIds={store.eliminatorLockedIds ?? []}
          eliminatedIds={store.eliminatorEliminatedIds ?? []}
          onChange={(next) =>
            patchStore({
              eliminatorLockedIds: next.lockedIds,
              eliminatorEliminatedIds: next.eliminatedIds,
            })
          }
        />
      ) : (
        <BracketologyTab
          teams={teams}
          metrics={metrics}
          conferences={conferences}
          snapshots={store.snapshots}
          draft={store.draft}
          viewingId={store.viewingId}
          onStoreChange={patchStore}
        />
      )}
    </div>
  );
}
