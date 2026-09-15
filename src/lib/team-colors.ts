/** ESPN stores colors as 3- or 6-digit hex without '#'. */
export function normalizeHex(value?: string | null): string | null {
  if (!value) return null;
  const hex = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}$/.test(hex) && !/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  return `#${full.toLowerCase()}`;
}

function relativeLuminance(hex: string): number {
  const raw = hex.replace("#", "");
  const toLin = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = toLin(parseInt(raw.slice(0, 2), 16));
  const g = toLin(parseInt(raw.slice(2, 4), 16));
  const b = toLin(parseInt(raw.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export type LogoSwatch = {
  backgroundColor: string;
  boxShadow: string;
};

/** Secondary (alternate) color behind the logo; primary if secondary is missing. */
export function logoSwatch(
  color?: string | null,
  alternateColor?: string | null,
): LogoSwatch | undefined {
  const secondary = normalizeHex(alternateColor);
  const primary = normalizeHex(color);
  const backgroundColor = secondary ?? primary;
  if (!backgroundColor) return undefined;

  const lightDisc = relativeLuminance(backgroundColor) > 0.72;
  const ring =
    lightDisc && primary && relativeLuminance(primary) < 0.55
      ? primary
      : lightDisc
        ? "rgba(20, 32, 26, 0.28)"
        : "rgba(255, 255, 255, 0.28)";

  return {
    backgroundColor,
    boxShadow: `inset 0 0 0 1px ${ring}`,
  };
}
