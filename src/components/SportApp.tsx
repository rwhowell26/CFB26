"use client";

import { useCallback, useEffect, useState } from "react";
import { BasketballApp } from "@/components/BasketballApp";
import { RankingApp } from "@/components/RankingApp";
import { SportSwitcher } from "@/components/SportSwitcher";
import { SPORT_STORAGE_KEY, type SportId } from "@/lib/cbb-season";

function readSport(): SportId {
  if (typeof window === "undefined") return "cfb";
  return window.localStorage.getItem(SPORT_STORAGE_KEY) === "cbb" ? "cbb" : "cfb";
}

export function SportApp() {
  const [sport, setSport] = useState<SportId>("cfb");

  useEffect(() => {
    setSport(readSport());
  }, []);

  const changeSport = useCallback((next: SportId) => {
    setSport(next);
    window.localStorage.setItem(SPORT_STORAGE_KEY, next);
  }, []);

  return (
    <>
      <SportSwitcher sport={sport} onChange={changeSport} />
      {sport === "cbb" ? <BasketballApp /> : <RankingApp />}
    </>
  );
}
