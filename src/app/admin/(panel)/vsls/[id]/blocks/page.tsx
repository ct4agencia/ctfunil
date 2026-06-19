import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BlockEditor from "@/components/admin/BlockEditor";
import type { Block, Vsl } from "@/lib/types";

export default async function BlocksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("vsls").select("*").eq("id", id).single();
  if (!data) notFound();
  const vsl = data as Vsl;

  return (
    <div>
      <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <strong>Blocos</strong> definem o <strong>layout visual</strong> da página
        (o que aparece e em que ordem). As configurações técnicas (vídeo,
        checkout, popup, pixels) ficam na aba <strong>Conteúdo</strong>. Arraste
        pelos 6 pontinhos (⠿) para reordenar. Sem blocos, a página usa o layout
        padrão da VSL.
      </div>
      <BlockEditor
        vslId={id}
        vsl={vsl}
        initial={(vsl.blocks ?? []) as Block[]}
      />
    </div>
  );
}
