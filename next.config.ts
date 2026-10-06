import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Fixa a raiz do projeto (havia outro package-lock.json no diretório home,
  // o que fazia o Turbopack inferir a raiz errada).
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
