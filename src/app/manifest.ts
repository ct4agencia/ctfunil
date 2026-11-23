import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/calculadora-lucrativa",
    name: "Calculadora de Lucro",
    short_name: "Calculadora",
    description: "Calcule custos e descubra quanto cobrar por cada peça artesanal.",
    start_url: "/calculadora-lucrativa",
    scope: "/calculadora-lucrativa",
    display: "standalone",
    background_color: "#F8F3FA",
    theme_color: "#F8F3FA",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
