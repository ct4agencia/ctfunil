import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsPanel from "@/components/admin/SettingsPanel";
import type { Vsl, Webhook } from "@/lib/types";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: vslData }, { data: webhookData }] = await Promise.all([
    supabase.from("vsls").select("*").eq("id", id).single(),
    supabase
      .from("webhooks")
      .select("*")
      .eq("vsl_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (!vslData) notFound();

  return (
    <SettingsPanel
      vsl={vslData as Vsl}
      webhooks={(webhookData ?? []) as Webhook[]}
    />
  );
}
