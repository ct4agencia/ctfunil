# Auditoria de Estrutura de Código — QuizFunnel

Data: 2026-08-25
Projeto: `quizfunnel-app`
Caminho local: `C:\Users\Luca Badaró\PROJETOS VS CODE\quizfunnel-app`
Branch observada: `main`
Tipo de auditoria: estrutura/arquitetura do código, sem alteração de código de aplicação.

## 1. Escopo

Esta auditoria mapeia a estrutura do projeto `quizfunnel-app`, identifica as principais camadas, rotas, APIs, módulos de domínio, pontos de acoplamento e alvos prováveis de refatoração.

Escopo incluído:

- Arquivos de configuração da raiz.
- `src/app` — App Router, páginas, APIs, Server Actions e proxy.
- `src/components` — componentes de admin, builder, dashboard, quiz, UI e VSL.
- `src/lib` — domínio, Supabase, métricas, tracking e integrações.
- `supabase/migrations` e seeds.
- `scripts`, `docs`, `specs` e `spec-compliance` em nível estrutural.
- Execução real de `npm run lint` e `npm run build`.

Escopo excluído das métricas para evitar ruído:

- `.git`
- `node_modules`
- `.next`
- `.turbo`
- `dist`
- `build`
- `coverage`
- `.cache`
- `venv`
- `.venv`
- `__pycache__`
- `backups`
- `fotos quizzes`

## 2. Arquivos lidos diretamente

- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `package.json`
- `tsconfig.json`
- `next.config.ts`
- `eslint.config.mjs`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/proxy.ts`
- `src/app/[slug]/page.tsx`
- `src/lib/supabase/server.ts`
- `src/lib/quiz/registry.ts`
- `src/lib/quiz/funnels-db.ts`
- `src/components/quiz/FunnelRenderer.tsx`
- `src/components/builder/LayersBuilder.tsx`
- `docs/PLANO-CORRECAO-CTFUNNEL.md`

## 3. Contexto do projeto

O projeto é um app Next.js 16.2.7 com React 19, TypeScript strict e Supabase.

`AGENTS.md` contém uma instrução importante:

> This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.

Implicação: antes de qualquer alteração de implementação em Next, consultar a documentação local instalada em `node_modules/next/dist/docs/`, principalmente para APIs App Router, proxy/middleware, fonts, route handlers e caching.

## 4. Configuração e scripts

`package.json`:

- `dev`: `next dev`
- `build`: `next build`
- `start`: `next start`
- `lint`: `eslint`

Dependências centrais:

- `next`: `16.2.7`
- `react`: `19.2.4`
- `react-dom`: `19.2.4`
- `@supabase/ssr`: `^0.10.3`
- `@supabase/supabase-js`: `^2.107.0`
- `motion`: `^12.40.0`
- `@dnd-kit/*`: usado pelo builder/drag-and-drop
- `sharp`: processamento/otimização de imagens
- `tailwindcss`: v4

`tsconfig.json`:

- `strict: true`
- `moduleResolution: bundler`
- `jsx: react-jsx`
- alias `@/*` para `./src/*`
- `allowJs: true`

`next.config.ts`:

- define `turbopack.root = path.resolve(__dirname)`.
- comentário indica que havia outro `package-lock.json` no diretório home, causando inferência errada da raiz pelo Turbopack.

`eslint.config.mjs`:

- usa `eslint-config-next/core-web-vitals` e `eslint-config-next/typescript`.
- ignora `.next`, `out`, `build`, `next-env.d.ts`.
- não ignora `scripts/*.cjs`, o que hoje causa grande volume de erros de lint em scripts CommonJS.

## 5. Métricas de composição

Escopo contado: arquivos de código/config/docs, com exclusões listadas no escopo.

Total:

- 242 arquivos
- 53.236 linhas

Por extensão:

| Extensão | Arquivos | Linhas |
|---|---:|---:|
| `.tsx` | 77 | 23.770 |
| `.ts` | 60 | 7.995 |
| `.md` | 33 | 3.843 |
| `.cjs` | 30 | 2.988 |
| `.sql` | 23 | 1.477 |
| `.json` | 11 | 12.477 |
| `.mjs` | 7 | 494 |
| `.css` | 1 | 192 |

Por área de topo:

| Área | Arquivos | Linhas |
|---|---:|---:|
| `src` | 136 | 31.939 |
| raiz | 11 | 7.841 |
| `specs` | 11 | 5.134 |
| `scripts` | 36 | 3.661 |
| `docs` | 4 | 3.046 |
| `supabase` | 23 | 1.477 |
| `spec-compliance` | 21 | 138 |

Observação: as linhas da raiz são infladas principalmente por `package-lock.json`.

## 6. Maiores arquivos e prováveis alvos de modularização

| Linhas | Arquivo |
|---:|---|
| 2.017 | `src/components/builder/LayersBuilder.tsx` |
| 1.704 | `src/components/quiz/steps.tsx` |
| 1.643 | `src/components/quiz/layers/blocks.tsx` |
| 1.397 | `src/components/builder/StepEditor.tsx` |
| 1.012 | `src/lib/quiz/metrics.ts` |
| 972 | `src/components/quiz/layers/LayersRunner.tsx` |
| 807 | `src/lib/quiz/types.ts` |
| 657 | `src/components/quiz/typebot/ChatRunner.tsx` |
| 650 | `src/components/admin/BlockEditor.tsx` |
| 639 | `src/components/quiz/RoletaFisicaV3.tsx` |
| 617 | `src/components/dashboard/GlobalAnalyticsView.tsx` |
| 604 | `src/components/vsl/BlockRenderer.tsx` |
| 603 | `src/components/quiz/ResinaVSL.tsx` |
| 594 | `src/components/admin/SettingsPanel.tsx` |
| 591 | `src/components/ui/funnel-chart.tsx` |

Interpretação:

- A complexidade está concentrada em client components grandes.
- `LayersBuilder.tsx`, `steps.tsx`, `blocks.tsx`, `StepEditor.tsx` e `metrics.ts` devem ser tratados como áreas de risco.
- Refatorações nesses arquivos devem ser incrementais, com auditoria e testes antes de mudança funcional.

## 7. Estrutura principal

### 7.1 `src/app`

Camada de rotas Next App Router.

Principais rotas/páginas:

- `src/app/page.tsx`
  - raiz multi-domínio.
  - em domínio da plataforma/localhost redireciona para `/dashboard`.
  - em domínio próprio na raiz retorna 404 para não disparar funil/pixel indevidamente.

- `src/app/[slug]/page.tsx`
  - entrada pública principal por slug.
  - resolve primeiro funil CTFUNNEL via `resolveFunnel`.
  - fallback para VSL antiga via tabela `vsls`.
  - usa ISR: `export const revalidate = 300`.
  - `generateStaticParams()` retorna array vazio, deixando o slug ser gerado no primeiro acesso.

- `src/app/q/[slug]/page.tsx`
  - rota pública alternativa de funil.

- `src/app/dashboard/page.tsx`
  - dashboard geral.

- `src/app/dashboard/[slug]/page.tsx`
  - painel por funil.

- `src/app/analytics/page.tsx`
  - analytics global.

- `src/app/builder/[slug]/page.tsx`
  - construtor/editor de funil.

- `src/app/admin/*`
  - painel administrativo e VSLs.

- `src/app/lab/roleta/*`
  - laboratório/experimentos da roleta.

### 7.2 APIs em `src/app/api`

Route handlers encontrados:

| Rota | Método |
|---|---|
| `src/app/api/export-leads/route.ts` | GET |
| `src/app/api/funnel-analytics/route.ts` | GET |
| `src/app/api/funnel-lead/route.ts` | POST |
| `src/app/api/funnel-leads-list/route.ts` | GET |
| `src/app/api/funnels-export/route.ts` | GET |
| `src/app/api/geo/route.ts` | GET |
| `src/app/api/lead/route.ts` | POST |
| `src/app/api/reset-funnel-data/route.ts` | POST |
| `src/app/api/resolve-meta-pixel/route.ts` | POST |
| `src/app/api/step/route.ts` | POST |
| `src/app/api/upload/route.ts` | POST |
| `src/app/api/visit/route.ts` | POST |
| `src/app/api/vsl-progress/route.ts` | POST |
| `src/app/api/vturb/detail/route.ts` | GET |
| `src/app/api/vturb/route.ts` | GET |

Padrão observado:

- Tracking e eventos de funil ficam em `/api/visit`, `/api/step`, `/api/lead`, `/api/funnel-lead`.
- Dados de analytics/leads/exportação ficam em `/api/funnel-*` e `/api/export-leads`.
- VSL/VTurb têm endpoints separados.
- Upload usa rota própria.

### 7.3 Server Actions

Arquivos e exports observados:

- `src/app/admin/actions.ts`
  - `createVsl`
  - `updateVsl`
  - `createWebhook`
  - `updateWebhook`
  - `deleteWebhook`
  - `duplicateVsl`
  - `deleteVsl`

- `src/app/auth/actions.ts`
  - `signOut`

- `src/app/builder/[slug]/actions.ts`
  - `saveFunnelAction`

- `src/app/dashboard/actions.ts`
  - `createFunnel`
  - `duplicateFunnel`
  - `deleteFunnel`

Isso sugere separação razoável de mutações por área funcional.

### 7.4 Proxy/Middleware

Arquivo:

- `src/proxy.ts`

Responsabilidade:

- Next 16: substitui o antigo `middleware.ts`.
- Chama `updateSession(request)` de `@/lib/supabase/proxy`.
- Protege rotas e atualiza sessão Supabase.

Matcher:

- roda em quase tudo, exceto arquivos estáticos, `_next/static`, `_next/image`, favicon, metadata e imagens comuns.

## 8. Camada de componentes

### 8.1 Distribuição por área

| Área | Arquivos | Linhas | Client files | Maiores arquivos |
|---|---:|---:|---:|---|
| `admin` | 8 | 2.059 | 8 | `BlockEditor.tsx`, `SettingsPanel.tsx`, `VslForm.tsx` |
| `builder` | 11 | 6.042 | 10 | `LayersBuilder.tsx`, `StepEditor.tsx`, `LayersFlow.tsx` |
| `dashboard` | 5 | 1.911 | 5 | `GlobalAnalyticsView.tsx`, `PerformanceView.tsx`, `VslDetail.tsx` |
| `quiz` | 21 | 9.366 | 19 | `steps.tsx`, `blocks.tsx`, `LayersRunner.tsx` |
| `ui` | 4 | 947 | 4 | `funnel-chart.tsx`, `ColorField.tsx`, `Pagination.tsx` |
| `vsl` | 6 | 1.719 | 5 | `BlockRenderer.tsx`, `VslView.tsx`, `PixelScripts.tsx` |

### 8.2 Client/server split

`src/app`:

- server/default: 21 arquivos / 1.068 linhas
- route/action/server: 19 arquivos / 1.650 linhas
- client: 3 arquivos / 1.073 linhas

`src/components`:

- client: 51 arquivos / 21.376 linhas
- server/default: 4 arquivos / 668 linhas

`src/lib`:

- server/default: 30 arquivos / 5.314 linhas
- client: 6 arquivos / 710 linhas

Leitura:

- O peso real está em client components.
- Isso é esperado no builder, mas deve ser monitorado nas rotas públicas do funil, onde performance mobile/LCP é crítica.

## 9. Camada de domínio em `src/lib`

### 9.1 Supabase

Arquivos:

- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/proxy.ts`

`server.ts` exporta:

- `createClient()` para Server Components, Route Handlers e Server Actions com cookies via `@supabase/ssr`.
- `createAdminClient()` com service role, sem persistência de sessão, para código exclusivamente server-side.

Risco: `createAdminClient()` deve continuar fora de Client Components.

### 9.2 Resolução/persistência de funis

Arquivo principal:

- `src/lib/quiz/funnels-db.ts`

Responsabilidades:

- Resolver funil por slug.
- Resolver funil por domínio.
- Salvar/upsert de funil.
- Criar/listar funis.
- Converter linhas Supabase para o tipo `Funnel`.
- Fallback para seed em código quando Supabase não está configurado ou falha.
- Compatibilidade com migrations ausentes por fallback de colunas.

Observação:

- O lint apontou `prefer-const` neste arquivo.
- Há catches silenciosos/fallbacks; alguns são intencionais, mas em áreas críticas isso pode mascarar problemas.

### 9.3 Registro seed

Arquivo:

- `src/lib/quiz/registry.ts`

Atualmente registra apenas:

- `clubeDasBolsas`

Comentários indicam que alguns funis `typed` foram aposentados/migrados para `layers` e não devem servir fallback divergente.

### 9.4 Métricas

Arquivo:

- `src/lib/quiz/metrics.ts`

É uma área crítica:

- 1.012 linhas.
- Agrega dados para dashboard e analytics.
- O documento `docs/PLANO-CORRECAO-CTFUNNEL.md` aponta riscos importantes nessa camada: catch silencioso, filtros inconsistentes, contagens divergentes, distinção entre sessão bruta/hidratada, filtros de período/funil e VSL/VTurb.

Recomendação: tratar `metrics.ts` como alvo de refatoração orientada por testes.

### 9.5 Tracking e integrações

Arquivos relevantes:

- `src/lib/tracking.ts`
- `src/lib/quiz/track.ts`
- `src/lib/quiz/vsl-watch.ts`
- `src/lib/vturb.ts`
- `src/lib/quiz/webhooks.ts`

Responsabilidades:

- eventos de sessão/lead/step;
- coleta de device/session/tracking params;
- integração com Meta/UTMify/Hotmart/VTurb;
- webhooks externos;
- retenção/progresso VSL.

## 10. Banco de dados e migrations

Migrations encontradas:

- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0002_domain.sql`
- `supabase/migrations/0003_settings_webhooks_leads.sql`
- `supabase/migrations/0004_checkout_url.sql`
- `supabase/migrations/0005_domain_not_unique.sql`
- `supabase/migrations/0006_lead_ctwa.sql`
- `supabase/migrations/0007_blocks.sql`
- `supabase/migrations/0008_funnel.sql`
- `supabase/migrations/0009_quiz.sql`
- `supabase/migrations/0010_funnel_settings.sql`
- `supabase/migrations/0011_indexes.sql`
- `supabase/migrations/0012_vsl_watch.sql`
- `supabase/migrations/0013_lockdown_anon_select.sql`
- `supabase/migrations/0014_hydrated_at.sql`
- `supabase/migrations/0015_lockdown_anon_write.sql`
- `supabase/migrations/0016_restaura_update_tracking.sql`
- `supabase/migrations/0017_select_minimo_tracking.sql`
- `supabase/migrations/0018_fecha_tudo_anon.sql`
- `supabase/migrations/0019_funnel_metrics_rpc.sql`
- `supabase/migrations/0020_funnel_rpc_grants.sql`
- `supabase/migrations/0021_funnel_leads_nao_herda_conclusao.sql`

Seeds:

- `supabase/seed_arte_da_resina.sql`
- `supabase/seed_cdb_estado.sql`

Leitura:

- O projeto já passou por várias fases de modelagem, tracking, RLS, lockdown de anon access e RPCs de métricas.
- Qualquer alteração em analytics/tracking precisa validar schema e policies, não apenas TypeScript.

## 11. Documentação e artefatos auxiliares

Arquivos em `docs`:

- `docs/PENDENCIAS-CDB-INSTA.md`
- `docs/PERSISTENCIA-RETORNO.md`
- `docs/PLANO-CORRECAO-CTFUNNEL.md`
- `docs/referencia/skills/meta-tracking.skill/SKILL.md`

`docs/PLANO-CORRECAO-CTFUNNEL.md` é especialmente relevante. Ele declara:

- 363 itens mapeados.
- 192 ações propostas.
- 55 críticas.
- 92 importantes.
- 45 melhorias.
- 138 sem dependência.

Essa documentação deve ser considerada antes de priorizar refatorações em dashboard, analytics, tracking e camada de dados.

## 12. Status de Git

Comando executado:

```bash
cd '/c/Users/Luca Badaró/PROJETOS VS CODE/quizfunnel-app' && git status --short && git branch --show-current
```

Resultado observado:

```text
?? spec-compliance/
main
```

Interpretação:

- Branch atual: `main`.
- Existe diretório não rastreado: `spec-compliance/`.
- Antes de commits/refactors, decidir se `spec-compliance/` deve ser versionado, removido ou ignorado.

## 13. Verificação real

### 13.1 Build

Comando:

```bash
cd '/c/Users/Luca Badaró/PROJETOS VS CODE/quizfunnel-app' && npm run build
```

Resultado:

- Passou.
- Next.js 16.2.7 com Turbopack.
- Build compilou com sucesso em 26.2s.
- TypeScript finalizou em 33.7s.
- 22 páginas estáticas geradas.
- Proxy/Middleware detectado.

Resumo das rotas emitidas pelo build:

```text
ƒ /
○ /_not-found
● /[slug]
ƒ /admin
○ /admin/login
ƒ /admin/vsls/[id]
ƒ /admin/vsls/[id]/blocks
ƒ /admin/vsls/[id]/leads
ƒ /admin/vsls/[id]/settings
ƒ /admin/vsls/new
ƒ /analytics
ƒ /api/export-leads
ƒ /api/funnel-analytics
ƒ /api/funnel-lead
ƒ /api/funnel-leads-list
ƒ /api/funnels-export
ƒ /api/geo
ƒ /api/lead
ƒ /api/reset-funnel-data
ƒ /api/resolve-meta-pixel
ƒ /api/step
ƒ /api/upload
ƒ /api/visit
ƒ /api/vsl-progress
ƒ /api/vturb
ƒ /api/vturb/detail
ƒ /builder/[slug]
ƒ /dashboard
ƒ /dashboard/[slug]
○ /lab/roleta
○ /lab/roleta-suspense
ƒ /q/[slug]
```

Legenda do Next:

- `○`: static
- `●`: SSG
- `ƒ`: dynamic/server-rendered on demand

### 13.2 Lint

Comando:

```bash
cd '/c/Users/Luca Badaró/PROJETOS VS CODE/quizfunnel-app' && npm run lint
```

Resultado:

- Falhou.
- 213 problemas.
- 172 errors.
- 41 warnings.
- 2 errors e 17 warnings potencialmente corrigíveis com `--fix`.

Categorias principais:

1. Scripts `.cjs` com regra TypeScript/ESM

Muitos scripts em `scripts/*.cjs` falham com:

```text
@typescript-eslint/no-require-imports
```

Interpretação: o ESLint do app está analisando scripts CommonJS como se fossem código ESM/TypeScript. Provável ajuste de configuração, não necessariamente bug funcional dos scripts.

2. React Hooks / React Compiler

Exemplos de problemas reais:

- `react-hooks/set-state-in-effect`
- `react-hooks/rules-of-hooks`
- `react-hooks/purity`
- `react-hooks/static-components`

Arquivos citados no lint:

- `src/app/lab/roleta/page.tsx`
- `src/components/quiz/steps.tsx`
- `src/components/ui/Pagination.tsx`
- `src/components/vsl/DebugBar.tsx`
- `src/components/vsl/VslView.tsx`
- `src/components/vsl/BlockRenderer.tsx`
- `src/lib/quiz/funnels-db.ts`

3. Warnings adicionais

- variáveis não usadas;
- eslint-disable não utilizados;
- `<img>` em vez de `next/image` em algumas áreas;
- deps faltantes em hooks.

## 14. Pontos fortes

- Build de produção passa.
- Projeto já está em Next 16 e usa `proxy.ts` conforme a nova convenção.
- Separação de áreas é clara: app/routes, components, lib/domain, supabase, scripts, docs.
- Comentários no código documentam decisões reais de performance e migração.
- `/[slug]` usa ISR e evita página pública sempre dinâmica.
- `FunnelRenderer` usa `next/dynamic` para carregar apenas o motor necessário (`layers` ou `typebot`).
- Existe fallback de Supabase para seed, reduzindo risco de quebra offline ou em ambiente incompleto.
- Migrations estão versionadas e cobrem evolução significativa de schema/RLS/tracking.
- Existe plano interno detalhado de correção (`docs/PLANO-CORRECAO-CTFUNNEL.md`).

## 15. Riscos e pontos de atenção

### 15.1 Componentes grandes demais

Arquivos como `LayersBuilder.tsx`, `steps.tsx`, `blocks.tsx` e `StepEditor.tsx` concentram muita responsabilidade.

Riscos:

- dificuldade de manutenção;
- bugs em hooks;
- alterações pequenas com efeitos colaterais grandes;
- dificuldade de testar comportamento isolado;
- maior custo cognitivo para agentes/automações.

### 15.2 Lint falhando

Apesar de o build passar, o lint falha com volume alto.

Risco:

- erros reais ficam misturados com ruído de configuração;
- React Compiler/React Hooks indicam padrões que podem afetar renderização e estabilidade;
- builds futuros podem endurecer regras e bloquear deploy.

### 15.3 Scripts CJS misturados com regras do app

O ruído em `scripts/*.cjs` deve ser separado do lint do app.

Opções:

- ignorar scripts no lint padrão do app;
- criar configuração específica para scripts CommonJS;
- migrar scripts críticos para ESM/TS gradualmente, se fizer sentido.

### 15.4 Métricas e analytics são críticos

`metrics.ts` e `docs/PLANO-CORRECAO-CTFUNNEL.md` indicam que a área de analytics tem riscos de decisão de negócio:

- zeros quando query falha;
- filtros inconsistentes;
- distinção confusa entre sessão, clique, resposta, lead e conclusão;
- métricas de VSL/VTurb possivelmente acopladas de modo frágil.

### 15.5 Muitos client components

O builder naturalmente exige client-side, mas rotas públicas de funil precisam continuar leves.

Pontos de atenção:

- bundle das rotas públicas;
- fontes e scripts de pixel;
- motores de funil carregados dinamicamente;
- componentes comuns compartilhados entre builder e runtime.

### 15.6 Diretório `spec-compliance/` não rastreado

O diretório aparece como untracked.

Antes de qualquer commit:

- decidir se deve entrar no repositório;
- ou adicionar ao `.gitignore`;
- ou remover se for artefato temporário.

## 16. Recomendações priorizadas

### Prioridade 1 — Separar sinal de ruído no lint

Objetivo: deixar o lint útil novamente.

Ações sugeridas:

1. Criar decisão explícita sobre `scripts/*.cjs`:
   - ignorar no lint padrão; ou
   - aplicar regras próprias de Node/CommonJS.
2. Rodar lint só em `src` para enxergar problemas reais do app.
3. Gerar uma lista curta de erros reais por arquivo.

Resultado esperado:

- menos ruído;
- problemas de React/TypeScript aparecem com clareza;
- base para correção incremental.

### Prioridade 2 — Corrigir erros pequenos de React/TypeScript primeiro

Começar por arquivos menores reduz risco.

Ordem sugerida:

1. `src/lib/quiz/funnels-db.ts`
   - `prefer-const`.
2. `src/components/ui/Pagination.tsx`
   - componente criado durante render.
3. `src/components/vsl/DebugBar.tsx`
   - componente criado durante render e setState em effect.
4. `src/app/lab/roleta/page.tsx`
   - setState em effect.

Depois atacar:

5. `src/components/vsl/VslView.tsx`
6. `src/components/quiz/steps.tsx`
7. `src/components/builder/LayersBuilder.tsx`

### Prioridade 3 — Modularizar arquivos grandes

#### `LayersBuilder.tsx`

Possível quebra:

- paleta/categorias/defaults para arquivo dedicado;
- hooks de estado do builder;
- painel de propriedades;
- preview/device;
- fluxo visual;
- aba performance;
- helpers puros para `src/lib`.

#### `steps.tsx`

Possível quebra:

- um componente por tipo de step;
- hooks próprios para roleta, scratch, timer, VSL;
- helpers puros em `src/lib/quiz`;
- remoção de `Math.random()` durante render/memo instável.

#### `metrics.ts`

Possível quebra:

- camada de queries Supabase;
- camada de agregadores puros;
- tipos DTO para UI;
- tratamento explícito de erro;
- helpers de porcentagem/sem base;
- testes unitários de agregação.

### Prioridade 4 — Criar testes mínimos de domínio

O projeto não possui script de teste no `package.json`.

Sugestão inicial:

- adicionar Vitest ou teste equivalente apenas para funções puras;
- começar sem browser/e2e.

Candidatos:

- `src/lib/text.ts`
- `src/lib/quiz/periodo.ts`
- `src/lib/quiz/colunas.ts`
- `src/lib/quiz/rastreio.ts`
- agregadores extraídos de `metrics.ts`
- transformação de funil/row
- regras de tracking sem Supabase real

### Prioridade 5 — Mapear fluxo crítico ponta a ponta

Fluxo crítico provável:

1. usuário acessa `/[slug]` ou `/q/[slug]`;
2. `resolveFunnel` resolve funil;
3. `FunnelRenderer` seleciona motor;
4. `VisitBeacon` registra visita;
5. `/api/visit` grava sessão;
6. usuário avança em steps/layers;
7. `/api/step` registra evento;
8. lead é capturado;
9. `/api/funnel-lead` ou `/api/lead` grava lead;
10. dashboard/analytics lê métricas.

Esse fluxo deve ganhar uma auditoria própria com:

- tabela Supabase por etapa;
- RLS/policies envolvidas;
- erros possíveis;
- onde há catch silencioso;
- diferença entre funil `layers`, `typebot` e VSL legado;
- validação via SQL/API.

## 17. Comandos executados

### Descoberta do diretório

```bash
python - <<'PY'
from pathlib import Path
root=Path(r'C:\Users\Luca Badaró\PROJETOS VS CODE')
print(root, root.exists())
for p in sorted(root.iterdir(), key=lambda x: x.name.lower()):
    print(('DIR ' if p.is_dir() else 'FILE') + p.name)
PY
```

### Listagem inicial do projeto

```bash
python - <<'PY'
from pathlib import Path
root=Path(r'C:\Users\Luca Badaró\PROJETOS VS CODE\quizfunnel-app')
print('root', root, 'exists', root.exists())
for p in sorted(root.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
    print(('DIR  ' if p.is_dir() else 'FILE ') + p.name)
PY
```

### Métricas, maiores arquivos e entrypoints

Foi executado script Python read-only com `pathlib`, exclusões de diretórios de build/dependências/cache e contagem por extensão/top-level/source.

Principais outputs preservados nesta auditoria:

- total de arquivos/linhas;
- contagem por extensão;
- contagem por área de topo;
- maiores arquivos;
- árvore resumida de `src`;
- entrypoints de App Router;
- migrations/seeds Supabase.

### Inspeção de rotas/actions/libs

Foi executado script Python read-only para listar:

- route handlers e métodos exportados;
- server actions;
- exports principais de `src/lib`.

### Lint

```bash
cd '/c/Users/Luca Badaró/PROJETOS VS CODE/quizfunnel-app' && npm run lint
```

Resultado: falhou com 213 problemas.

### Build

```bash
cd '/c/Users/Luca Badaró/PROJETOS VS CODE/quizfunnel-app' && npm run build
```

Resultado: passou.

## 18. Nota sobre alterações

Até a geração desta auditoria, nenhuma alteração de código de aplicação foi feita.

Este arquivo é um artefato de documentação/auditoria para guiar próximos passos.

## 19. Próximo passo recomendado

Antes de corrigir código, iniciar pela fase de saneamento do lint:

1. Fazer uma auditoria curta do `eslint.config.mjs`.
2. Decidir se `scripts/*.cjs` devem sair do lint padrão ou receber config própria.
3. Rodar lint focado em `src`.
4. Produzir uma lista menor de erros reais por severidade e risco.
5. Só então aplicar correções incrementais com build/lint de verificação.

Sugestão de nome para a próxima tarefa:

`Fase 1 — Saneamento do lint e separação de scripts operacionais`
