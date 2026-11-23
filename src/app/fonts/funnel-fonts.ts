import localFont from "next/font/local";

export const display = localFont({
  src: "./fraunces.woff2", weight: "600 900", variable: "--font-display", display: "swap", preload: false,
});

export const sans = localFont({
  src: "./jakarta.woff2", weight: "200 800", variable: "--font-sans-q", display: "swap", preload: false,
});

export const poppins = localFont({
  src: [
    { path: "../../../public/fonts/poppins-400.woff2", weight: "400" },
    { path: "./poppins-600.woff2", weight: "600" },
    { path: "../../../public/fonts/poppins-700.woff2", weight: "700" },
    { path: "../../../public/fonts/poppins-800.woff2", weight: "800" },
    { path: "../../../public/fonts/poppins-900.woff2", weight: "900" },
  ],
  variable: "--font-poppins", display: "swap", preload: false,
});
