# CTFUNNEL — Plano de Correção (dashboard, abas, colunas e ferramentas)

> Gerado por mapeamento automatizado de 5 superfícies do app (12 agentes em paralelo).
> **363 itens mapeados · 192 ações propostas.**
> Data: 2026-07-27

## Como ler

- 🔴 **crítico** = o número exibido está ERRADO ou a função não funciona
- 🟡 **importante** = o número é ambíguo ou incompleto
- 🟢 **melhoria** = polimento
- **Depende de** = o que precisa existir antes (migration, token, inspeção). `nada` = dá pra fazer já.

## Quadro geral

| Superfície | Itens | ok | impreciso | quebrado | não existe | Ações |
|---|---|---|---|---|---|---|
| Dashboard Global (/analytics) | 103 | 23 | 39 | 25 | 9 | 55 |
| Painel por Funil (Leads > Respostas/Resultados/Performance) | 51 | 6 | 35 | 5 | 2 | 34 |
| Construtor (Construtor/Fluxo/Design/Leads) | 102 | 41 | 36 | 12 | 13 | 44 |
| VSL / Admin | 65 | 17 | 22 | 6 | 16 | 32 |
| Camada de Dados e Rotas | 42 | 5 | 14 | 5 | 9 | 27 |

**Total:** 363 itens · {"quebrado":53,"nao-existe":49,"ok":92,"impreciso":146,"vazio":13,"duplicado":10}  
**Ações:** 55 críticas · 92 importantes · 45 melhorias · **138 sem dependência (executáveis já)**

---

## Dashboard Global (/analytics)

### 🔴 Dashboard Global > transversal (ordem de deploy)

**Ação:** Aplicar a migration 0014 no Supabase de PRODUÇÃO antes de qualquer push. Abrir supabase/migrations/0014_hydrated_at.sql, colar no SQL Editor do projeto do quizfunnel e rodar (add column hydrated_at + backfill via step_events + índice). NÃO fazer push do código atual antes disso: com a coluna inexistente, track.ts:41 quebra a GRAVAÇÃO da sessão (upsert 400) e as 4 leituras de metrics.ts recebem 400 → painel inteiro vira 'funil morto'. Ordem obrigatória: rodar 0014 → validar por SQL → push.

- **Arquivo:** `supabase/migrations/0014_hydrated_at.sql (aplicar); consumido em src/lib/quiz/metrics.ts:57,59,356,375; gravado em src/lib/quiz/track.ts:41`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** migration 0014 (acesso ao SQL Editor do Supabase)
- **Como validar:** SQL: select count(*) total, count(hydrated_at) hidratadas from public.funnel_sessions;  →  total=375 e hidratadas ≈ (select count(distinct session_id) from step_events). Depois: /analytics com o card 'Sessões' ≠ 0 e igual ao count de hidratadas.

### 🔴 Dashboard Global > Visão Geral > cards Respostas/Conclusões · Comparar · Operação · VSL

**Ação:** Fazer push do commit local 7ded91c (fix do ensureSession: parou de mandar max_step_reached:0 no upsert) E criar supabase/migrations/0015_backfill_max_step.sql com: update public.funnel_sessions s set max_step_reached = greatest(coalesce(s.max_step_reached,0), e.mx) from (select session_id, max(step_index) mx from public.step_events group by 1) e where e.session_id = s.session_id and e.mx > coalesce(s.max_step_reached,0); — sem o backfill, as 265 sessões zeradas pelo bug continuam subcontando o histórico para sempre.

- **Arquivo:** `src/lib/quiz/track.ts:36-51 (commit 7ded91c, não pushado) + novo supabase/migrations/0015_backfill_max_step.sql`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** migration 0014 aplicada antes (mesma janela de deploy)
- **Como validar:** SQL em cdb-01: select count(*) from funnel_sessions where funnel_slug='cdb-01' and max_step_reached >= <lastI do funil>;  →  12 (bate com os 12 registros de funnel_leads do cdb-01; o painel mostrava 9 em 24/07). Rodar antes/depois e comparar o delta.

### 🔴 Dashboard Global > transversal (catch silencioso)

**Ação:** Parar de engolir erro do PostgREST. Criar em metrics.ts um helper `function must<T>(res:{data:T|null;error:{message:string}|null}, ctx:string): T { if (res.error) throw new Error(`${ctx}: ${res.error.message}`); return res.data as T; }` e usá-lo em TODAS as leituras (substituindo `?? []`, `count ?? 0` e os catch vazios). globalAnalytics passa a devolver, por bloco, `{ ok:false, erro:string }`; GlobalAnalyticsView renderiza banner vermelho 'Métrica indisponível — <mensagem>' no lugar do número. Nunca mais pintar 0 quando a query falhou.

- **Arquivo:** `src/lib/quiz/metrics.ts:57-59, 62, 65, 72, 161-167, 214-226 (catch vazio), 310-313, 361-365, 370-382 (catch { return 0 })`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Em dev, trocar temporariamente `.not("hydrated_at","is",null)` por uma coluna inexistente e recarregar /analytics: a tela tem que mostrar o banner com a mensagem do PostgREST (42703), NÃO '0'. Print da tela com o banner.

### 🔴 Dashboard Global > Quiz > cards de pergunta / contador 'N respostas'

**Ação:** Parar de mergear os 15 funis. Trocar a query para `select("funnel_slug,question,answer")` e agregar com chave composta `${funnel_slug}||${question}`; no card, exibir badge com o /slug do funil ao lado do título da pergunta. Enquanto não houver filtro global de funil, ordenar por funnel_slug e depois por volume.

- **Arquivo:** `src/lib/quiz/metrics.ts:162, 168-182 (qMap) ; render em src/components/dashboard/GlobalAnalyticsView.tsx:304-308`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** SQL: select funnel_slug, count(*) from quiz_answers where question ilike 'Idade%' group by 1;  →  hoje a tela mostra 1 card somando 9 funis; depois do fix tem que aparecer 1 card por funil e a soma dos cards = o total do SQL.

### 🔴 Dashboard Global > Quiz > lista de perguntas (corte das 10 primeiras)

**Ação:** Remover o `.slice(0, 10)` e tornar a saída determinística: adicionar `.order("funnel_slug").order("created_at")` na query de quiz_answers e ordenar as perguntas por volume desc antes de renderizar. Se a lista ficar longa, paginar na UI (mostrar 10 + botão 'ver todas as N perguntas'), nunca descartar em silêncio.

- **Arquivo:** `src/lib/quiz/metrics.ts:162 (sem ORDER BY) e :176 (slice(0,10))`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** SQL: select count(distinct question) from quiz_answers;  →  47. A aba Quiz tem que declarar 47 perguntas (paginadas), e dois refreshes seguidos têm que mostrar exatamente as mesmas 10 primeiras.

### 🔴 Dashboard Global > VSL (aba inteira)

**Ação:** Desacoplar a seção VTurb do banco próprio. Trocar a condição `tab === 'vsl' && (vsls.length ? ... : <ComingSoon/>)` por render incondicional da seção VTurb, e aplicar o ComingSoon SOMENTE ao bloco 'VSL por funil'. Uma falha do Supabase não pode apagar um painel que vem da API do VTurb.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:160-163 (vsls) e :455 / :611 (gate + ComingSoon)`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Em dev, forçar data.operacao=[] (ou derrubar o Supabase) e abrir /analytics?tab=vsl: a tabela do VTurb com Views/Plays/Play Rate tem que continuar renderizando. Print.

### 🔴 Dashboard Global > Criativos > coluna Cliques / Conversão

**Ação:** Aplicar o mesmo filtro de hidratação da aba Operação na query de criativos: acrescentar `.not("hydrated_at","is",null)` ao select de funnel_sessions e renomear a coluna de 'Cliques' para 'Sessões' (é sessão hidratada, não clique de anúncio). Atualizar a nota de rodapé que hoje afirma 'Cliques = sessões'.

- **Arquivo:** `src/lib/quiz/metrics.ts:163 (query sem filtro) e :194 (e.clicks++); UI em src/components/dashboard/GlobalAnalyticsView.tsx:432, :442, :451`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** migration 0014
- **Como validar:** SQL: select count(*) filter (where hydrated_at is not null) as reais, count(*) as brutas from funnel_sessions where utm_content is not null;  →  hoje a aba soma 266 brutas e o real é 78. Depois do fix a soma da coluna na tela tem que bater com 'reais'.

### 🔴 Dashboard Global > Criativos > coluna Criativo (chave de agregação)

**Ação:** Normalizar a chave do criativo antes de agregar: `const key = content.split('|')[0].trim()` (remove o ID de conjunto que racha '0691' em 3 linhas) e, quando utm_content for puramente numérico (ad_id do Google), usar `${utm_campaign} · ${utm_content}` como rótulo pra não virar uma linha ilegível de 103 sessões. Remover o fallback `|| utm_campaign` da chave (campanha se disfarçando de criativo) e mandar quem não tem utm_content pro balde '(sem criativo)'.

- **Arquivo:** `src/lib/quiz/metrics.ts:191-198 (chave de sessão) e :202 (chave de lead)`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** SQL: select split_part(utm_content,'|',1) k, count(*) from funnel_sessions where utm_content ilike '0691%' group by 1;  →  1 linha só. Na tela, o criativo '0691' tem que aparecer 1 vez com a soma das 3 linhas atuais.

### 🔴 Dashboard Global > Visão Geral > cards Sessões/Respostas/Leads/Conclusões + Leads > contador

**Ação:** Unificar o universo de contagem. Em dashboardMetrics, além de somar por funil existente, criar um bucket 'Funis removidos' com os slugs órfãos e somá-lo aos totais (ou, alternativamente, filtrar a aba Leads pelos mesmos slugs). Hoje o card Leads da Visão Geral diz 49 (soma por funil) e a aba Leads diz 51 (count exact) — o mesmo conceito com dois números na mesma tela.

- **Arquivo:** `src/lib/quiz/metrics.ts:64-72 (agrupamento por slug), :82-83 (totais) vs :165/:216 (count exact da aba Leads)`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** SQL: select count(*) from funnel_leads;  →  51; e select count(*) from funnel_leads l where not exists (select 1 from funnels f where f.slug=l.funnel_slug);  →  2. Depois do fix, card 'Leads' da Visão Geral e contador da aba Leads têm que exibir o MESMO número (51) ou explicitar o recorte.

### 🔴 Dashboard Global > VSL > retenção real (vsl_watch_pct)

**Ação:** Consertar o tracking morto: (1) o regex de extração aceita só ID hex de 24 chars, enquanto o /api/vturb já reconhece TAMBÉM o formato UUID — se o embed usa UUID, extractPlayerId devolve null e attachVslWatch é um no-op silencioso. Alinhar o PLAYER_RE com o UUID_RE do route.ts. (2) Validar no browser (DevTools em /q/cdb-01, console: `window.smartplayer?.instances`) se o objeto existe no player atual; se a API mudou, trocar o polling pelo evento do custom element vturb-smartplayer. (3) Depois de gravar dados, LER vsl_watch_pct em metrics.ts e exibir na tabela 'VSL por funil'.

- **Arquivo:** `src/lib/quiz/vsl-watch.ts:12 (PLAYER_RE só 24-hex) vs src/app/api/vturb/route.ts:36 (UUID_RE aceita os dois) ; attach em vsl-watch.ts:65-77 ; leitura ausente em src/lib/quiz/metrics.ts`
- **Severidade:** critico · **Esforço:** alto
- **Depende de:** inspeção no browser (DevTools em /q/<slug> com a VSL)
- **Como validar:** Abrir /q/<funil com VSL>, assistir 30s, e rodar: select session_id, vsl_watch_pct, vsl_player_id from funnel_sessions order by created_at desc limit 5;  →  vsl_watch_pct > 0 e vsl_player_id preenchido. Cruzar com o Play Rate do painel do VTurb para o mesmo dia.

### 🟡 Dashboard Global > Visão Geral > hero 'Funil em destaque'

**Ação:** Trocar o critério implícito (operacao[0] após sort por visitantes desc) por um explícito e à prova de empate: escolher o funil com mais LEADS no período e, se todos os candidatos tiverem 0 visitante, não renderizar o hero (mostrar no lugar um card 'Sem tráfego no período'). Adicionar o /slug no subtítulo pra ficar claro qual funil está em destaque.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:117 (topFunnel), :195-215 (hero) ; ordenação em src/lib/quiz/metrics.ts:150`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** migration 0014
- **Como validar:** Print: o nome no hero tem que ser o mesmo funil da 1ª linha da aba Operação em 3 refreshes seguidos, e o subtítulo tem que bater com Sessões/Conclusão dessa linha.

### 🟡 Dashboard Global > shell (filtro de período)

**Ação:** Propagar DateRange de ponta a ponta: `globalAnalytics(range?: DateRange)` → repassar para dashboardMetrics (adicionar gte/lte de created_at nas 4 queries), para funnelMetrics(f.slug, range) e para as 5 queries de quiz/tráfego/criativos/leads. Na page, ler ?from/?to dos searchParams; no shell, adicionar seletor Hoje/Ontem/7d/30d/Personalizado que atualiza a URL. Isso também resolve o filtro de período que falta na aba Criativos.

- **Arquivo:** `src/lib/quiz/metrics.ts:50 (dashboardMetrics sem params), :137-142 (funnelMetrics sem range), :161-167 (queries sem data) ; src/app/analytics/page.tsx:10-12 ; barra em src/components/dashboard/GlobalAnalyticsView.tsx:183-190`
- **Severidade:** importante · **Esforço:** alto
- **Depende de:** nada
- **Como validar:** Selecionar 'Ontem' e conferir contra SQL: select count(*) from funnel_sessions where hydrated_at is not null and created_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo') - interval '1 day' and created_at < date_trunc('day', now() at time zone 'America/Sao_Paulo');  →  igual ao card Sessões.

### 🟡 Dashboard Global > shell (filtro por funil)

**Ação:** Adicionar um seletor global de funil ao lado das abas (multi-select com os slugs de data.operacao), guardado na URL como ?funnel=slug1,slug2, aplicado no servidor em globalAnalytics (filtrar as queries por `.in('funnel_slug', slugs)`). Sem isso, Quiz/Tráfego/Leads somam 15 variantes do MESMO produto e escondem o resultado do teste A/B.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:183-190 (barra de abas, sem controles) ; src/lib/quiz/metrics.ts:137-167`
- **Severidade:** importante · **Esforço:** alto
- **Depende de:** nada
- **Como validar:** Escolher só cdb-01 e conferir: o card Sessões tem que bater com select count(*) from funnel_sessions where funnel_slug='cdb-01' and hydrated_at is not null; e a aba Quiz só pode listar perguntas desse funil.

### 🟡 Dashboard Global > Comparar / Operação / VSL (taxas 0/0)

**Ação:** Distinguir 'sem base' de 'zero'. Criar um helper `pctOrDash(a,b)` que devolve null quando b===0 e renderiza '—' (com title 'sem visitantes no período'), aplicando em: % que respondem, % que viram lead, Taxa de conclusão, coluna Conclusão da Operação e % de chegada da VSL. Um funil com 16 leads jamais pode exibir '0%' de conversão.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:271, :273, :275, :334, :162/:600 ; fórmula em src/lib/quiz/metrics.ts:389-390`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Print com um funil de visitantes=0: as colunas de % têm que mostrar '—', não '0%'. Nenhuma linha com leads>0 pode exibir 0% de conversão.

### 🟡 Dashboard Global > Comparar > linha 'Conclusões (VSL)' e VSL > coluna 'Chegaram na VSL'

**Ação:** Renomear os dois rótulos para 'Chegou na última lâmina' e mover 'Conclusões (VSL)' de nome só quando existir vsl_watch_pct real. Adicionar tooltip: 'mede max_step_reached ≥ índice da última lâmina ativa — não mede play/retenção do vídeo'. Enquanto o rótulo disser VSL, o time lê como retenção de vídeo e decide errado.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:274 (Comparar) e :591/:599 (tabela VSL por funil) ; cálculo em src/lib/quiz/metrics.ts:338-347`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Print das duas telas com o novo rótulo + tooltip. Conferir que nenhuma coluna chamada 'VSL' usa max_step_reached como fonte.

### 🟡 Dashboard Global > Tráfego > gráfico Origens

**Ação:** Incluir as sessões sem UTM no gráfico como bucket '(sem origem)' (hoje o `if (srcVal)` descarta 109 de 375 e os % saem sobre 266) e REMOVER o fallback morto `|| s.src` (funnel_sessions.src é NULL em 100% das linhas). Renderizar também o campo traffic.total já calculado, como subtítulo 'X de Y sessões rastreadas'.

- **Arquivo:** `src/lib/quiz/metrics.ts:186, :188 (descarte), :228, :241 (traffic.total nunca renderizado) ; render em src/components/dashboard/GlobalAnalyticsView.tsx:315`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** SQL: select count(*) filter (where utm_source is null) sem_utm, count(*) total from funnel_sessions;  →  109 / 375. Na tela, a barra '(sem origem)' tem que mostrar 109 e a soma de todas as barras tem que ser 375.

### 🟡 Dashboard Global > Tráfego > gráfico Campanhas

**Ação:** Remover o fallback `|| utm_source || src` da chave de campanha (linha 187): campanha nula tem que cair em '(sem campanha)', nunca exibir 'FB'/'google' — que são ORIGENS — dentro de um gráfico chamado 'Campanhas'. Trocar o topN(8) fixo por top 8 + linha 'outros (N campanhas)'.

- **Arquivo:** `src/lib/quiz/metrics.ts:187, :229 (topN 8) ; render em src/components/dashboard/GlobalAnalyticsView.tsx:316`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** SQL: select count(distinct utm_campaign) from funnel_sessions where utm_campaign is not null;  →  19. Na tela: 8 barras + linha 'outros (11)', e nenhum valor da coluna Origens repetido em Campanhas.

### 🟡 Dashboard Global > Tráfego (origem × conversão)

**Ação:** Adicionar ao lado dos dois gráficos uma tabela 'Origem × Leads': agregar funnel_leads por utm_source (a aba Criativos já faz esse join em metrics.ts:201-211) e exibir colunas Sessões · Leads · Taxa. Sem isso a aba responde 'de onde vem o tráfego' mas nunca 'qual origem converte'.

- **Arquivo:** `src/lib/quiz/metrics.ts:185-199 (só conta sessão) ; nova seção em src/components/dashboard/GlobalAnalyticsView.tsx:313-318`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** A soma da coluna Leads da nova tabela tem que bater com select count(*) from funnel_leads where utm_source is not null;  →  36 (51 menos os 15 sem UTM), com o restante numa linha '(sem origem)'.

### 🟡 Dashboard Global > Criativos > colunas Origem e Campanha

**Ação:** Parar de congelar o primeiro valor visto (`if (!e.source) e.source = srcVal`). Agregar por (criativo × origem) ou, mantendo 1 linha por criativo, guardar um Set e renderizar 'vários (2)' com tooltip listando os valores quando houver mais de um. Hoje, se o mesmo utm_content roda em FB e Google, a coluna mente para metade das sessões.

- **Arquivo:** `src/lib/quiz/metrics.ts:193-194 e :206-207 ; colunas em src/components/dashboard/GlobalAnalyticsView.tsx:440-441`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** SQL: select utm_content, count(distinct utm_source) from funnel_sessions where utm_content is not null group by 1 having count(distinct utm_source) > 1;  →  toda linha retornada tem que aparecer como 'vários' na tela.

### 🟡 Dashboard Global > Criativos > coluna Leads

**Ação:** Parar de descartar lead sem UTM. Trocar o `if (!content) continue;` por agrupamento no balde '(sem atribuição)', que passa a aparecer como linha própria na tabela. 15 dos 51 leads (29%) hoje somem da aba e o numerador da conversão fica amputado.

- **Arquivo:** `src/lib/quiz/metrics.ts:201-203`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** SQL: select count(*) from funnel_leads where coalesce(utm_content,utm_campaign,src) is null;  →  15. A soma da coluna Leads da tabela (incluindo '(sem atribuição)') tem que dar 51.

### 🟡 Dashboard Global > Criativos > colunas Gasto / CPL / CPA / ROAS

**Ação:** Ligar o custo: criar rota /api/utmify/spend (ou ingest diário numa tabela ad_spend com colunas date, ad_id, adset_id, campaign_id, spend) e cruzar com o utm_content normalizado da ação de chave de criativo; adicionar as colunas Gasto, CPL (gasto÷leads) e CPA na tabela e usar CPL como critério padrão de ordenação. Sem custo a aba não responde 'qual anúncio dá lucro'.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:432 (thead) e :451 (nota 'entram ao ligar a UTMify') ; src/lib/quiz/metrics.ts:230-238`
- **Severidade:** importante · **Esforço:** alto
- **Depende de:** gasto da UTMify (ou Meta Ads API)
- **Como validar:** O total da coluna Gasto do dia D tem que bater com o gasto do mesmo dia no painel da UTMify (tolerância ±1%), e o CPL do criativo campeão tem que bater com gasto÷leads calculado à mão.

### 🟡 Dashboard Global > Vendas (rastreio de CTA/checkout)

**Ação:** Instrumentar o fim do funil: no clique do CTA/checkout, chamar trackStep com step_type='cta_click' (e meta: {href, produto}) e gravar também um evento 'checkout_redirect'. Hoje o rastro morre em 'chegou na última lâmina' — não se sabe quem clicou em comprar.

- **Arquivo:** `src/lib/quiz/track.ts:62-98 (trackStep) ; handlers de CTA em src/components/quiz/steps.tsx e src/components/quiz/layers/blocks.tsx`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Clicar no CTA em /q/cdb-01 e rodar: select step_type, count(*) from step_events where session_id like '%cdb-01' group by 1;  →  aparece linha cta_click. Print do DevTools mostrando o POST.

### 🟡 Dashboard Global > Vendas (aba inteira)

**Ação:** Criar a tabela public.sales (migration 0016: id, order_id, product_id, status, amount, buyer_email_hash, session_id, utm_*, created_at) + rota /api/webhooks/hotmart validando o Hottok, e trocar o ComingSoon por: Receita, Ticket médio, Conversão lead→venda e Vendas por criativo (join por session_id/utm_content).

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:371 (ComingSoon) ; nova rota src/app/api/webhooks/hotmart/route.ts ; nova migration supabase/migrations/0016_sales.sql`
- **Severidade:** importante · **Esforço:** alto
- **Depende de:** Hottok da Hotmart (token do webhook)
- **Como validar:** Faturamento do dia D na aba Vendas tem que bater com o relatório de vendas da Hotmart do mesmo dia (mesmo produto, mesmo fuso), diferença zero em quantidade de pedidos.

### 🟡 Dashboard Global > Diagnóstico (aba inteira)

**Ação:** Implementar o cruzamento prometido: reaproveitar o join session_id que já existe em /api/export-leads:31-41 para montar, por pergunta e por opção, 'respondentes × viraram lead × taxa'. Substituir o ComingSoon por essa tabela com filtro por funil.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:372 (ComingSoon) ; referência do join em src/app/api/export-leads/route.ts:31-41 ; nova função em src/lib/quiz/metrics.ts`
- **Severidade:** importante · **Esforço:** alto
- **Depende de:** nada
- **Como validar:** SQL de controle: select a.answer, count(distinct a.session_id) resp, count(distinct l.session_id) leads from quiz_answers a left join funnel_leads l using (session_id) where a.question='Idade' group by 1;  →  os números da tela têm que ser idênticos.

### 🟡 Dashboard Global > VSL > seção VTurb > vínculo player↔funil

**Ação:** Trocar a heurística por vínculo explícito: gravar o player_id escolhido em funnels.settings.vturb.playerId (campo novo no builder) e usar o regex do embed apenas como fallback. Na tabela, quando o vínculo vier do fallback, marcar com badge 'detectado automaticamente'.

- **Arquivo:** `src/app/api/vturb/route.ts:36-49 (UUID_RE sobre JSON.stringify) ; coluna em src/components/dashboard/GlobalAnalyticsView.tsx:535`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Depois de setar o playerId em 1 funil, a linha correspondente na tabela VTurb tem que sair de '— (manual)' para o /slug certo; conferir o mesmo player no painel do VTurb (mesmo nome e mesma duração).

### 🟡 Dashboard Global > VSL > seção VTurb (período)

**Ação:** Substituir o texto hardcoded 'últimos 30 dias' por um seletor de período no cabeçalho da tabela, cujo estado é passado tanto para loadVturb (query from/to de /api/vturb, que já aceita os params) quanto para o VslDetail e o VslCompare. Hoje trocar o período no detalhe deixa a tabela de cima em outra janela, sem aviso.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:460 (label) e :149-155 (loadVturb sem from/to) ; consumo em src/app/api/vturb/route.ts:24 ; VslDetail em src/components/dashboard/VslDetail.tsx:63-83`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Selecionar 'Hoje' e conferir que Views/Plays da tabela batem exatamente com o painel do VTurb filtrado em Hoje, e que o detalhe aberto mostra o mesmo total de espectadores.

### 🟡 Dashboard Global > VSL > tabela VTurb e VslCompare (Receita/Conversões)

**Ação:** Exibir o que já chega no client: adicionar coluna 'Receita' (stats.amountBrl, formatada em BRL) na tabela VTurb e incluir Conversões, Conv.% e Receita no array METRICS do VslCompare — hoje o único número de faturamento do painel trafega do servidor e não é renderizado em lugar nenhum.

- **Arquivo:** `src/app/api/vturb/route.ts:64 (amountBrl) ; thead/tbody em src/components/dashboard/GlobalAnalyticsView.tsx:523 e :536-543 ; src/components/dashboard/VslCompare.tsx:60-68`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** A Receita exibida para um player em 30 dias tem que bater com o valor do mesmo período no painel do VTurb (aba de conversões), e as métricas do VslCompare têm que coincidir linha a linha com a tabela de cima.

### 🟡 Dashboard Global > VSL (dois painéis com o mesmo título)

**Ação:** Renomear o painel do banco próprio (cmpVsl) para '⚖️ Comparação por funil (tracking do CTFUNNEL)' e o do VslCompare para '⚖️ Comparação de players (VTurb)', cada um com uma linha de fonte de dados embaixo do título. Dois blocos com título idêntico e fontes diferentes na mesma aba é impossível de auditar.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:561 (título cmpVsl) e src/components/dashboard/VslCompare.tsx:74 (título VTurb)`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Print da aba VSL com os dois blocos abertos: títulos distintos e legenda de fonte visível em cada um.

### 🟡 Dashboard Global > VSL > detalhe do player > período Personalizado

**Ação:** Corrigir o retorno mudo: mover o `if (!applied) return` para DEPOIS de um `setState('aguardando')` (novo estado) que renderiza 'Escolha as datas e clique em Aplicar' no lugar do gráfico. Hoje o botão fica marcado como selecionado enquanto o gráfico continua mostrando o período anterior.

- **Arquivo:** `src/components/dashboard/VslDetail.tsx:63-83 (load, linha 68) e :141-166 (botões de período)`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Clicar em 'Personalizado' sem aplicar: o gráfico tem que sumir e mostrar a mensagem; depois de Aplicar, o total de espectadores tem que mudar. Print dos dois estados.

### 🟡 Dashboard Global > VSL > comparação de players (VslCompare)

**Ação:** Memoizar o prop rows no pai: extrair `const cmpVturbRows = useMemo(() => typeof vturb === 'object' ? vturb.vsls.filter(v => cmpPlayers.includes(v.playerId)).map(...) : [], [vturb, cmpPlayers])` e passar essa referência estável. Hoje o array é criado inline no JSX e o useEffect [rows] refaz TODAS as chamadas à API do VTurb a cada re-render do painel.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:553 (prop inline) ; efeito em src/components/dashboard/VslCompare.tsx:28-52`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** DevTools > Network filtrando /api/vturb/detail: marcar 2 players, depois abrir/fechar um detalhe e trocar de aba — o número de requests não pode aumentar (hoje repete N por interação).

### 🟡 Dashboard Global > transversal (step_events write-only)

**Ação:** Passar a derivar as métricas de etapa de step_events em vez de max_step_reached: criar uma view/RPC `funnel_progress` (session_id, funnel_slug, max(step_index) as step, min(created_at), max(created_at)) e usá-la em funnelMetrics/dashboardMetrics. Habilita também o funil por lâmina (quantos passaram em cada step_id), que hoje não existe apesar das 2040 linhas gravadas.

- **Arquivo:** `escrita em src/lib/quiz/track.ts:78 ; leitura inexistente — src/lib/quiz/metrics.ts:370-388 usa max_step_reached ; nova migration supabase/migrations/0017_funnel_progress.sql`
- **Severidade:** importante · **Esforço:** alto
- **Depende de:** migration 0014 e backfill de max_step (ação do 0015)
- **Como validar:** SQL: select count(*) from (select session_id, max(step_index) s from step_events group by 1) x where s >= <lastI>;  →  esse número tem que ser IGUAL à coluna Conclusões do funil na aba Operação.

### 🟡 Dashboard Global > transversal (N+1 de queries)

**Ação:** Trocar os ~130 round-trips por página: criar uma RPC `analytics_overview(p_from, p_to)` que devolve em UMA query as contagens por funil (visitantes/respostas/conclusões/leads) via agregação SQL, e remover o loop `funis.map(f => funnelMetrics(f.slug))`. Depois disso, trocar force-dynamic por `export const revalidate = 60` (ou unstable_cache com tag) na page.

- **Arquivo:** `src/lib/quiz/metrics.ts:139-142 (loop de funnelMetrics) e :369-388 (6 counts por funil) ; src/app/analytics/page.tsx:6 (force-dynamic)`
- **Severidade:** importante · **Esforço:** alto
- **Depende de:** nada
- **Como validar:** DevTools > Network: TTFB de /analytics abaixo de 1,5s; e nos logs do Supabase (Postgres > Query performance) o número de statements por page load tem que cair de ~130 para <15. Números na tela idênticos antes/depois.

### 🟡 Dashboard Global > transversal (lógica de estágios duplicada)

**Ação:** Eliminar a duplicação: exportar uma única função `stageIndicesFor(funnel)` (a versão de stageIdx, que já trata typebot + lâminas desativadas) e chamá-la tanto em dashboardMetrics quanto em funnelMetrics, deletando o segundo caminho. Fazer as duas lerem a MESMA fonte (resolveFunnel), não uma query crua em funnels de um lado e resolveFunnel do outro.

- **Arquivo:** `src/lib/quiz/metrics.ts:33-48 (stageIdx) vs :277-298 (stageIndices) e :329-347 (bloco duplicado dentro de funnelMetrics)`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Assert de consistência: a soma da coluna Respostas da aba Operação tem que ser exatamente igual ao card 'Respostas' da Visão Geral (hoje podem divergir sem erro). Conferir em 3 funis typebot e 3 layers.

### 🟡 Dashboard Global > Leads > botão Exportar CSV

**Ação:** Dois consertos: (1) remover a coluna 'Email' do cabeçalho e o `(l as Record<string,unknown>).email` (funnel_leads não tem essa coluna — sai sempre vazia) OU adicionar `email text` via migration se a captura passar a pedir email; (2) trocar o `<a href="/api/export-leads">` por um onClick que faz fetch, checa `res.ok` e só então cria o Blob/download — hoje, sem sessão, o browser navega para um JSON 401.

- **Arquivo:** `src/app/api/export-leads/route.ts:46 (header) e :62 (campo inexistente) ; botão em src/components/dashboard/GlobalAnalyticsView.tsx:349`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Baixar o CSV e abrir no Excel: nenhuma coluna vazia no cabeçalho. Em aba anônima, clicar em Exportar tem que mostrar toast 'sessão expirada', não abrir JSON. Print dos dois.

### 🟡 Dashboard Global > Leads > coluna Quando

**Ação:** Fixar o fuso: trocar `new Date(l.when).toLocaleString('pt-BR', {...})` por `{...opts, timeZone: 'America/Sao_Paulo'}`, igual ao resto do arquivo (metrics.ts:20-22). Hoje o SSR renderiza em UTC (Vercel) e o valor muda sozinho depois da hidratação — pode aparecer 3h adiantado.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:361`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Comparar a hora do lead mais recente na tela com select created_at at time zone 'America/Sao_Paulo' from funnel_leads order by created_at desc limit 1;  →  idênticas, e sem mudar entre o HTML inicial (view-source) e depois da hidratação.

### 🟡 Dashboard Global > Leads > tabela (12 de 51)

**Ação:** Trocar o `limit(50).slice(0,12)` por paginação real: aceitar ?page/?q na page, buscar com `.range(offset, offset+24)` e adicionar na UI busca por nome/telefone, filtro por funil e botão 'carregar mais', além de rotular 'mostrando 12 de 51'. Hoje 38 linhas são buscadas do banco e jogadas fora e o 13º lead só existe no CSV.

- **Arquivo:** `src/lib/quiz/metrics.ts:166 (limit 50) e :217 (slice 0,12) ; tabela em src/components/dashboard/GlobalAnalyticsView.tsx:351-366`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Paginar até o fim e contar as linhas: 51, igual a select count(*) from funnel_leads;. Buscar por um telefone conhecido tem que trazer o lead.

### 🟡 Dashboard Global > Operação > tabela (ordenação/filtro)

**Ação:** Tornar os cabeçalhos Sessões/Respostas/Leads/Conclusão/Score clicáveis (sort client-side com indicador ▲▼) e adicionar campo de busca por nome//slug + select de status, espelhando o que a aba Criativos já tem em GlobalAnalyticsView.tsx:416-425.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:321-342 (tabela sem controles) ; ordem fixa em src/lib/quiz/metrics.ts:150`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Clicar em 'Leads' ordena desc e a 1ª linha tem que ser o funil com mais leads segundo select funnel_slug, count(*) from funnel_leads group by 1 order by 2 desc limit 1;. Print.

### 🟡 /analytics (página inteira) — gate de autenticação

**Ação:** CORREÇÃO DO DIAGNÓSTICO: /analytics NÃO é público. O Next 16 renomeou middleware.ts → proxy.ts, e src/proxy.ts + src/lib/supabase/proxy.ts:5 já listam '/analytics' em PROTECTED (redirect para /admin/login com allowlist por ADMIN_EMAIL). O que falta é defesa em profundidade: adicionar no topo da page `const g = await requireAdmin(); if (!g.ok) redirect('/admin/login');` (import de @/lib/quiz/admin-guard e de next/navigation) ANTES do globalAnalytics(), para que a página com service_role nunca dependa só do matcher.

- **Arquivo:** `src/app/analytics/page.tsx:10-12 (sem guard) ; gate real em src/proxy.ts:12-22 e src/lib/supabase/proxy.ts:5,57-61 ; helper pronto em src/lib/quiz/admin-guard.ts:10`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** curl -si https://<host>/analytics | head -1  →  307 com Location /admin/login (comportamento atual). Depois do fix, comentar o matcher em src/proxy.ts em dev e conferir que a página AINDA redireciona.

### 🟢 Dashboard Global > cabeçalho > botão ← Voltar

**Ação:** Trocar o `window.history.pushState` do setTab por `replaceState` (a aba deixa de empilhar histórico) ou apontar o botão ← para `router.push('/dashboard')`. Hoje, depois de folhear 5 abas, o ← desfaz uma aba por clique e não sai da página.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:108-115 (setTab/pushState) e :172-173 (router.back)`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Entrar em /analytics vindo do /dashboard, abrir 5 abas e clicar em ←: tem que voltar ao /dashboard em UM clique. Print/gravação.

### 🟢 Dashboard Global > Sidebar > ícones Analytics e Configurações

**Ação:** Remover o affordance mentiroso: no ícone 📊 Analytics tirar cursor-pointer/hover (é indicador de página atual) e no ⚙ Configurações ou ligar um onClick para uma rota real, ou remover o item da sidebar enquanto a tela não existir.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:15-17 (componente Icon), :22 (Analytics) e :23 (Configurações sem onClick)`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Passar o mouse nos dois ícones: nenhum elemento sem ação pode mostrar cursor de clique. Print com o hover.

### 🟢 Dashboard Global > Visão Geral > card Funis

**Ação:** Ou filtrar a query por status publicado (`.eq('status','published')` em metrics.ts:55) mantendo o sub 'ativos', ou trocar o sub para 'cadastrados' e adicionar um segundo valor 'N no ar'. Hoje o rótulo 'ativos' é texto fixo e rascunhos entram na conta.

- **Arquivo:** `src/lib/quiz/metrics.ts:55 (query sem WHERE status) e :97 (funis.length) ; card em src/components/dashboard/GlobalAnalyticsView.tsx:217`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** SQL: select status, count(*) from funnels group by 1;  →  o card tem que refletir exatamente a contagem de published (hoje 15 casa por acaso).

### 🟢 Dashboard Global > Visão Geral > gráfico Sessões (7 dias)

**Ação:** Adicionar eixo Y (3 marcas: 0, max/2, max) e o valor numérico impresso acima de cada barra (hoje o número só existe no atributo title, inacessível no toque/mobile).

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:53-65 (DailyChart, title na linha 59) ; uso em :226`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Abrir /analytics no emulador mobile do DevTools: os 7 valores têm que ser legíveis sem hover, e somar igual a select count(*) from funnel_sessions where hydrated_at is not null and created_at >= now() - interval '7 days';

### 🟢 Dashboard Global > Visão Geral > gráfico Sessões por funil

**Ação:** No componente Bars, trocar `Math.max(3, r.pct)` por `Math.max(0.5, r.pct)` (0,2% e 3% desenham a mesma barra hoje) e, no uso da Visão Geral, filtrar funis com 0 sessões agrupando-os numa linha 'N funis sem tráfego'.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:46 (width mínima 3%) e :230 (empurra os 15 funis)`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Print: dois funis com pct diferentes têm que ter barras visivelmente diferentes; a lista não pode ter mais barras em 0% do que com dados.

### 🟢 Dashboard Global > Comparar / Operação > coluna Score

**Ação:** Documentar a fórmula na UI: adicionar tooltip/legenda 'Score = 60% taxa de conclusão + 40% taxa de interação (0–100)' e mover os pesos e os cortes de cor (70/40) para constantes exportadas em metrics.ts, referenciadas no JSX em vez de números mágicos.

- **Arquivo:** `src/lib/quiz/metrics.ts:397 (fórmula) ; src/components/dashboard/GlobalAnalyticsView.tsx:276 (linha Comparar) e :335 (badge Operação)`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Print com a legenda visível; recalcular o Score de 1 funil à mão (0.6×conclusão + 0.4×interação) e bater com a badge.

### 🟢 Dashboard Global > Comparar > rodapé da tabela

**Ação:** Amarrar o texto ao estado real: substituir 'Métricas do período todo' por `Métricas de ${labelDoPeriodo}` derivado do filtro global de período. Como texto fixo, vira mentira no minuto em que o filtro existir.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:294`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** filtro de período global (ação do DateRange)
- **Como validar:** Trocar o período no seletor e conferir que o rodapé muda junto. Print dos dois estados.

### 🟢 Dashboard Global > Quiz > barras de opção (top 8)

**Ação:** Adicionar a linha 'outros (N opções · X respostas)' depois do slice(0,8), com pct calculado sobre o mesmo total — hoje as barras visíveis não somam 100% e o buraco não é explicado.

- **Arquivo:** `src/lib/quiz/metrics.ts:180 (slice 0,8) ; render em src/components/dashboard/GlobalAnalyticsView.tsx:307`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Numa pergunta com >8 opções, a soma dos pct exibidos (incluindo 'outros') tem que dar 100% ±0,3.

### 🟢 Dashboard Global > Quiz > rótulo da pergunta

**Ação:** Parar de gravar lixo como pergunta: no ChatRunner do typebot, só chamar trackAnswer quando o bloco for input-* (mensagens de bubble não são pergunta) e usar o label do bloco em vez do texto da mensagem; ignorar rótulos default tipo 'Card N' no builder de layers. Para o histórico, criar uma denylist em metrics.ts que filtra esses registros da aba.

- **Arquivo:** `src/lib/quiz/track.ts:101-119 (trackAnswer) ; chamadas em src/components/quiz/typebot/ChatRunner.tsx e src/components/quiz/steps.tsx ; filtro em src/lib/quiz/metrics.ts:169-174`
- **Severidade:** melhoria · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** SQL: select distinct question from quiz_answers order by 1;  →  nenhuma entrada que seja frase de mensagem ('Consegui reservar uma vaga…') nem 'Card 2' na aba Quiz depois do filtro. Print da lista limpa.

### 🟢 Dashboard Global > Tráfego (dimensões não exibidas)

**Ação:** Adicionar um select de dimensão nos gráficos da aba (utm_source / utm_medium / utm_campaign / utm_term / utm_content / src / fbclid / ctwa_clid / source_id / xcod), lendo as colunas que já são gravadas em funnel_sessions e hoje só saem no CSV.

- **Arquivo:** `colunas em supabase/migrations/0009_quiz.sql ; lidas só em src/app/api/export-leads/route.ts:45 ; aba em src/components/dashboard/GlobalAnalyticsView.tsx:313-318`
- **Severidade:** melhoria · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Selecionar 'utm_medium' e conferir contra select utm_medium, count(*) from funnel_sessions group by 1 order by 2 desc;  →  barras idênticas.

### 🟢 Dashboard Global > Operação > coluna Funil

**Ação:** Mostrar o /slug abaixo do nome (igual a tabela 'VSL por funil' já faz em GlobalAnalyticsView.tsx:597) e adicionar badge de status (Rascunho/No ar) — hoje dois funis diferentes exibem o nome 'CDB 👛 [BOLSAS] - HERO SLIDE' e não há como distingui-los.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:330 ; fonte em src/lib/quiz/funnels-db.ts:184-196 (já traz status no select)`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Print: as duas linhas com nome idêntico têm que exibir /cdb-slide-vsl e /cdb-hero13, com badge de status correspondente ao campo status da tabela funnels.

### 🟢 Dashboard Global > Leads > colunas Nome / WhatsApp / Funil

**Ação:** Polir a tabela: (1) telefone formatado (+55 (71) 9xxxx-xxxx) e clicável em https://wa.me/<digitos>; (2) coluna Funil exibindo o NOME do funil (resolvido por slug, igual à aba Operação) com badge 'funil removido' quando o slug for órfão; (3) marcar/filtrar registros de teste (name='ssss', phone='99999999999') com um toggle 'ocultar testes'.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:358-360 ; dados em src/lib/quiz/metrics.ts:217-221`
- **Severidade:** melhoria · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Print: clicar num telefone abre o WhatsApp com o número certo; o lead de cdb-type01-v1 aparece com badge 'funil removido'; com o toggle ligado, o count da tabela cai exatamente o número de linhas de teste.

### 🟢 Dashboard Global > Leads e VSL > estados vazios (ComingSoon)

**Ação:** Corrigir textos que mentem: no vazio de Leads trocar 'Requer a migração 0010 aplicada' (0010 é funnel_settings; leads vêm da 0003) por 'Nenhum lead capturado ainda', e no vazio da VSL trocar 'Sem funis com tráfego ainda' por texto neutro. Os dois só podem aparecer quando a query retornou OK com 0 linhas — se houve erro, mostrar o banner de erro da ação de fail-fast.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:367 (Leads) e :611 (VSL) ; componente ComingSoon em :67-76`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** fail-fast das queries (ação do catch silencioso)
- **Como validar:** Simular erro de query em dev: a tela tem que mostrar o banner vermelho, não o painel 'Sem leads/Sem tráfego'. Print dos dois cenários (0 linhas vs erro).

### 🟢 Dashboard Global > Criativos > contador e corte de 50

**Ação:** Devolver o total real: retornar `creativesTotal` (tamanho do Map antes do slice) no GlobalAnalytics e exibir 'N de M (M reais)' — e substituir o corte fixo por paginação, ou ordenar o corte por CLIQUES desc em vez de leads (hoje os criativos que gastaram e não converteram, que são os que você quer matar, são os primeiros a sumir).

- **Arquivo:** `src/lib/quiz/metrics.ts:237-238 (sort por leads + slice 50) ; contador em src/components/dashboard/GlobalAnalyticsView.tsx:426`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** SQL: select count(distinct utm_content) from funnel_sessions where utm_content is not null;  →  36 hoje; o contador da tela tem que exibir esse M mesmo quando passar de 50.

### 🟢 Dashboard Global > Criativos > painel de comparação melhor/pior

**Ação:** Depois de corrigir cliques (hidratação) e leads (sem atribuição), exigir volume mínimo para rotular: só marcar ▲ Melhor / ▼ Pior quando ambos tiverem >= 30 sessões, senão exibir 'amostra pequena'. Adicionar a coluna Gasto/CPL ao card quando a UTMify entrar — 'melhor' sem custo é métrica de vaidade.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:375-410 (ranking por conv) ; conv em src/lib/quiz/metrics.ts:233`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** gasto da UTMify (para a coluna de custo)
- **Como validar:** Selecionar 2 criativos com <30 sessões: nenhum badge ▲/▼ pode aparecer, e sim o aviso de amostra pequena. Print.

### 🟢 Dashboard Global > VSL > seletor manual de players

**Ação:** Persistir a seleção e ser honesto sobre o agrupamento: salvar extraPlayers em localStorage (chave 'analytics.vturb.extraPlayers') e restaurar no mount; trocar o rótulo '📁 <grupo>' por 'agrupado pelo nome' com tooltip 'a API do VTurb não expõe pastas'.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:148 (extraPlayers), :478-493 (agrupamento heurístico), :496 (setExtraPlayers)`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Adicionar 2 players, dar F5: os 2 continuam na tabela. Print antes/depois do refresh.

### 🟢 Dashboard Global > VSL > detalhe > botão ⬇ Baixar métricas

**Ação:** Corrigir o nome do arquivo e o conteúdo: usar `retencao-<player>-<from>_a_<to>.csv` (hoje sai 'hojed.csv'/'customd.csv') e acrescentar como primeira linha do CSV um cabeçalho com player, período e total de espectadores.

- **Arquivo:** `src/components/dashboard/VslDetail.tsx:116-126 (downloadCsv, template na linha 123)`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Baixar com período 'Hoje': o arquivo tem que se chamar retencao-<player>-2026-07-27_a_2026-07-27.csv e a 1ª linha declarar o período. Print do Excel aberto.

---

## Painel por Funil (Leads > Respostas/Resultados/Performance)

### 🔴 Builder > Leads > 📈 Performance (toda a sub-aba) + Dashboard > /dashboard/[slug]

**Ação:** Aplicar a migration 0014 no Supabase de produção ANTES de qualquer push do código atual. Rodar o conteúdo de supabase/migrations/0014_hydrated_at.sql (ALTER TABLE add hydrated_at + backfill via step_events + índice idx_fsessions_hydrated) no SQL Editor do projeto de produção. Sem isso, o filtro .not('hydrated_at','is',null) em metrics.ts:356 e :375 devolve 400 do PostgREST e a tela inteira vira zeros. Enquanto a coluna não existir, NÃO deployar — ou remover o filtro das duas queries.

- **Arquivo:** `supabase/migrations/0014_hydrated_at.sql:9-21 (aplicar); src/lib/quiz/metrics.ts:356 e :375 (consumidores)`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** migration 0014
- **Como validar:** SQL: select count(*) as total, count(hydrated_at) as hidratadas from public.funnel_sessions where funnel_slug='cdb-01'; → a query tem que rodar sem erro e hidratadas < total (esperado ~106 hidratadas contra ~123 sessões no dia 24/07). Depois, o card 'Visitas e Acessos' precisa exibir exatamente o valor de 'hidratadas', nunca 0 e nunca o total.

### 🔴 Builder > Leads > Performance (todos os cards) + Resultados > empty state + Campanhas > empty state

**Ação:** Parar de transformar erro em zero. Em metrics.ts as queries usam supabase-js, que NÃO lança em erro do PostgREST — devolve {data:null,error}. Logo o try/catch das linhas 363-365, 381 e 312-314 nunca dispara e o que zera é o `count ?? 0` / `data ?? []`. Corrigir: destructurar `{ data, count, error }` nas 3 queries (metrics.ts:361, 379, 310), e quando error existir fazer console.error(error.message) e propagar num campo novo `erro?: string` na interface FunnelMetrics. Em PerformanceView.tsx:141 renderizar banner vermelho 'Falha ao carregar métricas: <msg>' e NÃO desenhar cards/funil zerados. No cliente, trocar o .catch(()=>{}) de LayersBuilder.tsx:761 por .catch(e=>setErr(String(e))) + checar r.ok, e diferenciar as mensagens: 'Sem respostas ainda' (LayersBuilder.tsx:919) vs 'Erro ao carregar respostas'; 'Sem UTMs rastreadas' (PerformanceView.tsx:181) vs 'Erro ao carregar campanhas'.

- **Arquivo:** `src/lib/quiz/metrics.ts:310-314, 361-365, 379-382; src/components/dashboard/PerformanceView.tsx:141, 181; src/components/builder/LayersBuilder.tsx:761, 805, 919`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Renomear temporariamente a coluna hydrated_at (ou pedir uma coluna inexistente) em ambiente local e abrir a aba: a tela tem que mostrar o banner de erro com a mensagem do PostgREST, e o console do DevTools tem que ter o console.error. Hoje o mesmo teste mostra zeros sem nenhum log.

### 🔴 Builder > Leads > Performance > Total de conclusões / Taxa de conclusão / Média de Etapas / Score

**Ação:** Subir o commit local 7ded91c (ensureSession deixou de mandar max_step_reached:0 no upsert, track.ts:36-51) junto com a migration 0014 — sem ele todo F5/retorno continua zerando o progresso e todas as métricas derivadas de max_step_reached ficam subcontadas. Depois do deploy, rodar um backfill único reconstruindo max_step_reached a partir de step_events: update funnel_sessions s set max_step_reached = greatest(s.max_step_reached, x.mx) from (select session_id, max(step_index) mx from step_events group by 1) x where x.session_id = s.session_id;

- **Arquivo:** `src/lib/quiz/track.ts:36-51 (commit 7ded91c, ainda não pushado)`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** migration 0014 (deploy conjunto)
- **Como validar:** cdb-01, dia 24/07: 'Total de conclusões' tem que passar de 9 para 12 e bater com select count(*) from funnel_leads where funnel_slug='cdb-01' and created_at::date='2026-07-24' (12 leads). Depois do backfill, select count(*) from funnel_sessions s where s.max_step_reached < (select max(step_index) from step_events e where e.session_id=s.session_id) → tem que devolver 0.

### 🔴 Builder > Leads > Respostas > colunas de pergunta + anel de % / Resultados / Exportar leads (ordem das colunas)

**Ação:** A ordem das perguntas (qOrder) hoje é a ordem física de retorno do PostgREST, e ela define a BASE do % (route.ts:134 assume qOrder[0] = 100%) e a ordem das colunas do CSV. Corrigir: em funnel-analytics/route.ts carregar o funil (resolveFunnel(slug)) e ordenar qOrder pela posição da lâmina/step correspondente — casar por step_id (quiz_answers.step_id já é gravado, track.ts:112) com o índice do step no JSON; perguntas sem step correspondente vão pro fim. Aplicar a MESMA ordenação em export-leads/route.ts:29-41. Enquanto isso, adicionar no mínimo .order('created_at',{ascending:true}) nas duas queries (route.ts:31 e export-leads:31) para ter ordem determinística.

- **Arquivo:** `src/app/api/funnel-analytics/route.ts:31, 82-97, 134-138; src/app/api/export-leads/route.ts:29-41`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Abrir cdb-01 na sub-aba Respostas: a ordem das colunas 1..N tem que ser idêntica à ordem das lâminas no construtor, e o anel da 1ª coluna tem que ser 100%. SQL de conferência: select step_id, question, min(created_at) from quiz_answers where funnel_slug='cdb-01' group by 1,2 order by 3; a sequência tem que casar com a ordem exibida.

### 🔴 Builder > Leads > 📊 Resultados > card por pergunta ('N respostas')

**Ação:** Parar de contar LINHAS. Duas frentes: (1) no banco, criar índice único parcial `create unique index if not exists uq_quiz_answers_sess_step on public.quiz_answers (session_id, step_id) where step_id is not null;` e trocar o INSERT puro de track.ts:109 por .upsert({...},{onConflict:'session_id,step_id'}) — re-resposta passa a sobrescrever; (2) no agregador, contar sessões distintas: em funnel-analytics/route.ts:92 trocar o contador de linhas por um Set de session_id por (question, answer), e usar esse tamanho no `total` e no `pct` (route.ts:98-107). Assim Resultados e o PctRing da sub-aba Respostas passam a usar a MESMA população.

- **Arquivo:** `src/lib/quiz/track.ts:101-119; src/app/api/funnel-analytics/route.ts:86-107`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** migration nova (unique em quiz_answers)
- **Como validar:** Antes: select question, count(*) linhas, count(distinct session_id) sessoes from quiz_answers where funnel_slug='cdb-01' group by 1; hoje linhas > sessoes em pelo menos uma pergunta. Depois da correção, o número exibido em Resultados tem que ser igual a `sessoes` e igual ao total mostrado no PctRing da mesma pergunta na sub-aba Respostas.

### 🔴 Builder > Leads > Performance > Tráfego > gráfico 'Tráfego (24h)' + filtro Período + seletor 📅 Dia

**Ação:** Fazer o gráfico respeitar o range. Em metrics.ts:407-424 substituir a janela fixa de 24h por buckets derivados do `range`: se não há range ou a janela é <= 48h, bucketizar por hora dentro de [from,to] (default: últimas 24h); se a janela for maior, bucketizar por DIA. Remover o `continue` da linha 415 (que descarta tudo com mais de 24h). Em PerformanceView.tsx:163 tornar o título dinâmico ('Tráfego · 24h' / 'Tráfego · 7 dias' / 'Tráfego · 24/07').

- **Arquivo:** `src/lib/quiz/metrics.ts:407-424; src/components/dashboard/PerformanceView.tsx:163`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** migration 0014
- **Como validar:** Selecionar 📅 Dia = 24/07 em cdb-01: o gráfico tem que desenhar as 24 horas daquele dia com pico não-zero, e a soma da série 'Visitantes' tem que bater com o card 'Visitas e Acessos' do mesmo período. Hoje esse mesmo teste zera as 4 séries.

### 🔴 Builder > Leads > Performance > Tráfego > série 'Leads' do gráfico

**Ação:** Unificar a definição de 'Leads'. Hoje o funil usa COUNT(funnel_leads) e o gráfico usa 'max_step_reached >= captureI' (metrics.ts:421) — dois números com o mesmo rótulo na mesma tela. Corrigir: buscar funnel_leads(created_at, session_id) do range junto com as sessões (nova query em metrics.ts, ao lado da :352) e bucketizar os leads REAIS por hora/dia; remover a linha 421. Se quiser manter a métrica de 'chegou na lâmina de captura', renomeá-la explicitamente para 'Chegou na captura' na legenda (PerformanceView.tsx:87).

- **Arquivo:** `src/lib/quiz/metrics.ts:337-339, 344-346, 421; src/components/dashboard/PerformanceView.tsx:87`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** migration 0014
- **Como validar:** cdb-01, 24/07: soma da série 'Leads' do gráfico tem que ser exatamente 12 e igual ao valor do estágio 'Leads capturados' do funil ao lado, e igual a select count(*) from funnel_leads where funnel_slug='cdb-01' and created_at::date='2026-07-24'.

### 🔴 Builder > Leads > Performance > Desempenho > estágios '1ª resposta' e '2ª resposta'

**Ação:** Trocar os thresholds hardcoded 1 e 2 (metrics.ts:401-402, via countSessions(1)/countSessions(2)) pelos índices reais das duas primeiras lâminas de pergunta. Em stageIndices() (metrics.ts:277-298) passar a devolver também `secondQ` (o segundo índice cujo step tem layer em LAYER_Q / cujo type está em QUESTION_TYPES) e usar countSessions(firstQ)/countSessions(secondQ). Renomear os labels para '1ª pergunta respondida' e '2ª pergunta respondida'. Se firstQ/secondQ não forem encontrados, marcar o estágio como indisponível em vez de cair no fallback 1/2.

- **Arquivo:** `src/lib/quiz/metrics.ts:277-298, 385-388, 399-405`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** migration 0014
- **Como validar:** Em um funil cuja 1ª pergunta esteja na lâmina 3: o estágio '1ª resposta' tem que bater com select count(distinct session_id) from quiz_answers where funnel_slug=$1 and step_id=<id da 1ª lâmina de pergunta>, e tem que ser IGUAL ao card 'Respostas Iniciadas' logo acima (hoje os dois divergem).

### 🔴 Builder > Leads > Performance > Desempenho > estágio 'Leads capturados' + Taxa de conclusão

**Ação:** funnel_leads não tem unique e /api/funnel-lead faz INSERT puro (funnel-lead/route.ts:67) — reenvio do formulário cria linha nova e o estágio pode passar de 100%. Criar `create unique index if not exists uq_funnel_leads_session on public.funnel_leads (session_id) where session_id is not null;` e trocar o .insert(leadRow) por .upsert(leadRow,{onConflict:'session_id'}) em funnel-lead/route.ts:67. Antes de criar o índice, deduplicar o histórico mantendo a linha mais recente por session_id.

- **Arquivo:** `src/app/api/funnel-lead/route.ts:67; src/lib/quiz/metrics.ts:303-315`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** migration nova (unique em funnel_leads)
- **Como validar:** SQL antes: select session_id, count(*) from funnel_leads where funnel_slug='cdb-01' and session_id is not null group by 1 having count(*)>1; → tem que devolver 0 linhas depois da correção. E o estágio 'Leads capturados' nunca pode exibir pct > 100%.

### 🟡 Builder > Leads > Performance > Desempenho > Total de conclusões / estágio Conclusões

**Ação:** Congelar a definição de conclusão no momento em que ela acontece, em vez de reinterpretar com lastI do JSON atual. Adicionar coluna funnel_sessions.completed_at timestamptz (migration nova) e, no LayersRunner/ChatRunner, ao entrar na última lâmina ativa, gravar completed_at (via trackStep, track.ts:86-93, quando stepIndex === último índice). Trocar countSessions(lastI) (metrics.ts:385/404) por COUNT(completed_at is not null). Manter o cálculo por max_step_reached apenas como fallback para o histórico anterior à coluna.

- **Arquivo:** `src/lib/quiz/metrics.ts:338, 345-347, 385, 404; src/lib/quiz/track.ts:62-98`
- **Severidade:** importante · **Esforço:** alto
- **Depende de:** migration nova (completed_at)
- **Como validar:** Desativar uma lâmina no construtor e recarregar a aba Performance: 'Total de conclusões' do período histórico NÃO pode mudar de valor (hoje muda). SQL: comparar count(completed_at) com o número exibido — têm que ser idênticos.

### 🟡 Builder > Leads > Performance > Desempenho > gráfico de funil (fonte step_events não consumida)

**Ação:** Ler step_events e trocar o funil de 5 estágios inferido por drop-off REAL por lâmina. Criar RPC no Postgres: select step_index, step_id, count(distinct session_id) from step_events where funnel_slug=$1 and created_at between $2 and $3 group by 1,2 order by 1; expor em metrics.ts (nova função stepFunnel()) e renderizar uma linha por lâmina no componente Funnel (PerformanceView.tsx:61-79), com o rótulo vindo do título da lâmina. O funil de 5 estágios vira resumo, o detalhado vira a fonte de auditoria.

- **Arquivo:** `src/lib/quiz/metrics.ts (nova função, hoje nenhuma leitura de step_events); src/lib/quiz/track.ts:78-85; src/components/dashboard/PerformanceView.tsx:61-79`
- **Severidade:** importante · **Esforço:** alto
- **Depende de:** RPC nova + NOTIFY pgrst,'reload schema'
- **Como validar:** O valor do último estágio do funil detalhado tem que bater com 'Total de conclusões'; e o 1º estágio com 'Visitas e Acessos'. Validar a RPC pelo caminho real do app (fetch /api/funnel-analytics no DevTools), não pelo SQL Editor — RPC nova sem reload de schema devolve 404 no PostgREST.

### 🟡 Builder > aba 👥 Leads (nova sub-aba) + endpoint órfão /api/funnel-leads-list

**Ação:** Criar a 4ª sub-aba '👤 Leads' em LayersBuilder.tsx:776 consumindo GET /api/funnel-leads-list?slug&page&per (já pronto, sem consumidor). Antes disso, adicionar os filtros from/to na rota (funnel-leads-list/route.ts:18-21, gte/lte em created_at) para ela respeitar o mesmo período das outras sub-abas. Colunas: Data (com hora, TZ SP), Nome, Telefone, utm_source, utm_campaign, src; paginação server-side usando o `total` exato que a rota já devolve. Isso resolve o buraco de 'lead capturado que não respondeu nenhuma pergunta não aparece em lugar nenhum'.

- **Arquivo:** `src/app/api/funnel-leads-list/route.ts:5-25; src/components/builder/LayersBuilder.tsx:743, 776, 899`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** O total exibido na nova sub-aba tem que ser igual a select count(*) from funnel_leads where funnel_slug='cdb-01' [+ range], e igual ao estágio 'Leads capturados' do funil no mesmo período. Em um funil só-VSL (sem quiz_answers), a sub-aba Leads tem que listar linhas enquanto Respostas fica vazia.

### 🟡 Builder > Leads > 📋 Respostas > coluna Lead + contador 'N respostas'

**Ação:** Separar visualmente lead convertido de sessão anônima e desambiguar o contador. Na coluna Lead (LayersBuilder.tsx:877), quando r.name for null renderizar '#'+session em cinza com badge 'sessão' (e não em font-semibold como o lead real). No contador (LayersBuilder.tsx:856) trocar o texto por 'N sessões com resposta · M convertidas em lead', calculando M = rows.filter(r=>r.name||r.phone).length. Ajustar também os tooltips de 'Respostas Iniciadas' (PerformanceView.tsx:149) e do estágio '1ª resposta' para explicitar que são populações diferentes.

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:856, 877; src/components/dashboard/PerformanceView.tsx:149`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Print da sub-aba Respostas de cdb-01: o número 'M convertidas' tem que bater com o estágio 'Leads capturados' do funil no mesmo período; nenhuma linha '#xxxxxxxx' pode aparecer com o mesmo peso visual de um lead nomeado.

### 🟡 Builder > Leads > Respostas > colunas Lead / Telefone / Data / tracking (join incompleto)

**Ação:** Trocar os limites cegos por join explícito. Em funnel-analytics/route.ts: (1) executar answersQ primeiro, extrair o Set de session_id; (2) buscar funnel_leads e funnel_sessions com .in('session_id', [...sids]) em lotes de ~500, SEM os limit 5000 das linhas 38 e 44 e SEM filtro de created_at próprio (hoje as janelas de lead e de resposta são independentes: quem responde 23:50 e converte 00:05 perde nome/telefone). Isso resolve de uma vez o teto de 5000 leads, o teto de 5000 sessões sem .order() e o furo do filtro 'Ontem'.

- **Arquivo:** `src/app/api/funnel-analytics/route.ts:31-46, 58-64, 110-125`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Filtrar 'Ontem' num dia que tenha lead criado logo após a meia-noite: a linha tem que exibir nome/telefone (hoje exibe '—'). SQL de controle: select count(*) from quiz_answers a join funnel_leads l using(session_id) where a.funnel_slug='cdb-01' → o número de linhas com nome na tela não pode ser menor que esse count.

### 🟡 Builder > Leads > Respostas > coluna Data

**Ação:** Passar a exibir a data do EVENTO, não só a do lead. Em funnel-analytics/route.ts:86-97 guardar o min(created_at) das quiz_answers por sessão e devolver como `firstAnswerAt`; em route.ts:128 usar `when: l?.created_at ?? firstAnswerAt`. Em LayersBuilder.tsx:879 trocar toLocaleDateString por toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}) para mostrar hora e fixar o fuso.

- **Arquivo:** `src/app/api/funnel-analytics/route.ts:86-97, 128; src/components/builder/LayersBuilder.tsx:879`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Nenhuma linha da tabela pode exibir '—' na coluna Data (toda linha veio de pelo menos uma quiz_answer, então sempre há timestamp). Conferir uma linha específica contra select min(created_at) from quiz_answers where session_id=$1.

### 🟡 Builder > Leads > Performance > pílula 'vs período anterior' (todos os cards)

**Ação:** Três correções em funnel-analytics/route.ts:49-81: (1) quando o período é 'Hoje', recortar o período anterior no MESMO horário parcial — usar to = agora e prevRange = {from: from-24h, to: to-24h} em vez de dia inteiro; (2) trocar o retorno '+100%' de prv=0 e cur>0 (route.ts:68) por `null`, e em PerformanceView.tsx:29-38 renderizar a badge 'novo' (cinza) quando o delta vier null; (3) inverter o sinal semântico de taxaRejeicao — passar um prop `inverse` para o Card/Delta de PerformanceView.tsx:166 de modo que queda de rejeição pinte verde e a borda do card (PerformanceView.tsx:42) siga a mesma regra.

- **Arquivo:** `src/app/api/funnel-analytics/route.ts:49-56, 68, 77; src/components/dashboard/PerformanceView.tsx:29-42, 166`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Às 9h da manhã com 'Hoje' selecionado, o delta de Visitantes não pode ser fortemente negativo por construção — comparar com select count(*) from funnel_sessions where funnel_slug='cdb-01' and created_at >= (now()-interval '24 hours') e a mesma janela de ontem até a mesma hora. E: um funil que passou de 0 para 3 leads tem que exibir 'novo', não '+100%'.

### 🟡 Builder > Leads > Performance > card Tempo Médio

**Ação:** O last_seen_at só é gravado quando max_step_reached AVANÇA, por causa do .lt() na mesma query (track.ts:93) — então 'Tempo Médio' é 'tempo até a etapa mais funda', e F5/retorno nunca estende. Separar em DUAS escritas dentro do Promise.allSettled (track.ts:77-94): update({last_seen_at}) SEM guarda, e update({max_step_reached}).lt('max_step_reached', stepIndex) com a guarda de monotonicidade. Em metrics.ts:395 tornar o corte de 6h uma constante exportada e contar quantas sessões foram descartadas, expondo no tooltip do card (PerformanceView.tsx:151).

- **Arquivo:** `src/lib/quiz/track.ts:86-93; src/lib/quiz/metrics.ts:395-396; src/components/dashboard/PerformanceView.tsx:151`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Em localhost, abrir o funil, avançar 2 lâminas, esperar 60s parado e dar F5: select last_seen_at - created_at from funnel_sessions where session_id=$1 tem que ter aumentado (hoje fica congelado no instante do último avanço).

### 🟡 Builder > Leads > Performance > card Média de Etapas

**Ação:** Tirar a mistura de população: hoje o numerador vem da amostra de 5000 (metrics.ts:352-362, 394) enquanto os cards vizinhos são COUNT exato. Criar RPC `funnel_avg_step(slug text, from timestamptz, to timestamptz)` fazendo select avg(max_step_reached+1) from funnel_sessions where funnel_slug=$1 and hydrated_at is not null [+ range], e consumir em metrics.ts:394. Remover o arredondamento duplo: manter 1 casa em metrics.ts:394 e trocar o Math.round(m.mediaEtapas) de PerformanceView.tsx:150 por m.mediaEtapas.toFixed(1).

- **Arquivo:** `src/lib/quiz/metrics.ts:352-362, 394; src/components/dashboard/PerformanceView.tsx:150`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** migration 0014 + RPC nova
- **Como validar:** O card tem que exibir exatamente o resultado de select round(avg(max_step_reached+1)::numeric,1) from funnel_sessions where funnel_slug='cdb-01' and hydrated_at is not null; e um funil com média 2.4 tem que exibir '2.4/N', não '2/N'.

### 🟡 Builder > Leads > Performance > Campanhas > Total rastreado / Melhor origem / ranking top 6 / empty state

**Ação:** Trocar a agregação em JS sobre a amostra de 5000 (metrics.ts:426-441) por agregação no banco. Criar RPC `funnel_campaigns(slug, from, to)` com select coalesce(nullif(trim(utm_campaign),''), nullif(trim(utm_source),''), nullif(trim(src),'')) as camp, count(*) from funnel_sessions where funnel_slug=$1 and hydrated_at is not null [+range] group by 1 order by 2 desc. Devolver TODAS as linhas, exibir top 6 + linha agregada 'Outros (N)' em PerformanceView.tsx:179-182, e uma linha explícita 'Sem UTM (N)' com o count de camp IS NULL — que hoje é a informação que falta. Adicionar coluna com o rótulo da fonte (utm vs src) para não misturar Meta com CTWA no mesmo ranking.

- **Arquivo:** `src/lib/quiz/metrics.ts:426-441; src/components/dashboard/PerformanceView.tsx:175-182`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** migration 0014 + RPC nova
- **Como validar:** 'Total rastreado' + 'Sem UTM' tem que somar exatamente o valor de 'Visitas e Acessos' no mesmo período. SQL de controle: select count(*) filter (where coalesce(utm_campaign,utm_source,src) is not null) as com_utm, count(*) filter (where coalesce(utm_campaign,utm_source,src) is null) as sem_utm from funnel_sessions where funnel_slug='cdb-01' and hydrated_at is not null.

### 🟡 Builder > Leads > Performance > Campanhas > ranking (sem custo) e card 'Melhor origem'

**Ação:** Adicionar coluna de gasto/CPL/CPA no ranking de campanhas. Criar tabela `ad_spend(dia date, campaign_id text, campaign_name text, gasto numeric)` alimentada pelo conector UTMify (ou export Meta), e uma view que cruza por utm_campaign/utm_id contra funnel_sessions e funnel_leads para calcular CPL = gasto ÷ leads da campanha. Trocar o critério de 'Melhor origem' (metrics.ts:441, hoje = mais sessões) por 'menor CPL' quando houver gasto, mantendo 'mais sessões' como fallback rotulado.

- **Arquivo:** `src/lib/quiz/metrics.ts:426-441; src/components/dashboard/PerformanceView.tsx:172-183`
- **Severidade:** importante · **Esforço:** alto
- **Depende de:** gasto UTMify
- **Como validar:** A soma da coluna 'gasto' do ranking tem que bater com o gasto total do período no painel da UTMify/Meta para as mesmas campanhas (tolerância 1%). CPL de uma campanha = gasto UTMify ÷ count(*) de funnel_leads com aquele utm_campaign.

### 🟡 Builder > Leads > ⬇ Exportar leads + Dashboard > /dashboard/[slug] > ⬇ Exportar leads

**Ação:** Quatro correções em export-leads/route.ts: (1) aceitar from/to e aplicar gte/lte em created_at nas duas queries (route.ts:21-23 e :31-33), e passar o range atual nos dois links (LayersBuilder.tsx:781 e dashboard/[slug]/page.tsx:38 — este último precisa virar client component ou receber o range por searchParams); (2) remover a coluna 'Email' do header (route.ts:46) e o l.email (route.ts:62) — funnel_leads não tem essa coluna, ela sai sempre vazia; (3) adicionar utm_id, fbp e fbc à lista trackingCols (route.ts:45); (4) usar a mesma ordenação de perguntas da ação de qOrder.

- **Arquivo:** `src/app/api/export-leads/route.ts:21-23, 29-46, 62; src/components/builder/LayersBuilder.tsx:781; src/app/dashboard/[slug]/page.tsx:38`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Com 'Ontem' selecionado, o CSV baixado tem que ter exatamente o mesmo número de linhas que select count(*) from funnel_leads where funnel_slug='cdb-01' and created_at::date = current_date - 1. Abrir o CSV: não pode existir coluna Email vazia e as colunas de pergunta têm que estar na ordem do funil.

### 🟡 Builder > Leads > ♻ Resetar dados

**Ação:** Tornar a falha visível e o escopo explícito. No cliente (LayersBuilder.tsx:764-769): await do fetch, checar r.ok e o body — se algum valor de result[tabela] começar com 'erro:', exibir alert/toast vermelho com a tabela e a mensagem em vez de recarregar como sucesso. Na rota (reset-funnel-data/route.ts:23-27): devolver status 500 quando qualquer DELETE falhar. No confirm (LayersBuilder.tsx:765), incluir o texto 'Isso ignora o filtro de período — apaga TODO o histórico do funil' e exigir digitar o slug para confirmar (input em vez de window.confirm).

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:764-769, 782; src/app/api/reset-funnel-data/route.ts:23-27`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Revogar temporariamente o DELETE de uma das tabelas (ou apontar para tabela inexistente) e clicar em Resetar: a UI tem que mostrar erro. Depois de um reset real: select count(*) from funnel_sessions where funnel_slug=$1 → 0, e o painel tem que voltar zerado sem banner de erro.

### 🟡 Builder > Leads > Performance > card Respostas Iniciadas

**Ação:** Sinalizar quando o firstQ é fallback. Em stageIndices() (metrics.ts:286, 294) e no ramo typebot (metrics.ts:335), quando o índice não é encontrado o código cai em firstQ=1 e o card passa a medir 'chegou na 2ª lâmina'. Devolver junto um flag `firstQFallback:boolean` em FunnelMetrics e, quando true, exibir no card (PerformanceView.tsx:149) o ícone de alerta com tooltip 'Nenhuma lâmina de pergunta reconhecida neste funil — medindo avanço da 2ª lâmina'. Renomear o label para 'Chegou na 1ª pergunta' quando não for fallback.

- **Arquivo:** `src/lib/quiz/metrics.ts:286, 294, 335, 385; src/components/dashboard/PerformanceView.tsx:149`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** migration 0014
- **Como validar:** Abrir um funil só-VSL (sem lâmina de pergunta): o card tem que mostrar o alerta. Num funil com quiz, 'Respostas Iniciadas' tem que ser igual ao estágio '1ª resposta' do funil abaixo — se divergirem, o firstQ ainda está errado.

### 🟡 Builder > Leads > Respostas > colunas de tracking (fbclid, viewport, screen, platform, userAgent) + colunas ausentes

**Ação:** Duas frentes: (1) gravar fbclid, viewport, screen, platform e user_agent também em funnel_sessions (migration nova + ensureSession em track.ts:36-51 mandando os campos vindos de collectTrackingParams e do navigator), para que a sessão não convertida deixe de exibir '—' permanente; e adicionar esses campos ao select de sessão em funnel-analytics/route.ts:44 e ao fallback de trackOf (route.ts:121-123). (2) Adicionar utm_id, xcod, fbp e fbc à lista TRACK_COLS (LayersBuilder.tsx:694-701) — já existem em funnel_leads/webhook e hoje não têm coluna.

- **Arquivo:** `src/lib/quiz/track.ts:36-51; src/app/api/funnel-analytics/route.ts:44, 115-125; src/components/builder/LayersBuilder.tsx:694-701`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** migration nova (colunas de device em funnel_sessions)
- **Como validar:** Abrir o funil em localhost sem converter e conferir: select platform, viewport, fbclid from funnel_sessions where session_id=$1 → preenchidos; a linha correspondente na sub-aba Respostas tem que exibir os valores em vez de '—'. E a coluna utm_id tem que aparecer no seletor ▥ Colunas.

### 🟡 Builder > Leads > Performance > Desempenho > gráfico de funil (trapézio)

**Ação:** Clampar e sinalizar quebra de monotonicidade. Em PerformanceView.tsx:65 aplicar Math.min(100, s.pct) no cálculo de top/bot (a geometria estoura hoje quando leads > visitantes), mantendo o número real exibido no rótulo à direita (linha 73). Quando stages[i].value > stages[i-1].value, renderizar um ícone de alerta no estágio com tooltip 'população diferente: leads vêm de funnel_leads, não de funnel_sessions'. Marcar o estágio 'Leads capturados' com um badge visual distinto dos demais.

- **Arquivo:** `src/components/dashboard/PerformanceView.tsx:61-79 (esp. 65, 73); src/lib/quiz/metrics.ts:399-405`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Forçar um cenário com leads > visitantes (inserir 2 leads sem sessão hidratada em staging): o trapézio não pode alargar no meio e o alerta tem que aparecer; o rótulo à direita continua mostrando o pct real (>100%).

### 🟡 Builder > Leads > Respostas > colunas de etapa (perguntas que não geram resposta) 

**Ação:** Registrar resposta das lâminas de roleta. RouletteStepView nunca chama logAnswer — o resultado do giro (steps.tsx:180-193, dentro do setTimeout que faz setDone(true)) some da tabela e do CSV. Adicionar logAnswer(ctx, step.id, String(step.question || step.title || 'Roleta'), step.segments[win].label) logo após setDone(true) (steps.tsx:187). Conferir também o caminho da roleta usada como hero no motor layers (LayersRunner.tsx:175, 200), que reaproveita o mesmo componente.

- **Arquivo:** `src/components/quiz/steps.tsx:141, 180-193 (inserir em ~187); src/components/quiz/layers/LayersRunner.tsx:175, 200`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** inspeção no browser
- **Como validar:** Em localhost, girar a roleta de cdb-01 e rodar select question, answer from quiz_answers where session_id=$1 → tem que existir uma linha com o segmento sorteado; a lâmina da roleta tem que passar a aparecer como coluna na sub-aba Respostas.

### 🟡 Builder > Leads > Performance > Desempenho > estágio Conclusões (fim do funil)

**Ação:** Fechar o funil até a venda: hoje ele termina em 'chegou na última lâmina', sem clique em CTA/checkout nem venda. (1) Instrumentar clique de CTA/checkout: no handler do botão de checkout do runner, chamar trackStep com step_type='cta_click' e meta={url} (track.ts:78-85 já suporta meta) — vira um 6º estágio a partir de step_events. (2) Criar rota /api/webhooks/hotmart validando o Hottok no header, gravando venda em nova tabela `funnel_sales(session_id, funnel_slug, transacao, valor, status, created_at)`, casando por src/xcod (que já vai no checkout_url) — vira o 7º estágio e habilita CPA/ROAS por campanha.

- **Arquivo:** `src/lib/quiz/track.ts:62-98 (cta_click); src/app/api/funnel-lead/route.ts:79-85 (checkout_url, origem do casamento); src/lib/quiz/metrics.ts:399-405 (novos estágios)`
- **Severidade:** importante · **Esforço:** alto
- **Depende de:** Hottok
- **Como validar:** Fazer 1 compra de teste na Hotmart: a linha tem que entrar em funnel_sales com o mesmo session_id do lead, e o total de vendas do período no painel tem que bater com o relatório de vendas da Hotmart (mesmo produto, mesma janela). Cliques em CTA: select count(*) from step_events where step_type='cta_click' and funnel_slug='cdb-01' tem que ser >= conclusões.

### 🟢 Builder > Leads > Performance > 📱 Dispositivos

**Ação:** Remover o 'comingSoon' e agregar os dados que já existem. funnel_leads já grava platform, viewport, screen e user_agent (funnel-lead/route.ts:61-64). Criar RPC ou agregação em metrics.ts devolvendo `dispositivos: {label,value,pct}[]` a partir de platform (normalizado: iOS/Android/Desktop via user_agent quando platform for vazio) e substituir o placeholder de PerformanceView.tsx:184-187 por barras no mesmo estilo do card Campanhas.

- **Arquivo:** `src/components/dashboard/PerformanceView.tsx:184-187; src/lib/quiz/metrics.ts (nova agregação); src/app/api/funnel-lead/route.ts:61-64`
- **Severidade:** melhoria · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** A soma das barras do card tem que ser igual ao total de leads do período ('Leads capturados'). SQL: select coalesce(nullif(platform,''),'desconhecido'), count(*) from funnel_leads where funnel_slug='cdb-01' group by 1 order by 2 desc.

### 🟢 Builder > Leads > Performance > card Score e Desempenho + (órfão) FunnelAnalytics.tsx

**Ação:** Centralizar e deduplicar. Criar em metrics.ts as constantes SCORE_WEIGHTS={conclusao:0.6,interacao:0.4} e SCORE_TIERS=[76,51,26] mais a função scoreTier(score) devolvendo {label,tier}, e consumir em PerformanceView.tsx:140 e :147 (hoje as faixas 76/51/26 estão escritas duas vezes) e no texto do SLIDES:130. Deletar src/components/dashboard/FunnelAnalytics.tsx inteiro (10 KB, sem nenhum import em src/, só citado no comentário de dashboard/[slug]/page.tsx:13) — ele contém uma segunda tabela de thresholds (70/40) e um seletor de período decorativo, e é armadilha de 'consertar a tela errada'.

- **Arquivo:** `src/lib/quiz/metrics.ts:397; src/components/dashboard/PerformanceView.tsx:130, 140, 147; src/components/dashboard/FunnelAnalytics.tsx (deletar)`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** grep -rn 'FunnelAnalytics' src/ → só o comentário da page.tsx (ou nada) depois de remover; grep -rn '76\|51\|26' em PerformanceView.tsx não pode achar thresholds soltos; npm run build verde.

### 🟢 Builder > Leads > Performance > ⚡ Sumário (4 slides)

**Ação:** Reescrever os textos de SLIDES (PerformanceView.tsx:129-134) para bater com o que o código realmente calcula: (a) 'Tempo Médio' → 'tempo entre a primeira e a última interação registrada'; (b) explicitar que 'Visitas e Acessos' = sessões que HIDRATARAM (o beacon cria a linha antes e não conta); (c) no slide de Tráfego, dizer qual é a definição de 'Leads' usada no gráfico (após a unificação, funnel_leads); (d) trocar as faixas escritas à mão pelo import de SCORE_TIERS. Executar depois das ações de unificação, para o texto descrever o comportamento novo.

- **Arquivo:** `src/components/dashboard/PerformanceView.tsx:129-134`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Print dos 4 slides ao lado dos cards: cada frase do sumário tem que ter um número correspondente na tela e nenhuma definição pode contradizer o tooltip do card (Help text).

### 🟢 Dashboard > card do funil > /dashboard/[slug] (página Performance do funil)

**Ação:** Igualar as capacidades das duas telas. Extrair a barra de período de LayersBuilder.tsx:787-803 (PERIODOS, dayBounds, estado range) para um componente compartilhado PeriodFilter, e usar em dashboard/[slug]/page.tsx: transformar o corpo em client component que consome /api/funnel-analytics?slug&from&to (mesma rota do builder, já devolve performance + deltas) em vez de chamar funnelMetrics(slug) sem range no server (page.tsx:22). Assim a página ganha filtro e deltas e passa a ser 1 fonte só.

- **Arquivo:** `src/app/dashboard/[slug]/page.tsx:16-48 (esp. 22, 44); src/components/builder/LayersBuilder.tsx:721-737, 787-803`
- **Severidade:** melhoria · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Abrir /dashboard/cdb-01 e a aba Leads>Performance do builder com o mesmo período selecionado: TODOS os números têm que ser idênticos, incluindo as pílulas de delta (hoje as pílulas só existem no builder).

### 🟢 Dashboard > /dashboard/[slug] > header '/{slug} · N lâminas'

**Ação:** Exibir ativas e total: trocar `{m.totalSteps} lâminas` (page.tsx:33) por `{m.totalSteps} de {m.totalStepsAll} lâminas ativas`, adicionando totalStepsAll (steps.length antes do filtro de disabled) ao retorno de funnelMetrics (metrics.ts:344-347, 443-448). O mesmo valor é o denominador do card 'Média de Etapas', então a divergência com o construtor precisa ficar explícita.

- **Arquivo:** `src/app/dashboard/[slug]/page.tsx:33; src/lib/quiz/metrics.ts:331, 344-347, 443-448`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Desativar 1 lâmina no construtor: o header tem que passar a mostrar 'N-1 de N lâminas ativas' e o denominador de 'Média de Etapas' tem que acompanhar o N-1.

### 🟢 Builder > Leads > filtro Período / 📅 Dia (dayBounds com -03:00 fixo)

**Ação:** Trocar o offset cravado por cálculo real do fuso. Em LayersBuilder.tsx:726-729 substituir a string `${ymd}T00:00:00.000-03:00` por um helper que deriva o offset de America/Sao_Paulo via Intl.DateTimeFormat com timeZoneName (ou usar a lib de data já presente), para não quebrar se o horário de verão voltar ou se o funil for operado de outro fuso. Extrair o helper junto com o PeriodFilter compartilhado.

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:721-737`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Rodar o helper com uma data de janeiro e uma de julho: os ISO gerados têm que corresponder a 00:00 e 23:59:59 locais em São Paulo nos dois casos. Teste manual: selecionar 'Hoje' e conferir que o count bate com select count(*) from funnel_sessions where funnel_slug='cdb-01' and (created_at at time zone 'America/Sao_Paulo')::date = current_date.

### 🟢 Builder > Leads > Respostas > anel de % (PctRing)

**Ação:** Tirar os thresholds mágicos e deixar de mascarar valor inválido. Em LayersBuilder.tsx:705 extrair 80/50 para constantes RING_OK=80 / RING_MID=50 no topo do arquivo (ou reaproveitar SCORE_TIERS de metrics.ts). Em funnel-analytics/route.ts:137 o Math.min(100,...) esconde pct>100 (sintoma de qOrder errado ou de duplicidade em quiz_answers): manter o clamp no desenho do anel, mas devolver o valor bruto num campo `pctRaw` e exibir alerta no header da coluna quando pctRaw>100.

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:703-715 (esp. 705), 865-869; src/app/api/funnel-analytics/route.ts:131-138`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Depois da correção de qOrder e do dedupe de quiz_answers, nenhum pctRaw pode ser >100 em cdb-01. Print da linha de cabeçalho com os anéis: 1ª coluna = 100%, e a sequência tem que ser monotonicamente decrescente.

---

## Construtor (Construtor/Fluxo/Design/Leads)

### 🔴 Leads > sub-aba Performance

**Ação:** Rodar supabase/migrations/0014_hydrated_at.sql no Supabase de produção (SQL Editor) ANTES de qualquer deploy do build atual, e subir no MESMO push o commit local 7ded91c (track.ts:43 deixou de mandar max_step_reached:0 no upsert). Sem a coluna, tanto metrics.ts:376 (aba Performance) quanto metrics.ts:57/59 (Dashboard) devolvem 400 e zeram tudo. Ordem obrigatória: migration -> build -> push.

- **Arquivo:** `supabase/migrations/0014_hydrated_at.sql:9 + src/lib/quiz/metrics.ts:57,59,376`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** migration 0014
- **Como validar:** Depois da migration: `select count(*) from funnel_sessions where funnel_slug='cdb-01' and hydrated_at is not null;` -> tem que devolver 106 (não 123) no recorte de 24/07. O card Visitantes da aba Performance tem que exibir exatamente esse número, e o Dashboard não pode zerar nenhum funil.

### 🔴 Leads > sub-aba Performance

**Ação:** Parar de engolir erro de PostgREST: em countSessions trocar `catch { return 0 }` por captura do `error` retornado pelo supabase, logar e propagar; funnelMetrics passa a devolver `{ ...metrics, error }` e LayersBuilder.tsx:923 renderiza um bloco vermelho 'Erro ao carregar métricas' em vez de zeros. Fazer o mesmo no try de `sessions` (metrics.ts:364).

- **Arquivo:** `src/lib/quiz/metrics.ts:370-382 (catch na :381) + src/components/builder/LayersBuilder.tsx:923`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Em localhost, quebrar de propósito o filtro (`.not('hydrated_atX','is',null)`): a aba tem que mostrar 'Erro ao carregar métricas', NUNCA '0 visitantes'. Reverter e conferir que os números voltam.

### 🔴 Captura de lead (fluxo publicado)

**Ação:** Ligar o e-mail de ponta a ponta: (1) migration nova `alter table funnel_leads add column if not exists email text;`; (2) adicionar `email?: string` no type Body (route.ts:14-27), `email: body.email ?? null` no leadRow (route.ts:39-65) e `email: body.email ?? ''` no payload do webhook (route.ts:165-195). O runner já manda `email` (LayersRunner.tsx:121). Isso também resolve a coluna 'Email' sempre vazia do CSV (export-leads/route.ts:46 e :62).

- **Arquivo:** `src/app/api/funnel-lead/route.ts:14-27, :39-65, :165-195 + src/app/api/export-leads/route.ts:46,62`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** migration nova (coluna email em funnel_leads)
- **Como validar:** Preencher um funil com bloco E-mail em produção e rodar `select name,phone,email from funnel_leads order by created_at desc limit 1;` -> email preenchido. Baixar o CSV: a coluna Email tem que trazer o valor. No Datacrazy, o lead tem que chegar com o campo email mapeado.

### 🔴 Captura de lead (fluxo publicado)

**Ação:** Deixar de rejeitar captura sem telefone e parar o retry infinito: (1) em route.ts:36 aceitar quando houver `phone` OU `email` (`if (!body.funnelSlug || (!body.phone && !body.email)) return 400`) e tornar funnel_leads.phone nullable; (2) em LayersRunner.tsx:150-160, quando `!ok`, contar tentativas no item de `ctf_pending_leads` e descartar após 3 falhas; (3) exibir um aviso visível na lâmina quando o POST falhar (hoje falha 100% silencioso).

- **Arquivo:** `src/app/api/funnel-lead/route.ts:36 + src/components/quiz/layers/LayersRunner.tsx:73-90 e :150-160`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** migration nova (phone nullable)
- **Como validar:** Montar em localhost uma lâmina só com Campo=Nome + Campo=E-mail, submeter e conferir `select * from funnel_leads order by created_at desc limit 1;` -> linha criada com phone null. Depois forçar erro 500 e conferir no DevTools > Application > Local Storage que ctf_pending_leads para de crescer em 3 itens e que aparece o aviso na tela.

### 🔴 Construtor > Paleta > Formulário > Botão

**Ação:** Corrigir a ordem dos ramos e o destino por botão em ButtonBlock.onClick (blocks.tsx:236-240): trocar para `if (ctx.hasFields) { ctx.submitFields(dest); return; } if (isExternal) { fireMetaEvent('InitiateCheckout'); ctx.navigate(dest); return; } ctx.navigate(dest);`. Mudar a assinatura de submitFields para `submitFields(dest?: string)` no LayersCtx e usar `navigate(dest || btn?.content.destination || 'next')` em LayersRunner.tsx:150 e :176 (hoje pega sempre o PRIMEIRO botão da lâmina).

- **Arquivo:** `src/components/quiz/layers/blocks.tsx:236-240 + src/components/quiz/layers/LayersRunner.tsx:91,150,176`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Lâmina de captura com botão apontando para URL de checkout: preencher e clicar -> `select count(*) from funnel_leads where created_at > now()-interval '2 min';` tem que aumentar 1 ANTES do redirect. Lâmina com 2 botões e formulário: clicar no 2º tem que levar ao destino do 2º (conferir a URL/lâmina resultante).

### 🔴 Construtor > Canvas (lâmina de roleta/slider)

**Ação:** Fechar o vazamento de dados do preview: em LayersRunner.tsx:186 trocar `preview: false` por `preview` (a prop do componente) no stepCtx da roleta; e em LayersRunner.tsx:161 guardar o trackAnswer do LayersCtx: `trackAnswer: (stepId,q,a) => { if (!preview) trackAnswer(funnel.slug, stepId, q, a); }`. steps.tsx:35 já respeita ctx.preview, o furo é o hardcode.

- **Arquivo:** `src/components/quiz/layers/LayersRunner.tsx:161 e :186`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Anotar `select count(*) from quiz_answers where funnel_slug='cdb-r';`, girar a roleta 5x no construtor em localhost e rodar de novo -> o count NÃO pode mudar. Conferir também que nenhum evento Meta sai no DevTools > Network (filtro 'facebook').

### 🔴 Construtor > Canvas > toolbar do bloco (⠿ ⧉ ◐ 🗑)

**Ação:** Reaproveitar a lógica de cloneStepFresh no duplicar de BLOCO: em LayersBuilder.tsx:1027 substituir `{ ...JSON.parse(JSON.stringify(layers[i])), id: genId() }` por um clone que também regenera `content.id` e cada `content.options[].id` (extrair uma função cloneLayerFresh a partir de cloneStepFresh :985-1000 e usar nas duas rotas). Adicionar `window.confirm` no ramo `action === 'delete'` (:1026).

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:1024-1030 (clone :1027) + cloneStepFresh :985`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** No construtor, duplicar um bloco Campo, salvar e conferir no jsonb: `select jsonb_path_query_array(steps,'$[*].layers[*].content.id') from funnels where slug='...';` -> nenhum id repetido. No preview, digitar num campo NÃO pode espelhar no outro.

### 🔴 Construtor > painel Etapa > Título · Leads > Respostas > colunas de etapa

**Ação:** Desacoplar 'pergunta' de 'título da lâmina': agregar quiz_answers por `step_id` (a coluna já é gravada) e usar o título ATUAL da lâmina apenas como rótulo de exibição. Alterar o agrupamento em funnel-analytics/route.ts:98 (resultados), :126 (respostas) e :134 (questionStats), em export-leads/route.ts:35-41 e em funnel-lead/route.ts:120-140 (pergunta_N/resposta_N). Trocar o denominador do PctRing: usar `visitantes` do funnelMetrics, não o total da 1ª pergunta.

- **Arquivo:** `src/app/api/funnel-analytics/route.ts:98,126,134 + src/app/api/export-leads/route.ts:35-41 + src/app/api/funnel-lead/route.ts:120-140`
- **Severidade:** critico · **Esforço:** alto
- **Depende de:** nada
- **Como validar:** Renomear uma lâmina em localhost, responder o funil e conferir que a aba Respostas continua com UMA coluna para aquela etapa (não duas). Rodar `select step_id, count(distinct session_id) from quiz_answers where funnel_slug='cdb-01' group by 1;` -> o número de cada etapa tem que bater 1:1 com a coluna correspondente na tela.

### 🔴 Leads > sub-aba Resultados

**Ação:** Contar SESSÕES distintas, não linhas: em funnel-analytics/route.ts:98 agrupar por `(step_id, answer)` com `count(distinct session_id)`, e para múltipla escolha explodir a resposta concatenada antes de contar. O total da pergunta passa a ser `count(distinct session_id)` daquele step_id, para o % somar ~100%.

- **Arquivo:** `src/app/api/funnel-analytics/route.ts:98`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** `select count(distinct session_id) from quiz_answers where funnel_slug='cdb-01' and step_id='<id>';` tem que bater com o 'total' exibido no card daquela pergunta, e a soma dos % das opções tem que ficar entre 99 e 101.

### 🔴 Construtor > Paleta > Quiz > Opções

**Ação:** Parar de destruir a formatação inline: trocar o `<input value={strip(o.label)} ... label: `<p>${e.target.value}</p>` >` por `<HtmlField value={o.label} onChange={(v)=>...label: v}/>` (o mesmo componente já usado em Texto/Alerta, LayersBuilder.tsx:89). Assim negrito, cores e spans dos funis importados do inlead sobrevivem à edição.

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:413`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Abrir um funil importado do inlead que tenha opção com <strong>/<font color>, editar uma letra, salvar e rodar `select jsonb_path_query_array(steps,'$[*].layers[*].content.options[*].label') from funnels where slug='...';` -> as tags têm que continuar lá. Print do preview antes/depois idêntico salvo a letra alterada.

### 🔴 Construtor > Etapas > ⬇ Importar lâmina (modal) · Construtor > Etapas > ⧉ Duplicar

**Ação:** Remapear destinos no clone: em cloneStepFresh (LayersBuilder.tsx:985-1000) montar um mapa `oldId -> newId` de TODOS os steps/blocos e, ao final, reescrever `content.destination` e `content.options[].destination` que apontarem para ids do mapa. Para importação entre funis, o destino que não existir no funil de destino deve virar `'next'` E exibir um aviso listando quantas saídas foram religadas.

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:985 (cloneStepFresh), :1008 (importStep), :1009 (dupStep) + src/app/api/funnels-export/route.ts:16`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Duplicar uma lâmina com bifurcação, abrir a aba Fluxo e conferir que as setas da cópia apontam para a CÓPIA, não para a original. Importar lâmina de outro funil e conferir que nenhum select de destino fica com valor órfão (todos ou apontam para uma lâmina existente ou mostram '→ próxima').

### 🔴 Construtor > Etapas > ✕ Excluir

**Ação:** Em delStep (LayersBuilder.tsx:968) adicionar (1) `window.confirm` citando o título da lâmina, (2) varredura pós-exclusão que troca por 'next' todo `content.destination` e `options[].destination` que apontava para o id removido, e (3) toast informando quantas saídas foram religadas. Guardar o estado anterior num ref para um botão 'Desfazer' de 10s.

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:968 (botão :1097)`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Criar A->B->C com um botão de A apontando para C; excluir C: tem que pedir confirmação, avisar '1 saída religada' e a aba Fluxo mostrar A -> próxima. Nenhum destination órfão em `select steps from funnels where slug='...';`

### 🔴 Construtor (motor typebot) > Grupos

**Ação:** Em delGroup (TypebotBuilder.tsx:108) limpar as referências: após o filter, mapear todos os grupos zerando `g.to` igual ao id removido e todos os `item.to` dos blocos condition/choice/button; se o grupo removido era o startGroup, reapontar para groups[0]. Adicionar confirm.

- **Arquivo:** `src/components/builder/TypebotBuilder.tsx:108 (uso :170) + src/components/quiz/typebot/ChatRunner.tsx:103`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Montar 3 grupos encadeados, excluir o do meio, publicar e percorrer o chat em localhost: ele NÃO pode parar no meio; tem que seguir para o próximo grupo válido. Conferir no console que nenhum `groupById[gid]` fica undefined.

### 🔴 Construtor (motor typebot) > bloco Telefone (input-phone)

**Ação:** Deixar de depender do nome da variável: em ChatRunner.tsx:166-169, além de v.whatsapp/telefone/phone, aceitar o valor da variável do bloco cujo `type === 'input-phone'` (guardar o nome dela em varsRef ao processar o bloco) e o nome pelo bloco `input-text` marcado como nome. Alternativa mínima: no editor (TypebotBuilder.tsx:308) travar o campo 'Salvar na variável' do input-phone em um select fixo (whatsapp/telefone/phone) em vez de texto livre.

- **Arquivo:** `src/components/quiz/typebot/ChatRunner.tsx:166-169 + src/components/builder/TypebotBuilder.tsx:308-312`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Renomear a variável do input-phone para 'zap', completar o chat em localhost e conferir `select * from funnel_leads order by created_at desc limit 1;` -> o lead tem que ser gravado mesmo assim (ou o editor tem que impedir o nome inválido).

### 🟡 Construtor > painel direito > Aparência > Alinhamento vertical · Design (layers) > Cor do título

**Ação:** Remover os dois controles 100% mortos: apagar o grupo de botões valign (LayersBuilder.tsx:274-281) e o color-picker titleColor (:512). Se a intenção era manter, implementar a leitura em blocks.tsx (valign -> alignSelf do wrapper) e no LayersRunner (titleColor -> var CSS aplicada aos h1/h2/h3 do .lyr-html) — mas o barato e correto agora é remover para não sujar o jsonb.

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:274-281 e :512`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Grep no repo por `design.valign` e `design.titleColor` fora do motor typed -> zero ocorrências de LEITURA. Print do painel Aparência sem os 4 botões verticais.

### 🟡 Construtor > painel direito > Aparência > Largura / Alinhamento horizontal / Tamanho da fonte (bloco)

**Ação:** Criar um mapa de capacidades por tipo de bloco (ex.: `const SUPPORTS = { basis: new Set(['text','image','button','options']), align: new Set(['text','image','button']), fontSize: new Set(['text']) }`) e condicionar a renderização dos controles em Aparencia (LayersBuilder.tsx:256, :266, :289) a `SUPPORTS.x.has(layer.type)`. Hoje o slider grava valor que blocks.tsx ignora (Alerta, Campo, Timer, Loading, Carrossel, Embed, Espaço, Notificação, Gráfico usam 'mx-auto w-full' fixo).

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:256, :266, :289 + src/components/quiz/layers/blocks.tsx`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Selecionar um bloco Timer: o painel Aparência não pode mais mostrar Largura/Alinhamento/Tamanho da fonte. Selecionar um bloco Texto: os três continuam. Print das duas telas.

### 🟡 Construtor > Paleta > Jogos (hero) > Roleta · Slider 0–10

**Ação:** Mover os editores dedicados (LayersBuilder.tsx:1225 slider e :1245 roleta) para dentro do switch de LayerFields (:310-455) como `case 'roulette'` e `case 'slider'`, para aparecerem no painel Componente ao clicar no bloco. E, ao adicionar roleta/slider numa lâmina que já tem outros blocos, exibir aviso 'Esta lâmina vira hero: os demais blocos não serão exibidos' (o early return do LayersRunner.tsx:176-204 engole tudo).

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:310-455, :1225, :1245 + src/components/quiz/layers/LayersRunner.tsx:176`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Clicar na roleta no canvas -> o painel direito tem que abrir na aba Componente com os segmentos editáveis. Adicionar um Texto numa lâmina de roleta -> tem que aparecer o aviso. Print das duas.

### 🟡 Construtor > painel Etapa > Lâmina ativa/desativada · Fluxo > canvas de nós

**Ação:** Fazer o Fluxo refletir o funil publicado: em FluxoTab (LayersBuilder.tsx:559) marcar visualmente as lâminas `disabled` (cinza + selo OFF) e excluí-las do cálculo de `targetId` (:686), pintando de vermelho toda saída cujo destino é lâmina desativada ou inexistente. E trocar o texto falso 'segue → próxima lâmina' (:678) por '📝 formulário → destino do botão' quando a lâmina tiver bloco field.

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:559, :678, :686 + src/components/quiz/layers/LayersRunner.tsx:37`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Desativar a lâmina 3 de um funil e apontar um botão da 2 para ela: a aba Fluxo tem que mostrar essa saída em vermelho com aviso. Percorrer o funil publicado e confirmar que ele realmente pula para a 4 (mesma coisa que o Fluxo agora indica).

### 🟡 Fluxo > select de destino por saída

**Ação:** Adicionar no select (LayersBuilder.tsx:670-676) a opção fixa '🔗 Link externo…' que abre um prompt/input para colar a URL, e proteger a troca: se o destino atual for URL e o usuário escolher outra coisa, pedir confirmação ('Isso vai apagar a URL de checkout X. Continuar?').

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:670-676 (setDest :560)`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Criar um destino externo pelo Fluxo (sem editar jsonb) e conferir `select steps from funnels where slug='...';` com a URL gravada. Tentar trocar por 'próxima' -> tem que pedir confirmação.

### 🟡 Construtor > Paleta > Formulário > Campo

**Ação:** Expor a chave do campo e evitar colisão: adicionar no case 'field' de LayerFields (LayersBuilder.tsx:394-401) um input 'Chave (name) — usada no lead/webhook' editável, e validar na hora do save (LayersBuilder.tsx:951) que não há duas chaves iguais na mesma lâmina (bloqueia com mensagem). Fazer o runner honrar `content.required` na validação em vez da heurística por regex (LayersRunner.tsx:96-115) ou remover `required` do newLayer (:70) se não for usar.

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:394-401, :70, :951 + src/components/quiz/layers/LayersRunner.tsx:96-115`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Adicionar dois Campos tipo Nome na mesma lâmina -> o Salvar tem que recusar com mensagem. Alterar a chave de um campo e conferir no payload do webhook (aba Network do DevTools no POST /api/funnel-lead) que a nova chave chega ao Datacrazy.

### 🟡 Construtor > Paleta > Quiz > Opções

**Ação:** Completar o editor do bloco Opções em LayerFields (LayersBuilder.tsx:403-418): adicionar por opção um select de destino (reaproveitar `destOptions` já definido em :314) e um campo de emoji/imagem (grava `o.emoji` / `o.image`, que blocks.tsx:415-417 já lê); adicionar um checkbox 'Múltipla escolha' que grava `content.multiple` (o runtime já suporta, blocks.tsx:398); e um select de chevron (design.icon: right/none) para poder remover a seta que o newLayer (:72) força.

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:403-418 e :72 + src/components/quiz/layers/blocks.tsx:398,415-417`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Marcar 'Múltipla escolha' numa pergunta, responder no publicado e conferir `select answer from quiz_answers where step_id='<id>' order by created_at desc limit 1;` -> resposta concatenada. Definir destino direto pela aba Componente e conferir que a aba Fluxo mostra o mesmo destino.

### 🟡 Construtor > Paleta > Atenção > Notificação · Construtor > Paleta > Gráficos > Métricas

**Ação:** Tornar os dois blocos que o RUNTIME já renderiza editáveis: adicionar 'notification' e 'graphics' ao set ADDABLE (LayersBuilder.tsx:47) e criar seus cases no switch de LayerFields (:310-455) — Notificação: text/duration/position; Métricas: lista de {percent, style, legend} com + e ✕.

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:47, :310-455 + src/components/quiz/layers/blocks.tsx:557,578`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Abrir um funil importado do inlead que já tenha bloco de Métricas, clicar nele e conseguir editar o percentual; salvar e conferir o valor novo no preview e na URL pública (print lado a lado).

### 🟡 Configurações > Webhooks

**Ação:** Ou tornar o gatilho 'Click em componente' utilizável, ou removê-lo da UI. Para usar: adicionar no editor do bloco Botão (LayersBuilder.tsx:332-345) um campo 'ID do componente (webhook)' que grava `content.componentId`, e em blocks.tsx onClick / LayersRunner.tsx:122 passar esse valor no lugar do 'captura' fixo. Para remover: tirar a opção do select em FunnelSettingsPanel.tsx:271 e o input component_id (:272).

- **Arquivo:** `src/components/quiz/layers/LayersRunner.tsx:122 + src/components/builder/FunnelSettingsPanel.tsx:271-272 + src/app/api/funnel-lead/route.ts:102-107`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Criar webhook com trigger click_component e component_id='cta_vsl', marcar esse id num botão, clicar no publicado e conferir no endpoint receptor (webhook.site ou log do Datacrazy) que o POST chegou com `cta_vsl: clicked`.

### 🟡 Configurações > (aba ausente) — webhookKey por lâmina

**Ação:** Adicionar no painel Etapa (LayersBuilder.tsx:1171, ao lado do Título) um input 'Nome do campo no Datacrazy (webhookKey)' que grava `steps[].webhookKey`. Replicar no StepEditor do motor typed (StepEditor.tsx:55). O backend já consome (funnel-lead/route.ts:143-151) e cai em pergunta_N/resposta_N genérico sem isso.

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:1171 + src/components/builder/StepEditor.tsx:55 + src/app/api/funnel-lead/route.ts:143-151`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Setar webhookKey='Faixa_Etaria' na lâmina de idade, responder o funil e conferir no Datacrazy (ou no webhook.site) que chegou o campo Faixa_Etaria com o valor — e não só resposta_2.

### 🟡 Configurações > Geral > (campo ausente) — produto_nome

**Ação:** Adicionar no bloco Geral do FunnelSettingsPanel (linha 132, junto de Hotmart Product ID) um input 'Nome do produto (Datacrazy)' que grava `settings.produto_nome`. O webhook já lê (funnel-lead/route.ts:88) e hoje só dá para setar editando jsonb no Supabase.

- **Arquivo:** `src/components/builder/FunnelSettingsPanel.tsx:132 + src/app/api/funnel-lead/route.ts:88`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Preencher 'Clube das Bolsas', salvar, capturar um lead e conferir no payload do POST (aba Network) que `Produto: "Clube das Bolsas"` — e que o campo Produto chega assim no Datacrazy.

### 🟡 Construtor > header > Ver ao vivo ↗

**Ação:** Parar de poluir as próprias métricas: (1) adicionar suporte a `?preview=1` em src/app/[slug]/page.tsx (hoje só /q tem, q/[slug]/page.tsx:47-48) — quando preview, não renderizar <VisitBeacon> e passar preview ao FunnelRenderer; (2) trocar o href do 'Ver ao vivo' para incluir `?preview=1` nos 3 construtores; (3) unificar a rota (usar sempre /{slug} ou sempre /q/{slug}, não uma por motor).

- **Arquivo:** `src/app/[slug]/page.tsx:55-76 + src/components/builder/LayersBuilder.tsx:1065 · FunnelBuilder.tsx:178 · TypebotBuilder.tsx:137`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Anotar `select count(*) from funnel_sessions where funnel_slug='cdb-01';`, clicar 5x em 'Ver ao vivo' e percorrer o funil, rodar o count de novo -> não pode aumentar.

### 🟡 Construtor > header > 💾 Salvar · Construtor > header > ← Funis

**Ação:** Guarda de alterações não salvas: manter um `dirtyRef` comparando `funnel` com `initial` (JSON) e (1) registrar `window.onbeforeunload` quando dirty, (2) interceptar o Link '← Funis' (LayersBuilder.tsx:1050) com confirm, (3) autosave em localStorage a cada 10s com banner 'restaurar rascunho' ao reabrir. Replicar em FunnelBuilder.tsx e TypebotBuilder.tsx.

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:951 e :1050 (+ FunnelBuilder.tsx:178, TypebotBuilder.tsx:137)`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Editar um texto sem salvar e apertar F5 -> tem que aparecer o alerta nativo do browser. Clicar '← Funis' -> confirm. Fechar a aba e reabrir o construtor -> banner de rascunho com o texto editado.

### 🟡 Construtor > (ausente em todos os motores) — Publicar/Despublicar/Arquivar

**Ação:** Introduzir rascunho de verdade: em funnels-db.ts:145 parar de forçar `status: 'published'` e gravar `status: funnel.status ?? 'draft'`; filtrar `.eq('status','published')` em resolveFunnel (funnels-db.ts:90-104) e resolveFunnelByDomain (:107-125); adicionar no header do construtor um botão '🚀 Publicar' que salva com status='published' + revalidatePath, e no Dashboard um botão Arquivar.

- **Arquivo:** `src/lib/quiz/funnels-db.ts:145, :90-104, :107-125 + src/components/builder/LayersBuilder.tsx:1064`
- **Severidade:** importante · **Esforço:** alto
- **Depende de:** nada
- **Como validar:** Salvar sem publicar e abrir a URL pública -> tem que servir a versão anterior (ou 404 se nunca publicado); `select slug,status from funnels where slug='...';` -> 'draft'. Clicar Publicar -> status vira 'published' e a URL passa a servir a versão nova.

### 🟡 Leads > ⬇ Exportar leads

**Ação:** Passar o filtro de período para o CSV: em LayersBuilder.tsx:781 acrescentar `&from=`/`&to=` na URL (os mesmos params já usados em :731/:787) e em export-leads/route.ts:21 aplicar `.gte('created_at',from)` / `.lte('created_at',to)`. Colocar o período no nome do arquivo (`leads-cdb-01-2026-07-01_2026-07-27.csv`).

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:781 + src/app/api/export-leads/route.ts:21,72`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Selecionar 'Hoje' e exportar: o número de linhas do CSV (menos o cabeçalho) tem que bater com `select count(*) from funnel_leads where funnel_slug='cdb-01' and created_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo');`

### 🟡 Leads > sub-aba Respostas

**Ação:** Deixar explícito o universo da tabela: em funnel-analytics/route.ts:126 passar a listar TODAS as sessões do período (LEFT JOIN funnel_sessions -> quiz_answers/funnel_leads), com badge por linha: 'só visitou' / 'respondeu' / 'lead'. Trocar o rótulo '#abc12345' por 'Anônimo (sessão abc12345)' e o telefone '—' por 'não capturado'.

- **Arquivo:** `src/app/api/funnel-analytics/route.ts:126 + src/components/builder/LayersBuilder.tsx:808`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** migration 0014 (para o universo = sessões hidratadas)
- **Como validar:** Total de linhas da aba Respostas (sem filtro) tem que bater com o card Visitantes da aba Performance no mesmo período; e a contagem de linhas com badge 'lead' tem que bater com `select count(*) from funnel_leads where funnel_slug='...' and created_at between ...`

### 🟡 Construtor > Etapas > ⠿ arrastar (reordenar lâminas)

**Ação:** Blindar o histórico: (1) se o funil já tem sessões, mostrar confirm ao reordenar avisando que os números históricos da aba Performance passam a somar etapas diferentes; (2) migrar a contagem de conclusão de índice para id — em metrics.ts:326-347 e :382 usar step_events.step_id (já gravado por trackStep, LayersRunner.tsx:54) em vez de max_step_reached, que é index-based.

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:1041 (onStepDragEnd) + src/lib/quiz/metrics.ts:326-347, :382`
- **Severidade:** importante · **Esforço:** alto
- **Depende de:** migration 0014 (deploy junto)
- **Como validar:** Depois da migração da métrica: `select count(distinct session_id) from step_events where funnel_slug='cdb-01' and step_id='<id da última lâmina>';` tem que bater com o card Conclusões. Reordenar as lâminas e conferir que o card NÃO muda de valor.

### 🟡 Construtor > Canvas > moldura do celular · Design (layers) > Fonte

**Ação:** Alinhar preview e publicado: em LayersBuilder.tsx:1148 trocar o `fontFamily: 'Poppins'` hardcoded pela mesma regra de [slug]/page.tsx:61-66 (`funnel.font === 'poppins' ? var(--font-poppins) : var(--font-sans-q)`), carregando as duas famílias no construtor. E ou fazer 'Serif (Fraunces)' aplicar Fraunces no corpo do motor layers (LayersRunner.tsx: setar fontFamily via --q-display no wrapper), ou remover a opção Serif do select do motor layers (:520).

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:1148 e :520 + src/app/[slug]/page.tsx:61-66`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Print lado a lado do preview do construtor e da URL pública com font='serif' e com font='poppins' — a tipografia tem que ser visualmente idêntica nos dois casos.

### 🟡 Construtor (motor typebot) > (ausente) — startGroup

**Ação:** Adicionar no painel de grupos (TypebotBuilder.tsx:165-175) um select 'Grupo inicial do funil' que grava `settings.typebot.startGroup` (o ChatRunner.tsx:159 já lê, e hoje cai em groups[0] silenciosamente). Marcar o grupo inicial com um selo ▶ na lista.

- **Arquivo:** `src/components/builder/TypebotBuilder.tsx:165-175 + src/components/quiz/typebot/ChatRunner.tsx:159`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Definir o grupo 3 como inicial, salvar, abrir o publicado -> o chat tem que começar pelo grupo 3. Reordenar os grupos e conferir que continua começando pelo 3.

### 🟢 Construtor > Paleta > Mídia e conteúdo > Vídeo

**Ação:** Fazer cleanup dos scripts do player no EmbedBlock: guardar num array os <script> injetados no document.head e removê-los no return do useEffect (hoje só limpa o innerHTML da div), e deduplicar por `src` antes de injetar.

- **Arquivo:** `src/components/quiz/layers/blocks.tsx:345-370 (EmbedBlock)`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** No construtor, alternar 10x entre a lâmina de VSL e outra; no DevTools > Console rodar `document.querySelectorAll('script[src*="converteai"]').length` -> tem que ficar em 1 (hoje empilha).

### 🟢 Construtor > Paleta > Atenção > Loading

**Ação:** Completar o editor do bloco Loading (LayersBuilder.tsx:423-427): adicionar select de destino do auto-avanço (reaproveitar `destOptions` de :314, hoje sempre 'next'), input de descrição e toggles show_title / show_percent / show_progress — todos já lidos por blocks.tsx:504-537.

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:423-427 + src/components/quiz/layers/blocks.tsx:504-537`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Desligar 'mostrar %' pelo painel, salvar e conferir no publicado que o percentual sumiu (print). Setar destino do auto-avanço para a lâmina 5 e conferir que o funil pula para ela.

### 🟢 Design (layers) > (controles ausentes) + Header global

**Ação:** Expor na aba Design os 5 tokens que o runtime já lê e não têm UI: `gap` (LayersRunner.tsx:288), `verticalAlign` (:281), `rounded` e `elementSize` (blocks.tsx:99/281) e o toggle global `go_to_top` (LayersRunner.tsx:272). Adicionar todos no bloco de Design em LayersBuilder.tsx:510-540.

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:510-540 + src/components/quiz/layers/LayersRunner.tsx:272,281,288 + src/components/quiz/layers/blocks.tsx:99,281`
- **Severidade:** melhoria · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Mexer no slider de gap e conferir no preview + no publicado que o espaçamento entre blocos mudou (print antes/depois). Ligar 'Ir ao topo' global e conferir que o botão ↑ aparece em todas as lâminas exceto a 1ª.

### 🟢 Construtor > Paleta > (todos os blocos 'em breve')

**Ação:** Limpar a paleta: filtrar CATS (LayersBuilder.tsx:59-70) para renderizar só os itens em ADDABLE (:47), movendo os 17 placeholders para um accordion 'Em breve' colapsado no fim da lista — ou removendo-os. Apagar junto o `window.alert` morto de addPaletteItem (:1013), que nunca dispara porque o botão já vem disabled (:1115).

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:47, :59-70, :1013, :1115`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Print da coluna Paleta: nenhum selo 'breve' visível na lista principal. Grep por `window.alert` em LayersBuilder.tsx -> zero ocorrências.

### 🟢 Construtor > Etapas > + (nova etapa) · Construtor > Paleta > Formulário > Botão (campo morto)

**Ação:** Parar de gravar lixo no jsonb: em addStep (LayersBuilder.tsx:963) remover `options: {show_logo, show_progress}` (o runtime só lê headerOverride e settings.header, LayersRunner.tsx:241-243); em newLayer case 'button' (:70) trocar `pulse: true` por `effect: 'none'` (o runtime lê design.effect, blocks.tsx:250).

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:963 e :70 + src/components/quiz/layers/blocks.tsx:250`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Criar lâmina + botão novos, salvar e rodar `select jsonb_pretty(steps) from funnels where slug='...';` -> nenhuma chave `options.show_logo` nem `design.pulse` nas entradas novas.

### 🟢 Construtor > painel direito > Exibição > Revelar após (s)

**Ação:** Aplicar o Reveal também no editor: em blocks.tsx:718 (`if (edit) return <>{node}</>`) respeitar `layer.effects.starts` quando um novo toggle 'Simular tempos' do canvas estiver ligado, ou adicionar um botão '▶ Testar timing' no painel Exibição (LayersBuilder.tsx:464) que remonta o preview em modo runtime.

- **Arquivo:** `src/components/quiz/layers/blocks.tsx:718 + src/components/builder/LayersBuilder.tsx:464`
- **Severidade:** melhoria · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Setar 'Revelar após 5s' num botão, clicar em Testar timing e cronometrar no preview: o botão só pode aparecer aos ~5s, igual ao publicado.

### 🟢 Fluxo > arrastar nó

**Ação:** Persistir a posição dos nós em `steps[].flowPos = {x,y}` (gravado junto no save) e trocar a dependência do useEffect de reencaixe de `[steps.length]` para `[steps.map(s=>s.id).join(',')]`, para reordenar/renomear atualizarem o mapa.

- **Arquivo:** `src/components/builder/LayersBuilder.tsx:584 e :594`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Arrastar 3 nós, salvar, sair da aba Fluxo, voltar e apertar F5 -> os nós têm que estar nas mesmas posições (print antes/depois).

### 🟢 Construtor (motor typebot) > Blocos > ▲▼ / ✕

**Ação:** Paridade com o motor layers: trocar os botões ▲▼ (TypebotBuilder.tsx:99) por drag-drop com @dnd-kit (já é dependência do projeto, usado em LayersBuilder), adicionar botão ⧉ duplicar bloco (clonando com genId novo) e `window.confirm` no ✕ (:98).

- **Arquivo:** `src/components/builder/TypebotBuilder.tsx:98-104`
- **Severidade:** melhoria · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Arrastar um bloco no construtor typebot, salvar e conferir a nova ordem em `select settings->'typebot'->'groups' from funnels where slug='...';`. Clicar ✕ -> confirm aparece.

### 🟢 Configurações > Pixel / Scripts

**Ação:** Adicionar no bloco Pixel/Scripts do FunnelSettingsPanel (linha 174-230) o textarea 'Script do rodapé (footer_script)', que já existe no tipo FunnelPixels (types.ts:420) e hoje não tem campo — e garantir que o PixelScripts injete esse valor no fim do body.

- **Arquivo:** `src/components/builder/FunnelSettingsPanel.tsx:174-230 + src/lib/quiz/types.ts:420`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Colar `<script>window.__ft=1</script>` no campo, salvar, abrir a URL pública e rodar `window.__ft` no console -> tem que devolver 1.

### 🟢 Construtor (motor typed) > Preview

**Ação:** Trazer para o motor typed o que o layers já tem: reaproveitar PREVIEW_DEVICES + o controle de zoom (LayersBuilder.tsx:50, :1136, :1141) no preview de FunnelBuilder.tsx:291, e fazer handleEditFromPreview (:106) selecionar de fato o campo correspondente no StepEditor em vez de só rolar e piscar a borda.

- **Arquivo:** `src/components/builder/FunnelBuilder.tsx:106 e :291 + src/components/builder/LayersBuilder.tsx:50,1136,1141`
- **Severidade:** melhoria · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Print do construtor typed com seletor de dispositivo e zoom funcionando; clicar num título do preview tem que deixar o input correspondente focado (cursor piscando nele).

### 🟢 Construtor (motor typed) > (ausentes) — desativar lâmina / importar lâmina · Fluxo (motor typed)

**Ação:** Adicionar `disabled?: boolean` ao BaseStep (types.ts:86), o toggle 'Lâmina ativa/desativada' no editor (StepEditor.tsx) e o filtro correspondente no QuizRunner; reaproveitar o modal de importar lâmina do layers (LayersBuilder.tsx:1337 + /api/funnels-export). Enquanto a aba Fluxo do typed continuar só leitura (FunnelBuilder.tsx:65), rotulá-la 'Fluxo (linear — sem bifurcação neste motor)' para não prometer edição.

- **Arquivo:** `src/lib/quiz/types.ts:86 + src/components/builder/StepEditor.tsx + src/components/builder/FunnelBuilder.tsx:65 + src/components/builder/LayersBuilder.tsx:1337`
- **Severidade:** melhoria · **Esforço:** alto
- **Depende de:** nada
- **Como validar:** Desativar a lâmina 4 de um funil typed e percorrer o publicado -> ele tem que pular da 3 para a 5. Print da aba Fluxo com o novo rótulo.

---

## VSL / Admin

### 🔴 /analytics > aba VSL (e todo o painel)

**Ação:** Rodar a migration 0014 no SQL editor do Supabase (projeto mmoahavnqucxmpnnprct) ANTES de qualquer push do codigo atual: abrir [supabase/migrations/0014_hydrated_at.sql](c:/Users/Luca%20Badar%C3%B3/PROJETOS%20VS%20CODE/quizfunnel-app/supabase/migrations/0014_hydrated_at.sql), copiar o arquivo inteiro, colar no SQL Editor e Run. Sem ela, os 4 pontos que filtram por hydrated_at (metrics.ts:57, :59, :356, :375) recebem 42703 do PostgREST, o catch devolve 0 e TODA a aba VSL (mais Geral/Operacao) vira zero silencioso.

- **Arquivo:** `supabase/migrations/0014_hydrated_at.sql:11-13 (consumido por src/lib/quiz/metrics.ts:57,59,356,375)`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** migration 0014
- **Como validar:** select count(*) total, count(hydrated_at) hidratou from funnel_sessions where funnel_slug='cdb-01'; -> tem que devolver 123 / 106. Depois GET /rest/v1/funnel_sessions?funnel_slug=eq.cdb-01&hydrated_at=not.is.null&select=count responde 200 (hoje responde 400 'column does not exist').

### 🔴 /analytics > VSL > 'VSL por funil' > Chegaram na VSL / % de chegada

**Ação:** Depois da 0014 aplicada, rodar npm run build e dar push do commit local 7ded91c (ensureSession parou de mandar max_step_reached:0 no upsert com onConflict, que zerava o progresso a cada F5/retorno). Enquanto nao subir, o numerador de 'Chegaram na VSL' continua subcontado em producao.

- **Arquivo:** `src/lib/quiz/track.ts:40-45 (commit 7ded91c, ainda nao pushado)`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** migration 0014 (aplicar antes do push)
- **Como validar:** Abrir /q/cdb-01, avancar ate a lamina da VSL, dar F5 e voltar: select session_id,max_step_reached from funnel_sessions where session_id like 's-%::cdb-01' order by last_seen_at desc limit 5 -> nenhum registro pode voltar a 0. Na aba VSL o cdb-01 tem que exibir 12 conclusoes (dado real de 24/07), nao 9.

### 🔴 /analytics > VSL (todas as secoes que leem o banco)

**Ação:** Parar de mascarar erro de banco: em countSessions trocar `catch { return 0 }` por relancar/retornar null e propagar um campo `dbError` no payload de globalAnalytics/funnelMetrics; na UI renderizar faixa vermelha 'nao consegui ler o banco' em vez de 0. Mesmo tratamento nos dois outros catches mudos.

- **Arquivo:** `src/lib/quiz/metrics.ts:381, :363-365, :224-226 (render em src/components/dashboard/GlobalAnalyticsView.tsx:455-611)`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Em localhost, renomear temporariamente a coluna hydrated_at (ou apontar pra slug inexistente com filtro invalido) e recarregar /analytics: a aba VSL tem que mostrar a mensagem de erro, nunca '0 visitantes'. Print da tela com a faixa de erro.

### 🔴 /analytics > aba VSL (gate da aba inteira)

**Ação:** Desacoplar o gate: trocar `{tab === 'vsl' && (vsls.length ? ... : <ComingSoon/>)}` por render incondicional da secao 'Metricas do video (VTurb)' (que nao depende do nosso banco) e aplicar o ComingSoon SOMENTE dentro da secao 'VSL por funil' quando vsls.length === 0.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:455 e :611 (fonte do array em :160-163)`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Em localhost com o filtro de sessoes forcado a 0 (ou banco vazio), abrir /analytics > VSL: a tabela do VTurb com os 5 players tem que continuar aparecendo e so o bloco 'VSL por funil' mostra o vazio. Print da tela.

### 🔴 /analytics > VSL > detalhe > tabela TEMPO / % RET. / % QUEDA

**Ação:** Corrigir o off-by-one de uma linha inteira: no loop de minutagem usar a retencao no FIM do intervalo (`const end = Math.min(start+60, maxT); const pt = [...curve].reverse().find(c => c.t <= end)`) em vez de `curve.find(c => c.t >= start)`, e acrescentar a linha final com o ultimo ponto da curva (hoje o valor final, 20,6% no player do cdb-01, nunca aparece).

- **Arquivo:** `src/app/api/vturb/detail/route.ts:71-80 (render em src/components/dashboard/VslDetail.tsx:223-231)`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Player 69f24c24a6fe5ed477b6e963 (cdb-01), 30 dias: a linha '00:00 a 01:00' tem que mostrar %RET 92% e QUEDA -8% (hoje mostra 100% / 0%), e a ultima linha tem que fechar em 20,6% — mesmos numeros da curva do painel da VTurb.

### 🔴 /analytics > VSL > detalhe > filtro Hoje / Ontem / 7 dias / 30 dias

**Ação:** Trocar `iso(d) = d.toISOString().slice(0,10)` (UTC) por data em America/Sao_Paulo: `new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)`, e usar a mesma funcao em daysAgo() e nos `max` dos inputs date. Hoje, das 21h as 24h BRT, 'Hoje' pede o dia seguinte (volta vazio) e 'Ontem' pede hoje.

- **Arquivo:** `src/components/dashboard/VslDetail.tsx:33-34 (usado em :55-56, :65-71, :157-160)`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Com o relogio da maquina em 22h BRT (ou fixando Date.now no console), clicar 'Hoje': o request tem que sair /api/vturb/detail?...&from=<data de hoje BRT>&to=<mesma data> na aba Network do DevTools, e o total de espectadores tem que bater com o card 'Hoje' do painel da VTurb.

### 🔴 /analytics > VSL > secao VTurb > coluna 'Funil'

**Ação:** Deixar explicito que o VTurb reporta o PLAYER inteiro (todas as paginas que embedam o video, inclusive fora deste app): em /api/vturb/route.ts devolver `pagesCount = funis.length` e um flag `sharedPlayer` quando > 1; na coluna exibir '/slug +N paginas' com badge de aviso e, quando views do VTurb > 10x as sessoes locais do funil, mostrar icone de alerta com tooltip 'trafego do player inclui paginas fora deste funil'.

- **Arquivo:** `src/app/api/vturb/route.ts:36-49 e :56-58 (render em src/components/dashboard/GlobalAnalyticsView.tsx:535)`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Player 6a31dfc11659071cf31eb32e tem que aparecer como '/cdb-rr +6 paginas' (7 slugs) e o player do cdb-01 com o alerta de escala (12.632 views VTurb vs 375 sessoes locais no total). Conferir a lista de slugs com: select slug from funnels where (settings::text || steps::text) like '%6a31dfc11659071cf31eb32e%';

### 🔴 (coleta) pagina do funil > bloco de video — tracking de retencao

**Ação:** Corrigir a origem da duracao no attachVslWatch: o ApiCompat do smartplayer v4 nao define player.video.duration. Trocar `const d = player.video.duration || 0` por cascata: `player.instance?.config?.duration ?? player.instance?.duration ?? Number(document.querySelector('vturb-smartplayer')?.getAttribute('duration')) ?? propDurationDoBloco`, e como ultimo recurso aceitar a duracao vinda do player VTurb ja conhecida no funil. Manter o guard de :42 so para maxT.

- **Arquivo:** `src/lib/quiz/vsl-watch.ts:71-76 (guard em :41-45)`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** inspecao no browser (DevTools na pagina /q/cdb-01 para confirmar onde o v4 expoe a duracao)
- **Como validar:** Abrir /q/cdb-01 no Chrome, dar play e assistir ~30s: na aba Network tem que sair POST /api/vsl-progress (hoje nao sai nenhum); depois select session_id,vsl_watch_pct,vsl_player_id from funnel_sessions where funnel_slug='cdb-01' order by last_seen_at desc limit 5 -> vsl_watch_pct > 0 e vsl_player_id preenchido (hoje 0 em 375/375 linhas).

### 🔴 (coleta) pagina do funil > botao de CTA/checkout

**Ação:** Gravar o clique no nosso CTA: no onClick do ButtonBlock, alem do fireMetaEvent('InitiateCheckout'), disparar navigator.sendBeacon para um novo POST /api/cta-click gravando step_event tipo 'cta_click' (+ coluna cta_clicked_at em funnel_sessions via migration 0015). Com isso monta-se o funil chegou na VSL -> clicou no CTA -> virou lead, que hoje nao existe em lugar nenhum, e a tabela 'VSL por funil' ganha a coluna 'Cliques no CTA'.

- **Arquivo:** `src/components/quiz/layers/blocks.tsx:236-241 (novo src/app/api/cta-click/route.ts + supabase/migrations/0015_cta_click.sql)`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** migration nova 0015 (cta_clicked_at)
- **Como validar:** Clicar no CTA do /q/cdb-01: select count(*) from step_events where event='cta_click' and funnel_slug='cdb-01' aumenta em 1 e a sessao ganha cta_clicked_at; o total do dia tem que ser <= 'Chegaram na lamina da VSL' e >= numero de leads do dia (sanidade do funil).

### 🟡 (infra) src/lib/vturb.ts — janela default de 30 dias

**Ação:** Gerar start_date/end_date em America/Sao_Paulo (mesmo timezone declarado no corpo) em vez de `d.toISOString()` UTC, e deletar a duplicacao: fazer vturbSessionStats chamar statsBody(player, range) em vez de reimplementar o mesmo corpo.

- **Arquivo:** `src/lib/vturb.ts:53-64 e :156-165`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Chamar /api/vturb sem from/to as 22h BRT e comparar total_viewed do player 69f24c24a6fe5ed477b6e963 com o mesmo intervalo de 30 dias no painel da VTurb: diferenca tem que ser 0 (hoje ha deslocamento de 3h nas bordas). Rodar tambem `tsc --noEmit` apos a deduplicacao.

### 🟡 /analytics > VSL > secao VTurb (titulo 'ultimos 30 dias') + comparacao

**Ação:** Elevar o periodo para state unico da aba VSL: criar `const [vslPeriod, setVslPeriod] = useState('30')` no GlobalAnalyticsView, montar from/to (em America/Sao_Paulo) e passar em loadVturb(`/api/vturb?...&from=&to=`), em VslDetail (props) e em VslCompare (props), substituindo o rotulo fixo ':460' e o hardcode de 30 dias do VslCompare. Assim os parametros from/to de /api/vturb/route.ts:24, hoje mortos, passam a ser exercitados.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:149-156 e :460; src/components/dashboard/VslCompare.tsx:32-33; src/app/api/vturb/route.ts:24`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** acao do timezone (usar a mesma funcao de data BRT)
- **Como validar:** Selecionar 'Hoje': na aba Network tem que sair /api/vturb?from=<hoje>&to=<hoje> e /api/vturb/detail com o MESMO from/to; o titulo da secao tem que dizer 'hoje'; Views da tabela de cima e espectadores do drill-down tem que se referir ao mesmo intervalo.

### 🟡 /analytics > VSL > secao VTurb > colunas Views e Plays

**Ação:** Mapear views para `s.total_viewed_device_uniq ?? s.total_viewed` e plays para `s.total_started_device_uniq ?? s.total_started` (campos ja tipados em vturb.ts:27-29), e renomear os cabecalhos para 'Views (unicos)' / 'Plays (unicos)' com title explicando a base. Hoje a coluna usa a contagem bruta e nunca bate com o painel da VTurb.

- **Arquivo:** `src/app/api/vturb/route.ts:60 (render em src/components/dashboard/GlobalAnalyticsView.tsx:536-537 e :523)`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Player 69f24c24a6fe5ed477b6e963, 30 dias: a coluna Views tem que exibir 10.596 (device_uniq) e Plays 9.560, exatamente os numeros do painel da VTurb — hoje exibe 12.632 e 10.474.

### 🟡 /analytics > VSL > detalhe > header 'N espectadores no periodo'

**Ação:** Renomear o rotulo para 'N plays unicos (base da curva)' — o valor e a soma dos buckets de saida (total_started_session_uniq), nao espectadores — e exibir ao lado, do mesmo periodo, Views e Plays vindos de /sessions/stats, para nao ficarem 3 numeros sem base declarada na mesma tela.

- **Arquivo:** `src/components/dashboard/VslDetail.tsx:135-139 (valor em src/app/api/vturb/detail/route.ts:50 e :105)`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Player do cdb-01, 30 dias: o header tem que mostrar '9.620 plays unicos (base da curva)' e, ao lado, Views 10.596 / Plays 9.560 — os mesmos valores da linha da tabela de cima. Print da tela.

### 🟡 /analytics > VSL > secao VTurb > coluna 'Cliques'

**Ação:** Renomear a coluna para 'Cliques no player (VTurb)' com title 'CTA nativo do player — os funis deste app usam bloco button proprio, este numero vem de outras paginas' e pintar em cinza claro; quando existir o tracking do nosso CTA (acao do clique no checkout), colocar ao lado a coluna 'Cliques no nosso CTA'.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:523 (th) e :542 (td)`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Print da tela com o novo rotulo; conferir que o funil cdb-01 nao tem CTA nativo do player (grep por 'destination' pay.hotmart em funnels.steps do cdb-01) enquanto a coluna exibe 3.826 cliques — o texto tem que explicar essa divergencia.

### 🟡 /analytics > VSL > coluna 'Conv.' + detalhe > tabela de segmentacao

**Ação:** Duas partes: (a) configurar a integracao de venda (Hotmart) no painel da VTurb para os 5 players dos funis; (b) no codigo, quando total_conversions/overall_conversion_rate vierem 0 em todos os players, exibir '—' com hint 'integracao de venda nao configurada na VTurb' em vez de pilula '0 · 0%', e adicionar as colunas Conv. e Receita na tabela de segmentacao (o backend ja mapeia conversions e amountBrl em detail/route.ts:93-94 e o dado e descartado no render).

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:543; src/components/dashboard/VslDetail.tsx:253-284 (dado em src/app/api/vturb/detail/route.ts:93-94)`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** integracao de venda Hotmart configurada no painel da VTurb (Hottok)
- **Como validar:** Antes: POST analytics.vturb.net/sessions/stats nos 5 players devolve total_conversions=0 e total_amount_brl=0 -> a UI tem que mostrar '—' + hint. Depois de integrar: total_conversions do player do cdb-01 tem que bater com as vendas do produto na Hotmart no mesmo periodo (tolerancia 0).

### 🟡 /analytics > VSL > detalhe > sub-aba 'Origem do Trafego'

**Ação:** Rotular a origem como do player, nao do funil: cabecalho 'UTMs vistos pelo player (inclui paginas fora deste app)' e nota de rodape explicando que nao reconcilia com a aba Criativos, que usa utm_content de funnel_sessions. Opcional: linkar 'ver os mesmos criativos no nosso tracking' apontando para a aba Criativos.

- **Arquivo:** `src/components/dashboard/VslDetail.tsx:246-251 e :256 (dado em src/app/api/vturb/detail/route.ts:44)`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Abrir a sub-aba no player do cdb-01: aparecem origens gbraid/Google Ads que nao existem em funnel_sessions (select distinct utm_source from funnel_sessions where funnel_slug='cdb-01' -> nao contem gbraid). O aviso tem que estar visivel na mesma tela. Print.

### 🟡 /analytics > VSL > 'Comparacao de VSLs' (dois blocos homonimos)

**Ação:** Desambiguar os dois comparadores com o mesmo titulo na mesma aba: renomear o bloco local para 'Comparar funis (nosso tracking: visitantes/chegada)' e o do VTurb para 'Comparar players (VTurb: retencao do video)', cada um com uma linha de subtitulo dizendo a fonte.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:558-582 (titulo em :561) vs src/components/dashboard/VslCompare.tsx:74`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Print da aba VSL com os dois blocos abertos: nenhum titulo pode se repetir e cada um tem que declarar a fonte (funnel_sessions vs VTurb Analytics API).

### 🟡 /analytics > VSL > 'VSL por funil' > colunas Visitantes / Chegaram na VSL / % de chegada

**Ação:** Ajustar os rotulos para o que o numero realmente e, depois da 0014: 'Visitantes' -> 'Visitantes (hidratados)' com title 'sessoes em que o app montou; o beacon puro nao conta'; 'Chegaram na VSL' -> 'Chegaram na lamina da VSL' com title 'proxy de chegada, nao de assistir'; atualizar a nota de rodape (:608) na mesma linha.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:591 (thead), :598-600, :608`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** migration 0014 aplicada
- **Como validar:** cdb-01 tem que exibir 106 visitantes (nao 123) e 12 na lamina da VSL; conferir com select count(*) filter (where hydrated_at is not null) e count(*) filter (where hydrated_at is not null and max_step_reached >= <indice da ultima lamina ativa>) from funnel_sessions where funnel_slug='cdb-01'.

### 🟡 /analytics > VSL > 'VSL por funil' — retencao medida por nos

**Ação:** Passar a LER vsl_watch_pct/vsl_milestones: adicionar em metrics.ts um agregado por funnel_slug (avg(vsl_watch_pct), count filter vsl_watch_pct>=50, >=75, >=100) e duas colunas na tabela 'VSL por funil' ('Retencao media' e 'Passaram do pitch'), alem de comparar com a curva do VTurb no drill-down. Hoje o unico leitor da coluna e o payload do webhook do lead.

- **Arquivo:** `src/lib/quiz/metrics.ts (novo agregado, ao lado de :370-388); render em src/components/dashboard/GlobalAnalyticsView.tsx:591-601; leitor atual em src/app/api/funnel-lead/route.ts:160-179`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** acao do fix de duracao do attachVslWatch (sem ela a coluna sai 0)
- **Como validar:** Depois de 1 dia de trafego: a 'Retencao media' do cdb-01 na UI tem que bater com select round(avg(vsl_watch_pct)) from funnel_sessions where funnel_slug='cdb-01' and vsl_watch_pct>0; e a % que passou do pitch tem que ficar na mesma ordem de grandeza da 'Ret. Pitch' do VTurb para o mesmo periodo.

### 🟡 (coleta) pagina do funil > CTA com revealAt

**Ação:** Ancorar o reveal no player, nao no relogio: reaproveitar o listener de timeupdate do vsl-watch (exportar um subscribe) e liberar o botao quando currentTime >= revealAt, com fallback para o setTimeout atual se nao houver player em 90s. Alem disso, derivar o revealAt do pitch_time do player (1060s) em vez do hardcode 1055s no bloco, ou exibir aviso no builder quando os dois divergirem.

- **Arquivo:** `src/components/quiz/layers/blocks.tsx:220-229 (referencia do comportamento correto: src/components/vsl/VslView.tsx:122)`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** acao do fix de duracao do attachVslWatch (mesmo listener)
- **Como validar:** No /q/cdb-01, pausar o video por 60s e trocar de aba: o CTA nao pode aparecer antes do currentTime atingir o revealAt. Conferir tambem que revealAt do bloco == pitch_time do player: select settings from funnels where slug='cdb-01' vs GET analytics.vturb.net/players/list (pitch_time 1060).

### 🟡 (coleta) step_events — drop-off por lamina

**Ação:** Passar a ler step_events (2.040 linhas gravadas e nunca consultadas): criar em metrics.ts um agregado count(distinct session_id) por step_index para o funil e renderizar o drop-off lamina a lamina no drill-down do funil (e na aba VSL, o corte entre a lamina anterior e a da VSL). Hoje paga-se o custo de escrita sem nenhum retorno.

- **Arquivo:** `src/lib/quiz/metrics.ts (nenhuma leitura de step_events hoje); render novo em src/components/dashboard/GlobalAnalyticsView.tsx (secao 'VSL por funil')`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** O grafico de drop-off do cdb-01 tem que bater com select step_index, count(distinct session_id) from step_events where funnel_slug='cdb-01' group by 1 order by 1; e o valor da ultima lamina tem que ser igual a 'Chegaram na lamina da VSL' exibido na tabela.

### 🟡 (coleta) venda — fechamento do funil

**Ação:** Criar o webhook de venda da Hotmart (POST /api/hotmart-webhook validando Hottok) gravando em funnel_sales com src/sck para casar com funnel_sessions/funnel_leads, e exibir as colunas Vendas e Receita na tabela 'VSL por funil'. Sem isso, nem o nosso painel nem a coluna Conv. do VTurb tem venda — o funil termina no lead.

- **Arquivo:** `novo src/app/api/hotmart-webhook/route.ts + supabase/migrations/0016_funnel_sales.sql; render em src/components/dashboard/GlobalAnalyticsView.tsx:591-601`
- **Severidade:** importante · **Esforço:** alto
- **Depende de:** Hottok da Hotmart + cadastro do webhook no painel da Hotmart
- **Como validar:** Fazer/simular 1 venda de teste: select count(*) from funnel_sales where funnel_slug='cdb-01' aumenta em 1 e o total do mes tem que bater exatamente com o relatorio de vendas da Hotmart do mesmo produto e periodo.

### 🟡 qualquer pagina do funil > injecao de pixels (cdb-01 sem Meta Pixel)

**Ação:** Portar a ferramenta 'Colar e implementar' (detectScripts + /api/resolve-meta-pixel) do SettingsPanel morto para o builder de funis, adicionar badge de alerta 'funil sem Meta Pixel' na lista de funis e no /analytics, e renderizar a DebugBar (?debug=1) tambem no caminho de funil (hoje so existe dentro do BlockRenderer/VslView legado). Cadastrar o pixel 864712... no cdb-01.

- **Arquivo:** `src/components/admin/SettingsPanel.tsx:243-247 (origem a canibalizar); src/components/vsl/PixelScripts.tsx:1-107; src/components/vsl/DebugBar.tsx:16-32`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** select slug, settings->'pixels' from funnels where slug='cdb-01' tem que retornar o pixel configurado; abrir /q/cdb-01?debug=1 e ver a DebugBar reportando fbq carregado; e o Meta Events Manager tem que registrar PageView do dominio do cdb-01 em tempo real.

### 🟡 (infra) VTURB_API_TOKEN em producao

**Ação:** Confirmar/setar VTURB_API_TOKEN nas Environment Variables do projeto na Vercel (Production e Preview) com o mesmo valor do .env.local, e redeploy. Se faltar, a aba VSL degrada silenciosamente para 'Token do VTurb nao configurado'.

- **Arquivo:** `src/lib/vturb.ts:11-15 (consumido em src/app/api/vturb/route.ts:18-20 e src/app/api/vturb/detail/route.ts:23-25)`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** acesso ao painel da Vercel
- **Como validar:** Abrir /analytics > VSL em producao logado como ADMIN_EMAIL: a tabela de players tem que carregar com dados (nao a mensagem de token); no Network, /api/vturb responde 200 com vsls.length >= 5.

### 🟢 /analytics > VSL > detalhe > botao 'Baixar metricas'

**Ação:** Depois do fix da minutagem, corrigir o nome do arquivo: trocar `-${period}d.csv` por um rotulo mapeado ('hoje' | 'ontem' | '7d' | '30d' | `${from}_a_${to}`), eliminando 'retencao-X-hojed.csv' e '-customd.csv'.

- **Arquivo:** `src/components/dashboard/VslDetail.tsx:116-126 (linha :123)`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** acao do off-by-one da minutagem
- **Como validar:** Baixar o CSV com periodo 'Hoje' e com 'Personalizado': nomes tem que sair 'retencao-<player>-hoje.csv' e 'retencao-<player>-2026-07-20_a_2026-07-27.csv'; abrir o CSV e conferir que a 1a linha bate com a tabela corrigida.

### 🟢 /analytics > VSL > secao VTurb > '+ adicionar player da conta...' e carga da aba

**Ação:** Tirar os 872 players do payload principal: criar GET /api/vturb/players (lista leve id+name+linked) chamado so quando o picker abre, remover allPlayers da resposta de /api/vturb, limitar a concorrencia do Promise.all de /sessions/stats em blocos de 5, e persistir extraPlayers em localStorage + querystring (?players=) para sobreviver a troca de aba e F5. Trocar tambem o agrupamento por regex frouxo por um agrupamento simples por primeira palavra com rotulo 'agrupamento aproximado (a API do VTurb nao expoe pastas)'.

- **Arquivo:** `src/app/api/vturb/route.ts:53-67 e :70-73; src/components/dashboard/GlobalAnalyticsView.tsx:462-509 (regex em :485)`
- **Severidade:** melhoria · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** DevTools > Network: a resposta de /api/vturb tem que cair de ~872 itens para so os players vinculados (payload < 20 KB); adicionar um player manual, dar F5 e trocar de aba — o player selecionado tem que continuar na tabela e na URL.

### 🟢 /analytics > VSL > secao VTurb > botao 'Atualizar'

**Ação:** Fazer o botao realmente invalidar a lista de players: trocar `next: { revalidate: 300 }` por `next: { tags: ['vturb-players'] }` e chamar revalidateTag('vturb-players') numa server action disparada pelo botao (ou simplesmente cache: 'no-store' na rota, que ja e admin-only e de baixo volume).

- **Arquivo:** `src/lib/vturb.ts:45 (botao em src/components/dashboard/GlobalAnalyticsView.tsx:510)`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Renomear um player no painel da VTurb e clicar em 'Atualizar' no nosso painel: o nome novo tem que aparecer em menos de 5s (hoje demora ate 5 min). Conferir no Network que a chamada a analytics.vturb.net/players/list sai a cada clique.

### 🟢 /analytics > VSL > detalhe > grafico de retencao (hover)

**Ação:** Adicionar suporte a toque no SVG: onTouchStart/onTouchMove usando e.touches[0].clientX no mesmo calculo do onMove, e onTouchEnd limpando o hover. O trafego do funil e majoritariamente mobile e hoje a leitura da curva so funciona com mouse.

- **Arquivo:** `src/components/dashboard/VslDetail.tsx:97-104 e :177`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** DevTools > device toolbar (iPhone), arrastar o dedo sobre a curva: o tooltip mm:ss + % tem que seguir o toque. Print da tela em modo mobile com o tooltip visivel.

### 🟢 /analytics > VSL > comparacao multi-VSL > tabela melhor/pior

**Ação:** Marcar o trofeu so em metricas de qualidade: adicionar `trophy: true` apenas em Play Rate, Engajamento e Ret. Pitch no array METRICS e nao pintar melhor/pior em Views, Plays e Aud. Pitch (volume nao e desempenho).

- **Arquivo:** `src/components/dashboard/VslCompare.tsx:60-68 e :129-141`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Comparar dois players com volumes muito diferentes (69f24c24a6fe5ed477b6e963 vs 6a31dfc11659071cf31eb32e): o trofeu nao pode aparecer em Views/Plays/Cliques, so nas taxas. Print da tabela.

### 🟢 /analytics > VSL > comparacao multi-VSL (performance)

**Ação:** Estabilizar a identidade de `rows`: no pai, envolver o array passado ao VslCompare em useMemo dependente de [vturb, cmpPlayers]; no filho, trocar a dependencia do useEffect de `rows` para `rows.map(r => r.playerId).join(',')`. Hoje qualquer clique no pai refaz N chamadas /api/vturb/detail do zero.

- **Arquivo:** `src/components/dashboard/GlobalAnalyticsView.tsx:553; src/components/dashboard/VslCompare.tsx:28-52`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** DevTools > Network, com 3 players marcados: abrir/fechar o drill-down de uma linha nao pode gerar novas chamadas a /api/vturb/detail?lite=1 (hoje gera 3 por clique).

### 🟢 /admin/vsls/[id] > aba Leads > export CSV (antes de deletar)

**Ação:** Canibalizar o export do LeadsToolbar antes de apagar o painel legado: comparar as 23 colunas dele (fbp, fbc, xcod, ctwa_clid...) com as colunas do /api/export-leads vivo e adicionar as que faltarem no export vivo.

- **Arquivo:** `src/components/admin/LeadsToolbar.tsx:7-30 vs src/app/api/export-leads/route.ts`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Baixar o CSV do /api/export-leads e conferir que ele contem todas as colunas listadas no LeadsToolbar que existam em funnel_leads (comparar com select column_name from information_schema.columns where table_name='funnel_leads').

### 🟢 /admin (painel legado), /[slug] VSL legada e FunnelAnalytics

**Ação:** Deletar o codigo morto depois da canibalizacao (export CSV e 'Colar e implementar' ja portados): src/app/admin/(panel)/** , src/components/admin/* (BlockEditor, SettingsPanel, VslForm, WebhooksManager, LeadsToolbar, NewVslForm, ImageField, WorkspaceTabs), src/components/vsl/VslView.tsx + o ramo getVsl de src/app/[slug]/page.tsx:30-35, trackVsl de src/lib/tracking.ts:171-198 e src/components/dashboard/FunnelAnalytics.tsx (178 linhas nunca importadas, com filtro de periodo decorativo em :107-109). Manter /admin/login e o redirect do proxy. Registrar num comentario que o vinculo player-funil canonico e o regex do embed (api/vturb/route.ts:36), nao vsls.vturb_player_id.

- **Arquivo:** `src/lib/supabase/proxy.ts:71-76 (redirect que ja torna tudo inalcancavel); src/app/admin/(panel)/**; src/components/admin/*; src/components/vsl/VslView.tsx; src/lib/tracking.ts:171-198; src/components/dashboard/FunnelAnalytics.tsx`
- **Severidade:** melhoria · **Esforço:** medio
- **Depende de:** acao de canibalizar o export CSV e a de portar o 'Colar e implementar'
- **Como validar:** npm run build verde e `grep -rn "components/admin\|VslView\|FunnelAnalytics" src/` sem nenhum resultado; /admin/login continua funcionando e /q/cdb-01 e /dashboard/cdb-01 renderizam iguais (print antes/depois).

---

## Camada de Dados e Rotas

### 🔴 Banco > coluna funnel_sessions.hydrated_at

**Ação:** GATE DE DEPLOY — rodar a migration ANTES de qualquer push. Ordem exata: (1) abrir o SQL Editor do Supabase do quizfunnel, (2) colar o conteudo inteiro de supabase/migrations/0014_hydrated_at.sql (add column + backfill via step_events + idx_fsessions_hydrated), (3) rodar `notify pgrst, 'reload schema';` para o PostgREST enxergar a coluna nova, (4) so entao `git push`. Se o push sair antes, countSessions recebe 400, o catch devolve 0 e TODO o painel (visitantes, respostas, conclusoes, funil, dashboard, analytics global) exibe funil morto sem mensagem de erro.

- **Arquivo:** `supabase/migrations/0014_hydrated_at.sql:9-21 (consumido por src/lib/quiz/metrics.ts:356,375 e src/lib/quiz/track.ts:41)`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** migration 0014
- **Como validar:** Antes do push: `select funnel_slug, count(*) total, count(hydrated_at) hidratadas from funnel_sessions group by 1 order by 2 desc;` — cdb-01 tem que sair com ~123 total / ~106 hidratadas (nao 0 hidratadas). Depois do deploy: painel do cdb-01 exibe 106 visitantes (nao 0, nao 123).

### 🔴 Tracking > track.ts > ensureSession (upsert da sessao)

**Ação:** hydrated_at tem que ser a PRIMEIRA hidratacao, nao a ultima — hoje a linha 41 reescreve o carimbo a cada F5. Tirar hydrated_at do objeto `row` do upsert (track.ts:36-42) e, logo depois do upsert, fazer uma chamada separada: `.from('funnel_sessions').update({ hydrated_at: new Date().toISOString() }).eq('session_id', sid(funnelSlug)).is('hydrated_at', null)`. Trocar tambem o `catch {}` mudo da linha 52 por `catch (e) { console.warn('[track] ensureSession', e) }` — foi esse silencio que escondeu o schema drift por 13 dias.

- **Arquivo:** `src/lib/quiz/track.ts:36-54`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** migration 0014
- **Como validar:** Em localhost: entrar no funil, dar 3 F5 com ~30s entre eles, depois `select session_id, created_at, hydrated_at, last_seen_at from funnel_sessions order by created_at desc limit 1;` — hydrated_at CONSTANTE nos 3 F5 e ~= created_at, enquanto last_seen_at avanca.

### 🔴 API > GET /api/funnel-analytics (Performance/Resultados/Respostas)

**Ação:** Parar de mascarar erro de query como zero. Em metrics.ts:370-382, capturar `{ count, error }` do PostgREST; se `error`, dar `console.error` e lancar. Adicionar `degraded?: boolean` na interface FunnelMetrics e devolver true quando qualquer count/query falhar; a rota /api/funnel-analytics passa a responder 503 com `{error}` em vez de 200 com zeros. Mesmo tratamento nos catches de metrics.ts:363 (amostra de sessoes) e :312 (realLeadCount). Na UI, banner 'erro ao carregar metricas' em vez de renderizar 0.

- **Arquivo:** `src/lib/quiz/metrics.ts:370-382, :350-365, :304-315 + src/app/api/funnel-analytics/route.ts:58-64`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Trocar temporariamente 'hydrated_at' por 'coluna_que_nao_existe' no countSessions e abrir a aba Performance: tem que aparecer banner de erro e o /api/funnel-analytics responder 503 na aba Network do DevTools — hoje responde 200 com visitantes:0.

### 🔴 Tracking > tracking.ts > submitFunnelLead

**Ação:** O lead grava session_id sem o sufixo do funil e todo JOIN lead<->sessao falha. Em src/lib/tracking.ts:144, trocar `session_id: getSessionId()` por `session_id: `${getSessionId()}::${payload.funnelSlug}`` (mesma regra do sid() em track.ts:23). Backfill do historico numa migration: `update public.funnel_leads set session_id = session_id || '::' || funnel_slug where session_id is not null and session_id not like '%::%';`. Isso destrava de uma vez: quiz_answers no webhook (funnel-lead:121), vsl_watch_pct no webhook (funnel-lead:161), respostas no CSV (export-leads:57) e o leadBy/sessBy do analytics (funnel-analytics:110-128).

- **Arquivo:** `src/lib/tracking.ts:140-145`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** `select count(*) from funnel_leads l join funnel_sessions s on s.session_id = l.session_id;` tem que ficar igual a `select count(*) from funnel_leads;` (hoje da 0). No Datacrazy, o proximo lead de teste tem que chegar com pergunta_1/resposta_1 preenchidos.

### 🔴 API > POST /api/funnel-lead (captura do quiz) + Banco > tabela funnel_leads

**Ação:** Lead duplicado infla o painel E redispara webhook Datacrazy. (1) Migration: deduplicar (`delete from funnel_leads a using funnel_leads b where a.ctid < b.ctid and a.funnel_slug=b.funnel_slug and a.session_id=b.session_id`) e criar `create unique index idx_fleads_uniq on funnel_leads (funnel_slug, session_id) where session_id is not null;`. (2) Em route.ts:67, trocar `.insert(leadRow)` por `.upsert(leadRow, { onConflict: 'funnel_slug,session_id', ignoreDuplicates: true }).select('id')` e so entrar no bloco de webhooks (linha 71) se `data?.length` — sem isso o F5 redispara o fluxo Datacrazy.

- **Arquivo:** `src/app/api/funnel-lead/route.ts:67-71 + supabase/migrations/0010_funnel_settings.sql:21-47`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** acao do session_id em submitFunnelLead (o sufixo ::slug tem que entrar antes do unique)
- **Como validar:** `select funnel_slug, session_id, count(*) from funnel_leads group by 1,2 having count(*)>1;` = 0 linhas. Em localhost, submeter o form 2x seguidas: 1 linha em funnel_leads e 1 unico disparo no log de webhooks do Datacrazy.

### 🔴 Tracking > vsl-watch.ts > attachVslWatch + Banco > colunas vsl_watch_pct / vsl_milestones / vsl_player_id + API > POST /api/vsl-progress

**Ação:** Destravar o tracking da VSL (0 em 243/243 sessoes desde 03/07). (1) Antes de mexer, confirmar no Chrome DevTools com o cdb-01 aberto: rodar no console `document.body.innerHTML.match(/players\/[\w-]+/g)` e `window.smartplayer?.instances?.length`. (2) Trocar o PLAYER_RE de vsl-watch.ts:12 pelo mesmo regex de src/app/api/vturb/route.ts:36 (aceita 24-hex OU uuid 8-4-4-4-12) — o formato UUID hoje faz extractPlayerId devolver null e o attach virar no-op silencioso na linha 32. (3) Em vsl-watch.ts:66, em vez de `instances[0]`, procurar a instancia cujo id casa com playerId. (4) Adicionar `console.warn` quando playerId for null e quando estourar as 90 tentativas.

- **Arquivo:** `src/lib/quiz/vsl-watch.ts:12, 31-32, 66-70`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** inspecao no browser (confirmar formato do embed e existencia de window.smartplayer)
- **Como validar:** Assistir 30s da VSL em localhost e rodar `select vsl_watch_pct, vsl_milestones, vsl_player_id from funnel_sessions where session_id like '%::cdb-01' order by last_seen_at desc limit 1;` — pct > 0 e milestones preenchido. Em producao, a curva agregada tem que ficar na mesma ordem de grandeza da retencao que /api/vturb/detail traz do VTurb para o mesmo player.

### 🔴 Banco > RLS funnel_sessions > policy 'fsessions anon update'

**Ação:** Fechar o buraco que permite falsificar o painel inteiro de fora. Migration 0015: `drop policy if exists "fsessions anon update" on public.funnel_sessions;` e `drop policy if exists "fsessions anon insert" on public.funnel_sessions;` (idem 'sevents anon insert' e 'qanswers anon insert'). Como as escritas do browser passam a ser barradas, mover o tracking para o servidor: criar src/app/api/track/route.ts (POST) com service_role recebendo {tipo: step|answer, session_id, funnel_slug, ...} e trocar as 3 chamadas anon de track.ts (linhas 51, 78, 86, 109) por fetch nessa rota. O /api/visit ja usa service_role e nao regride.

- **Arquivo:** `supabase/migrations/0009_quiz.sql:96-106 + src/lib/quiz/track.ts:34-115`
- **Severidade:** critico · **Esforço:** alto
- **Depende de:** nada
- **Como validar:** Com a ANON key que esta no bundle: `curl -X PATCH "$SUPABASE_URL/rest/v1/funnel_sessions?funnel_slug=eq.cdb-01" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"max_step_reached":99}'` tem que voltar 401/403 (hoje reescreve tudo). Em seguida, percorrer o funil em localhost e conferir que max_step_reached continua subindo.

### 🔴 API > GET /api/funnel-analytics + /api/export-leads + /api/reset-funnel-data + /api/funnels-export + /api/resolve-meta-pixel

**Ação:** O gate de admin so compara e-mail SE ADMIN_EMAIL existir — sem a env, qualquer autenticado le e apaga tudo. Criar src/lib/auth/admin.ts com `export async function requireAdmin(): Promise<{ok:boolean}>` que NEGA quando `!process.env.ADMIN_EMAIL` (fail-closed) e usar nas 5 rotas, substituindo o bloco `if (!user || (adminEmail && ...))`: funnel-analytics/route.ts:12-17, export-leads/route.ts:10-15, reset-funnel-data/route.ts:10-15, funnels-export/route.ts e resolve-meta-pixel/route.ts:12 (essa hoje nao tem gate NENHUM e serve de proxy anonimo para a API da UTMify). Setar ADMIN_EMAIL na Vercel em Production E Preview.

- **Arquivo:** `src/app/api/funnel-analytics/route.ts:14-17; src/app/api/export-leads/route.ts:12-15; src/app/api/reset-funnel-data/route.ts:12-15; src/app/api/resolve-meta-pixel/route.ts:12`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** `curl -X POST https://<host>/api/resolve-meta-pixel -H 'Content-Type: application/json' -d '{"utmifyPixelId":"aaaaaaaaaaaaaaaaaaaaaa"}'` sem cookie: tem que voltar 401 (hoje volta o pixel). Com ADMIN_EMAIL apagada no ambiente local, GET /api/export-leads?slug=cdb-01 logado como usuario nao-admin tem que voltar 401.

### 🔴 Banco > coluna utm_id (ID do anuncio Meta)

**Ação:** O app ja coleta utm_id (tracking.ts:37) e ja manda pro Datacrazy (funnel-lead:187) mas joga fora na gravacao porque a coluna nao existe. Migration 0015: `alter table public.funnel_sessions add column if not exists utm_id text; alter table public.funnel_leads add column if not exists utm_id text; create index if not exists idx_fsessions_utmid on funnel_sessions(utm_id) where utm_id is not null;`. Gravar em 3 pontos: /api/visit/route.ts:20-53 (tipo Body + upsert), track.ts:48 (adicionar 'utm_id' na lista de chaves copiadas) e /api/funnel-lead/route.ts:49-58 (leadRow). E a chave que cobre 99,3% do gasto no ctanalytics (contra 61% do SCK).

- **Arquivo:** `supabase/migrations/ (nova 0015) + src/app/api/visit/route.ts:40-53 + src/lib/quiz/track.ts:48 + src/app/api/funnel-lead/route.ts:49-58`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Abrir o funil com `?utm_id=120219876543210` e rodar `select utm_id from funnel_sessions order by created_at desc limit 1;` — preenchido. Depois de 3 dias: `select round(count(*) filter (where utm_id is not null)::numeric/count(*),2) from funnel_leads where created_at > now()-interval '3 days' and utm_source ilike '%f%';` > 0,90.

### 🔴 Tracking > VisitBeacon (script inline no <head>) + API > POST /api/visit

**Ação:** O beacon do 1o toque (o toque de atribuicao) manda 8 params e o app coleta 13. Acrescentar utm_id, xcod, fbclid, _fbp e _fbc no payload do VisitBeacon.tsx:13-22 (lendo cookie _fbp/_fbc igual tracking.ts:66-70) e os 5 campos correspondentes no `type Body` (visit/route.ts:20-31) e no upsert (visit/route.ts:40-53). Como o /api/visit usa ignoreDuplicates, a linha criada aqui e a definitiva para UTM — o que o beacon nao capturar, o ensureSession so preenche se ainda estiver vazio. E a causa de 109 de 375 sessoes sem UTM nenhum.

- **Arquivo:** `src/components/quiz/VisitBeacon.tsx:13-22 + src/app/api/visit/route.ts:20-53`
- **Severidade:** critico · **Esforço:** baixo
- **Depende de:** coluna utm_id (mesma migration 0015)
- **Como validar:** Abrir o funil com `?utm_id=X&xcod=Y&fbclid=Z`, fechar a aba em <1s (antes de hidratar) e rodar `select utm_id, xcod, fbclid, fbp, fbc from funnel_sessions order by created_at desc limit 1;` — tudo preenchido. Depois: `select count(*) filter (where coalesce(utm_source,src,ctwa_clid) is null)::float/count(*) from funnel_sessions where created_at > now()-interval '2 days';` tem que cair bem abaixo dos 29% de hoje (109/375).

### 🔴 Tracking > clique em CTA/checkout do funil + Tracking > link de checkout (session_id / sck)

**Ação:** Fechar o degrau entre 'conclusao' e 'venda'. (1) Criar src/lib/quiz/checkout.ts com `buildCheckoutUrl(base, funnelSlug)` copiando a logica que ja funciona em src/components/vsl/VslView.tsx:161-186: acrescenta collectTrackingParams() que faltarem + `xcod=<sid>` + `sck=<sid>` (sid = `${getSessionId()}::${funnelSlug}`). (2) Antes de abrir, gravar o clique: `trackStep(slug, stepIndex, stepId, 'cta_click', { url })`. Aplicar nos 3 pontos que hoje so disparam fbq e abrem a URL crua: steps.tsx:1209-1212 (openCheckout), layers/blocks.tsx:238 (isExternal -> ctx.navigate) e typebot/ChatRunner.tsx:145 (redirect) e :609-613 (openCheckout).

- **Arquivo:** `src/components/quiz/steps.tsx:1209-1212; src/components/quiz/layers/blocks.tsx:238; src/components/quiz/typebot/ChatRunner.tsx:145 e 609-613`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** Clicar no CTA em localhost e conferir 2 coisas: (a) `select count(*) from step_events where step_type='cta_click' and funnel_slug='cdb-01';` > 0; (b) na aba Network do DevTools, a URL aberta contem `xcod=s-...%3A%3Acdb-01`, `sck=` e os utm_*.

### 🔴 Ciclo ate a venda > webhook Hotmart + Ciclo ate a venda > tabela de venda por funil (funnel_sales)

**Ação:** Criar src/app/api/hotmart/route.ts (POST, runtime nodejs): validar o header `x-hotmart-hottok` contra process.env.HOTMART_HOTTOK (401 se nao bater), aceitar PURCHASE_APPROVED / PURCHASE_COMPLETE / PURCHASE_REFUNDED / PURCHASE_CHARGEBACK, extrair session_id do campo `sck` (ou `xcod`) do payload e gravar com `.upsert(row, { onConflict: 'transaction_id,event_type' })` — o unique ja existe em 0001_init.sql:120. Migration 0015 complementar: `alter table public.sales add column if not exists funnel_slug text, add column if not exists session_id_funnel text; alter table public.sales alter column vsl_id drop not null;` (sales hoje e chaveada por vsl_id do stack legado). Sempre gravar raw_payload.

- **Arquivo:** `src/app/api/hotmart/route.ts (a criar) + supabase/migrations/0001_init.sql:93-123`
- **Severidade:** critico · **Esforço:** alto
- **Depende de:** Hottok da Hotmart + a acao de propagacao de sck no link de checkout (sem sck a venda nao acha a sessao)
- **Como validar:** Disparar o 'testar webhook' no painel da Hotmart e conferir `select transaction_id, event_type, status, value, session_id_funnel, funnel_slug from sales order by created_at desc limit 5;`. Depois de 24h: `select count(*), sum(value) from sales where event_type='PURCHASE_APPROVED' and purchase_date::date = current_date-1;` tem que bater exatamente com o relatorio de vendas do dia na Hotmart.

### 🔴 Processo > controle de migrations

**Ação:** Causa sistemica da bomba da 0014. (1) Rodar `supabase link --project-ref <ref-do-quizfunnel>` na raiz do repo e passar a aplicar com `supabase db push` em vez de colar no SQL Editor. (2) Criar scripts/check-schema.mjs que consulta information_schema.columns pelas colunas que o codigo depende (funnel_sessions.hydrated_at, funnel_sessions.utm_id, funnel_leads.utm_id, sales.funnel_slug) e sai com codigo 1 se faltar alguma; plugar como `prebuild` no package.json para o `npm run build` falhar antes do push. (3) Remover a gambiarra de fallback de coluna inexistente em funnels-db.ts:77-81 depois que o check existir.

- **Arquivo:** `package.json (script prebuild) + scripts/check-schema.mjs (a criar) + src/lib/quiz/funnels-db.ts:77-81`
- **Severidade:** critico · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** `supabase db diff --linked` retorna vazio. Teste negativo: dropar hydrated_at num banco de staging e rodar `npm run build` — tem que falhar com 'coluna ausente: funnel_sessions.hydrated_at', nao passar verde.

### 🟡 Tracking > track.ts > trackStep (update do progresso)

**Ação:** Separar os dois updates que hoje viajam juntos: a guarda `.lt('max_step_reached', Math.max(stepIndex,1))` da linha 93 tambem bloqueia o last_seen_at quando o lead fica/volta na mesma lamina. Trocar o segundo item do Promise.allSettled por DOIS updates: (a) `.update({ last_seen_at: new Date().toISOString() }).eq('session_id', session_id)` sem guarda nenhuma; (b) `.update({ max_step_reached: stepIndex }).eq('session_id', session_id).lt('max_step_reached', stepIndex)` com a guarda de monotonicidade. Isso conserta o tempoMedioSeg de metrics.ts:395, que hoje subestima justamente quem fica parado na VSL/captura.

- **Arquivo:** `src/lib/quiz/track.ts:86-93`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Em localhost, ficar 2 min parado na lamina da VSL e rodar `select last_seen_at - created_at as tempo, max_step_reached from funnel_sessions where session_id like '%::cdb-01' order by created_at desc limit 1;` — tempo ~= 2min e max_step_reached inalterado. No painel, tempoMedioSeg do cdb-01 tem que subir em relacao ao valor de hoje.

### 🟡 Banco > tabela quiz_answers + API > GET /api/funnel-analytics (Resultados)

**Ação:** Mesma pergunta com dois numeros na mesma tela. (1) Migration: deduplicar (`delete from quiz_answers a using quiz_answers b where a.ctid<b.ctid and a.session_id=b.session_id and a.step_id=b.step_id`) e `create unique index idx_qanswers_uniq on quiz_answers (session_id, step_id);`. (2) track.ts:109-115: trocar `.insert` por `.upsert({...}, { onConflict: 'session_id,step_id' })` — ultima resposta prevalece, igual a regra que o funnel-lead:133 ja usa. Com isso o `resultados` de funnel-analytics:98-107 (que conta linhas) passa a bater com o questionStats:135-138 (que conta sessoes) sem mudar o front.

- **Arquivo:** `src/lib/quiz/track.ts:109-115 + src/app/api/funnel-analytics/route.ts:86-107`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** `select session_id, step_id, count(*) from quiz_answers group by 1,2 having count(*)>1;` = 0 linhas. Na aba Resultados do cdb-01, o `total` de cada pergunta tem que ser identico ao `total` da mesma pergunta no grafico de etapas (questionStats) — hoje divergem.

### 🟡 Tracking > track.ts > trackAnswer

**Ação:** Adicionar `await ensureSession(funnelSlug);` como primeira linha do try (track.ts:108), igual trackStep ja faz na linha 70. Hoje a resposta pode entrar antes do upsert da sessao e fica orfa (nao ha FK impedindo), sumindo de qualquer cruzamento lead<->sessao.

- **Arquivo:** `src/lib/quiz/track.ts:107-115`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** `select count(*) from quiz_answers a where a.created_at > now()-interval '1 day' and not exists (select 1 from funnel_sessions s where s.session_id = a.session_id);` = 0.

### 🟡 Banco > tabela step_events + Tracking > track.ts > trackStep (insert de evento)

**Ação:** Dar leitor para a tabela write-only (hoje 3 indices e todo o volume de escrita por nada). Criar a RPC `funnel_step_dropoff(p_slug text, p_from timestamptz, p_to timestamptz)` retornando step_index, step_id, step_type, sessoes distintas e mediana de segundos ate o proximo evento; consumir em metrics.ts:399-405 para o array `funil` deixar de ser derivado do escalar max_step_reached, e expor uma sub-aba 'Etapas' respondendo onde o lead desiste. Depois de criar a RPC, rodar `notify pgrst, 'reload schema';`.

- **Arquivo:** `src/lib/quiz/metrics.ts:399-405 + supabase/migrations/ (nova RPC) + src/lib/quiz/track.ts:78-85`
- **Severidade:** importante · **Esforço:** alto
- **Depende de:** nada
- **Como validar:** `select step_index, count(distinct session_id) from step_events where funnel_slug='cdb-01' group by 1 order by 1;` — a contagem do maior step_index tem que bater com 'Conclusoes' do painel (12 em 24/07 no cdb-01), e a contagem do step_index 0 com 'Visitantes' hidratados (106).

### 🟡 API > POST /api/visit (beacon de visitante) + Banco > tabela funnel_sessions (sem FK)

**Ação:** Impedir que slug arbitrario infle o denominador. (1) Em visit/route.ts, antes do upsert (linha 40), validar o slug contra funnels com cache em memoria de 60s: se nao existir ou nao estiver published, devolver 204 sem gravar. (2) Trocar o `status: 200` fixo (linhas 35, 37, 59) por status reais (400/500) para dar pra monitorar. (3) Migration: limpar orfaos (`delete from funnel_sessions where funnel_slug not in (select slug from funnels)`) e adicionar `alter table funnel_sessions add constraint fk_fsessions_funnel foreign key (funnel_slug) references funnels(slug) on update cascade on delete cascade;` — idem funnel_leads, quiz_answers e step_events.

- **Arquivo:** `src/app/api/visit/route.ts:33-60 + supabase/migrations/0009_quiz.sql:30-47`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** `select distinct funnel_slug from funnel_sessions where funnel_slug not in (select slug from funnels);` = 0 linhas. `curl -X POST .../api/visit -d '{"slug":"nao-existe","session_id":"x"}'` volta 204 e nao cria linha.

### 🟡 Rotas publicas > protecao (rate-limit / validacao de origem) + API > POST /api/vsl-progress

**Ação:** Criar src/middleware.ts com matcher em ['/api/visit','/api/funnel-lead','/api/vsl-progress','/api/lead','/api/resolve-meta-pixel']: (a) rejeitar 403 quando Origin/Referer nao for o host do funil nem um dominio de funnels.domain; (b) rate-limit por IP — 30 req/min em /api/visit e /api/vsl-progress, 5 req/min em /api/funnel-lead (usar @upstash/ratelimit ou LRU em memoria com TTL). No form de captura, adicionar honeypot (input escondido; se preenchido, responde 200 e descarta). Em /api/vsl-progress, exigir um token HMAC do session_id gerado no server durante o render — hoje, com um session_id conhecido, da pra forjar 100% de retencao em qualquer sessao.

- **Arquivo:** `src/middleware.ts (a criar) + src/app/api/vsl-progress/route.ts:23-86`
- **Severidade:** importante · **Esforço:** alto
- **Depende de:** nada
- **Como validar:** `for i in $(seq 1 50); do curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<host>/api/visit -H 'Content-Type: application/json' -d '{"slug":"cdb-01","session_id":"bot-'$i'"}'; done` — a partir da 31a resposta tem que sair 429. Percorrer o funil real no navegador logo depois: continua registrando visita, lead e progresso normalmente.

### 🟡 API > POST /api/upload (assets do construtor)

**Ação:** Bucket 'vsl-assets' e publico e aceita qualquer coisa. Em upload/route.ts, logo apos a checagem `file instanceof File` (linha 26): (a) allowlist de MIME — image/png, image/jpeg, image/webp, image/gif, video/mp4, audio/mpeg — devolvendo 415 no resto (bloqueia image/svg+xml, que carrega script); (b) limite por tipo via file.size antes do arrayBuffer: 10MB imagem, 50MB video/audio, 413 se estourar.

- **Arquivo:** `src/app/api/upload/route.ts:25-33`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** `curl -F file=@teste.svg .../api/upload` volta 415; PNG de 20MB volta 413; PNG de 1MB continua subindo e saindo como .webp de ~90KB (conferir a URL retornada abrindo no browser).

### 🟡 API > POST /api/reset-funnel-data (zerar funil)

**Ação:** Operacao destrutiva sem rede de seguranca. (1) Exigir `confirm` no body igual ao slug (reset-funnel-data/route.ts:16-18) e o front pedir o slug digitado. (2) Antes de deletar, fazer o snapshot de contagens das 4 tabelas e gravar em uma tabela nova `admin_audit(id, actor_email, action, target, counts jsonb, created_at default now())`. (3) Trocar o loop de 4 deletes (linhas 22-26) por uma RPC `reset_funnel(p_slug text)` que roda os 4 deletes numa unica transacao, evitando dado orfao se falhar no meio.

- **Arquivo:** `src/app/api/reset-funnel-data/route.ts:16-27`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** POST sem `confirm` volta 400. Rodar o reset num funil de teste e conferir `select actor_email, target, counts, created_at from admin_audit order by created_at desc limit 1;` com as contagens de antes; e as 4 tabelas zeradas para aquele slug numa unica transacao.

### 🟡 API > GET /api/export-leads (CSV)

**Ação:** A coluna 'Email' sai vazia em todo export porque funnel_leads nao tem essa coluna. Remover 'Email' do header (export-leads/route.ts:46) e o `(l as Record<string,unknown>).email` da linha 62 — o funil nao captura e-mail hoje. Adicionar paginacao com `.range(off, off+999)` em loop no lugar do `.limit(20000)` (linha 21) e do `.limit(100000)` (linha 31), e uma ultima linha no CSV avisando quando houve truncamento.

- **Arquivo:** `src/app/api/export-leads/route.ts:21, 31, 46, 62`
- **Severidade:** importante · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Baixar o CSV do cdb-01: sem coluna Email; numero de linhas de dados == `select count(*) from funnel_leads where funnel_slug='cdb-01';`; e as colunas de pergunta preenchidas (isso so passa depois da correcao do session_id em submitFunnelLead).

### 🟡 API > POST /api/lead (VSL legada) + Tracking > tracking.ts > submitLead / trackView / trackVsl + Banco > stack legado vsls/leads/webhooks/vsl_events + Banco > funcao vsl_funnel(uuid)

**Ação:** Decidir e congelar o stack paralelo antes que o dado divirja de novo. Passo 1: medir uso (query abaixo). Se morto: migration de drop de vsls/leads/webhooks/vsl_events + vsl_funnel(), apagar src/app/api/lead/route.ts, tracking.ts:108-130 e 157-196 e a rota /admin/vsls. Se ainda usado: marcar deprecated no topo de cada arquivo, trocar a fireWebhook copiada de lead/route.ts:30-66 por import de lib/quiz/webhooks (uma implementacao so) e congelar mudancas. Em qualquer dos casos, portar para o funil de quiz o que so o legado tem: o evento cta_click de trackVsl (tracking.ts:175-196) e o modelo completo de vsl_funnel (0008_funnel.sql:6-40, views->plays->cta->leads->compras).

- **Arquivo:** `src/app/api/lead/route.ts:30-182 + src/lib/tracking.ts:108-130,157-196 + supabase/migrations/0008_funnel.sql:6-40`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** decisao do Luca sobre o /admin/vsls (nada tecnico bloqueia)
- **Como validar:** `select count(*) from leads where created_at > now()-interval '30 days';` e `select count(*) from vsl_events where created_at > now()-interval '30 days';` — se ambos = 0, o stack esta morto e pode cair. Apos a limpeza: `npm run build` verde e nenhuma rota do /admin quebrada no DevTools.

### 🟡 Ciclo ate a venda > gasto de midia (Meta Ads spend)

**Ação:** Criar a tabela de custo: `create table public.ad_spend (date date not null, campaign_id text, adset_id text, ad_id text, utm_id text, campaign_name text, spend numeric(12,2) not null default 0, impressions bigint, clicks bigint, updated_at timestamptz default now(), primary key (date, ad_id));` + `create index idx_adspend_utmid on ad_spend(utm_id, date);`. Ingestao diaria (Vercel cron ou n8n) da UTMify/Meta Ads, mesmo padrao que o ctanalytics ja usa. Nas metricas de criativo, juntar por `utm_id` e expor CPL = spend/leads e CPA = spend/vendas, alem de filtro de periodo na aba Criativos.

- **Arquivo:** `supabase/migrations/ (nova) + src/lib/quiz/metrics.ts (agregacao por criativo)`
- **Severidade:** importante · **Esforço:** alto
- **Depende de:** gasto UTMify (credencial/API) + coluna utm_id + webhook Hotmart (para o ROAS)
- **Como validar:** `select sum(spend) from ad_spend where date = current_date-1;` tem que bater (+-1%) com o gasto do dia anterior no gerenciador da Meta. Na aba Criativos, CPL exibido == gasto do periodo / leads do periodo, conferido na mao para 1 criativo.

### 🟡 Banco > tabela funnels

**Ação:** Tres correcoes na mesma migration: (1) `create index if not exists idx_funnels_domain on public.funnels (domain) where domain is not null;` — resolveFunnelByDomain (funnels-db.ts:113-119) faz seq scan em toda request de dominio proprio; (2) `drop index if exists idx_funnels_slug;` (a constraint UNIQUE de slug ja cria o indice); (3) tirar o token da Datacrazy de dentro do jsonb `webhooks`: guardar so `{"token_ref":"DATACRAZY_TOKEN_<FUNIL>"}` e resolver o valor via process.env dentro de fireWebhook (lib/quiz/webhooks.ts), para o segredo sair da linha que o app le.

- **Arquivo:** `supabase/migrations/0009_quiz.sql:12-25 + src/lib/quiz/funnels-db.ts:113-119 + src/lib/quiz/webhooks.ts`
- **Severidade:** importante · **Esforço:** medio
- **Depende de:** nada
- **Como validar:** `explain analyze select * from funnels where domain='<dominio-real>';` mostra Index Scan (nao Seq Scan). `select count(*) from funnels where webhooks::text ~* '(token|bearer|apikey)';` = 0 apos a migracao dos segredos. Disparar um lead de teste e confirmar que o webhook continua chegando no Datacrazy.

### 🟢 Banco > indices de funnel_leads

**Ação:** Derrubar os indices que sao prefixo de compostos ja existentes: `drop index if exists public.idx_fleads_slug;` (prefixo de idx_fleads_slug_created, 0011:19) e `drop index if exists public.idx_fsessions_slug;` (prefixo de idx_fsessions_slug_created, 0011:12). Peso morto em toda escrita de lead/sessao.

- **Arquivo:** `supabase/migrations/0011_indexes.sql:12,18-19 + 0009_quiz.sql:46`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** nada
- **Como validar:** Antes de dropar: `select indexrelname, idx_scan from pg_stat_user_indexes where relname in ('funnel_leads','funnel_sessions') order by idx_scan;` — confirmar idx_scan baixo nos dois. Depois: abrir a aba Performance do cdb-01 e conferir no DevTools que o tempo do /api/funnel-analytics nao piorou.

### 🟢 Banco > tabela funnel_sessions (constraints de integridade)

**Ação:** A tabela e fonte de TODA metrica do painel e nao tem uma unica constraint alem do unique de session_id. Migration: `alter table public.funnel_sessions add constraint chk_max_step check (max_step_reached >= 0 and max_step_reached <= 200), add constraint chk_vsl_pct check (vsl_watch_pct is null or (vsl_watch_pct >= 0 and vsl_watch_pct <= 100));` e, depois de normalizar o historico (`update funnel_leads set phone = regexp_replace(phone,'\D','','g')`), `alter table public.funnel_leads add constraint chk_phone check (phone ~ '^[0-9]{10,15}$');`. Sem o CHECK de max_step, um valor 9999 injetado faz a sessao contar como conclusao em qualquer funil.

- **Arquivo:** `supabase/migrations/0009_quiz.sql:30-47 + 0010_funnel_settings.sql:21-47`
- **Severidade:** melhoria · **Esforço:** baixo
- **Depende de:** acao de derrubar as policies anon de INSERT/UPDATE (fazer as duas na mesma janela)
- **Como validar:** `insert into funnel_sessions(session_id,funnel_slug,max_step_reached) values('teste-chk','cdb-01',9999);` tem que falhar com violacao de check. `select count(*) from funnel_leads where phone !~ '^[0-9]{10,15}$';` = 0.

---

## Crítica de cobertura (o que quase ficou de fora)

I have enough to answer.

## O QUE FICOU DE FORA (superfícies/funcionalidades que nenhum dos 5 mapas cobriu)

- **`/dashboard` — a tela de entrada inteira** (`src/components/dashboard/Dashboard.tsx`, 275 linhas). Os 5 mapas só citam `/dashboard/[slug]`. Sem cobertura: modal **+ Criar funil** (com PRESETS e `comingSoon`), modal **⚙ Configurações** (tema claro/escuro/sistema — dark e system estão `disabled` "em breve"; Idioma fixo pt-BR; "Admin do CTFUNNEL" hardcoded), **⎋ Sair** (`signOut`), busca por nome/slug/nicho, paginação de 20, badge de motor (typebot/layers/steps), badge de `f.status`, e o menu ⋮ com 6 ações (Editar / Performance / Exportar leads / Visualizar / Duplicar / Excluir).
- **Card "Total de funis"** (`Dashboard.tsx:110`): mesmo defeito do `/analytics` — sub diz `${funnels.length} ativos` sendo texto fixo com rascunhos incluídos. Nenhuma ação cobre.
- **Gráficos do `/dashboard`**: "Dados diários" (7 dias fixos, sem eixo Y, valor só no `title`) e o **Donut "Sessões por funil"** (`Donut`, só top-5 na legenda, resto some). São componentes DIFERENTES dos do `/analytics` — as ações de gráfico do mapa dash-global não os alcançam.
- **Renomear o slug do funil** (`funnels-db.ts:134,168-175`). Fluxo inteiro sem mapa: valida colisão, apaga a linha antiga e migra `funnel_sessions`/`step_events`/`quiz_answers`/`funnel_leads` num `Promise.allSettled` **sem checar erro nenhum**. Se um dos 4 updates falhar, metade do histórico fica órfã em silêncio.
- **Excluir funil** (`deleteFunnelDb`, `funnels-db.ts:257`): apaga só a linha de `funnels` e deixa sessões/leads órfãos — é essa a origem dos "slugs órfãos" que o mapa dash-global quer somar. O `confirm` é só `Excluir "slug"?`, sem dizer que N leads ficam inacessíveis.
- **Aba 🔀 Fluxo do motor typebot** (`TypebotFlow.tsx`, 4ª aba em `TypebotBuilder.tsx:129`). O mapa construtor cobriu o Fluxo do layers e do typed, e do typebot só Grupos/Blocos/Telefone/VSL/Tema.
- **Paleta de blocos do typebot**: ~30 tipos (`voice`, `call`, `system`, `document`, `link`, `location`, `contact`, `input-rating`, `input-picture`, `input-cards`, `input-file`, `wait`, `set-variable`, `condition`, `redirect`, `date`, `embed`…) — o mapa trata "Blocos" como item único e só detalha 2.
- **Personalização por geo — `{estado}` / `{cidade}` / `{nome}`**: `interpEstado` (`blocks.tsx:80`), `/api/geo`, `leadGeo()`, o override do lead no `QuizRunner`, o `StepEditor:232` ("confirma o estado"), `EDITOR_VARS` no LayersBuilder. Nenhum mapa cita. Consequência não mapeada: `estado`/`cidade` vão para o webhook do Datacrazy (`funnel-lead/route.ts:170`) mas **não são gravados em `funnel_sessions` nem `funnel_leads`** → não existe nenhuma métrica por região, e não há como saber se o `{estado}` resolveu ou renderizou vazio.
- **`/[slug]` é ISR (`revalidate = 300`) e `/q/[slug]` é dinâmico com `leadGeo()` no server.** Duas rotas públicas para o mesmo funil com comportamento diferente (uma pega geo no server, a outra no client via `/api/geo`; só `/q` aceita `?preview=1`). Não coberto.
- **Fallback de seed em `resolveFunnel`** (`funnels-db.ts:100`): se o Supabase falhar OU o funil for excluído, `getSeedFunnel(slug)` serve o `clube-das-bolsas` hardcoded. O funil "excluído" continua no ar e continua gerando sessões.
- **Música de fundo e som de clique** (`funnel.music` / `funnel.clickSound`): editor só existe no `FunnelBuilder` (motor typed, linhas 225-233) e o playback só no `QuizRunner`. Funis **layers** e **typebot** salvam essas colunas no banco e nunca tocam nada — controle fantasma.
- **`fireWebhook` (`lib/quiz/webhooks.ts:8-31`) não checa `res.ok`, não loga, não tem retry e não grava lugar nenhum.** Lead entra no banco, o Datacrazy não recebe, e ninguém fica sabendo. Os mapas cobrem a UI de webhooks e o payload, nunca a observabilidade do disparo — é um buraco maior que várias ações listadas.
- **`session_id` é permanente por navegador** (`tracking.ts:78`, localStorage `vsl_session_id`, sem TTL, compartilhado com o stack legado). Com o `/api/visit` usando `ignoreDuplicates` (`visit/route.ts:55`), **quem volta depois nunca cria linha nova** → `funnel_sessions.created_at` é a data do 1º acesso do browser, para sempre. Isso invalida silenciosamente TODO filtro de período proposto nos 5 mapas: o lead que clicou no anúncio hoje e já tinha visitado semana passada é contado como visitante de semana passada, e "Visitantes" na verdade é "navegadores únicos desde sempre", não sessões.
- **Sem `not-found.tsx`, sem `error.tsx`, sem `global-error.tsx`** em nenhum nível. Qualquer erro de runtime numa página de funil com tráfego pago vira tela de erro padrão do Next.
- **Sem `robots.txt`, sem `sitemap.xml`, sem `noindex`** nas páginas de funil (o matcher do `proxy.ts:20` até exclui esses arquivos, mas eles não existem). Páginas de anúncio indexáveis.
- **`next.config.ts` não tem `headers()`** — nenhum CSP, `X-Frame-Options` ou `Referrer-Policy`, num app que injeta `<script>` arbitrário (bloco HTML/Script + `RawScripts`) e serve upload de bucket público.
- **`scripts/*.cjs`** — 10 scripts que fazem `insert/update/delete` direto em produção com service_role (`update-type01`, `vslify-funnel`, `seed-cdb-tb1`, `build-type01-copia`, `adjust-waits`, `cleanup-diag`) fora de qualquer migration ou revisão. A ação de "Processo > controle de migrations" só trata DDL, não isto.
- **`/analytics/page.tsx` não tem seletor de período nem passa nada para `globalAnalytics()`** — confirmado, mas o que ficou de fora é que **`dashboardMetrics()` também é chamado por `/dashboard/page.tsx`**: mudar a assinatura para aceitar `range` (ação do mapa dash-global) exige tocar as duas páginas.

## AÇÕES QUE SE CONTRADIZEM ENTRE SUPERFÍCIES

- **Órfãos: exibir vs apagar.** dash-global quer criar o bucket "Funis removidos" e somá-lo aos totais; dados-rotas manda rodar `delete from funnel_sessions where funnel_slug not in (select slug from funnels)` + FK. Rodar a segunda destrói o dado que a primeira quer mostrar.
- **Unique de `funnel_leads`: duas chaves diferentes.** painel-funil pede `unique (session_id) where session_id is not null` + `onConflict:'session_id'`; dados-rotas pede `unique (funnel_slug, session_id) where ...` + `onConflict:'funnel_slug,session_id'`. Aplicar as duas cria índices redundantes e um dos dois `onConflict` deixa de casar. (E `funnel_slug` é redundante: o `sid()` já é `id::slug`.)
- **Unique de `quiz_answers`: `uq_quiz_answers_sess_step ... where step_id is not null` (painel-funil) vs `idx_qanswers_uniq (session_id, step_id)` sem predicado (dados-rotas).** Nomes e definições diferentes para a mesma regra.
- **`hydrated_at` como carimbo:** dados-rotas manda gravar só na PRIMEIRA hidratação (`.is('hydrated_at', null)`); combinado com o `session_id` eterno isso congela o carimbo na 1ª visita de sempre — o oposto do que as ações de filtro de período de dash-global e painel-funil assumem.
- **Query de criativos vs Tráfego (mesma query, ações opostas).** dash-global manda adicionar `.not("hydrated_at","is",null)` ao select de `funnel_sessions` dos criativos — mas é a **mesma** `sess` de `metrics.ts:163` que alimenta os gráficos de Origens e Campanhas (`:185-199`). Aplicar muda os denominadores da aba Tráfego sem que a ação da aba Tráfego (que fala em 375 sessões) saiba.
- **`traffic.total` — premissa errada.** A ação "renderizar o `traffic.total` já calculado como 'X de Y sessões rastreadas'" não funciona: `traffic.total = src.total` (`metrics.ts:228,241`) é a soma das sessões **com** origem, ou seja o próprio X. Vai renderizar "266 de 266".
- **`middleware.ts` não existe neste Next.** dados-rotas manda "criar `src/middleware.ts`" para rate-limit; o projeto é Next 16.2.7 e o arquivo já se chama **`src/proxy.ts`** (com `config.matcher` próprio). Criar `middleware.ts` é ignorado ou colide — tem que ser feito dentro do `proxy.ts` existente, e sem quebrar o atalho de performance das linhas 22-25 (que pula `getUser()` nas rotas públicas para não pagar 200-400ms na página da lead).
- **Dois comparadores homônimos na aba VSL:** dash-global renomeia para "Comparação por funil (tracking do CTFUNNEL)" / "Comparação de players (VTurb)"; vsl-admin renomeia para "Comparar funis (nosso tracking…)" / "Comparar players (VTurb…)". Escolha uma.
- **Correção do CSV de leads:** dash-global e painel-funil mandam **remover** a coluna Email; construtor manda **criar** `funnel_leads.email` e ligá-la ponta a ponta (o runner já envia). Só uma pode valer.
- **`ADMIN_EMAIL` fail-closed:** dados-rotas manda o `requireAdmin` NEGAR quando a env não existe. Isso muda o `admin-guard.ts:17` usado por `saveFunnelAction`, `createFunnel`, `duplicateFunnel`, `deleteFunnel` — se a env não estiver setada na Vercel, o **construtor inteiro para de salvar**. E o `proxy.ts` (`lib/supabase/proxy.ts:56`) continua fail-open: os dois gates ficariam com regras opostas.

## AÇÕES QUE QUEBRAM OUTRA PARTE SE APLICADAS ISOLADAMENTE

- **🔴 `status: funnel.status ?? 'draft'` + `.eq('status','published')` no `resolveFunnel`** (ação "Publicar/Despublicar" do mapa construtor). **`Funnel` não tem campo `status`**, `FUNNEL_COLS` não seleciona `status` e `rowToFunnel` não o mapeia — então `funnel.status` é sempre `undefined` e **todo save gravaria `draft`**. Com o filtro no `resolveFunnel`, no primeiro Salvar: o funil sai do ar (404 público), **o `/builder/[slug]` para de abrir** (`builder/[slug]/page.tsx:16` usa `resolveFunnel` → `notFound()`) e **`funnelMetrics` devolve `found:false`** (`metrics.ts:323`), zerando a aba Performance. É a ação mais perigosa do conjunto.
- **🔴 FK `on delete cascade` em `funnel_sessions/leads/answers/step_events`** (dados-rotas) + o fluxo de **rename** (`funnels-db.ts:169`): o código apaga a linha antiga de `funnels` **antes** de migrar os filhos → a cascata apagaria todo o histórico do funil no ato de renomear o slug. E o botão 🗑 Excluir do `/dashboard` passaria a apagar todos os leads com um `confirm` de uma linha.
- **🔴 `upsert` de `quiz_answers` no browser** (`onConflict:'session_id,step_id'`, painel-funil e dados-rotas): `quiz_answers` só tem policy **anon INSERT** (`0009_quiz.sql:119`) — a 0013 derrubou os SELECT mas nunca criou UPDATE. `ON CONFLICT DO UPDATE` exige policy de UPDATE → erro 42501, engolido pelo `catch {}` do `track.ts:116` → **todas as respostas repetidas somem em silêncio**. Precisa da policy de UPDATE na mesma migration.
- **🟠 Índices UNIQUE parciais como alvo de `onConflict`:** `... where session_id is not null` / `where step_id is not null` não são inferíveis pelo PostgREST — o upsert falha com "no unique or exclusion constraint matching the ON CONFLICT specification". Ou o índice é total, ou o upsert vira insert+update explícitos.
- **🟠 `?preview=1` em `src/app/[slug]/page.tsx`** (construtor, "Ver ao vivo"): ler `searchParams` nessa página **mata o ISR** (`revalidate = 300`, linha 23) — é justamente a otimização de LCP que tirou o `leadGeo()` do server e criou o `/api/geo`. A página da lead volta a renderizar dinâmico em toda request.
- **🟠 Derrubar as policies anon de INSERT/UPDATE** (dados-rotas) antes de a rota `/api/track` existir e estar publicada: `track.ts` (linhas 51, 78, 86, 109) e `tracking.ts` (`vsl_events`) escrevem com a chave anon. Entre o deploy da migration e o do código, **o tracking inteiro para** — e para em silêncio, pelos mesmos `catch {}`.
- **🟠 `dashboardMetrics(range)`**: mudar a assinatura sem tocar `src/app/dashboard/page.tsx:13` quebra o build (ou pior, passa `undefined` e o `/dashboard` fica sem período enquanto o `/analytics` filtra — dois números diferentes na mesma sessão).
- **🟠 Remover o fallback `isMissingColumn` de `funnels-db.ts:77-81`** (dados-rotas): é ele que segura o app quando uma migration não rodou. Removê-lo **antes** do `scripts/check-schema.mjs` estar plugado no `prebuild` troca uma degradação silenciosa por uma queda total. Ordem: check-schema primeiro, remoção depois.
- **🟡 `.upsert(..., {ignoreDuplicates:true}).select('id')`** no `/api/funnel-lead` (dados-rotas, para não redisparar webhook): com `ignoreDuplicates` o Postgres faz `DO NOTHING` e o `.select()` volta **vazio também na primeira gravação de uma sessão já existente** — o webhook do Datacrazy deixaria de disparar para leads legítimos. Precisa de `onConflict` com `DO UPDATE` + comparação de `created_at`, não `ignoreDuplicates`.
- **🟡 Validar slug no `/api/visit` contra `funnels`** (dados-rotas): quebra o fallback de seed do `resolveFunnel` — funil servido pelo seed (ou por domínio próprio antes de existir no banco) para de registrar visitante.
