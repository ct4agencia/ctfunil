"use client";

import { createClient } from "@/lib/supabase/client";
import { getSessionId } from "@/lib/tracking";

/**
 * Tracking do funil de quiz:
 *   funnel_sessions (1 linha/sessão, max_step_reached atualizado a cada avanço)
 *   step_events     (1 linha por etapa avançada → alimenta o funil do dashboard)
 *
 * O AVANÇO DE LÂMINA vai pelo SERVIDOR (/api/step com service_role), não mais
 * direto do browser: assim a página da lead não precisa de permissão nenhuma no
 * banco (era a última brecha aberta pra forjar progresso de fora) e o envio
 * sobrevive ao unload via sendBeacon.
 *
 * Best-effort: falha em silêncio e NUNCA quebra a página.
 */

// Marca o 1º evento de cada funil na sessão — é ele que carimba a hidratação
// ("o app montou no browser", que é o que conta como Visitante).
const ensured = new Set<string>();

/** session_id POR FUNIL: o mesmo navegador pode passar por vários funis; sem isso,
 *  a sessão (chaveada por session_id) se mistura entre funis e a análise por funil
 *  fica errada. Compomos session_id::funil pra cada funil ter sua própria sessão. */
function sid(funnelSlug: string): string {
  return `${getSessionId()}::${funnelSlug}`;
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
    const primeiro = !ensured.has(funnelSlug);
    ensured.add(funnelSlug);

    const body = JSON.stringify({
      session_id: sid(funnelSlug),
      funnel_slug: funnelSlug,
      step_index: stepIndex,
      step_id: stepId,
      step_type: stepType,
      meta: meta ?? null,
      // 1º evento da sessão = o app montou no browser (isso é "Visitante")
      hydrated: primeiro,
    });

    // Vai pelo SERVIDOR (/api/step, service_role): o browser não precisa mais
    // de permissão no banco — era a última superfície aberta pra forjar dado.
    // sendBeacon o navegador ENTREGA mesmo com a página sendo descarregada
    // (clique no CTA, troca de aba, fechar). A escrita direta usava fetch comum
    // e morria no unload — foi o que fez o funil registrar menos conclusões do
    // que o VTurb via. Fallback: fetch com keepalive.
    const ok = navigator.sendBeacon?.("/api/step", new Blob([body], { type: "application/json" }));
    if (!ok) {
      fetch("/api/step", {
        method: "POST",
        body,
        keepalive: true,
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    }
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
