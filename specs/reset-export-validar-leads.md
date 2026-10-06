# Extrair/Limpar leads + validação de tracking real

## Status
- Criada: 2026-06-26
- Sessão: validação ponta-a-ponta com tráfego REAL + botões Extrair/Limpar leads
- Pré-condição: dados de teste já foram zerados (backup em `/backups`).

## Objetivo
Permitir testar os funis com **leads reais** e confirmar que os dados são **mapeados em todas as abas/lâminas** e **quantificados na análise** (evasão por lâmina + % de conversão), com **pixel/UTM/Hotmart/tracking** enviados. Mais: botão **"Extrair leads"** (CSV) e botão **"Limpar leads"** (com confirmação) na aba Leads de cada funil — sempre extraindo antes de limpar.

## Contexto
- Tabelas: `funnel_sessions`, `step_events`, `quiz_answers`, `funnel_leads`.
- Já existe `GET /api/export-leads?slug=` (CSV: Data, Nome, Telefone, Email, respostas do quiz, utm/src/fbclid/ctwa, Plataforma) e `GET /api/funnel-leads-list` (paginado).
- Pixel/UTMify/Hotmart saem no SSR via `PixelScripts` (config em `settings.pixels`, `utmify_pixel_id`, `hotmart_*`). `fireMetaEvent` dispara Lead/InitiateCheckout (ONDA 1).
- `step_events` é gravado mas **a análise por lâmina (evasão) ainda não é exibida** (audit M8).
- Aba Leads atual: tabela + paginação + "Exportar CSV" (global). Falta o **por funil** + **Limpar**.

## Requisitos exatos
- [ ] REQ-1: Na aba **Leads** do construtor (por funil) há botão **"Extrair leads (CSV)"** que baixa `GET /api/export-leads?slug=<funil>` — CSV com Data, Nome, Telefone, Email, respostas do quiz e tracking.
- [ ] REQ-2: Há botão **"Limpar leads / Resetar dados"** que abre um **modal de confirmação** (digitar/clicar "tenho certeza") antes de qualquer exclusão.
- [ ] REQ-3: O modal de confirmação **oferece "Extrair CSV antes"** (1 clique baixa o CSV) e só habilita o "Limpar" depois, OU deixa claro que recomenda extrair antes.
- [ ] REQ-4: `POST /api/reset-funnel-data` (admin auth) apaga, **só do funil informado**, as 4 tabelas (`funnel_sessions`, `step_events`, `quiz_answers`, `funnel_leads`) por `funnel_slug`. Nunca global por acidente.
- [ ] REQ-5: A **análise por lâmina (evasão)** existe: para o funil, mostrar, lâmina a lâmina, quantos chegaram e **% que abandonou** entre cada etapa (lendo `step_events`/`max_step_reached`). Inclui **% de conversão** total (Visitantes → Lead).
- [ ] REQ-6: **Validação de tracking real** (roteiro + diagnóstico): um painel "Diagnóstico" por funil mostrando se **Pixel FB / UTMify / Hotmart** estão configurados, e os **contadores em tempo real** (sessões, respostas, leads, conclusões, % conversão) que sobem quando um lead real passa.
- [ ] REQ-7: Um **roteiro de validação** (doc curto) pro Luca passar 1 lead real e checar: evento **PageView/Lead/InitiateCheckout** no Events Manager, UTMs/`src`/`ctwa_clid` no lead exportado, e a contagem subindo nas abas.

## Casos extremos a tratar
- EDGE-1: Limpar sem extrair → o modal avisa e oferece extrair; ação destrutiva exige confirmação explícita.
- EDGE-2: Reset de um funil **não** afeta os outros (filtro por `funnel_slug`).
- EDGE-3: Funil sem leads → botões funcionam (CSV com cabeçalho; reset no-op) sem erro.
- EDGE-4: Evasão com 0 sessões → mostra "sem dados ainda" em vez de dividir por zero.
- EDGE-5: Lâmina de hero tipado (roleta/slider) e lâminas desativadas → contam corretamente no funil de evasão (índices coerentes).

## Fora de escopo
- Disparar pixel server-side/CAPI próprio (continua via UTMify) — é a ONDA A4 futura.
- Backup automático no reset pelo app (o backup manual via script já existe; o app só recomenda extrair antes).
- Análise preditiva/segmentação de perfil (aba Diagnóstico do inlead) — fase futura.

## Definição de "concluído"
- [ ] REQ-1..REQ-7 implementados e verificáveis.
- [ ] `npm run build` verde.
- [ ] Passar **1 lead real** num funil e ver: CSV extraído com os dados + tracking; contadores subindo nas abas; evasão por lâmina coerente; % conversão correta.
- [ ] Limpar com confirmação zera só aquele funil (verificado por contagem).
- [ ] Pixel: Luca confirma PageView/Lead/InitiateCheckout no Events Manager (parte real, validada por ele).
- [ ] Validação final do Luca.

## Notas pra /review
- Conferir `POST /api/reset-funnel-data` exige auth admin + filtra por `funnel_slug` (testar que não apaga outro funil).
- Conferir o funil de evasão usa `step_events`/`max_step_reached` por lâmina e bate com `funnel_sessions`.
- Conferir o botão Extrair baixa o CSV do funil certo (`?slug=`).
- Roteiro de validação: arquivo `specs/roteiro-validacao-tracking.md` (ou seção) com o passo-a-passo do lead real.
