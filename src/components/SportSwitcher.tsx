"use client";

import type { SportId } from "@/lib/cbb-season";

type Props = {
  sport: SportId;
  onChange: (sport: SportId) => void;
};

export function SportSwitcher({ sport, onChange }: Props) {
  return (
    <div className="sport-bar">
      <div className={`sport-slider sport-${sport}`} role="tablist" aria-label="Sport">
        <span className="sport-slider-pill" aria-hidden />
        <button
          type="button"
          role="tab"
          aria-selected={sport === "cfb"}
          className={sport === "cfb" ? "active" : ""}
          onClick={() => onChange("cfb")}
        >
          CFB
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={sport === "cbb"}
          className={sport === "cbb" ? "active" : ""}
          onClick={() => onChange("cbb")}
        >
          College Basketball
        </button>
      </div>
    </div>
  );
}
