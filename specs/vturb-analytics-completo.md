# VTurb Analytics Completo — replicação painel + relatório diário + webhook de retenção

## Status
- Criada: 2026-07-03
- **Aprovada pelo Luca: 2026-07-03** ("aprovo a spec do vturb")
- Sessão: spec dirigida por entrevista (prints do painel VTurb + 2 planilhas + print da aba de dia)

## Objetivo
Trazer para o CTFUNNEL tudo que hoje vive em 2 lugares manuais: o painel do VTurb (retenção, segmentação, métricas de player) e as planilhas de acompanhamento (diária de 37 colunas GASTO→LUCRO e a de retenção minuto a minuto por produto). O app vira a fonte única, auto-calculada — eliminando erros manuais de fórmula (ex.: linha 14/01/2025 da planilha tem PITCH=5674 copiado de VISU PV e %CONV=449%). Além disso, o webhook de lead passa a carregar a % da VSL que o lead assistiu.

## Contexto

### Fontes de dados por coluna da planilha diária (37 colunas)
| Coluna(s) | Fonte | Status |
|---|---|---|
| VALOR GASTO, ALCANCE, IMPRESSÕES, CLIQUES NO LINK | Meta Ads via UTMify (ou input manual) | integração nova |
| CPM, CPC, todos os "R$ CUSTO …", todas as % | **calculado** no app | fórmula |
| VISU. PV (visitantes) | próprio DB (`funnel_sessions`) | ✅ já existe |
| CLICOU ETAPA 1 (= 1ª resposta) | próprio DB (`max_step ≥ 1`) | ✅ já existe |
| CLICOU ULTIMA ETAPA (= conclusões) | próprio DB | ✅ já existe |
| LEAD | próprio DB (`funnel_leads`) | ✅ já existe |
| PLAY VTURB | VTurb `/sessions/stats` → `total_started` | ✅ client pronto (`src/lib/vturb.ts`) |
| PITCH VTURB, % PITCH | VTurb → `total_over_pitch`, `over_pitch_rate` | ✅ client pronto |
| IC (initiate checkout) | pixel/evento próprio no clique do checkout | evento novo |
| VENDAS, APROVADAS, RECEITA, UPSELL+OB'S | Hotmart/UTMify | integração nova (fase 2) |
| RESULTADO SEM FUNIL / COMPLETO | calculado (receita − gasto) | fórmula |

### Mapa: onde cada informação fica no app (sub abas de /analytics)
| Sub aba | Conteúdo |
|---|---|
| **Geral** (existe) | visão consolidada — inalterada |
| **Diário** (NOVA) | tabela dia a dia estilo planilha 37 col: grupos de colunas (Tráfego · Funil · VSL · Checkout · Resultado), toggle de visibilidade de colunas (como "Visualização de Colunas" do VTurb), linha TOTAL, seletor de mês/período, export CSV |
| **VSL** (existe, expandir) | por player: curva de retenção idêntica ao VTurb (gráfico escuro, eixo tempo, hover), tabela minuto a minuto %RET/%QUEDA (replica planilha 15JGi5X), sub-segmentação em abas Países/Dispositivos/SO/Navegadores/Origem do Tráfego, busca por parâmetro (utm), comparação de janelas (30/17/10 dias lado a lado) |
| **VSL → Pastas** (NOVA org) | hierarquia Produto (pasta) → VSLs, espelhando as pastas do VTurb; produto agrega métricas das suas VSLs |
| **Comparar / Criativos** (existem) | inalterados |

### Endpoints VTurb já mapeados
- `/times/user_engagement` (grouped_timed) → curva de retenção + tabela minuto a minuto
- `/times/user_engagement_by_field` (country, device_type, os, browser, utm_*) → abas de segmentação
- `/sessions/stats` + `/sessions/stats_by_field` → cards e tabela
- `/traffic_origin/stats` + `/valid_utms` → aba Origem do Tráfego + busca de parâmetro
- Rate limit: 60–800 req/min → cache server-side obrigatório

## Requisitos exatos

### A — Webhook com retenção da VSL (prioridade 1)
- [ ] REQ-1: Runner do funil escuta o progresso do player VTurb (smartplayer/postMessage) na lâmina da VSL e grava `vsl_watch_pct` (0–100) na `funnel_sessions` da sessão, atualizado nos marcos 25% / 50% / pitch / 75% / 100%.
- [ ] REQ-2: Novo disparo de webhook `vsl_progress` para a mesma URL configurada no funil (Datacrazy ou outra), payload: `{ event: "vsl_progress", phone, name, slug, player_id, watch_pct, passed_pitch: bool, timestamp }` — disparado a cada marco atingido APÓS o lead já ter sido capturado (casamento por telefone).
- [ ] REQ-3: Se o lead ainda não foi capturado quando o marco dispara, o marco fica gravado na sessão e o webhook de captura (payload existente) passa a incluir o campo `vsl_watch_pct` com o valor atual — sem quebrar o formato atual (campo aditivo).
- [ ] REQ-4: Tracker de watch ≤ 2 KB, vanilla JS, sem dependência, envia via `navigator.sendBeacon` (não bloqueia navegação nem thread principal).

### B — Aba VSL idêntica ao VTurb
- [ ] REQ-5: Curva de retenção por player: gráfico de área escuro com eixo X em mm:ss, hover mostrando % de audiência no segundo apontado, marcador visual do pitch — dados de `/times/user_engagement` (grouped_timed).
- [ ] REQ-6: Tabela minuto a minuto por player: TEMPO ("00:00 a 01:00"…) | % RET. | % QUEDA, calculada da mesma curva; suporta 2+ janelas de período lado a lado (ex.: 30 dias vs 10 dias).
- [ ] REQ-7: Abas de segmentação por player: Países, Dispositivos, SO, Navegadores, Origem do Tráfego — cada uma tabela com Views/Plays/PlayRate/Engajamento por valor do campo (`by_field`).
- [ ] REQ-8: Busca por parâmetro (utm_source, utm_campaign etc.) filtrando as métricas do player (`/valid_utms` + query por utm).
- [ ] REQ-9: Toggle "Visualização de Colunas" na tabela de players (mostrar/ocultar colunas, persistido em localStorage).
- [ ] REQ-10: Botão "Baixar métricas" exportando CSV da tabela visível.

### C — Pastas/Produtos
- [ ] REQ-11: Entidade Produto (nome, emoji/cor) contendo N players VTurb; CRUD no app; player pode ser associado manualmente ou via auto-detecção existente (embed nos funis).
- [ ] REQ-12: Aba VSL lista por Produto (colapsável), com linha agregada do produto (soma/média das VSLs) e drill-down por VSL.

### D — Aba Diário (planilha 37 colunas)
- [ ] REQ-13: Tabela dia a dia do mês selecionado com grupos de colunas: Tráfego (GASTO/ALCANCE/IMPRESSÕES/CPM/CLIQUES/CPC), Funil (VISU/ETAPA1/ÚLT.ETAPA/LEAD + %), VSL (PLAY/CUSTO PLAY/PAGE÷PLAY/PITCH/%PITCH), Checkout (IC/CUSTO IC/%PITCH→IC), Resultado (VENDAS/CPA/APROVADAS/%APROV/RECEITA/RESULTADO).
- [ ] REQ-14: Colunas do próprio DB e do VTurb populam automático; GASTO/ALCANCE/IMPRESSÕES/CLIQUES entram por (a) UTMify se configurado OU (b) input manual por dia (célula editável) — MVP aceita (b).
- [ ] REQ-15: Toda coluna derivada é calculada no app (nunca digitada); divisão por zero exibe "—" (nunca #DIV/0!).
- [ ] REQ-16: Linha TOTAL do período com agregação correta (somas para valores, médias ponderadas para %).
- [ ] REQ-17: Evento IC: clique no botão de checkout da VSL grava evento na sessão (mesma infra de tracking atual) → coluna IC.
- [ ] REQ-18: Export CSV do mês.
- [ ] REQ-21: Drill-down do dia (replica as abas diárias da planilha ABR QUIZ 2.1): clicar numa linha do Diário abre o detalhe do dia quebrado por **PERFIL de anúncio + VSL** (colunas PERFIL | VIDEO VTURB | mesmas métricas do Diário | linha TOTAL). MVP: PERFIL vem de input manual ou do utm (utm_source/utm_campaign) quando presente na sessão; VSL vem do player detectado no funil.

### E — Performance (restrição transversal)
- [ ] REQ-19: ZERO peso novo nas rotas públicas do funil além do tracker do REQ-4 (≤2 KB). Todo o resto é admin-only, code-split por rota (já validado: analytics não entra no bundle do funil).
- [ ] REQ-20: Chamadas VTurb sempre server-side com cache (revalidate ≥ 300s) e agrupamento por player — nunca do browser, nunca 1 req por linha de tabela.

## Casos extremos a tratar
- EDGE-1: Sessão sem telefone (lead não capturado) atinge marco → grava na sessão, NÃO dispara webhook `vsl_progress` (sem telefone não há casamento).
- EDGE-2: Lead volta e reassiste → `vsl_watch_pct` só aumenta (max), marcos não re-disparam webhook duplicado (flag por marco na sessão).
- EDGE-3: VTurb rate limit / fora do ar → aba VSL mostra último cache + aviso "dados de HH:MM"; nunca quebra a página.
- EDGE-4: Player no funil sem dados no VTurb (vídeo novo) → linha com "—", sem erro.
- EDGE-5: Dia sem tráfego/sem dados → linha zerada com "—" nos derivados (nunca #DIV/0!).
- EDGE-6: GASTO não informado no dia → colunas de custo mostram "—" e TOTAL ignora o dia nos custos médios.
- EDGE-7: Funil com 2 players (VSL A/B) → cada player rastreado separado; `vsl_progress` leva `player_id`.
- EDGE-8: adblock bloqueia beacon → falha silenciosa, funil segue normal.
- EDGE-9: Dia com sessões sem PERFIL identificável (sem utm e sem input manual) → agrupadas em linha "(sem perfil)" no drill-down; TOTAL do dia continua batendo com a linha do Diário.

## Fora de escopo
- Integração Hotmart/UTMify automática para VENDAS/RECEITA (fase 2 — MVP usa input manual no Diário).
- "Criar Grupo" de comparação estilo VTurb (usar a aba Comparar existente).
- Conversões/receita DENTRO do VTurb (exige postback de venda no VTurb — não configurado).
- Headlines A/B do VTurb.
- App mobile / iOS.

## Definição de "concluído"
- [ ] Todos os REQ implementados; cada um verificável na UI local (localhost:3005) via DevTools/Playwright.
- [ ] Webhook `vsl_progress` testado ponta a ponta: sessão real → marco → payload chega no webhook de teste com phone + watch_pct corretos.
- [ ] Curva de retenção e tabela minuto a minuto batem com o painel VTurb (mesmo player, mesmo período — tolerância de arredondamento).
- [ ] Aba Diário reproduz a planilha para um mês de exemplo sem nenhum #DIV/0!.
- [ ] `npm run build` verde; bundle das rotas públicas do funil sem crescimento além do tracker (verificar com build output antes/depois).
- [ ] Validação local do Luca (folhear abas) → só então push/deploy.

## Notas pra /review
- REQ-4/19: comparar `npm run build` first-load JS da rota `/q/[slug]` (ou rota pública equivalente) antes/depois.
- REQ-2: usar webhook.site como alvo pra inspecionar payload.
- REQ-5/6: screenshot lado a lado app × painel VTurb do mesmo player/período.
- REQ-15/16: conferir TOTAL contra a planilha original (mesmos inputs → mesmos números, exceto linhas com fórmula quebrada na planilha, ex. 14/01/2025).
- REQ-20: checar Network no admin — 1 chamada `/api/vturb` por load, não N.
