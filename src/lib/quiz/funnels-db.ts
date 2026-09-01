import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/server";
import type { Funnel } from "./types";
import { getFunnel as getSeedFunnel } from "./registry";
import { funnelFromPreset, getPreset } from "./presets";

export interface FunnelSummary {
  slug: string;
  name: string;
  niche: string | null;
  palette_id: string;
  status: string;
  updated_at: string;
  domain?: string | null;
  /** Motor do funil (steps/layers/typebot) — badge informativo no card. */
  engine?: string | null;
}

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "funil";
}

/**
 * Persistência de funis no Supabase (tabela `funnels`). Usa o client admin
 * (service_role) — o construtor ainda não tem auth própria nesta fase.
 * Tudo com fallback pro seed em código, pra nunca quebrar offline.
 */

function configured(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL;
}

interface FunnelRow {
  slug: string;
  name: string;
  niche: string | null;
  logo: string | null;
  palette_id: string;
  steps: Funnel["steps"];
  font?: Funnel["font"] | null;
  music?: string | null;
  click_sound?: boolean | null;
  domain?: string | null;
  settings?: Funnel["settings"] | null;
  utmify_pixel_id?: string | null;
  hotmart_account_id?: string | null;
  hotmart_product_id?: string | null;
  checkout_url?: string | null;
  webhooks?: Funnel["webhooks"] | null;
}

function rowToFunnel(r: FunnelRow): Funnel {
  return {
    slug: r.slug, name: r.name, niche: r.niche ?? undefined,
    logo: r.logo ?? undefined, paletteId: r.palette_id, steps: r.steps,
    font: r.font ?? undefined,
    music: r.music ?? undefined,
    clickSound: r.click_sound ?? undefined,
    domain: r.domain ?? undefined,
    settings: r.settings ?? undefined,
    utmifyPixelId: r.utmify_pixel_id ?? undefined,
    hotmartAccountId: r.hotmart_account_id ?? undefined,
    hotmartProductId: r.hotmart_product_id ?? undefined,
    checkoutUrl: r.checkout_url ?? undefined,
    webhooks: r.webhooks ?? undefined,
  };
}

const FUNNEL_COLS =
  "slug,name,niche,logo,palette_id,steps,font,music,click_sound,domain,settings,utmify_pixel_id,hotmart_account_id,hotmart_product_id,checkout_url,webhooks";
/** Colunas garantidas pela migração 0009 (fallback enquanto 0010 não rodar). */
const BASE_COLS = "slug,name,niche,logo,palette_id,steps";

/** true se o erro for "coluna inexistente" (migração 0010 ainda não aplicada). */
function isMissingColumn(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === "42703" || err.code === "PGRST204" ||
    /column .* does not exist|could not find|schema cache/i.test(err.message ?? "");
}

/** Carrega do banco; se não existir lá, cai no seed em código.
 *  Memoizado por request (React cache) — generateMetadata e a página compartilham
 *  UMA query em vez de duas idas ao Supabase. */
export const resolveFunnel = cache(async (slug: string): Promise<Funnel | null> => {
  if (configured()) {
    try {
      const sb = createAdminClient();
      const { data, error } = await sb
        .from("funnels")
        .select(FUNNEL_COLS)
        .eq("slug", slug)
        .maybeSingle();
      if (isMissingColumn(error)) {
        // migração 0010 ainda não rodou — carrega só as colunas base.
        const { data: baseData } = await sb.from("funnels").select(BASE_COLS).eq("slug", slug).maybeSingle();
        if (baseData) return rowToFunnel(baseData as unknown as FunnelRow);
      }
      if (data) return rowToFunnel(data as unknown as FunnelRow);
    } catch {
      /* fallback abaixo */
    }
  }
  return getSeedFunnel(slug) ?? null;
});

/** Carrega o funil cujo DOMÍNIO próprio bate com o host (multi-domínio). */
export async function resolveFunnelByDomain(host: string): Promise<Funnel | null> {
  if (!configured() || !host) return null;
  const clean = host.toLowerCase().split(":")[0].replace(/^www\./, "");
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("funnels")
      .select(FUNNEL_COLS)
      .eq("domain", clean)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (isMissingColumn(error)) return null; // sem coluna domain → migração 0010 não rodou
    if (data) return rowToFunnel(data as unknown as FunnelRow);
  } catch {
    /* sem dados */
  }
  return null;
}

/** Salva (upsert) o funil no banco. `renameFrom` = slug antigo (apaga ao renomear). */
export async function saveFunnelDb(funnel: Funnel, renameFrom?: string): Promise<{ ok: boolean; error?: string }> {
  if (!configured()) return { ok: false, error: "Supabase não configurado (.env.local)" };
  try {
    const sb = createAdminClient();
    // renomeação: garante que o novo slug não colide com OUTRO funil
    if (renameFrom && renameFrom !== funnel.slug) {
      const { data: clash } = await sb.from("funnels").select("slug").eq("slug", funnel.slug).maybeSingle();
      if (clash) return { ok: false, error: `Já existe um funil com o slug "${funnel.slug}".` };
    }
    const base = {
      slug: funnel.slug,
      name: funnel.name,
      niche: funnel.niche ?? null,
      logo: funnel.logo ?? null,
      palette_id: funnel.paletteId,
      steps: funnel.steps,
      status: "published",
      updated_at: new Date().toISOString(),
    };
    const full = {
      ...base,
      font: funnel.font ?? null,
      music: funnel.music ?? null,
      click_sound: funnel.clickSound ?? false,
      domain: funnel.domain ?? null,
      settings: funnel.settings ?? {},
      utmify_pixel_id: funnel.utmifyPixelId ?? null,
      hotmart_account_id: funnel.hotmartAccountId ?? null,
      hotmart_product_id: funnel.hotmartProductId ?? null,
      checkout_url: funnel.checkoutUrl ?? null,
      webhooks: funnel.webhooks ?? [],
    };
    let { error } = await sb.from("funnels").upsert(full, { onConflict: "slug" });
    if (isMissingColumn(error)) {
      // migração 0010 ainda não rodou — salva só as colunas base (sem perder o funil).
      ({ error } = await sb.from("funnels").upsert(base, { onConflict: "slug" }));
    }
    if (error) return { ok: false, error: error.message };
    // renomeou: apaga a linha antiga (e migra as sessões/eventos pro novo slug)
    if (renameFrom && renameFrom !== funnel.slug) {
      await sb.from("funnels").delete().eq("slug", renameFrom);
      await Promise.allSettled([
        sb.from("funnel_sessions").update({ funnel_slug: funnel.slug }).eq("funnel_slug", renameFrom),
        sb.from("step_events").update({ funnel_slug: funnel.slug }).eq("funnel_slug", renameFrom),
        sb.from("quiz_answers").update({ funnel_slug: funnel.slug }).eq("funnel_slug", renameFrom),
        sb.from("funnel_leads").update({ funnel_slug: funnel.slug }).eq("funnel_slug", renameFrom),
      ]);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Lista todos os funis (para a aba Dashboard). */
export async function listFunnelsDb(): Promise<FunnelSummary[]> {
  if (!configured()) return [];
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("funnels")
      .select("slug,name,niche,palette_id,status,updated_at,domain,engine:settings->>engine")
      .order("updated_at", { ascending: false });
    return (data as unknown as FunnelSummary[]) ?? [];
  } catch {
    return [];
  }
}

/** Gera um slug único (sufixo numérico se já existir). */
async function uniqueSlug(base: string): Promise<string> {
  const sb = createAdminClient();
  let slug = slugify(base);
  for (let i = 0; i < 50; i++) {
    const { data } = await sb.from("funnels").select("slug").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    slug = `${slugify(base)}-${i + 2}`;
  }
  return `${slugify(base)}-${Date.now().toString(36)}`;
}

/** Cria um funil novo a partir de um preset. */
export async function createFunnelDb(name: string, presetId: string): Promise<{ ok: boolean; slug?: string; error?: string }> {
  if (!configured()) return { ok: false, error: "Supabase não configurado" };
  const preset = getPreset(presetId);
  if (!preset) return { ok: false, error: "Modelo inválido" };
  try {
    const slug = await uniqueSlug(name || preset.name);
    const funnel = funnelFromPreset(preset, name || preset.name, slug);
    const r = await saveFunnelDb(funnel);
    return r.ok ? { ok: true, slug } : { ok: false, error: r.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Duplica um funil existente. */
export async function duplicateFunnelDb(slug: string): Promise<{ ok: boolean; slug?: string; error?: string }> {
  const src = await resolveFunnel(slug);
  if (!src) return { ok: false, error: "Funil não encontrado" };
  try {
    const newSlug = await uniqueSlug(`${src.slug}-copia`);
    const r = await saveFunnelDb({ ...src, slug: newSlug, name: `${src.name} (cópia)` });
    return r.ok ? { ok: true, slug: newSlug } : { ok: false, error: r.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Exclui um funil. */
export async function deleteFunnelDb(slug: string): Promise<{ ok: boolean; error?: string }> {
  if (!configured()) return { ok: false, error: "Supabase não configurado" };
  try {
    const sb = createAdminClient();
    const { error } = await sb.from("funnels").delete().eq("slug", slug);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
