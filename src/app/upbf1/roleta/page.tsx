import type { Metadata } from "next";
import { connection } from "next/server";
import BlackFriday from "../BlackFriday";

export const metadata: Metadata = { title: "Roleta do presente — Black Friday da Sônia" };

const message = "Sônia, tirei o GUIA COMPLETO + 80% OFF 🔥 e quero desbloquear o meu presente!!!";

function getRedirectUrl() {
  const input = process.env.UPBF1_REDIRECT_URL || "https://app.goredirect.com.br/fd61/bf-01";
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password) return;
    if ((url.hostname === "wa.me" || url.hostname === "api.whatsapp.com") && !url.searchParams.has("text")) {
      url.searchParams.set("text", message);
    }
    return url.href;
  } catch {}
}

export default async function RoulettePage() {
  await connection();
  return <BlackFriday roulette redirectUrl={getRedirectUrl()} />;
}
