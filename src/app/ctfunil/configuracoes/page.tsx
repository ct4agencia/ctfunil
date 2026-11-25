import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/quiz/admin-guard";
import { getUpbf1RedirectUrl, readUpbf1RouletteState } from "@/lib/upbf1-roleta";
import SettingsWorkspace from "./SettingsWorkspace";

export const metadata: Metadata = { title: "Configurações · CTFunil" };

export default async function SettingsPage({ searchParams }: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const section = tab === "assistente" || tab === "importacao" ? tab : "geral";
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/admin/login?next=" + encodeURIComponent("/ctfunil/configuracoes?tab=" + section));
  // A roleta do /upbf1 só aparece na aba Geral: as outras não consultam o banco.
  const upbf1 = section === "geral" ? await readUpbf1RouletteState() : undefined;
  return <SettingsWorkspace section={section} accountEmail={auth.user.email}
    upbf1={upbf1 && { initial: upbf1.settings, status: upbf1.status, destination: getUpbf1RedirectUrl() }} />;
}
