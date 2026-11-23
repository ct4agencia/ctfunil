import type { Metadata } from "next";
import { connection } from "next/server";
import BlackFriday from "../BlackFriday";

export const metadata: Metadata = { title: "Roleta de benefício — Black Friday da Sônia" };

export default async function RoulettePage() {
  await connection();
  const number = process.env.UPBF1_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? "";
  return <BlackFriday roulette whatsappNumber={/^55[1-9]\d{9,10}$/.test(number) ? number : undefined} />;
}
