import type { Metadata } from "next";
import { connection } from "next/server";
import { getUpbf1RedirectUrl, readUpbf1AutoRedirectSeconds } from "@/lib/upbf1-roleta";
import BlackFriday from "../BlackFriday";

export const metadata: Metadata = { title: "Roleta do presente — Black Friday da Sônia" };

export default async function RoulettePage() {
  await connection();
  const redirectUrl = getUpbf1RedirectUrl();
  // Redirecionamento automático: ligado no construtor, na roleta do funil upbf1.
  const autoRedirectSeconds = redirectUrl ? await readUpbf1AutoRedirectSeconds() : undefined;
  return <BlackFriday roulette redirectUrl={redirectUrl} autoRedirectSeconds={autoRedirectSeconds} />;
}
