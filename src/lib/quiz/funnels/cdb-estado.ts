import type { Funnel, HeroStep, QuestionStep, Step } from "../types";
import { clubeDasBolsas } from "./clube-das-bolsas";

/**
 * Funis "CDB Estado" — 4 variações duplicadas do funil CDB (Clube das Bolsas),
 * geo-personalizadas por {estado} (ver lib/quiz/geo + lib/quiz/estado).
 *
 * Pedido do cliente (ct4agencia): 4 funis novos (cdb-estado1..4). Cada um abre
 * com um HERO de escassez DIFERENTE (prints HERO 01/02/03/04) e logo em seguida
 * o MESMO CARD 02 de confirmação de inscrição (print). O restante (perguntas →
 * loading → resultado → oferta → captura → VSL) é o corpo do funil CDB
 * reaproveitado do seed `clube-das-bolsas`.
 *
 * Obs.: o "contador regressivo" e a "barra de carregamento" anotados nos prints
 * são elementos visuais do construtor de blocos (motor layers). Aqui, no motor
 * de lâminas tipadas, a urgência fica na copy do subtítulo + na linha `time`.
 */

function clone<T>(v: T): T {
  try {
    return structuredClone(v);
  } catch {
    return JSON.parse(JSON.stringify(v)) as T;
  }
}

/**
 * Tracking dos 4 funis (igual nas 4 variações). O PixelScripts (SSR) emite, a
 * partir desses IDs:
 *  - UTMify Pixel: window.pixelId + cdn.utmify.com.br/scripts/pixel/pixel.js
 *  - UTMify UTMs: cdn.utmify.com.br/scripts/utms/latest.js (data-utmify-prevent-subids)
 *  - Hotmart Launcher: launcher.hotmart.com/launcher.js + hot("account", …)
 */
const UTMIFY_PIXEL_ID = "6967e71d579dc0043882d672";
const HOTMART_ACCOUNT_ID = "05e7c8af-88d1-3baa-80ae-ea71d7de1dd7";

// ── CARD 02 — confirmação da inscrição (IGUAL nas 4 variações) ──────────────
const CARD_2: QuestionStep = {
  id: "card2-inscricao",
  type: "question",
  question: "Você quer ganhar ==5 mil por mês== fazendo bolsas em crochê?",
  help: "Ótimo, agora vamos confirmar a sua inscrição. Responda às próximas perguntas para verificarmos se você atende aos critérios da seleção e confirmar a sua bolsa de estudos. Leva menos de 1 minuto.",
  options: [
    { label: "Sim", emoji: "👍" },
    { label: "Não", emoji: "👎" },
  ],
};

/**
 * Corpo do funil CDB: perguntas → loading → resultado → oferta → captura → VSL.
 * Reaproveita o seed `clube-das-bolsas` descartando a roleta e o hero originais
 * (índices 0 e 1) — o início de cada funil-estado é o HERO próprio + o CARD 02.
 */
function bodySteps(): Step[] {
  return clone(clubeDasBolsas.steps).slice(2);
}

function buildEstado(slug: string, name: string, hero: HeroStep): Funnel {
  return {
    slug,
    name,
    niche: clubeDasBolsas.niche,
    logo: clubeDasBolsas.logo,
    paletteId: clubeDasBolsas.paletteId,
    font: clubeDasBolsas.font,
    clickSound: clubeDasBolsas.clickSound,
    utmifyPixelId: UTMIFY_PIXEL_ID,
    hotmartAccountId: HOTMART_ACCOUNT_ID,
    steps: [hero, clone(CARD_2), ...bodySteps()],
  };
}

const CTA = "SIM, QUERO GARANTIR MINHA BOLSA";

// ── HERO 01 — 8 vagas gratuitas disponíveis para {estado} ───────────────────
const HERO_1: HeroStep = {
  id: "hero",
  type: "hero",
  title: "Apenas ==8 vagas gratuitas== disponíveis para {estado}",
  subtitle:
    "**Sua vaga expira em instantes.** 🎁 Sua bolsa de estudos de 6 meses está reservada por apenas alguns minutos. Neste momento, outras mulheres de {estado} estão garantindo acesso gratuito ao maior treinamento de crochê do Brasil — se o tempo acabar antes da sua confirmação, sua bolsa poderá ser disponibilizada para outra candidata.",
  cta: CTA,
  time: "⏳ Sua bolsa está reservada por poucos minutos",
};

// ── HERO 02 — 🚨 Restam apenas 8 vagas para {estado} ────────────────────────
const HERO_2: HeroStep = {
  id: "hero",
  type: "hero",
  badge: "🚨 VAGAS ESGOTANDO",
  title: "🚨 Restam apenas ==8 vagas== para {estado}",
  subtitle:
    "**Sua bolsa de estudos ainda pode ser garantida.** Você foi selecionada para participar da distribuição de bolsas de estudos do **Clube das Bolsas**. Como existem poucas vagas para o seu estado, sua reserva ficará disponível apenas por alguns minutos. Clique no botão abaixo para continuar sua seleção antes que sua vaga seja disponibilizada para outra candidata.",
  cta: CTA,
  time: "⏳ Reserva válida por poucos minutos",
};

// ── HERO 03 — Localização verificada (barra 100%) em {estado} ───────────────
const HERO_3: HeroStep = {
  id: "hero",
  type: "hero",
  badge: "📍 LOCALIZAÇÃO VERIFICADA",
  title: "Identificamos que você está em {estado} ✅",
  subtitle:
    "**E olha que notícia boa…** Neste momento, ainda existem **bolsas de estudos disponíveis para mulheres do seu estado**. Sua bolsa ficará reservada apenas pelos próximos minutos. Finalize sua seleção agora para garantir sua bolsa antes que ela seja disponibilizada para outra candidata da sua região.",
  cta: CTA,
  time: "⏳ Bolsa reservada pelos próximos minutos",
};

// ── HERO 04 — Verificação concluída / Parabéns ──────────────────────────────
const HERO_4: HeroStep = {
  id: "hero",
  type: "hero",
  badge: "✅ LOCALIZAÇÃO CONFIRMADA",
  title: "🎉 Parabéns! Sua região faz parte da campanha de bolsas",
  subtitle:
    "Identificamos que você está em {estado} e sua região faz parte da campanha atual de distribuição de bolsas. Você pode concorrer a uma das **8 bolsas de estudos** disponíveis para mulheres do seu estado. Mas atenção: essa disponibilidade é atualizada em tempo real. Confirme sua participação agora para garantir que sua bolsa não seja disponibilizada para outra candidata.",
  cta: CTA,
  time: "⏳ Disponibilidade atualizada em tempo real",
};

export const cdbEstado1 = buildEstado(
  "cdb-estado1",
  "CDB Estado 1 👛 HERO 01 — 8 vagas grátis",
  HERO_1,
);
export const cdbEstado2 = buildEstado(
  "cdb-estado2",
  "CDB Estado 2 👛 HERO 02 — Restam 8 vagas",
  HERO_2,
);
export const cdbEstado3 = buildEstado(
  "cdb-estado3",
  "CDB Estado 3 👛 HERO 03 — Localização verificada",
  HERO_3,
);
export const cdbEstado4 = buildEstado(
  "cdb-estado4",
  "CDB Estado 4 👛 HERO 04 — Verificação concluída",
  HERO_4,
);

export const cdbEstadoFunnels: Funnel[] = [cdbEstado1, cdbEstado2, cdbEstado3, cdbEstado4];
