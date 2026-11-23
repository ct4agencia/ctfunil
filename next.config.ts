import type { NextConfig } from "next";
import path from "node:path";

const previewHost = process.env.CTFUNIL_PREVIEW_HOST;

const compiledPreview = process.env.CTFUNIL_COMPILED_PREVIEW === "1";

const nextConfig: NextConfig = {
  ...(previewHost ? {
    allowedDevOrigins: [previewHost.split(":")[0]],
    devIndicators: false,
    onDemandEntries: { maxInactiveAge: 15_000, pagesBufferLength: 1 },
  } : {}),
  ...(compiledPreview ? {
    distDir: process.env.CTFUNIL_PREVIEW_DIST || ".next-preview",
    experimental: { cpus: 1, webpackMemoryOptimizations: true },
  } : {}),
  // Fixa a raiz do projeto (havia outro package-lock.json no diretório home,
  // o que fazia o Turbopack inferir a raiz errada).
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
