import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/quiz/admin-guard";
import SettingsWorkspace from "./SettingsWorkspace";

export const metadata: Metadata = { title: "Configurações · CTFunil" };

export default async function SettingsPage({ searchParams }: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const section = tab === "assistente" || tab === "importacao" ? tab : "geral";
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/admin/login?next=" + encodeURIComponent("/ctfunil/configuracoes?tab=" + section));
  return <SettingsWorkspace key={section} section={section} />;
}
