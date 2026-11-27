import { createAdminClient } from "@/lib/supabase/server";
import { fireWebhook } from "@/lib/quiz/webhooks";
import { vturbListPlayers } from "@/lib/vturb";
import type { FunnelWebhook } from "@/lib/quiz/types";
import {
  GATILHO_DO_EVENTO, SEM_ENVIO, caminhoDoFunil, chegouNoPitch, normalizarTelefone,
  pitchDoBotao, playerValido, segundosDoPitch, slugValido, type ConfigEnvioVsl, type EventoVsl, type GatilhoVsl,
} from "@/lib/quiz/vsl-datacrazy";

/**
 * Repasse da VSL para os webhooks do funil (DataCrazy).
 *
 * GET  ?slug=&player=  → o que este funil envia para este vídeo (sem endereços).
 * POST (form-urlencoded) → `vsl_progress` ou `vsl_pitch_reached`; a rota lê os
 *      webhooks do funil no banco e repassa. Não grava nada no banco.
 *
 * O navegador nunca recebe o endereço do webhook. Só a própria página do funil
 * (mesma origem, `/{slug}` ou `/q/{slug}`, sem `?preview=1`) pode enviar.
 * Pedido do Luca em 27/11/2026; veja `src/lib/quiz/vsl-datacrazy.ts`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const vazio = (status = 204) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

type FunilRow = {
  slug: string;
  status: string | null;
  steps: unknown;
  settings: Record<string, unknown> | null;
  webhooks: FunnelWebhook[] | null;
};

async function lerFunil(slug: string): Promise<FunilRow | null> {
  try {
    const { data, error } = await createAdminClient()
      .from("funnels").select("slug,status,steps,settings,webhooks").eq("slug", slug).maybeSingle();
    if (error || !data || data.status !== "published") return null;
    return data as FunilRow;
  } catch {
    return null; // preview em consulta ou banco indisponível: nada a enviar
  }
}

/** O vídeo pertence ao funil (o id do player aparece no conteúdo das etapas). */
function videoDoFunil(funil: FunilRow, player: string): boolean {
  try { return JSON.stringify(funil.steps ?? []).toLowerCase().includes(player); } catch { return false; }
}

function webhooksDoGatilho(funil: FunilRow, gatilho: GatilhoVsl): FunnelWebhook[] {
  return (Array.isArray(funil.webhooks) ? funil.webhooks : []).filter(wh =>
    wh && wh.enabled === true && (wh.trigger_event as string) === gatilho &&
    typeof wh.api_url === "string" && wh.api_url.startsWith("https://"));
}

async function playerDoVturb(player: string) {
  const lista = await vturbListPlayers();
  return lista?.find(p => p.id === player) ?? null;
}

/**
 * Tempo do pitch de cada webhook "Chegou no pitch", nesta ordem (pedidos do
 * Luca em 27/11): o digitado no webhook; sem ele, o tempo em que o botão
 * aparece na etapa do vídeo; sem botão com tempo, o `pitch_time` do VTurb (que
 * vem 0 para vários players). 0 = sem pitch, não envia.
 */
function tempoDoPitch(wh: FunnelWebhook, pitchBotao: number, pitchVturb: number): number {
  return segundosDoPitch(wh.pitch_seconds) || pitchBotao || (pitchVturb > 0 ? pitchVturb : 0);
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const slug = q.get("slug") ?? "";
  const player = (q.get("player") ?? "").toLowerCase();
  const json = (body: ConfigEnvioVsl) => Response.json(body, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" },
  });
  if (!slugValido(slug) || !playerValido(player)) return json(SEM_ENVIO);
  const funil = await lerFunil(slug);
  if (!funil || !videoDoFunil(funil, player)) return json(SEM_ENVIO);
  const progress = webhooksDoGatilho(funil, "vsl_progress").length > 0;
  const doPitch = webhooksDoGatilho(funil, "vsl_pitch");
  let pitchTime = 0;
  if (doPitch.length) {
    const botao = pitchDoBotao(funil.steps, player);
    const faltaTempo = !botao && doPitch.some(wh => !segundosDoPitch(wh.pitch_seconds));
    const vturb = faltaTempo ? (await playerDoVturb(player))?.pitch_time ?? 0 : 0;
    const tempos = doPitch.map(wh => tempoDoPitch(wh, botao, vturb)).filter(n => n > 0);
    pitchTime = tempos.length ? Math.min(...tempos) : 0; // sem tempo de pitch, não há o que avisar
  }
  return json({ progress, pitch: pitchTime > 0, pitch_time: pitchTime });
}

// Proteção por processo contra repetição e abuso (o navegador também guarda o
// que já enviou na aba). Chave: evento, funil, vídeo, telefone e faixa.
const JA_ENVIADO = new Map<string, number>();
const COTA = new Map<string, { desde: number; total: number }>();
const SEIS_HORAS = 6 * 60 * 60 * 1000;
const DEZ_MINUTOS = 10 * 60 * 1000;

function repetido(chave: string, agora: number): boolean {
  if (JA_ENVIADO.size > 5000) for (const [k, em] of JA_ENVIADO) if (agora - em > SEIS_HORAS) JA_ENVIADO.delete(k);
  const em = JA_ENVIADO.get(chave);
  return em !== undefined && agora - em < SEIS_HORAS;
}

function semCota(telefone: string, agora: number): boolean {
  const c = COTA.get(telefone);
  if (!c || agora - c.desde > DEZ_MINUTOS) { COTA.set(telefone, { desde: agora, total: 1 }); return false; }
  c.total += 1;
  return c.total > 30;
}

export async function POST(request: Request) {
  const alvo = new URL(request.url);
  if (request.headers.get("origin") !== alvo.origin) return vazio(403);
  let ref: URL;
  try { ref = new URL(request.headers.get("referer") ?? ""); } catch { return vazio(403); }
  if (ref.origin !== alvo.origin || ref.searchParams.get("preview") === "1") return vazio(403);
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) return vazio(400);
  if (Number(request.headers.get("content-length")) > 2048) return vazio(413);
  const raw = await request.text();
  if (raw.length > 2048) return vazio(413);
  const p = new URLSearchParams(raw);

  const evento = p.get("event") as EventoVsl | null;
  if (evento !== "vsl_progress" && evento !== "vsl_pitch_reached") return vazio(400);
  const slug = p.get("funnel_slug") ?? "";
  const player = (p.get("video_id") ?? "").toLowerCase();
  const telefone = normalizarTelefone(p.get("telefone"));
  if (!slugValido(slug) || !playerValido(player) || !telefone) return vazio(400);
  if (!caminhoDoFunil(ref.pathname, slug)) return vazio(403);
  const eventId = p.get("event_id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return vazio(400);
  const nome = (p.get("nome") ?? "").trim();
  const produtoUrl = (p.get("product_id") ?? "").trim().toLowerCase();

  let faixa = 0;
  let t = 0;
  if (evento === "vsl_progress") {
    faixa = Number(p.get("vsl_watch_pct"));
    if (!Number.isInteger(faixa) || faixa < 10 || faixa > 100 || faixa % 10 !== 0) return vazio(400);
  } else {
    t = Number(p.get("t"));
    if (!Number.isFinite(t) || t <= 0 || t > 6 * 60 * 60) return vazio(400);
  }

  const agora = Date.now();
  const chave = `${evento}|${slug}|${player}|${telefone}|${faixa}`;
  if (repetido(chave, agora)) return vazio();
  if (semCota(telefone, agora)) return vazio(429);

  const funil = await lerFunil(slug);
  if (!funil || !videoDoFunil(funil, player)) return vazio(404);
  const doGatilho = webhooksDoGatilho(funil, GATILHO_DO_EVENTO[evento]);
  if (!doGatilho.length) return vazio();

  const vturb = await playerDoVturb(player);
  const pitchVturb = vturb?.pitch_time ?? 0;
  const pitchBotao = pitchDoBotao(funil.steps, player);
  // pitch: só os webhooks cujo tempo de pitch já foi alcançado
  const destinos = evento === "vsl_pitch_reached"
    ? doGatilho.filter(wh => chegouNoPitch(t, tempoDoPitch(wh, pitchBotao, pitchVturb)))
    : doGatilho;
  if (!destinos.length) return vazio(422);

  JA_ENVIADO.set(chave, agora);
  const produtoNome = typeof funil.settings?.produto_nome === "string" ? funil.settings.produto_nome.trim() : "";
  const corpo: Record<string, string> = {
    event: evento,
    funnel_slug: slug,
    video_id: player,
    ...(vturb?.name ? { video_name: vturb.name } : {}),
    ...(produtoUrl && /^[a-z0-9_-]{1,40}$/.test(produtoUrl) ? { product_id: produtoUrl } : {}),
    ...(produtoNome ? { produto: produtoNome } : {}),
    telefone,
    ...(nome && !/[@{}<>]/.test(nome) ? { nome: nome.slice(0, 100) } : {}),
    ...(evento === "vsl_progress" ? { vsl_watch_pct: String(faixa) } : {}),
    event_id: eventId,
    occurred_at: new Date(agora).toISOString(),
  };
  await Promise.allSettled(destinos.map(wh => fireWebhook(wh, evento === "vsl_pitch_reached"
    ? { ...corpo, pitch_time: String(tempoDoPitch(wh, pitchBotao, pitchVturb)) }
    : corpo)));
  return vazio();
}
