"use client";

import { createClient } from "@/lib/supabase/client";
import { getSessionId, collectTrackingParams } from "@/lib/tracking";

/**
 * Tracking do funil de quiz — espelha o modelo descoberto no Zenlya:
 *   funnel_sessions (1 linha/sessão, max_step_reached atualizado a cada avanço)
 *   step_events     (1 linha por etapa avançada → alimenta o funil do dashboard)
 *
 * Best-effort: se as tabelas/Supabase não existirem, falha em silêncio e NUNCA
 * quebra a página (igual lib/tracking.ts do vsl-platform).
 */

const ensured = new Set<string>();

/** session_id POR FUNIL: o mesmo navegador pode passar por vários funis; sem isso,
 *  a sessão (chaveada por session_id) se mistura entre funis e a análise por funil
 *  fica errada. Compomos session_id::funil pra cada funil ter sua própria sessão. */
function sid(funnelSlug: string): string {
  return `${getSessionId()}::${funnelSlug}`;
}

/** Garante a linha da sessão (1x por funil). */
async function ensureSession(funnelSlug: string): Promise<void> {
  if (ensured.has(funnelSlug)) return;
  ensured.add(funnelSlug);
  try {
    const supabase = createClient();
    const t = collectTrackingParams();
    await supabase.from("funnel_sessions").upsert(
      {
        session_id: sid(funnelSlug),
        funnel_slug: funnelSlug,
        max_step_reached: 0,
        utm_source: t.utm_source ?? null,
        utm_medium: t.utm_medium ?? null,
        utm_campaign: t.utm_campaign ?? null,
        utm_content: t.utm_content ?? null,
        utm_term: t.utm_term ?? null,
        src: t.src ?? null,
        ctwa_clid: t.ctwa_clid ?? null,
        source_id: t.source_id ?? null,
      },
      { onConflict: "session_id" },
    );
  } catch {
    /* best-effort */
  }
}

/** Registra o avanço para uma etapa (índice + tipo) e atualiza max_step. */
export async function trackStep(
  funnelSlug: string,
  stepIndex: number,
  stepId: string,
  stepType: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await ensureSession(funnelSlug);
    const supabase = createClient();
    const session_id = sid(funnelSlug);
    await supabase.from("step_events").insert({
      session_id,
      funnel_slug: funnelSlug,
      step_index: stepIndex,
      step_id: stepId,
      step_type: stepType,
      meta: meta ?? null,
    });
    await supabase
      .from("funnel_sessions")
      .update({ max_step_reached: stepIndex, last_seen_at: new Date().toISOString() })
      .eq("session_id", session_id)
      .lt("max_step_reached", stepIndex);
  } catch {
    /* best-effort */
  }
}

/** Registra uma resposta de pergunta (alimenta a aba Quiz do dashboard). */
export async function trackAnswer(
  funnelSlug: string,
  stepId: string,
  question: string,
  answer: string,
): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.from("quiz_answers").insert({
      session_id: sid(funnelSlug),
      funnel_slug: funnelSlug,
      step_id: stepId,
      question,
      answer,
    });
  } catch {
    /* best-effort */
  }
}
