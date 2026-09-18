/** ESPN stores colors as 3- or 6-digit hex without '#'. */
export function normalizeHex(value?: string | null): string | null {
  if (!value) return null;
  const hex = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}$/.test(hex) && !/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  return `#${full.toLowerCase()}`;
}

function rgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace("#", "");
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function relativeLuminance(hex: string): number {
  const toLin = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const { r, g, b } = rgb(hex);
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

/** True for white / off-white / pale gray — not gold, maize, or other light brand colors. */
export function isWhiteOrNearWhite(hex: string): boolean {
  const { r, g, b } = rgb(hex);
  if (r >= 245 && g >= 245 && b >= 245) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  return relativeLuminance(hex) > 0.88 && sat < 0.12;
}

function usableFill(hex: string | null): string | null {
  if (!hex || isWhiteOrNearWhite(hex)) return null;
  return hex;
}

const FALLBACK_FILL = "#1e293b";
const DARK_FILL = 0.38;

/** Disc fills keyed by ESPN team id (overrides secondary-first default). */
const FILL_OVERRIDES: Record<string, string> = {
  "145": "#13294b", // Ole Miss navy
  "87": "#062340", // Notre Dame navy
  "258": "#232d4b", // Virginia navy
  "259": "#6a2c3e", // Virginia Tech maroon
  "167": "#ba0c2f", // New Mexico red
  "2": "#002b5c", // Auburn navy
  "235": "#004991", // Memphis blue
  "344": "#5d1725", // Mississippi State maroon
  "153": "#7bafd4", // North Carolina carolina blue
  "256": "#450084", // James Madison purple
  "66": "#ae192d", // Iowa State red
  "2305": "#0051ba", // Kansas blue
  "309": "#ce181e", // Louisiana red
};

/** Keep the default colored ESPN mark instead of the 500-dark (white) variant. */
const LOGO_FORCE_COLOR = new Set(["197"]); // Oklahoma State orange

/** Tint the 500-dark (white) silhouette; ESPN has no yellow West Virginia 500 mark. */
const LOGO_TINT: Record<string, string> = {
  "277": "#eaaa00", // West Virginia gold
};

function pickFill(primary: string | null, secondary: string | null, teamId?: string | null): string {
  if (teamId && FILL_OVERRIDES[teamId]) return FILL_OVERRIDES[teamId];
  return usableFill(secondary) ?? usableFill(primary) ?? FALLBACK_FILL;
}

function colorLogoHref(href: string): string {
  if (href.includes("/ncaa/500-dark/")) return href.replace("/ncaa/500-dark/", "/ncaa/500/");
  return href;
}

function lightLogoHref(href: string): string {
  if (href.includes("/ncaa/500-dark/")) return href;
  if (href.includes("/ncaa/500/")) return href.replace("/ncaa/500/", "/ncaa/500-dark/");
  return href;
}

/** ESPN's 500-dark marks are light-on-transparent; use them on dark discs. */
export function espnContrastLogo(
  href: string,
  fillHex: string,
  teamId?: string | null,
): string {
  if (teamId && LOGO_FORCE_COLOR.has(teamId)) return colorLogoHref(href);
  const darkFill = relativeLuminance(fillHex) < DARK_FILL;
  if (!darkFill) return href;
  if (href.includes("/ncaa/500-dark/")) return href;
  if (href.includes("/ncaa/500/")) return href.replace("/ncaa/500/", "/ncaa/500-dark/");
  return href;
}

export type LogoSwatch = {
  backgroundColor: string;
  boxShadow: string;
};

export function logoSwatch(
  color?: string | null,
  alternateColor?: string | null,
  teamId?: string | null,
): LogoSwatch {
  const primary = normalizeHex(color);
  const secondary = normalizeHex(alternateColor);
  const backgroundColor = pickFill(primary, secondary, teamId);
  const darkFill = relativeLuminance(backgroundColor) < DARK_FILL;
  const ring = darkFill ? "rgba(255, 255, 255, 0.28)" : "rgba(20, 32, 26, 0.22)";
  return {
    backgroundColor,
    boxShadow: `inset 0 0 0 1px ${ring}`,
  };
}

export function logoAppearance(
  color?: string | null,
  alternateColor?: string | null,
  logoHref?: string | null,
  teamId?: string | null,
): { src: string | null; style: LogoSwatch; markColor: string | null } {
  const style = logoSwatch(color, alternateColor, teamId);
  const markColor = teamId ? LOGO_TINT[teamId] ?? null : null;
  const src = logoHref
    ? markColor
      ? lightLogoHref(logoHref)
      : espnContrastLogo(logoHref, style.backgroundColor, teamId)
    : null;
  return { src, style, markColor };
}
