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

// Promise em cache por funil: garante 1 upsert só, mas sem marcar como "feito"
// antes do await (o Set marcava antes e, se o upsert falhasse, não havia retry
// e um upsert atrasado podia aterrissar DEPOIS do update, travando a sessão).
const ensured = new Map<string, Promise<void>>();

/** session_id POR FUNIL: o mesmo navegador pode passar por vários funis; sem isso,
 *  a sessão (chaveada por session_id) se mistura entre funis e a análise por funil
 *  fica errada. Compomos session_id::funil pra cada funil ter sua própria sessão. */
function sid(funnelSlug: string): string {
  return `${getSessionId()}::${funnelSlug}`;
}

/** Garante a linha da sessão (1x por funil). */
function ensureSession(funnelSlug: string): Promise<void> {
  const cached = ensured.get(funnelSlug);
  if (cached) return cached;

  const run = (async () => {
    try {
      const supabase = createClient();
      const t = collectTrackingParams();
      const row: Record<string, unknown> = {
        session_id: sid(funnelSlug),
        funnel_slug: funnelSlug,
      };
      // NUNCA mandar max_step_reached aqui: o upsert vira UPDATE no conflito e
      // zerava o progresso a cada F5/retorno (lead que chegou na última lâmina
      // voltava pra 0 e sumia do funil). A coluna já tem DEFAULT 0 no insert.
      // UTM só quando tem valor — sobrescrever com null apagava a atribuição de
      // 1º toque que o VisitBeacon já tinha gravado certo.
      for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "src", "ctwa_clid", "source_id"] as const) {
        if (t[k]) row[k] = t[k];
      }
      await supabase.from("funnel_sessions").upsert(row, { onConflict: "session_id" });

      // Hidratação (o app montou no browser) — é ISSO que conta como "Visitante":
      // o VisitBeacon cria a linha antes, mas sem hydrated_at não é visitante.
      // Vai numa chamada SEPARADA de propósito: a coluna só existe depois da
      // migration 0014 e, dentro do upsert, sua ausência derrubava a gravação
      // INTEIRA da sessão (PGRST204). Aqui ela falha sozinha, sem levar nada junto.
      // `.is(null)` mantém a PRIMEIRA hidratação (não reescreve a cada F5).
      await supabase
        .from("funnel_sessions")
        .update({ hydrated_at: new Date().toISOString() })
        .eq("session_id", sid(funnelSlug))
        .is("hydrated_at", null);
    } catch {
      /* best-effort */
    }
  })();

  ensured.set(funnelSlug, run);
  return run;
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
    // Em PARALELO: eram 3 round-trips sequenciais e o update (que alimenta o
    // funil do painel) era o último — se o lead clicava no CTA/fechava a aba,
    // o fetch morria no unload e o progresso não subia, embora o step_event
    // já tivesse entrado. Dava max_step=0 com evento na última lâmina.
    await Promise.allSettled([
      supabase.from("step_events").insert({
        session_id,
        funnel_slug: funnelSlug,
        step_index: stepIndex,
        step_id: stepId,
        step_type: stepType,
        meta: meta ?? null,
      }),
      supabase
        .from("funnel_sessions")
        .update({ max_step_reached: stepIndex, last_seen_at: new Date().toISOString() })
        .eq("session_id", session_id)
        // Guarda de monotonicidade: só sobe, nunca regride (voltar lâmina não
        // rebaixa o progresso). O piso 1 existe porque na 1ª lâmina stepIndex=0
        // e `.lt(max, 0)` nunca casa — o last_seen_at nunca era gravado ali.
        .lt("max_step_reached", Math.max(stepIndex, 1)),
    ]);
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
