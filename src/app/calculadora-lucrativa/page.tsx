import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Calculadora from "./Calculadora";

const nunito = localFont({ src: "../fonts/nunito-sans.woff2", weight: "400 800", variable: "--font-calc", display: "swap" });

export const metadata: Metadata = {
  title: "Calculadora de Lucro",
  description: "Calcule seus custos, valorize seu tempo e descubra quanto cobrar por cada peça artesanal.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "Calculadora", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#F8F3FA" };

// Página estática: o cálculo roda só no navegador, sem envio ou armazenamento de dados.
export default function CalculadoraLucrativaPage() {
  return (
    <div className={nunito.variable}>
      <Calculadora />
    </div>
  );
}
