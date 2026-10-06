---
name: meta-tracking
description: Receita de tracking Meta (Pixel + Conversions API) para os funis da CT4 — event_id para dedup, CAPI server-side, maximização de EMQ. Use ao mexer em disparo de evento pro Meta, em atribuição de venda, ou quando o ROAS reportado divergir do real. Cobre o que já existe no vsl-platform/quizfunnel-app e o que falta.
---

# Metatracking — Guia de Tracking Meta (Pixel + CAPI) para os funis da CT4

> **ESPELHO.** Este arquivo existe idêntico em dois repositórios:
> `vsl-platform/docs/referencia/skills/meta-tracking.skill/SKILL.md` e
> `quizfunnel-app/docs/referencia/skills/meta-tracking.skill/SKILL.md`.
> **Mudou um, mude o outro.** São repos e deploys separados, e os dois precisam do doc na mão de
> quem for mexer no tracking.
>
> **Origem:** `Documents/CT4/TECH/ESTUDO/metatracking.skill` (05/08/2026), derivado do código do
> Top Créditos. **Esta versão foi corrigida** — o original tem 4 erros que quebram em produção; ver
> §0.

---

## Índice

0. O que foi corrigido do documento original
1. Estado atual dos funis CT4 — o que já existe e o que falta
2. Visão geral — como o tracking do Meta funciona
3. Setup do Pixel no frontend
4. Estrutura de código — os 4 arquivos core
5. Catálogo de eventos
6. Conversions API (CAPI) — server-side
7. Maximizando o Event Match Quality (EMQ)
8. Padrões por tipo de negócio
9. Debug, QA e monitoramento
10. Checklist de implementação
11. Anti-padrões e erros comuns

---

## 0. O que foi corrigido do documento original

Quatro erros do doc original. Se você tiver a versão antiga em mãos, **não copie aqueles blocos**.

| # | Erro no original | Consequência | Correção aqui |
|---|---|---|---|
| 1 | `getFbc()` devolvia o `fbclid` cru | O campo `fbc` não casa com ninguém — mata o EMQ que o doc quer subir | Lê o cookie `_fbc`; fallback monta `fb.1.<timestamp>.<fbclid>` (§4.2) |
| 2 | `usePixelSearch` usava `require()` | `require` não existe em módulo ESM de navegador — estoura na primeira busca | Import estático (§4.3) |
| 3 | Script de console citava Stripe e `meta_pending_event_id` | Sobra do Top Créditos; confunde quem debugga aqui | Removido (§9.3) |
| 4 | `META_API_VERSION = 'v22.0'` | **v22.0 morreu em 19/02/2026.** Código bate em API desligada e você debugga código certo | `v25.0` (lançada 18/02/2026) — reconferir a cada 6 meses |

O erro 1 merece destaque: **o código que já roda nos funis da CT4 estava certo e o documento estava
errado.** `collectTrackingParams()` em `src/lib/tracking.ts` já lê o cookie `_fbc` corretamente.

---

## 1. Estado atual dos funis CT4

Antes de qualquer implementação, o retrato do que existe (verificado em 05/08/2026):

| Peça | vsl-platform | quizfunnel-app |
|---|---|---|
| Captura `_fbp` / `_fbc` (cookie) | OK | OK |
| Captura `fbclid`, UTMs, `src`, `xcod`, `ctwa_clid`, `source_id` | OK | OK |
| Persiste fbp/fbc por lead no banco | OK | OK (`funnel_leads`) |
| `fbq('track', ...)` disparando | OK | OK |
| **`event_id` no disparo** | **FALTA** | **FALTA** |
| **CAPI server-side** | **FALTA** | **FALTA** |

Onde olhar: `src/lib/tracking.ts` (`collectTrackingParams`, `fireMetaEvent`) e as rotas
`src/app/api/lead/route.ts` / `src/app/api/funnel-lead/route.ts`.

**A parte difícil já está pronta.** Capturar e persistir `fbp`/`fbc` por lead é o que costuma
travar esse tipo de projeto — e isso já funciona. Falta exatamente o miolo deste documento.

### 1.1 O aviso mais importante deste arquivo

Hoje o disparo é assim:

```ts
// src/lib/tracking.ts — SEM o 4º argumento
window.fbq("track", name, params || {});
```

Sem `eventID` no Pixel, **a deduplicação do Meta é impossível**.

> **Se a CAPI subir antes do `event_id`, toda conversão passa a contar em dobro.**
> ROAS inflado, algoritmo aprendendo com número falso, e corrigir depois exige limpar histórico.

**Ordem obrigatória:**

1. `event_id` no Pixel + persistir junto do lead/pedido — **sozinho, sem CAPI**
2. Conferir no Events Manager que a contagem **não mudou** em relação à semana anterior
3. Só então CAPI, reusando o `event_id` já gravado
4. Validar dedup com `test_event_code` antes de liberar em produção

### 1.2 Por que isso importa pro CTAnalytics

Gasto sem SRC carimbado pelo Meta, SCK cobrindo só 61% das vendas, campanha do Google com R$253 e
zero lead atribuído — **tudo isso é falta de identidade no evento**.

Hoje o `ctanalytics` remenda por cruzamento (`leads.utm_id` = `campaignId`). CAPI com `external_id`
resolve na origem. É correção de causa, não de sintoma.

---

## 2. Visão geral

### 2.1 Por que Pixel sozinho não basta

**20% a 40% dos eventos do Pixel são perdidos** por ad blockers e navegadores com Intelligent
Tracking Prevention (Safari, Firefox, Brave). Só com Pixel, os dados de conversão ficam
subestimados — e o algoritmo do Meta otimiza com dado incompleto.

A **Conversions API (CAPI)** manda o evento direto do servidor, contornando o navegador. O Meta
deduplica quando Pixel e CAPI chegam com o mesmo `event_id`.

```
┌─────────────────────────────────────────────────────┐
│ CLIENT-SIDE (Pixel)                                  │
│ fbq('track', 'Purchase', data, { eventID: uuid })   │
│                                                      │
│ ─── mesmo eventID ───                               │
│                                                      │
│ SERVER-SIDE (CAPI)                                   │
│ POST /{pixel_id}/events → Graph API                 │
│ mesmo eventID + dados hasheados do usuário           │
└─────────────────────────────────────────────────────┘
```

### 2.2 O que o Meta faz com o evento

| Sistema | O que faz | Por que importa |
|---|---|---|
| Otimização de entrega | Decide pra quem mostrar o anúncio | Sem evento de qualidade, entrega pra qualquer um |
| Medição de conversão | Atribui venda a campanha | Sem `value` correto, o ROAS reportado é ficção |
| Públicos personalizados | Remarketing e lookalike | Audiência de quem viu produto, iniciou checkout, comprou |
| Aprendizado de máquina | Melhora targeting com o tempo | Mais dado bom, mais inteligente fica |

### 2.3 Regra de ouro

Um `Purchase` com 8 parâmetros bem preenchidos vale mais que 10 eventos incompletos. O Meta dá a
cada evento um **Event Match Quality (EMQ)** de 1 a 10 e prioriza os de EMQ alto.

---

## 3. Setup do Pixel no frontend

### 3.1 Script base

O snippet **deve** estar no `<head>` do HTML, não inicializado dinamicamente via React — assim
carrega antes de qualquer interação.

```html
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '__META_PIXEL_ID__');
fbq('track', 'PageView');
</script>
```

**Regras:**

- Pixel ID **nunca hardcoded** — variável de ambiente injetada no build
  (`process.env.NEXT_PUBLIC_META_PIXEL_ID` no Next.js)
- **Um Pixel pra dev/staging, outro pra produção.** Testar em staging com o Pixel de produção suja
  dado real.
- `PageView` já é automático no snippet. Não implemente de novo.

> **No contexto CT4:** os funis carregam o Pixel via `PixelScripts.tsx`, com o ID vindo das settings
> do funil (banco), não do env. Isso é intencional — cada funil pode ter Pixel próprio. Mantenha.

### 3.2 Tipagem TypeScript

Sem tipagem, `'purchase'` vs `'Purchase'` passa batido. O Meta é **case-sensitive**.

```ts
// src/lib/pixel-types.ts
export type MetaStandardEvent =
  | 'PageView' | 'ViewContent' | 'Search' | 'AddToCart' | 'AddToWishlist'
  | 'InitiateCheckout' | 'AddPaymentInfo' | 'Purchase' | 'Lead'
  | 'CompleteRegistration' | 'StartTrial' | 'Subscribe' | 'Contact'
  | 'Schedule' | 'FindLocation' | 'Donate' | 'CustomizeProduct'
  | 'SubmitApplication';

export interface MetaEventData {
  content_ids?: string[];
  content_type?: string;
  content_name?: string;
  content_category?: string;
  value?: number;
  currency?: string;
  order_id?: string;
  num_items?: number;
  predicted_ltv?: number;
  search_string?: string;
  registration_method?: string;
  status?: string;
  subscription_period?: string;   // custom
  subscription_id?: string;       // custom
  [key: string]: string | number | string[] | undefined;
}

export interface MetaTrackOptions {
  eventID?: string;
}

declare global {
  interface Window {
    fbq?: (
      method: 'track' | 'trackCustom' | 'trackSingle' | 'init',
      eventName: string,
      data?: MetaEventData,
      options?: MetaTrackOptions
    ) => void;
    _fbq?: unknown;
  }
}
```

---

## 4. Estrutura de código

Quatro arquivos formam o core. Nesta ordem.

### 4.1 Arquivo 1: `lib/pixel.ts` — core de disparo

```ts
import type { MetaStandardEvent, MetaEventData, MetaTrackOptions } from './pixel-types';

const DEDUP_WINDOW_MS = 30_000;
const firedEvents = new Map<string, number>();

/** UUID v4 para event_id. crypto.randomUUID() quando disponível — mais forte que Math.random. */
export function generateEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function trackEvent(
  eventName: MetaStandardEvent | string,
  data?: MetaEventData,
  options?: MetaTrackOptions
): string | null {
  const eventId = options?.eventID ?? generateEventId();

  if (typeof window === 'undefined' || !window.fbq) {
    console.warn(`[Meta] fbq indisponível. Evento "${eventName}" perdido (client-side).`);
    return eventId;
  }

  // Dedup LOCAL: bloqueia re-disparo do mesmo evento com os mesmos dados em 30s.
  // Protege de double-fire por re-render. NÃO substitui a dedup do Meta — essa é por event_id.
  const dedupKey = `${eventName}|${JSON.stringify(data || {})}`;
  const lastFired = firedEvents.get(dedupKey);
  const now = Date.now();

  if (lastFired && now - lastFired < DEDUP_WINDOW_MS) {
    console.debug(`[Meta] Dedup: "${eventName}" ignorado (${now - lastFired}ms desde o último)`);
    return eventId;
  }

  firedEvents.set(dedupKey, now);

  // Limpeza lazy do Map (evita memory leak em sessão longa)
  if (firedEvents.size > 200) {
    for (const [key, ts] of firedEvents) {
      if (now - ts > DEDUP_WINDOW_MS) firedEvents.delete(key);
    }
  }

  window.fbq('track', eventName, data ?? {}, { eventID: eventId });
  return eventId;
}

export function trackCustomEvent(eventName: string, data?: MetaEventData): string {
  const eventId = generateEventId();
  if (typeof window === 'undefined' || !window.fbq) return eventId;
  window.fbq('trackCustom', eventName, data ?? {});
  return eventId;
}
```

### 4.2 Arquivo 2: `lib/pixel-events.ts` — catálogo de eventos

> **CORREÇÃO 1 aplicada aqui.** O `getFbc()` original devolvia o `fbclid` cru — formato inválido
> pro Meta, que exige `fb.<subdomain_index>.<timestamp>.<fbclid>`. Mandar o `fbclid` puro no campo
> `fbc` não casa com usuário nenhum e derruba justamente o EMQ que estamos tentando subir.

```ts
import { trackEvent, generateEventId } from './pixel';

// ── Helpers de identidade ──

/** Lê um cookie pelo nome (mesma implementação já usada em src/lib/tracking.ts). */
function getCookie(name: string): string | undefined {
  try {
    const m = document.cookie.match(
      new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
    );
    return m ? decodeURIComponent(m[1]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Facebook Click ID.
 *
 * Fonte preferida: cookie `_fbc`, que o próprio Pixel grava já no formato exigido
 * (`fb.<subdomain_index>.<timestamp>.<fbclid>`).
 *
 * Fallback: monta o formato à mão. Necessário no PRIMEIRO hit — o usuário chega com `?fbclid=` na
 * URL antes do Pixel ter gravado o cookie. Sem o fallback, o primeiro evento da sessão (justamente
 * o que carrega o clique do anúncio) sairia sem `fbc`.
 */
function getFbc(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const cookie = getCookie('_fbc');
  if (cookie) return cookie;

  const fbclid = new URLSearchParams(window.location.search).get('fbclid');
  if (!fbclid) return undefined;

  // subdomain_index = 1 para domínio com um nível de subdomínio (ex: www.site.com.br).
  // O timestamp é o do clique — Date.now() aqui é aproximação aceita pelo Meta.
  return `fb.1.${Date.now()}.${fbclid}`;
}

/** Facebook Browser ID — cookie `_fbp`, gravado pelo Pixel. */
function getFbp(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return getCookie('_fbp');
}

export interface TrackingContext {
  eventId: string;
  fbc?: string;
  fbp?: string;
  sourceUrl: string;
}

/**
 * Captura o contexto de tracking pra mandar ao backend.
 * Chame no momento do checkout/captura de lead — o backend precisa disso pra CAPI depois.
 */
export function captureTrackingContext(): TrackingContext {
  return {
    eventId: generateEventId(),
    fbc: getFbc(),
    fbp: getFbp(),
    sourceUrl: typeof window !== 'undefined' ? window.location.href : '',
  };
}

// ═══════════════ EVENTOS PADRÃO ═══════════════

/** ViewContent — ao abrir página de produto, plano ou item de catálogo. */
export function trackViewContent(params: {
  contentId: string;
  contentType: 'product' | 'product_group';
  contentName?: string;
  contentCategory?: string;
  value?: number;
  currency?: string;
}): string {
  return trackEvent('ViewContent', {
    content_ids: [params.contentId],
    content_type: params.contentType,
    content_name: params.contentName,
    content_category: params.contentCategory,
    value: params.value,
    currency: params.currency || 'BRL',
  });
}

/** Search — quando o usuário busca. SEMPRE com debounce. */
export function trackSearch(params: { searchString: string }): string {
  return trackEvent('Search', { search_string: params.searchString });
}

/** AddToCart */
export function trackAddToCart(params: {
  contentId: string;
  contentType?: string;
  contentName?: string;
  value?: number;
  currency?: string;
}): string {
  return trackEvent('AddToCart', {
    content_ids: [params.contentId],
    content_type: params.contentType || 'product',
    content_name: params.contentName,
    value: params.value,
    currency: params.currency || 'BRL',
  });
}

/** InitiateCheckout — ao chegar na página de checkout/pagamento. */
export function trackInitiateCheckout(params: {
  contentIds?: string[];
  contentType?: string;
  numItems?: number;
  value: number;
  currency?: string;
}): string {
  return trackEvent('InitiateCheckout', {
    content_ids: params.contentIds,
    content_type: params.contentType || 'product',
    num_items: params.numItems || 1,
    value: params.value,
    currency: params.currency || 'BRL',
  });
}

/** AddPaymentInfo — ao selecionar método de pagamento. */
export function trackAddPaymentInfo(params: {
  paymentMethod: string;  // 'pix', 'credit_card', 'boleto'
  value: number;
  currency?: string;
}): string {
  return trackEvent('AddPaymentInfo', {
    payment_method: params.paymentMethod,
    value: params.value,
    currency: params.currency || 'BRL',
  });
}

/** Purchase — na tela de confirmação. SOMENTE com a compra confirmada. */
export function trackPurchase(params: {
  orderId: string;
  contentIds: string[];
  contentType?: string;
  contentName?: string;
  numItems?: number;
  value: number;
  currency?: string;
}): string {
  return trackEvent('Purchase', {
    content_ids: params.contentIds,
    content_type: params.contentType || 'product',
    content_name: params.contentName || `Pedido #${params.orderId}`,
    num_items: params.numItems || 1,
    value: params.value,
    currency: params.currency || 'BRL',
    order_id: params.orderId,
  });
}

/** CompleteRegistration — cadastro confirmado. */
export function trackCompleteRegistration(params?: {
  method?: string;
  value?: number;
  currency?: string;
}): string {
  return trackEvent('CompleteRegistration', {
    registration_method: params?.method || 'email',
    value: params?.value,
    currency: params?.currency || 'BRL',
  });
}

/** Lead — captura de funil, formulário de contato, orçamento. */
export function trackLead(params?: {
  contentName?: string;
  value?: number;
  currency?: string;
}): string {
  return trackEvent('Lead', {
    content_name: params?.contentName || 'Captura de funil',
    value: params?.value,
    currency: params?.currency || 'BRL',
  });
}

/** Contact — clique em WhatsApp, telefone, email, chat. */
export function trackContact(params: {
  contactMethod: 'whatsapp' | 'phone' | 'email' | 'chat';
}): string {
  return trackEvent('Contact', { contact_method: params.contactMethod });
}

// ── SaaS / assinatura ──

export function trackStartTrial(params: {
  planId: string;
  planName: string;
  trialDays: number;
  predictedLtv?: number;
  currency?: string;
}): string {
  return trackEvent('StartTrial', {
    content_ids: [params.planId],
    content_type: 'product',
    content_name: params.planName,
    num_items: params.trialDays,
    predicted_ltv: params.predictedLtv,
    currency: params.currency || 'BRL',
  });
}

export function trackSubscribe(params: {
  subscriptionId: string;
  planId: string;
  planName: string;
  value: number;
  currency?: string;
  period: 'monthly' | 'quarterly' | 'annual';
}): string {
  return trackEvent('Subscribe', {
    content_ids: [params.planId],
    content_type: 'product',
    content_name: params.planName,
    value: params.value,
    currency: params.currency || 'BRL',
    subscription_id: params.subscriptionId,
    subscription_period: params.period,
  });
}
```

> **Nota sobre `content_type`:** o Meta espera `'product'` ou `'product_group'` pra casar com
> catálogo. O doc original usava `'plan'`, que não é valor de catálogo — corrigido acima.

### 4.3 Arquivo 3: `hooks/usePixel.ts` — hooks React

> **CORREÇÃO 2 aplicada aqui.** O original usava `require('../lib/pixel-events')` dentro do
> `useEffect`. `require` não existe em módulo ESM de navegador — estouraria na primeira busca.

```ts
import { useEffect, useRef } from 'react';
import { trackSearch } from '../lib/pixel-events';   // import estático, não require()

/**
 * Hook para eventos de view (ViewContent, checkout, tela de sucesso).
 * O useRef protege do double-fire do React StrictMode em desenvolvimento — sem ele, todo
 * Purchase seria contado duas vezes em dev.
 */
export function usePixelViewEvent(fn: () => void, deps: unknown[] = []): void {
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;
    fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Busca com debounce. Só dispara Search depois que o usuário para de digitar.
 * Sem debounce, cada tecla vira um evento e o Meta recebe lixo.
 */
export function usePixelSearch(query: string, delayMs: number = 800): void {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!query || query.trim().length < 2) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      trackSearch({ searchString: query.trim() });
    }, delayMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, delayMs]);
}
```

### 4.4 Arquivo 4: `lib/capi-client.ts` — cliente do endpoint CAPI

O frontend manda pro **seu backend**, que chama o Meta. Nunca chama o Meta direto — o token de
acesso não pode ficar exposto no navegador.

```ts
const CAPI_ENDPOINT = '/api/capi';

interface CapiPayload {
  event_name: string;
  event_id: string;
  event_time: number;
  event_source_url: string;
  action_source: 'website' | 'system_generated' | 'email';
  user_data: {
    em?: string;           // hasheado SHA256 no BACKEND, nunca aqui
    ph?: string;
    external_id?: string;
    fbc?: string;
    fbp?: string;
  };
  custom_data: Record<string, unknown>;
}

export async function sendCapiEvent(event: CapiPayload): Promise<void> {
  try {
    await fetch(CAPI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [event] }),
      keepalive: true,   // fire-and-forget: não bloqueia a navegação
    });
  } catch {
    // silencioso: CAPI é best-effort, nunca quebra a página
  }
}
```

---

## 5. Catálogo de eventos

### 5.1 Obrigatórios em qualquer aplicação

| Evento | Quando | Obrigatórios | Sobem o EMQ |
|---|---|---|---|
| **PageView** | Automático (snippet) | — | — |
| **ViewContent** | Página de produto/plano | `content_ids`, `content_type` | `content_name`, `value`, `currency` |
| **Purchase** | Confirmação de pagamento | `value`, `currency`, `content_ids` | `order_id`, `num_items`, `content_type` |

### 5.2 Funil de captura (o caso dos funis CT4)

| Evento | Quando | Gatilho |
|---|---|---|
| **ViewContent** | Abertura da VSL/quiz | `usePixelViewEvent` no componente |
| **Lead** | Captura de contato confirmada | `onSubmit`, **após** o `/api/lead` responder OK |
| **Contact** | Clique em WhatsApp | Handler do `onClick` |
| **InitiateCheckout** | Ida pro checkout Hotmart | Handler do CTA |
| **Purchase** | Compra confirmada | **Webhook Hotmart via CAPI** — o navegador não volta pro funil |

> **Particularidade CT4:** a compra acontece na **Hotmart**, fora do domínio do funil. O Pixel do
> funil nunca vê o `Purchase`. Por isso o `Purchase` aqui é **majoritariamente server-side** — o
> webhook da Hotmart é a única fonte confiável. Isso torna a CAPI mais importante nos funis da CT4
> do que num e-commerce comum.

### 5.3 Funil de assinatura

| Evento | Quando | Client ou Server |
|---|---|---|
| ViewContent | Página de planos | Client |
| CompleteRegistration | Email confirmado | Client + Server |
| StartTrial | Trial iniciado | Client + Server |
| InitiateCheckout | Página de pagamento | Client |
| Purchase | Primeiro pagamento | Client + Server |
| **Subscribe** | Cobrança recorrente | **Server apenas** |
| **CancelSubscription** | Cancelamento | **Server apenas** — evento customizado |

> `CancelSubscription` não é evento padrão do Meta. Mande via CAPI com esse `event_name`. É um
> **anti-sinal**: ensina o algoritmo a NÃO procurar gente com esse perfil.

---

## 6. Conversions API (CAPI)

### 6.1 O mecanismo de dedup

1. O **frontend** gera um `event_id` (UUID)
2. Dispara `fbq('track', 'Purchase', data, { eventID })`
3. **Inclui esse `event_id`** na requisição que vai pro backend
4. O backend, ao confirmar o pagamento, chama a CAPI com o **mesmo** `event_id`, `event_name` e
   `event_time`
5. O Meta vê os dois e conta **1 conversão**

> **Crítico:** se o `event_name` for diferente entre Pixel e CAPI, a dedup **não funciona**. Têm que
> ser idênticos (`'Purchase'` nos dois lados, mesma capitalização).

### 6.2 Implementação server-side

```ts
// app/api/capi/route.ts

const META_PIXEL_ID = process.env.META_PIXEL_ID!;
const META_CAPI_TOKEN = process.env.META_CAPI_TOKEN!;

/**
 * CORREÇÃO 4: o doc original trazia 'v22.0', disponível só até 19/02/2026.
 * Versão corrente: v25.0 (lançada 18/02/2026). RECONFERIR A CADA 6 MESES —
 * https://developers.facebook.com/docs/graph-api/changelog/versions/
 */
const META_API_VERSION = 'v25.0';

interface CapiServerEvent {
  event_name: string;
  event_time: number;        // Unix em SEGUNDOS
  event_id: string;          // MESMO UUID do frontend
  event_source_url: string;
  action_source: 'website' | 'system_generated' | 'email';
  user_data: {
    em?: string;             // SHA256(email)
    ph?: string;             // SHA256(telefone só dígitos, com DDI, sem "+")
    fn?: string;             // SHA256(primeiro nome)
    ln?: string;             // SHA256(sobrenome)
    external_id?: string;    // SEU id — TEXTO PURO, não hashear
    fbc?: string;
    fbp?: string;
    client_ip_address?: string;
    client_user_agent?: string;
  };
  custom_data: Record<string, unknown>;
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sendToMeta(events: CapiServerEvent[]) {
  const url =
    `https://graph.facebook.com/${META_API_VERSION}/${META_PIXEL_ID}/events` +
    `?access_token=${META_CAPI_TOKEN}`;

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: events,
      // Em staging: manda pro Test Events em vez de poluir dado real
      ...(process.env.META_TEST_EVENT_CODE
        ? { test_event_code: process.env.META_TEST_EVENT_CODE }
        : {}),
    }),
  });
}

export async function POST(request: Request) {
  try {
    const { events } = await request.json();
    if (!Array.isArray(events) || events.length === 0) {
      return Response.json({ error: 'events array required' }, { status: 400 });
    }

    const metaResponse = await sendToMeta(events);
    const metaData = await metaResponse.json();

    // Logar SEMPRE: sem isso, CAPI falhando vira silêncio e você só descobre pelo ROAS caindo
    console.log('[Meta CAPI]', JSON.stringify(metaData));

    return Response.json(metaData, { status: metaResponse.status });
  } catch (error) {
    console.error('[Meta CAPI] erro:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 6.3 Onde chamar — webhook de venda (o caso CT4)

```ts
// Webhook Hotmart: venda aprovada
async function onVendaAprovada(venda: Venda, lead: Lead, req: Request) {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const userAgent = req.headers.get('user-agent');

  await sendToMeta([{
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: lead.meta_event_id,       // gerado no funil, salvo no banco
    event_source_url: lead.source_url || '',
    action_source: 'website',
    user_data: {
      em: venda.email ? await sha256(venda.email) : undefined,
      ph: venda.telefone ? await sha256(venda.telefone.replace(/\D/g, '')) : undefined,
      external_id: lead.session_id,     // TEXTO PURO
      fbc: lead.fbc,                    // já capturado por collectTrackingParams()
      fbp: lead.fbp,
      client_ip_address: clientIp || undefined,
      client_user_agent: userAgent || undefined,
    },
    custom_data: {
      value: venda.valor,
      currency: 'BRL',
      content_ids: [venda.produto_id],
      content_type: 'product',
      order_id: venda.transacao_id,
    },
  }]);
}
```

> **Idempotência é obrigatória.** A Hotmart reenvia webhook. Sem checar se aquele `transacao_id` já
> foi processado, você manda o mesmo `Purchase` duas vezes com `event_id` diferente — e aí conta em
> dobro, exatamente o que a dedup existe pra impedir.

### 6.4 O que o frontend precisa mandar pro backend

```ts
const payload = {
  // ... dados normais do lead/pedido ...
  meta_event_id: ctx.eventId,     // UUID gerado no funil
  meta_fbc: ctx.fbc,
  meta_fbp: ctx.fbp,
  meta_source_url: ctx.sourceUrl,
};
```

O backend **guarda esses campos no banco**. Quando o webhook de venda chegar (minutos ou horas
depois), é de lá que sai o `event_id`.

> **Nos funis CT4 isso já é 80% feito:** `fbp`, `fbc`, `fbclid`, UTMs e `src` já são capturados e
> gravados por lead. Falta só acrescentar o `meta_event_id` na mesma linha.

---

## 7. Maximizando o EMQ

### 7.1 O que a nota significa

| EMQ | Efeito |
|---|---|
| 1–3 | Evento praticamente ignorado na otimização |
| 4–6 | Usado, mas com peso reduzido |
| **7–8** | **Totalmente utilizado — mínimo aceitável** |
| 9–10 | Peso máximo no algoritmo |

### 7.2 Peso de cada parâmetro

| Prioridade | Parâmetro | Onde obter |
|---|---|---|
| Crítico | `em` (email SHA256) | Banco, no backend |
| Crítico | `external_id` (texto puro) | Seu id de sessão/usuário |
| Alto | `ph` (telefone SHA256) | Banco, no backend |
| Alto | `fbp` | Cookie `_fbp` |
| Alto | `fbc` | Cookie `_fbc` (ver §4.2) |
| Médio | `client_ip_address` | Header `x-forwarded-for` |
| Médio | `client_user_agent` | Header `user-agent` |
| Baixo | `fn`, `ln`, `ct`, `zp` | Banco |

### 7.3 Se só puder mandar 4

```ts
user_data: {
  em: await sha256(email),      // 1. maior peso individual
  external_id: sessionId,       // 2. matching cross-device
  client_ip_address: ip,        // 3. geolocalização
  client_user_agent: ua,        // 4. matching de dispositivo
}
```

### 7.4 Regras de hash

- **SEMPRE** SHA256. Outro algoritmo não é aceito.
- **SEMPRE** `.toLowerCase().trim()` antes de hashear.
- Telefone: só dígitos, com código do país, **sem** `+` (ex: `5511999999999`).
- **NUNCA** hasheie `external_id`, `fbc`, `fbp`, IP ou user agent — vão em texto puro.

---

## 8. Padrões por tipo de negócio

### 8.1 Funil de captura → Hotmart (padrão CT4)

```
Anúncio → VSL/Quiz → Captura → WhatsApp/Checkout → Hotmart → Venda
   │         │           │                                      │
 fbclid  ViewContent    Lead                                  Purchase
                                                            (só server)
```

**Server-side (CAPI):** `Purchase` no webhook Hotmart — **crítico**, é a única fonte. `Refund`
(custom) no estorno.

**O que guardar por lead:**

```sql
ALTER TABLE funnel_leads
  ADD COLUMN IF NOT EXISTS meta_event_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_source_url TEXT,
  ADD COLUMN IF NOT EXISTS meta_client_ip TEXT;
-- fbp, fbc, fbclid, utms e src JÁ EXISTEM nas tabelas dos funis CT4
```

### 8.2 SaaS / assinatura

1. **`Subscribe` é cobrança recorrente** e tem que ser server-side. O navegador não sabe que a
   cobrança automática aconteceu.
2. **`CancelSubscription` é anti-sinal** — tão importante quanto Purchase.
3. **`StartTrial` com `predicted_ltv`** se você consegue estimar.
4. **`value` do Subscribe é a cobrança individual, não o LTV.** R$49,90/mês → `value: 49.90`. O Meta
   calcula o LTV sozinho pelos eventos repetidos.

---

## 9. Debug, QA e monitoramento

### 9.1 Ferramentas

1. **Meta Pixel Helper** (extensão Chrome) — eventos em tempo real na página
2. **Events Manager → Test Events** — log do que o Meta realmente recebeu. É a fonte da verdade.
3. **Events Manager → Diagnostics** — alerta de parâmetro faltando, dedup quebrada, EMQ baixo

### 9.2 Testar sem sujar produção

```ts
const payload = { data: events, test_event_code: 'TEST12345' };
```

No Pixel, `fbq('init', ID, { debug: true })` em staging.

### 9.3 Script de verificação no console

> **CORREÇÃO 3 aplicada aqui.** O original tinha referências a Stripe e a um
> `sessionStorage.getItem('meta_pending_event_id')` que são do Top Créditos, não da CT4.

```js
// Cole no console do navegador, na página do funil:
(function checkPixel() {
  if (!window.fbq) return console.error('Pixel não carregado');
  console.log('Pixel carregado');

  const queue = window.fbq.queue || [];
  const events = queue.filter(raw => typeof raw === 'object' && raw.length >= 2);

  if (events.length === 0) {
    console.log('Nada na fila — o PageView já foi processado. Dispare um evento e rode de novo.');
  }

  console.group(`${events.length} evento(s) na fila`);
  for (const ev of events) {
    const name = ev[1] || '???';
    const data = ev[2] || {};

    const avisos = [];
    if (name === 'Purchase' && !data.value) avisos.push('falta value');
    if (name === 'Purchase' && !data.currency) avisos.push('falta currency');
    if (name === 'Purchase' && !data.order_id) avisos.push('falta order_id');
    if (['ViewContent', 'Purchase', 'InitiateCheckout'].includes(name) && !data.content_ids) {
      avisos.push('falta content_ids');
    }
    console.log(`${avisos.length ? 'AVISO' : 'OK'} — ${name}`, data, avisos.length ? avisos : '');
  }
  console.groupEnd();

  // eventID é o que torna a dedup com a CAPI possível
  for (const ev of events) {
    const opts = ev[3] || {};
    if (!opts.eventID) {
      console.warn(`"${ev[1]}" SEM eventID — dedup com a CAPI não vai funcionar.`);
    }
  }

  // Identidade disponível pro EMQ
  console.group('Identidade');
  const fbp = document.cookie.match(/_fbp=([^;]+)/);
  const fbc = document.cookie.match(/_fbc=([^;]+)/);
  const fbclid = new URLSearchParams(location.search).get('fbclid');
  console.log('_fbp:', fbp ? fbp[1].slice(0, 16) + '…' : 'ausente');
  console.log('_fbc:', fbc ? fbc[1].slice(0, 20) + '…'
                           : (fbclid ? 'ainda não gravado (fbclid na URL — use o fallback)'
                                     : 'sem fbclid (OK se tráfego orgânico)'));
  console.groupEnd();
})();
```

### 9.4 Monitoramento

**Semanal (primeiro mês):** Diagnostics · EMQ por evento · alertas de parâmetro faltando ·
**comparar vendas no banco vs Purchase no Meta — divergência >15% investiga**.

**Mensal:** revisar eventos customizados (o Meta pode ter lançado padrão equivalente) · confirmar
que a dedup segue funcionando · conferir `action_source` (webhook puro = `system_generated`).

### 9.5 Sintoma → causa

| Sintoma | Causa provável |
|---|---|
| EMQ sempre abaixo de 6 | Falta `em`, `external_id` ou `client_ip_address` |
| ROAS reportado **abaixo** do real | Purchase perdido (ad blocker). Falta CAPI. |
| ROAS reportado **acima** do real | Purchase duplicado. `event_id` diferente entre Pixel e CAPI. |
| "No events received" | Pixel ID errado, token CAPI inválido, ou versão da API expirada |
| "Low event coverage for FBP" | Não está capturando o cookie `_fbp` |
| Evento contado 2x | `event_id` divergente, ou webhook sem idempotência |

---

## 10. Checklist de implementação

### Fase 1 — `event_id` primeiro (SOZINHO)

- [ ] `generateEventId()` no `lib/pixel.ts`
- [ ] `fireMetaEvent` passa a receber e repassar `{ eventID }` no 4º argumento
- [ ] `captureTrackingContext()` no momento da captura de lead
- [ ] `meta_event_id` no payload de `/api/lead` e `/api/funnel-lead`
- [ ] Coluna `meta_event_id` na tabela de leads
- [ ] **Events Manager: a contagem NÃO mudou vs semana anterior** ← gate

### Fase 2 — CAPI

- [ ] Rota `/api/capi`
- [ ] `META_CAPI_TOKEN` no cofre (nunca no frontend)
- [ ] SHA256 no backend
- [ ] Webhook Hotmart chama a CAPI com o `event_id` gravado
- [ ] Idempotência por `transacao_id` antes de mandar
- [ ] Testar dedup com `test_event_code`: Pixel + CAPI = **1** evento

### Fase 3 — Qualidade

- [ ] EMQ do Purchase ≥ 7
- [ ] EMQ dos demais ≥ 6
- [ ] Diagnostics sem warning
- [ ] Vendas no banco vs Purchase no Meta por 48h
- [ ] StrictMode não causa double-fire

---

## 11. Anti-padrões e erros comuns

| Erro | Por que acontece | Como evitar |
|---|---|---|
| **CAPI antes do `event_id`** | Parece o passo mais valioso | **Toda conversão conta em dobro.** `event_id` primeiro, sempre |
| **Purchase no `onClick`** | Dev põe no botão em vez da confirmação | Só na tela de sucesso, ou no webhook |
| **Purchase repetido** | Re-render dispara o `useEffect` de novo | `useRef` como guard |
| **`value` como string** | `value: "99.90"` | Tipar como `number` |
| **Esquecer `currency`** | Meta assume USD | Sempre `currency: 'BRL'` |
| **`event_id` diferente entre Pixel e CAPI** | UUID gerado nos dois lados | Gerar UMA vez no frontend e persistir |
| **`action_source: 'website'` em webhook puro** | Copiado do exemplo de e-commerce | `'system_generated'` quando não há navegador |
| **`external_id` hasheado** | Aplicar SHA256 em tudo | `external_id` vai em TEXTO PURO |
| **`fbc` com o `fbclid` cru** | O doc original ensinava errado | Cookie `_fbc`, ou `fb.1.<ts>.<fbclid>` |
| **Busca sem debounce** | Cada tecla vira evento | Debounce ≥800ms, mínimo 2 caracteres |
| **Webhook sem idempotência** | Provedor reenvia | Checar se o `transacao_id` já foi processado |
| **Staging com Pixel de produção** | Um Pixel só | Pixel separado por ambiente |
| **Versão de API vencida** | Ninguém revisita a constante | Reconferir a cada 6 meses |

---

## Apêndice A — Variáveis de ambiente

```bash
# frontend
NEXT_PUBLIC_META_PIXEL_ID=123456789012345

# backend — NUNCA expor
META_PIXEL_ID=123456789012345
META_CAPI_TOKEN=EAAxxxxx...
META_TEST_EVENT_CODE=TEST12345      # só em staging
```

## Apêndice B — Referências

- [Meta Pixel](https://developers.facebook.com/docs/meta-pixel/)
- [Conversions API](https://developers.facebook.com/docs/marketing-api/conversions-api/)
- [Standard Events](https://developers.facebook.com/docs/meta-pixel/reference/)
- [Versões da Graph API](https://developers.facebook.com/docs/graph-api/changelog/versions/) — **confira antes de fixar a constante**
- [Events Manager](https://www.facebook.com/events_manager2/)

---

> **Versão:** 05/08/2026 — corrigido a partir de `Documents/CT4/TECH/ESTUDO/metatracking.skill`.
> O Meta muda API e parâmetro com frequência: revalidar a cada 6 meses, começando pela versão da
> Graph API.
