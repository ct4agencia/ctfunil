import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {};
}

/**
 * Raiz multi-domínio do CTFUNNEL.
 *  - host = domínio próprio (ex: viverdebolsas.com.br) → a RAIZ NÃO serve
 *    funil nenhum (404). Cada funil vive num slug: {domínio}/{slug}. Assim a
 *    raiz nua não dispara pixel/lead de funil nenhum (decisão do Luca).
 *  - domínio da plataforma / *.vercel.app / localhost → vai pro painel.
 */
export default async function Home() {
  const h = await headers();
  const host = (h.get("host") || "").toLowerCase().split(":")[0].replace(/^www\./, "");

  const isPlatform =
    host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app") || !host;

  // Domínio próprio na raiz → aponta pra ninguém.
  if (!isPlatform) notFound();

  // Plataforma → painel.
  redirect("/dashboard");
}
