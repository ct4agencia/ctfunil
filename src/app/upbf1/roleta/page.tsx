import type { Metadata } from "next";
import { connection } from "next/server";
import { getUpbf1RedirectUrl, readUpbf1RouletteSettings } from "@/lib/upbf1-roleta";
import BlackFriday from "../BlackFriday";

export const metadata: Metadata = { title: "Roleta do presente — Black Friday da Sônia" };

export default async function RoulettePage() {
  await connection();
  const redirectUrl = getUpbf1RedirectUrl();
  // Redirecionamento automático, ligado e desligado em Configurações do painel.
  const settings = redirectUrl ? await readUpbf1RouletteSettings() : undefined;
  return <BlackFriday roulette redirectUrl={redirectUrl}
    autoRedirectSeconds={settings?.autoRedirect ? settings.seconds : undefined} />;
}
