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

export function relativeLuminance(hex: string): number {
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
/** Skip a tint that would disappear into the disc. */
const MIN_MARK_CONTRAST = 3;

/** Zoom ESPN marks that sit tiny inside their 500px canvas. */
const LOGO_SCALE: Record<string, number> = {
  "2110": 2.35, // Central Arkansas bear
};

/** Scale origin so a cropped mark stays centered in the disc. */
const LOGO_ORIGIN: Record<string, string> = {
  "2110": "center 62%", // Central Arkansas bear sits low on the ESPN canvas
};

/** Keep the default colored ESPN mark instead of the 500-dark (white) variant. */
const LOGO_FORCE_COLOR = new Set(["197"]); // Oklahoma State orange

/** Tint the 500-dark (white) silhouette to a brand color, when it still contrasts. */
const LOGO_TINT: Record<string, string> = {
  "277": "#002855", // West Virginia navy on gold
  "344": "#ffffff", // Mississippi State white script
  "2649": "#0b2240", // Toledo blue wording
  "2426": "#00225b", // Navy navy mark
  "183": "#000e54", // Syracuse blue S
};

function pickFill(primary: string | null, secondary: string | null): string {
  return usableFill(primary) ?? usableFill(secondary) ?? FALLBACK_FILL;
}

function tintForFill(teamId: string | null | undefined, fillHex: string): string | null {
  if (!teamId) return null;
  const tint = LOGO_TINT[teamId];
  if (!tint) return null;
  return contrastRatio(tint, fillHex) >= MIN_MARK_CONTRAST ? tint : null;
}

export function logoScale(teamId?: string | null): number {
  if (!teamId) return 1;
  return LOGO_SCALE[teamId] ?? 1;
}

export function logoOrigin(teamId?: string | null): string {
  if (!teamId) return "center";
  return LOGO_ORIGIN[teamId] ?? "center";
}

/** Brand color for chart lines: primary, then secondary, skipping white. */
export function teamChartColor(
  color?: string | null,
  alternateColor?: string | null,
): string {
  return usableFill(normalizeHex(color)) ?? usableFill(normalizeHex(alternateColor)) ?? FALLBACK_FILL;
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
  const backgroundColor = pickFill(primary, secondary);
  const darkFill = relativeLuminance(backgroundColor) < DARK_FILL;
  const ring = darkFill ? "rgba(255, 255, 255, 0.28)" : "rgba(20, 32, 26, 0.22)";
  return {
    backgroundColor,
    boxShadow: `inset 0 0 0 1px ${ring}`,
  };
}

/** Full-row fill using the same brand color as the logo disc. */
export function teamFillColors(
  color?: string | null,
  alternateColor?: string | null,
  teamId?: string | null,
): { backgroundColor: string; color: string } {
  const backgroundColor = logoSwatch(color, alternateColor, teamId).backgroundColor;
  const light = "#f8fafc";
  const dark = "#0f172a";
  return {
    backgroundColor,
    color: contrastRatio(backgroundColor, light) >= contrastRatio(backgroundColor, dark) ? light : dark,
  };
}

export function logoAppearance(
  color?: string | null,
  alternateColor?: string | null,
  logoHref?: string | null,
  teamId?: string | null,
): { src: string | null; style: LogoSwatch; markColor: string | null } {
  const style = logoSwatch(color, alternateColor, teamId);
  const markColor = tintForFill(teamId, style.backgroundColor);
  const src = logoHref
    ? markColor
      ? lightLogoHref(logoHref)
      : espnContrastLogo(logoHref, style.backgroundColor, teamId)
    : null;
  return { src, style, markColor };
}

function contrastRatio(left: string, right: string): number {
  const a = relativeLuminance(left);
  const b = relativeLuminance(right);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

function darkenHex(hex: string, amount: number): string {
  const { r, g, b } = rgb(hex);
  const factor = Math.max(0, 1 - amount);
  const to = (channel: number) =>
    Math.round(channel * factor)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Primary fill + secondary text, darkened until the type stays readable. */
export function compareColumnColors(
  color?: string | null,
  alternateColor?: string | null,
): { background: string; color: string } {
  const primary = normalizeHex(color);
  const secondary = normalizeHex(alternateColor);
  let background = primary ?? secondary ?? FALLBACK_FILL;
  while (relativeLuminance(background) > 0.28) {
    background = darkenHex(background, 0.14);
  }
  let text = secondary && secondary.toLowerCase() !== background.toLowerCase() ? secondary : "#f8fafc";
  if (contrastRatio(background, text) < 4.5) {
    text = relativeLuminance(background) < 0.45 ? "#f8fafc" : "#0f172a";
  }
  return { background, color: text };
}

export function logoOnFill(
  logoHref?: string | null,
  teamId?: string | null,
  fillHex?: string | null,
): { src: string | null; markColor: string | null } {
  const fill = fillHex ?? FALLBACK_FILL;
  const markColor = tintForFill(teamId, fill);
  const src = logoHref
    ? markColor
      ? lightLogoHref(logoHref)
      : espnContrastLogo(logoHref, fill, teamId)
    : null;
  return { src, markColor };
}
