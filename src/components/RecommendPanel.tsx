"use client";

import { useEffect, useMemo, useState } from "react";
import { TeamResume } from "@/components/TeamResume";
import { shortConferenceName } from "@/lib/conferences";
import { orderUnrankedCandidates, suggestedInsertIndex } from "@/lib/ranking-logic";
import type { PriorRank, PriorBallot } from "@/lib/storage";
import type { Game, Team } from "@/lib/types";

type Props = {
  teamsById: Map<string, Team>;
  unrankedIds: string[];
  rankedIds: string[];
  records: Map<string, { wins: number; losses: number }>;
  lastWeekBallot: PriorBallot | null;
  lastWeekRanks: Map<string, number>;
  search: string;
  selectedRankedId: string | null;
  games: Game[];
  currentRanks: Map<string, number>;
  priorRanks: Map<string, PriorRank>;
  resumeRanks: Map<string, number>;
  onClearRanked: () => void;
  onInsert: (teamId: string, index: number) => void;
};

function teamMatchesSearch(team: Team, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const confShort = shortConferenceName(team.conference).toLowerCase();
  return (
    team.name.toLowerCase().includes(q) ||
    team.shortName.toLowerCase().includes(q) ||
    team.abbreviation.toLowerCase().includes(q) ||
    team.conference.toLowerCase().includes(q) ||
    confShort.includes(q)
  );
}

export function RecommendPanel({
  teamsById,
  unrankedIds,
  rankedIds,
  records,
  lastWeekBallot,
  lastWeekRanks,
  search,
  selectedRankedId,
  games,
  currentRanks,
  priorRanks,
  resumeRanks,
  onClearRanked,
  onInsert,
}: Props) {
  const [skip, setSkip] = useState(0);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const candidates = useMemo(() => {
    const ordered = orderUnrankedCandidates(
      unrankedIds,
      records,
      lastWeekRanks,
      (id) => teamsById.get(id)?.name ?? id,
    );
    if (!search.trim()) return ordered;
    return ordered.filter((id) => {
      const team = teamsById.get(id);
      return team ? teamMatchesSearch(team, search) : false;
    });
  }, [unrankedIds, records, lastWeekRanks, teamsById, search]);

  useEffect(() => {
    setSkip(0);
    setPickedId(null);
  }, [candidates[0], search]);

  const recommendedId =
    pickedId && candidates.includes(pickedId)
      ? pickedId
      : candidates.length
        ? candidates[skip % candidates.length]
        : null;
  const recommended = recommendedId ? teamsById.get(recommendedId) : null;
  const selectedRanked = selectedRankedId ? teamsById.get(selectedRankedId) : null;
  const record = recommended
    ? records.get(recommended.id) ?? { wins: 0, losses: 0 }
    : null;
  const lastWeekRank = recommended ? lastWeekRanks.get(recommended.id) : undefined;
  const suggestedIndex = recommended
    ? suggestedInsertIndex(rankedIds, recommended.id, records, lastWeekRanks)
    : 0;
  const selectedIndex = selectedRankedId ? rankedIds.indexOf(selectedRankedId) : -1;

  const placeAt = (index: number) => {
    if (!recommended) return;
    onInsert(recommended.id, index);
    setSkip(0);
    setPickedId(null);
  };

  if (!unrankedIds.length) {
    return (
      <aside className="recommend-panel">
        <section className="panel">
          <header className="panel-header">
            <p className="eyebrow">Recommended next</p>
            <h2>Ballot complete</h2>
            <p>All 138 teams are ranked. Select a placed team to review its resume.</p>
          </header>
        </section>
        {selectedRanked ? (
          <TeamResume
            team={selectedRanked}
            games={games}
            currentRanks={currentRanks}
            priorRanks={priorRanks}
            resumeRanks={resumeRanks}
            roleLabel="Selected on ballot"
            onClose={onClearRanked}
          />
        ) : null}
      </aside>
    );
  }

  return (
    <aside className="recommend-panel">
      <section className="panel">
        <header className="panel-header">
          <p className="eyebrow">Recommended next</p>
          <h2>{recommended ? recommended.shortName : "No match"}</h2>
          {recommended && record ? (
            <p>
              {record.wins}-{record.losses}
              {lastWeekRank != null
                ? ` · ${lastWeekBallot?.label ?? "Last week"} #${lastWeekRank}`
                : lastWeekBallot
                  ? ` · not on ${lastWeekBallot.label}`
                  : " · no prior ballot"}
              {" · "}
              suggested #{suggestedIndex + 1}
            </p>
          ) : (
            <p>Search doesn’t match any remaining teams.</p>
          )}
        </header>

        {recommended ? (
          <div className="recommend-actions">
            <button type="button" className="primary-btn" onClick={() => placeAt(suggestedIndex)}>
              Place at #{suggestedIndex + 1}
            </button>
            <button
              type="button"
              className="ghost-btn"
              disabled={selectedIndex < 0}
              onClick={() => placeAt(selectedIndex)}
            >
              Insert above selected
            </button>
            <button
              type="button"
              className="ghost-btn"
              disabled={selectedIndex < 0}
              onClick={() => placeAt(selectedIndex + 1)}
            >
              Insert below selected
            </button>
            <button
              type="button"
              className="ghost-btn"
              disabled={candidates.length < 2}
              onClick={() => {
                setPickedId(null);
                setSkip((n) => n + 1);
              }}
            >
              Skip
            </button>
          </div>
        ) : null}

        {candidates.length > 1 ? (
          <label className="block-label recommend-pick">
            Or pick another remaining team
            <select
              value={recommendedId ?? ""}
              onChange={(e) => {
                setPickedId(e.target.value);
                const idx = candidates.indexOf(e.target.value);
                if (idx >= 0) setSkip(idx);
              }}
            >
              {candidates.map((id) => {
                const team = teamsById.get(id);
                if (!team) return null;
                const rec = records.get(id) ?? { wins: 0, losses: 0 };
                const prior = lastWeekRanks.get(id);
                return (
                  <option key={id} value={id}>
                    {team.shortName} · {rec.wins}-{rec.losses}
                    {prior != null ? ` · LW #${prior}` : ""}
                  </option>
                );
              })}
            </select>
          </label>
        ) : null}
      </section>

      <div className="recommend-resumes">
        {recommended ? (
          <TeamResume
            team={recommended}
            games={games}
            currentRanks={currentRanks}
            priorRanks={priorRanks}
            resumeRanks={resumeRanks}
            roleLabel="Recommended · not yet ranked"
          />
        ) : (
          <section className="resume-compact">
            <p className="rc-sub">No remaining teams match your search.</p>
          </section>
        )}

        {selectedRanked ? (
          <TeamResume
            team={selectedRanked}
            games={games}
            currentRanks={currentRanks}
            priorRanks={priorRanks}
            resumeRanks={resumeRanks}
            roleLabel="Selected on ballot"
            onClose={onClearRanked}
          />
        ) : (
          <section className="resume-compact">
            <header className="rc-header">
              <div>
                <p className="eyebrow">Selected on ballot</p>
                <h3 className="rc-id">Click a ranked team</h3>
              </div>
            </header>
          </section>
        )}
      </div>
    </aside>
  );
}
