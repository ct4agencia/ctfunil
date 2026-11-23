import type { CSSProperties } from "react";
import type { InleadDesign } from "./types";

export const FUNNEL_FONTS = ["Arial", "Poppins", "Inter", "Roboto", "DM Sans", "Lora", "Playfair Display", "Fraunces", "Nunito", "Barlow"] as const;
const serifFonts = new Set(["Lora", "Playfair Display", "Fraunces"]);

export function fontFamily(value?: string): string | undefined {
  const font = FUNNEL_FONTS.find(font => font.toLowerCase() === value?.toLowerCase());
  if (font === "Arial") return "Arial, Helvetica, sans-serif";
  return font ? `var(--funnel-font-${font.toLowerCase().replaceAll(" ", "-")}), ${serifFonts.has(font) ? "Georgia, serif" : "Arial, sans-serif"}` : undefined;
}

export function designNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = value === "" || value == null ? NaN : Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

export function typographyStyles(design: InleadDesign): CSSProperties {
  return {
    fontFamily: fontFamily(design.contentFont),
    "--funnel-title-font": fontFamily(design.featuredFont),
    "--funnel-title-color": design.titleColor,
    "--funnel-title-size": design.titleSize == null ? undefined : `${designNumber(design.titleSize, 32, 12, 96)}px`,
    "--funnel-title-weight": design.titleWeight == null ? undefined : designNumber(design.titleWeight, 700, 400, 900),
    "--funnel-title-line": design.titleLineHeight == null ? undefined : designNumber(design.titleLineHeight, 1.15, 1, 2.5),
    "--funnel-content-weight": design.contentWeight == null ? undefined : designNumber(design.contentWeight, 400, 400, 900),
    "--funnel-content-line": design.contentLineHeight == null ? undefined : designNumber(design.contentLineHeight, 1.45, 1, 2.5),
  } as CSSProperties;
}
