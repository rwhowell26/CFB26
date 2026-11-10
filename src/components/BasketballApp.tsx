"use client";

import { useEffect, useMemo, useState } from "react";
import { BracketologyTab } from "@/components/BracketologyTab";
import { CBB_SEASON_LABEL, CBB_SEASON_YEAR } from "@/lib/cbb-season";
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
  const [tab] = useState<"bracketology">("bracketology");

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
  }) => {
    setStore({
      ...store,
      snapshots: next.snapshots ?? store.snapshots,
      draft: next.draft === undefined ? store.draft : next.draft,
      viewingId: next.viewingId === undefined ? store.viewingId : next.viewingId,
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
    <div className={`app-shell cbb-mode${store.draft ? " is-scrub" : ""}`}>
      <header className="topbar">
        <div className="brand-block">
          <p className="brand">CBB{String(CBB_SEASON_YEAR).slice(2)}</p>
          <h1>Bracketology</h1>
          <p className="tagline">
            {CBB_SEASON_LABEL} · {teams.length} D1 teams · {conferences.length} auto-bids · 36 at-large
            {latest ? ` · last saved ${latest.label}` : ""}
          </p>
        </div>
      </header>

      <nav className="tabs" aria-label="Basketball">
        <button type="button" className={tab === "bracketology" ? "active" : ""}>
          Bracketology
        </button>
      </nav>

      <BracketologyTab
        teams={teams}
        metrics={metrics}
        conferences={conferences}
        snapshots={store.snapshots}
        draft={store.draft}
        viewingId={store.viewingId}
        onStoreChange={patchStore}
      />
    </div>
  );
}
