import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { isReadOnlyWorkspace } from "@/lib/workspace-preview";
import { funnelCacheTag } from "@/lib/quiz/funnels-db";
import { rouletteAutoRedirectSeconds } from "@/lib/quiz/roleta-redirect";
import type { RouletteStep } from "@/lib/quiz/types";

/**
 * Página fixa /upbf1/roleta no servidor. Só código de servidor importa este
 * arquivo, porque ele usa o cliente com service_role.
 *
 * O redirecionamento automático do popup é ligado no construtor, na roleta do
 * funil `upbf1` ("Popup de prêmio" › "Redirecionar automaticamente"), pedido
 * do Luca em 25/11. A página fixa lê dali o liga/desliga e os segundos. Os
 * textos, as cores e o link dela continuam no código.
 */
const FUNNEL_SLUG = "upbf1";

const whatsappMessage = "Sônia, tirei o GUIA COMPLETO + 80% OFF 🔥 e quero desbloquear o meu presente!!!";

/** Link do botão do popup. Só aceita HTTPS sem usuário e senha na URL. */
export function getUpbf1RedirectUrl() {
  const input = process.env.UPBF1_REDIRECT_URL || "https://app.goredirect.com.br/fd61/bf-01";
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password) return;
    if ((url.hostname === "wa.me" || url.hostname === "api.whatsapp.com") && !url.searchParams.has("text")) {
      url.searchParams.set("text", whatsappMessage);
    }
    return url.href;
  } catch {}
}

type Layer = { content?: unknown };
type StoredStep = { type?: unknown; layers?: unknown };

function isRoulette(value: unknown): value is RouletteStep {
  return !!value && typeof value === "object" && (value as { type?: unknown }).type === "roulette";
}

/** Primeira roleta do funil: bloco do motor layers ou etapa do motor tipado. */
function findRoulette(steps: unknown): RouletteStep | undefined {
  if (!Array.isArray(steps)) return;
  for (const step of steps as StoredStep[]) {
    if (isRoulette(step)) return step;
    if (!Array.isArray(step?.layers)) continue;
    const layer = (step.layers as Layer[]).find(item => isRoulette(item?.content));
    if (layer) return layer.content as RouletteStep;
  }
}

async function fetchAutoRedirectSeconds(): Promise<number | null> {
  const { data, error } = await createAdminClient().from("funnels").select("steps")
    .eq("slug", FUNNEL_SLUG).abortSignal(AbortSignal.timeout(2500)).maybeSingle();
  if (error) throw new Error(error.message);
  return rouletteAutoRedirectSeconds(findRoulette(data?.steps)) ?? null;
}

// A roleta recebe o tráfego da campanha: guarda a leitura por até 60 s, e
// salvar o funil no construtor derruba o cache na hora (updateTag na action).
// Uma falha lança e não fica guardada.
const cachedAutoRedirectSeconds = unstable_cache(fetchAutoRedirectSeconds, ["upbf1-roleta-auto-redirect"], {
  revalidate: 60, tags: [funnelCacheTag(FUNNEL_SLUG)],
});

/** Segundos do redirecionamento automático; `undefined` = desligado ou ilegível. */
export async function readUpbf1AutoRedirectSeconds(): Promise<number | undefined> {
  if (isReadOnlyWorkspace()) return;
  try {
    return (await cachedAutoRedirectSeconds()) ?? undefined;
  } catch {
    return;
  }
}
