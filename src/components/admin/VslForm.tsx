"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateVsl, deleteVsl } from "@/app/admin/actions";
import { type VslInput } from "@/lib/types";

// ── Campos reutilizáveis ──────────────────────────────────────
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-sky-500";

function InfoIcon({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-400"
    >
      i
    </span>
  );
}

function Section({
  title,
  info,
  children,
}: {
  title: string;
  info?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
        {title}
        {info && <InfoIcon text={info} />}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export default function VslForm({
  initial,
  vslId,
}: {
  initial: VslInput;
  vslId: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<VslInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof VslInput>(key: K, value: VslInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Conteúdo = configuração da página (motor). Texto, imagem, vagas, popup
    // e copy agora são editados na aba Blocos.
    const patch: Partial<VslInput> = {
      checkout_url: form.checkout_url,
      hotmart_product_id: form.hotmart_product_id,
      vturb_player_id: form.vturb_player_id,
      vturb_account_id: form.vturb_account_id,
      primary_color: form.primary_color,
      cta_keep_green: form.cta_keep_green,
    };

    startTransition(async () => {
      const res = await updateVsl(vslId, patch);
      if (res?.error) setError(res.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!vslId) return;
    if (!confirm("Excluir esta VSL? Esta ação não pode ser desfeita.")) return;
    startTransition(() => deleteVsl(vslId));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <strong>Conteúdo</strong> = configuração da página (o &quot;motor&quot;:
        checkout, player, tempos, paleta, tracking). O que aparece na página
        (texto, imagem, vídeo, vagas, captura, copy) você monta na aba{" "}
        <strong>Blocos</strong>.
      </div>

      <Section
        title="Hotmart (checkout)"
        info="Cole o link de pagamento da Hotmart (Compartilhar link de pagamento). O botão CTA usa esse link e a gente acrescenta os UTMs + session_id automaticamente."
      >
        <div className="sm:col-span-2">
          <Field
            label="Link do checkout (Hotmart)"
            hint="Cole o link completo, ex: https://pay.hotmart.com/B105492064D?off=xxxx — é o que o botão de compra usa."
          >
            <input
              className={inputCls}
              placeholder="https://pay.hotmart.com/..."
              value={form.checkout_url ?? ""}
              onChange={(e) => set("checkout_url", e.target.value || null)}
            />
          </Field>
        </div>
        <Field
          label="Product ID (opcional)"
          hint="Código Bxxxx — só pro relatório/CRM. Vazio = extraído do link."
        >
          <input
            className={inputCls}
            placeholder="B105492064D"
            value={form.hotmart_product_id ?? ""}
            onChange={(e) => set("hotmart_product_id", e.target.value || null)}
          />
        </Field>
        {!form.checkout_url && (
          <div className="sm:col-span-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            ⚠️ Sem link de checkout, os botões de compra (CTA) não levam a lugar
            nenhum. Cole o link da Hotmart pra ativar.
          </div>
        )}
      </Section>

      <Section
        title="VTurb (player)"
        info="IDs do player de vídeo VTurb (Converte AI). Player ID e Account ID aparecem na URL embed do player. Usados pelo bloco de Vídeo."
      >
        <Field label="Player ID">
          <input
            className={inputCls}
            value={form.vturb_player_id ?? ""}
            onChange={(e) => set("vturb_player_id", e.target.value || null)}
          />
        </Field>
        <Field label="Account ID">
          <input
            className={inputCls}
            value={form.vturb_account_id ?? ""}
            onChange={(e) => set("vturb_account_id", e.target.value || null)}
          />
        </Field>
      </Section>

      <Section
        title="Paleta"
        info="Cor primária da marca — a página deriva a paleta dela (fundo, bordas, títulos dos blocos). 'Botão verde' é o padrão dos CTAs gerados."
      >
        <Field label="Cor primária da marca">
          <div className="flex items-center gap-3">
            <input
              type="color"
              className="h-10 w-14 cursor-pointer rounded border border-slate-300"
              value={form.primary_color}
              onChange={(e) => set("primary_color", e.target.value)}
            />
            <input
              className={inputCls}
              value={form.primary_color}
              onChange={(e) => set("primary_color", e.target.value)}
            />
          </div>
        </Field>
        <Field label="Botão CTA verde" hint="Recomendado manter verde (converte).">
          <label className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              checked={form.cta_keep_green}
              onChange={(e) => set("cta_keep_green", e.target.checked)}
            />
            <span className="text-sm text-slate-700">Manter o botão verde</span>
          </label>
        </Field>
      </Section>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Salvo com sucesso.
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-sky-600 px-5 py-2.5 font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
          >
            {pending ? "Salvando..." : "Salvar alterações"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Voltar
          </button>
        </div>

        {vslId && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded-lg border border-red-300 px-5 py-2.5 font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            Excluir
          </button>
        )}
      </div>
    </form>
  );
}
