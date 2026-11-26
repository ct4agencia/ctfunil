import type { ReactNode } from "react";
import localFont from "next/font/local";

const display = localFont({ src: "../fonts/playfair-display.woff2", weight: "700 800", variable: "--upbf1-display", display: "swap" });
const sans = localFont({ src: "../fonts/nunito.woff2", weight: "400 800", variable: "--upbf1-sans", display: "swap" });

export default function CampaignLayout({ children }: { children: ReactNode }) {
  return <div className={`${display.variable} ${sans.variable}`}>{children}</div>;
}
