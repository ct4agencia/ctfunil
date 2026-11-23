import localFont from "next/font/local";

const inter = localFont({ src: "../../../app/fonts/inter.woff2", weight: "100 900", variable: "--funnel-font-inter", preload: false, display: "swap" });
const roboto = localFont({ src: "../../../app/fonts/roboto.woff2", weight: "100 900", variable: "--funnel-font-roboto", preload: false, display: "swap" });
const dmSans = localFont({ src: "../../../app/fonts/dm-sans-full.woff2", weight: "100 1000", variable: "--funnel-font-dm-sans", preload: false, display: "swap" });
const lora = localFont({ src: "../../../app/fonts/lora.woff2", weight: "400 700", variable: "--funnel-font-lora", preload: false, display: "swap" });
const playfair = localFont({ src: "../../../app/fonts/playfair-display.woff2", weight: "400 900", variable: "--funnel-font-playfair-display", preload: false, display: "swap" });
const fraunces = localFont({ src: "../../../app/fonts/fraunces-full.woff2", weight: "100 900", variable: "--funnel-font-fraunces", preload: false, display: "swap" });
const nunito = localFont({ src: "../../../app/fonts/nunito.woff2", weight: "200 1000", variable: "--funnel-font-nunito", preload: false, display: "swap" });
const poppins = localFont({
  src: [
    { path: "../../../../public/fonts/poppins-400.woff2", weight: "400" },
    { path: "../../../app/fonts/poppins-500.woff2", weight: "500" },
    { path: "../../../app/fonts/poppins-600.woff2", weight: "600" },
    { path: "../../../../public/fonts/poppins-700.woff2", weight: "700" },
    { path: "../../../../public/fonts/poppins-800.woff2", weight: "800" },
    { path: "../../../../public/fonts/poppins-900.woff2", weight: "900" },
  ],
  variable: "--funnel-font-poppins", preload: false, display: "swap",
});
const barlow = localFont({
  src: [
    { path: "../../../app/fonts/barlow-400.woff2", weight: "400" },
    { path: "../../../app/fonts/barlow-500.woff2", weight: "500" },
    { path: "../../../app/fonts/barlow-600.woff2", weight: "600" },
    { path: "../../../app/fonts/barlow-700.woff2", weight: "700" },
    { path: "../../../app/fonts/barlow-800.woff2", weight: "800" },
    { path: "../../../app/fonts/barlow-900.woff2", weight: "900" },
  ],
  variable: "--funnel-font-barlow", preload: false, display: "swap",
});

export const funnelFontClasses = [poppins, inter, roboto, dmSans, lora, playfair, fraunces, nunito, barlow].map(font => font.variable).join(" ");
