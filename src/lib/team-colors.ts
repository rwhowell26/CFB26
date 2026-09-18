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

function pickFill(primary: string | null, secondary: string | null): string {
  return usableFill(secondary) ?? usableFill(primary) ?? FALLBACK_FILL;
}

/** ESPN's 500-dark marks are light-on-transparent; use them on dark discs. */
export function espnContrastLogo(href: string, fillHex: string): string {
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

export function logoAppearance(
  color?: string | null,
  alternateColor?: string | null,
  logoHref?: string | null,
): { src: string | null; style: LogoSwatch } {
  const style = logoSwatch(color, alternateColor);
  const src = logoHref ? espnContrastLogo(logoHref, style.backgroundColor) : null;
  return { src, style };
}
