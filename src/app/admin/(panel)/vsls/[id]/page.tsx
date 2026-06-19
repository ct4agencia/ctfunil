import { notFound } from "next/navigation";
import VslForm from "@/components/admin/VslForm";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VSL, type Vsl, type VslInput } from "@/lib/types";

export default async function EditVslPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("vsls")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) notFound();

  const vsl = data as Vsl;

  // Remove campos gerenciados pelo banco; mantém só os editáveis.
  const initial: VslInput = {
    ...DEFAULT_VSL,
    slug: vsl.slug,
    name: vsl.name,
    niche: vsl.niche,
    status: vsl.status,
    domain: vsl.domain,
    checkout_url: vsl.checkout_url,
    hotmart_product_id: vsl.hotmart_product_id,
    hotmart_src: vsl.hotmart_src,
    vturb_player_id: vsl.vturb_player_id,
    vturb_account_id: vsl.vturb_account_id,
    pitch_reveal_at: vsl.pitch_reveal_at,
    vagas_reveal_at: vsl.vagas_reveal_at,
    vagas_inicial: vsl.vagas_inicial,
    vagas_limite: vsl.vagas_limite,
    vagas_total: vsl.vagas_total,
    primary_color: vsl.primary_color,
    cta_keep_green: vsl.cta_keep_green,
    content: vsl.content ?? {},
    img_garantia: vsl.img_garantia,
    img_pagamentos: vsl.img_pagamentos,
    img_selo: vsl.img_selo,
    utmify_pixel_id: vsl.utmify_pixel_id,
    hotmart_account_id: vsl.hotmart_account_id,
  };

  return <VslForm initial={initial} vslId={vsl.id} />;
}
