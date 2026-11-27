/**
 * Envio da VSL para os webhooks do funil (DataCrazy): "% da VSL assistida"
 * (`vsl_progress`) e "Chegou no pitch" (`vsl_pitch_reached`).
 *
 * Pedido do Luca (27/11/2026): os funis comerciais (ex.: ADR VIU PITCH 1 e
 * SEM PITCH 1) avisam o DataCrazy quando o lead chega ao pitch do vídeo, pelo
 * mesmo mecanismo do vsl_progress. O vsl_progress só existia no deploy dos
 * domínios de 17/11 (`dpl_8wwEaa…`, fora das branches); esta é a versão do
 * código atual, configurada pelos webhooks do funil (sem funil fixo no código).
 *
 * Funções puras, usadas no navegador (`vsl-watch.ts`) e na rota
 * `/api/funnel-vsl-webhook`. O lead chega pelo link do DataCrazy com
 * `?telefone=` (e, se houver, `nome` e `product_id`); sem telefone válido,
 * nada é enviado.
 */

/** Gatilhos de webhook ligados à VSL ("Quando enviar" no painel). */
export type GatilhoVsl = "vsl_progress" | "vsl_pitch";
/** Eventos enviados ao webhook. */
export type EventoVsl = "vsl_progress" | "vsl_pitch_reached";

export const GATILHO_DO_EVENTO: Record<EventoVsl, GatilhoVsl> = {
  vsl_progress: "vsl_progress",
  vsl_pitch_reached: "vsl_pitch",
};

export const ROTA_ENVIO_VSL = "/api/funnel-vsl-webhook";

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,119}$/;
const PLAYER_RE = /^[0-9a-f]{24}$/;
const PRODUTO_RE = /^[a-z0-9_-]{1,40}$/;
// DDDs válidos no Brasil (mesma lista do envio de 17/11).
const DDD_RE = /^(?:11|12|13|14|15|16|17|18|19|21|22|24|27|28|31|32|33|34|35|37|38|41|42|43|44|45|46|47|48|49|51|53|54|55|61|62|63|64|65|66|67|68|69|71|73|74|75|77|79|81|82|83|84|85|86|87|88|89|91|92|93|94|95|96|97|98|99)(?:9\d{8}|[2-5]\d{7})$/;

export function slugValido(slug: unknown): slug is string {
  return typeof slug === "string" && SLUG_RE.test(slug);
}

export function playerValido(id: unknown): id is string {
  return typeof id === "string" && PLAYER_RE.test(id);
}

/**
 * Telefone do lead, só com dígitos e com o 55 na frente (`5511987654321`).
 * Aceita "+55 (11) 98765-4321", "11987654321" etc.; recusa texto de modelo
 * não preenchido (`{{telefone}}`), DDD inexistente e números repetidos.
 */
export function normalizarTelefone(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  const raw = bruto.trim();
  if (!raw || raw.length > 30 || !/^\+?[\d\s().-]+$/.test(raw)) return null;
  let d = raw.replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  else if (raw.startsWith("+")) return null;
  if (!DDD_RE.test(d) || /^(\d)\1+$/.test(d.slice(2))) return null;
  return `55${d}`;
}

/** `?telefone=` da URL: exatamente um parâmetro com esse nome. */
export function telefoneDaUrl(url: URL): string | null {
  const valores = url.searchParams.getAll("telefone");
  if (valores.length !== 1) return null;
  return normalizarTelefone(valores[0]);
}

/** `?nome=` da URL, sem modelo não preenchido (`{{nome}}`, e-mail etc.). */
export function nomeDaUrl(url: URL): string {
  const nome = (url.searchParams.get("nome") ?? "").trim();
  return nome && !/[@{}<>]/.test(nome) ? nome.slice(0, 100) : "";
}

/** `?product_id=` da URL (ex.: `adr`, `sdb`), em minúsculas. */
export function produtoDaUrl(url: URL): string {
  const p = (url.searchParams.get("product_id") ?? "").trim().toLowerCase();
  return PRODUTO_RE.test(p) ? p : "";
}

/** O envio só vale na página pública do funil: `/{slug}` ou `/q/{slug}`. */
export function caminhoDoFunil(pathname: string, slug: string): boolean {
  const limpo = pathname.replace(/\/+$/, "");
  return limpo === `/${slug}` || limpo === `/q/${slug}`;
}

/** Faixa de 10 em 10 (0, 10 … 100) de quanto do vídeo foi assistido. */
export function faixaAssistida(t: number, d: number): number {
  if (!Number.isFinite(t) || !Number.isFinite(d) || d <= 0 || t <= 0) return 0;
  return Math.max(0, Math.min(100, 10 * Math.floor((t / d) * 10 + 1e-9)));
}

/** Chegou ao pitch: tempo assistido ≥ tempo do pitch (com 1 s de folga). */
export function chegouNoPitch(t: number, pitchTime: number): boolean {
  return Number.isFinite(t) && Number.isFinite(pitchTime) && pitchTime > 0 && t + 1 >= pitchTime;
}

/**
 * Tempo do pitch digitado no webhook: segundos (`294`) ou minutos e segundos
 * (`04:54`). Devolve 0 quando vazio ou inválido (até 6 h).
 */
export function segundosDoPitch(valor: unknown): number {
  if (typeof valor === "number") return Number.isInteger(valor) && valor > 0 && valor <= 21600 ? valor : 0;
  if (typeof valor !== "string") return 0;
  const v = valor.trim();
  const mmss = /^(\d{1,3}):([0-5]\d)$/.exec(v);
  const n = mmss ? Number(mmss[1]) * 60 + Number(mmss[2]) : /^\d{1,5}$/.test(v) ? Number(v) : 0;
  return n > 0 && n <= 21600 ? n : 0;
}

const PLAYER_NO_TEXTO = /players\/([0-9a-f]{24})/i;
type CamadaSolta = { type?: unknown; content?: { revealAt?: unknown; revealClock?: unknown } | null } | null;

/**
 * Tempo em que o botão aparece na etapa do vídeo (`content.revealAt` da camada
 * de botão). É o pitch que o Luca já configura no construtor (27/11: "o tempo
 * do pitch está configurado no botão"); o webhook "Chegou no pitch" usa este
 * tempo quando o campo próprio está vazio. Prefere botões no relógio do vídeo;
 * com mais de um, vale o primeiro a aparecer. 0 = a etapa do vídeo não tem
 * botão com tempo. Sem `player`, usa a primeira etapa que tem um vídeo do VTurb.
 */
export function pitchDoBotao(steps: unknown, player?: string): number {
  if (!Array.isArray(steps)) return 0;
  for (const step of steps as { layers?: unknown }[]) {
    const camadas = (Array.isArray(step?.layers) ? step.layers : []) as CamadaSolta[];
    let texto = "";
    try { texto = JSON.stringify(camadas).toLowerCase(); } catch { continue; }
    const id = player?.toLowerCase() ?? PLAYER_NO_TEXTO.exec(texto)?.[1];
    if (!id || (!texto.includes(`players/${id}`) && !texto.includes(`vid-${id}`))) continue;
    const tempos = camadas
      .filter(c => c?.type === "button")
      .map(c => ({ s: segundosDoPitch(Math.round(Number(c?.content?.revealAt))), video: c?.content?.revealClock === "video" }))
      .filter(x => x.s > 0);
    const lista = tempos.some(x => x.video) ? tempos.filter(x => x.video) : tempos;
    if (lista.length) return Math.min(...lista.map(x => x.s));
  }
  return 0;
}

/** Resposta do GET da rota: o que este funil envia para este vídeo. */
export interface ConfigEnvioVsl {
  progress: boolean;
  pitch: boolean;
  /** segundos; 0 quando o pitch não está configurado no VTurb */
  pitch_time: number;
}

export const SEM_ENVIO: ConfigEnvioVsl = { progress: false, pitch: false, pitch_time: 0 };
