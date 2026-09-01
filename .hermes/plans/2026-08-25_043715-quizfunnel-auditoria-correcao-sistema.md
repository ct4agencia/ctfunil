# QuizFunnel — Auditoria e Workflow de Correção do Sistema

> **Para Hermes:** executar este plano em modo audit-first. Não alterar código sem aprovação explícita do Luca. Para implementação posterior, usar agentes/squad por fase, sempre com verificação após cada lote.

**Goal:** corrigir os problemas estruturais e funcionais mapeados no sistema QuizFunnel (`quizfunnel-app`) com segurança, começando pela separação de ruído de lint, depois React/Next, métricas/tracking e fluxo crítico.

**Architecture:** abordagem em fases: auditoria curta e objetiva → lista priorizada → aprovação → patch pequeno → verificação → próximo lote. O build já passa, mas o lint falha; portanto o primeiro objetivo é recuperar sinal confiável do lint sem quebrar o build.

**Tech Stack:** Next.js 16.2.7, React 19.2.4, TypeScript strict, ESLint 9, Supabase, App Router, `proxy.ts`, Tailwind v4, `@dnd-kit`, scripts operacionais `.cjs`.

---

## 1. Estado atual confirmado

Projeto:

`C:\Users\Luca Badaró\PROJETOS VS CODE\quizfunnel-app`

Branch:

`main`

Status Git antes deste plano:

```text
## main...origin/main
?? docs/audits/
?? spec-compliance/
```

Arquivos já criados por auditoria anterior:

`docs/audits/2026-08-25-estrutura-codigo-quizfunnel.md`

Estado de build:

```bash
npm run build
```

Resultado anterior confirmado: passou.

Estado de lint geral:

```bash
npm run lint
```

Resultado anterior confirmado:

- 213 problemas
- 172 errors
- 41 warnings

Lint focado em `src` executado nesta fase:

```bash
npx eslint src --format json
```

Resultado:

- 20 arquivos com problemas
- 78 errors
- 41 warnings

Isso confirma que parte do problema vem de `scripts/*.cjs`, mas ainda há erros reais em `src`.

---

## 2. Princípios de execução

1. Auditoria antes de correção.
2. Sem commit automático.
3. Sem push automático.
4. Sem alteração de `.env*`.
5. Não expor secrets.
6. Código só muda após aprovação explícita de um lote de correção.
7. Cada lote deve ser pequeno e verificável.
8. Depois de cada lote, rodar pelo menos:
   - lint focado no arquivo/área alterada;
   - `npm run build` se a alteração tocar rota, render, types, Supabase ou domínio.
9. Para Next 16, consultar documentação local em `node_modules/next/dist/docs/` antes de alterar comportamento de framework.
10. Se uma correção tocar métricas/tracking/Supabase, validar schema, migration e impacto de dados antes de mexer.

---

## 3. Backlog macro mapeado

### 3.1 Lint / qualidade estática

Problema confirmado:

- lint geral falha com 213 problemas;
- lint em `src` falha com 78 errors e 41 warnings;
- `scripts/*.cjs` geram ruído adicional por `@typescript-eslint/no-require-imports`.

Impacto:

- CI/deploy pode ser bloqueado se lint for gate;
- erros reais ficam misturados com ruído;
- React Compiler/React Hooks apontam padrões potencialmente frágeis.

### 3.2 React Hooks / React Compiler

Regras mais recorrentes no lint de `src`:

| Ocorrências | Regra |
|---:|---|
| 49 | `react-hooks/static-components` |
| 17 | `[fatal]` |
| 11 | `@typescript-eslint/no-unused-vars` |
| 8 | `react-hooks/set-state-in-effect` |
| 7 | `react-hooks/exhaustive-deps` |
| 6 | `react-hooks/rules-of-hooks` |
| 6 | `@next/next/no-img-element` |
| 3 | `@next/next/no-html-link-for-pages` |
| 3 | `react-hooks/refs` |
| 3 | `prefer-const` |
| 2 | `react-hooks/immutability` |
| 2 | `@typescript-eslint/no-namespace` |
| 1 | `@typescript-eslint/no-explicit-any` |
| 1 | `react-hooks/purity` |

### 3.3 Analytics / métricas / tracking

O arquivo `docs/PLANO-CORRECAO-CTFUNNEL.md` mapeia 363 itens e aponta alta concentração em:

- `src/lib/quiz/metrics.ts`
- `src/components/dashboard/GlobalAnalyticsView.tsx`
- tracking de sessão/lead/step
- VSL/VTurb
- migrations Supabase

Principais riscos mapeados:

- mostrar `0` quando query falhou;
- misturar dados de funis diferentes;
- cortes silenciosos de perguntas/respostas;
- filtros inconsistentes por data/funil;
- confusão entre sessão, clique, lead, conclusão e retenção;
- `vsl_watch_pct` possivelmente não gravando/lendo corretamente.

### 3.4 Dívida estrutural

Arquivos grandes:

- `src/components/builder/LayersBuilder.tsx` — 2.017 linhas
- `src/components/quiz/steps.tsx` — 1.704 linhas
- `src/components/quiz/layers/blocks.tsx` — 1.643 linhas
- `src/components/builder/StepEditor.tsx` — 1.397 linhas
- `src/lib/quiz/metrics.ts` — 1.012 linhas

Risco:

- baixa manutenibilidade;
- acoplamento entre editor, runtime e persistência;
- correções de lint podem virar refactor grande se não forem fatiadas.

---

## 4. Triagem atual dos erros de lint em `src`

Resultado de `npx eslint src --format json`:

### Arquivos com mais errors

| Errors | Warnings | Arquivo |
|---:|---:|---|
| 27 | 2 | `src/components/builder/TypebotBuilder.tsx` |
| 11 | 5 | `src/components/builder/LayersBuilder.tsx` |
| 8 | 6 | `src/components/quiz/layers/blocks.tsx` |
| 6 | 2 | `src/components/dashboard/GlobalAnalyticsView.tsx` |
| 4 | 3 | `src/components/quiz/layers/LayersRunner.tsx` |
| 4 | 0 | `src/components/vsl/DebugBar.tsx` |
| 3 | 5 | `src/components/vsl/VslView.tsx` |
| 3 | 0 | `src/lib/quiz/funnels-db.ts` |
| 2 | 4 | `src/components/quiz/steps.tsx` |
| 2 | 1 | `src/components/quiz/ResinaVSL.tsx` |
| 2 | 0 | `src/components/ui/Pagination.tsx` |
| 2 | 0 | `src/components/dashboard/Dashboard.tsx` |
| 1 | 1 | `src/components/vsl/BlockRenderer.tsx` |
| 1 | 1 | `src/app/lab/roleta/page.tsx` |
| 1 | 0 | `src/components/dashboard/VslDetail.tsx` |
| 1 | 0 | `src/components/builder/fields.tsx` |

### Interpretação de risco

Baixo risco / bons primeiros patches:

- `src/lib/quiz/funnels-db.ts`: `prefer-const`.
- `src/components/ui/Pagination.tsx`: componente local criado dentro do render.
- `src/components/vsl/DebugBar.tsx`: componente `Dot` local + `setState` em effect.
- `src/app/lab/roleta/page.tsx`: `setState` em effect e import não usado.

Risco médio:

- `src/components/dashboard/Dashboard.tsx`
- `src/components/dashboard/VslDetail.tsx`
- `src/components/vsl/VslView.tsx`
- `src/components/vsl/BlockRenderer.tsx`
- `src/components/quiz/ResinaVSL.tsx`

Risco alto:

- `src/components/builder/TypebotBuilder.tsx`
- `src/components/builder/LayersBuilder.tsx`
- `src/components/quiz/layers/blocks.tsx`
- `src/components/quiz/layers/LayersRunner.tsx`
- `src/components/quiz/steps.tsx`
- `src/components/builder/fields.tsx`

Motivo: esses arquivos estão no núcleo de builder/runtime e podem afetar funis publicados.

---

## 5. Workflow de correção recomendado

## Fase 0 — Congelar baseline

**Objetivo:** garantir que existe um ponto de comparação antes de qualquer patch.

**Arquivos:** nenhum código.

**Passos:**

1. Rodar status Git:

```bash
git status --short --branch
```

2. Confirmar se `docs/audits/` deve ser mantido.

3. Decidir o destino de `spec-compliance/`:

- versionar;
- ignorar;
- remover;
- manter fora do commit por enquanto.

4. Rodar baseline:

```bash
npm run build
npx eslint src --format json
```

**Critério de saída:** baseline documentado e sem dúvida sobre arquivos não rastreados.

---

## Fase 1 — Separar lint de app e scripts operacionais

**Objetivo:** reduzir ruído do lint geral sem esconder erros reais de `src`.

**Arquivos prováveis:**

- `eslint.config.mjs`
- opcional: `package.json`

**Opção A — mais conservadora:** ignorar `scripts/**/*.cjs` no lint padrão.

Mudança provável em `eslint.config.mjs`:

```js
globalIgnores([
  ".next/**",
  "out/**",
  "build/**",
  "next-env.d.ts",
  "scripts/**/*.cjs",
])
```

**Opção B — mais completa:** criar bloco de config próprio para scripts CJS permitindo `require()`.

Critério de decisão:

- Se scripts são operacionais e não entram no bundle, Opção A é suficiente.
- Se scripts são parte crítica do produto e devem ser lintados, Opção B é melhor.

**Verificação:**

```bash
npm run lint
npx eslint src --format json
npm run build
```

**Aprovação necessária antes de aplicar:** sim.

---

## Fase 2 — Corrigir lote pequeno de baixo risco

**Objetivo:** provar o ciclo de correção com arquivos pequenos antes de tocar builder/runtime pesado.

**Lote sugerido 2A:**

1. `src/lib/quiz/funnels-db.ts`
   - trocar `let` por `const` onde o lint pede, preservando fallback onde realmente há reatribuição.

2. `src/components/ui/Pagination.tsx`
   - mover componente `Arrow` para fora ou transformar em função render helper que não seja componente criado dentro do render.

3. `src/components/vsl/DebugBar.tsx`
   - mover `Dot` para fora do componente principal.
   - rever `setShow(true)` no effect conforme regra React 19/Compiler.

4. `src/app/lab/roleta/page.tsx`
   - remover import `LIMITES` não usado.
   - revisar inicialização de state a partir de `localStorage` sem `setState` síncrono direto no effect, ou justificar/desabilitar regra localmente se for lab e não produção.

**Verificação:**

```bash
npx eslint src/lib/quiz/funnels-db.ts src/components/ui/Pagination.tsx src/components/vsl/DebugBar.tsx src/app/lab/roleta/page.tsx
npx eslint src --format json
npm run build
```

**Aprovação necessária antes de aplicar:** sim.

---

## Fase 3 — Dashboard e VSL de médio risco

**Objetivo:** corrigir padrões de React em áreas visíveis, mas sem alterar regra de negócio de métricas ainda.

**Arquivos prováveis:**

- `src/components/dashboard/Dashboard.tsx`
- `src/components/dashboard/VslDetail.tsx`
- `src/components/vsl/VslView.tsx`
- `src/components/vsl/BlockRenderer.tsx`
- `src/components/quiz/ResinaVSL.tsx`

**Foco:**

- componentes locais criados dentro de render;
- `setState` síncrono em effect;
- namespace TypeScript;
- links internos com `<Link />`;
- warnings simples.

**Verificação:**

```bash
npx eslint src/components/dashboard/Dashboard.tsx src/components/dashboard/VslDetail.tsx src/components/vsl/VslView.tsx src/components/vsl/BlockRenderer.tsx src/components/quiz/ResinaVSL.tsx
npm run build
```

**Aprovação necessária antes de aplicar:** sim.

---

## Fase 4 — Builder/runtime pesado

**Objetivo:** reduzir erros em arquivos centrais sem fazer refactor amplo desnecessário.

**Arquivos prováveis:**

- `src/components/builder/TypebotBuilder.tsx`
- `src/components/builder/LayersBuilder.tsx`
- `src/components/builder/fields.tsx`
- `src/components/quiz/layers/blocks.tsx`
- `src/components/quiz/layers/LayersRunner.tsx`
- `src/components/quiz/steps.tsx`

**Estratégia:**

1. Tratar um arquivo por vez.
2. Primeiro corrigir erros mecânicos sem mudar UX.
3. Evitar refatorar layout/estado/fluxo no mesmo patch.
4. Para hooks condicionais, entender o fluxo antes de mover hook.
5. Para `Math.random()` em render, trocar para inicializador de `useState` ou `useRef` conforme intenção de estabilidade.
6. Para refs acessadas durante render, mover leitura para effect/event ou state derivado seguro.

**Verificação por arquivo:**

```bash
npx eslint <arquivo>
npm run build
```

**Verificação do lote:**

```bash
npx eslint src --format json
npm run build
```

**Aprovação necessária antes de aplicar:** sim.

---

## Fase 5 — Métricas, analytics e tracking

**Objetivo:** corrigir problemas que podem mudar números de negócio, com validação forte.

**Arquivos prováveis:**

- `src/lib/quiz/metrics.ts`
- `src/components/dashboard/GlobalAnalyticsView.tsx`
- `src/lib/quiz/track.ts`
- `src/lib/quiz/vsl-watch.ts`
- `src/lib/tracking.ts`
- `src/app/api/visit/route.ts`
- `src/app/api/step/route.ts`
- `src/app/api/lead/route.ts`
- `src/app/api/funnel-lead/route.ts`
- `supabase/migrations/*.sql`

**Antes de alterar:**

1. Ler trechos específicos de `docs/PLANO-CORRECAO-CTFUNNEL.md`.
2. Validar se as migrations citadas já estão aplicadas no Supabase real.
3. Confirmar quais slugs/funis são referência para teste.
4. Rodar queries SQL read-only para comparar números atuais, se houver credenciais/CLI.
5. Definir o comportamento esperado na UI antes de alterar fórmula.

**Itens candidatos:**

- erro do PostgREST não pode virar número zero silencioso;
- separar perguntas por `funnel_slug`;
- remover `slice(0, 10)` silencioso;
- aplicar filtro de sessão hidratada consistentemente;
- distinguir `0%` de `sem base`;
- revisar tracking de VSL com UUID/hex;
- exibir `vsl_watch_pct` real quando existir.

**Aprovação necessária antes de aplicar:** obrigatória, item por item.

---

## Fase 6 — Testes mínimos

**Objetivo:** criar rede de segurança antes de refatorar arquivos grandes.

**Arquivos prováveis:**

- `package.json`
- config de Vitest ou alternativa
- testes em `src/lib/**/*.test.ts` ou `tests/`

**Candidatos de teste:**

- `src/lib/text.ts`
- `src/lib/quiz/periodo.ts`
- `src/lib/quiz/colunas.ts`
- `src/lib/quiz/rastreio.ts`
- agregadores extraídos de `metrics.ts`
- parsing/normalização de tracking
- `extractPlayerId` de VSL

**Aprovação necessária antes de aplicar:** sim, porque adiciona dependência/configuração.

---

## 6. Proposta de Opensquad para executar este workflow

Nome do squad:

`quizfunnel-code-health-squad`

Modo inicial:

`audit-only`

Papéis:

1. `code-cartographer`
   - mantém mapa de estrutura e dependências.

2. `lint-triage-auditor`
   - transforma lint bruto em backlog executável.

3. `react-hooks-auditor`
   - analisa erros de React/Compiler antes dos patches.

4. `analytics-data-auditor`
   - audita `metrics.ts`, dashboards e divergências de contagem.

5. `supabase-tracking-auditor`
   - audita migrations, RLS, sessão, leads, steps, VSL.

6. `fix-engineer`
   - aplica patches somente após aprovação.

7. `qa-verifier`
   - roda lint/build/testes e valida saída real.

Arquivos sugeridos para o scaffold futuro:

```text
squads/quizfunnel-code-health-squad/
  squad.yaml
  squad-party.csv
  README.md
  _memory/memories.md
  _memory/runs.md
  pipeline/
    pipeline.yaml
    data/project-context.md
    data/audit-seed.md
    data/scope-and-safety.md
    steps/00-baseline.md
    steps/01-lint-triage.md
    steps/02-low-risk-fixes.md
    steps/03-dashboard-vsl-fixes.md
    steps/04-builder-runtime-fixes.md
    steps/05-analytics-tracking-audit.md
    steps/06-tests.md
  agents/
    code-cartographer.custom.md
    lint-triage-auditor.custom.md
    react-hooks-auditor.custom.md
    analytics-data-auditor.custom.md
    supabase-tracking-auditor.custom.md
    fix-engineer.custom.md
    qa-verifier.custom.md
```

Importante: não rodar `opensquad init/update` sem backup/validação, porque scaffold pode sobrescrever arquivos raiz como `package.json`, `.gitignore`, `AGENTS.md` ou `.mcp.json`.

---

## 7. Ordem recomendada de execução prática

### Próxima ação segura imediata

Criar um relatório de triagem do lint atual em:

`docs/audits/2026-08-25-lint-triage-quizfunnel.md`

Esse relatório deve conter:

- lint geral vs lint `src`;
- erros por regra;
- erros por arquivo;
- classificação baixo/médio/alto risco;
- lote 2A proposto;
- comandos de verificação;
- pedido de aprovação para aplicar o lote 2A.

### Depois da aprovação do lote 2A

Aplicar correções em:

- `src/lib/quiz/funnels-db.ts`
- `src/components/ui/Pagination.tsx`
- `src/components/vsl/DebugBar.tsx`
- `src/app/lab/roleta/page.tsx`

Verificar:

```bash
npx eslint src/lib/quiz/funnels-db.ts src/components/ui/Pagination.tsx src/components/vsl/DebugBar.tsx src/app/lab/roleta/page.tsx
npx eslint src --format json
npm run build
```

### Depois disso

Recalcular backlog e escolher o próximo lote.

---

## 8. Arquivos que provavelmente mudarão depois da aprovação

Primeiro lote provável:

- `eslint.config.mjs` ou `package.json`, se for aprovada a separação dos scripts CJS.
- `src/lib/quiz/funnels-db.ts`
- `src/components/ui/Pagination.tsx`
- `src/components/vsl/DebugBar.tsx`
- `src/app/lab/roleta/page.tsx`

Arquivos de médio/alto risco para fases posteriores:

- `src/components/dashboard/Dashboard.tsx`
- `src/components/dashboard/VslDetail.tsx`
- `src/components/vsl/VslView.tsx`
- `src/components/vsl/BlockRenderer.tsx`
- `src/components/quiz/ResinaVSL.tsx`
- `src/components/builder/TypebotBuilder.tsx`
- `src/components/builder/LayersBuilder.tsx`
- `src/components/builder/fields.tsx`
- `src/components/quiz/layers/blocks.tsx`
- `src/components/quiz/layers/LayersRunner.tsx`
- `src/components/quiz/steps.tsx`
- `src/lib/quiz/metrics.ts`

---

## 9. Critérios de sucesso

Curto prazo:

- separar ruído de `scripts/*.cjs` do lint principal;
- reduzir erros de `src` sem quebrar build;
- criar backlog real e priorizado;
- preservar comportamento público dos funis.

Médio prazo:

- `npx eslint src` com zero errors;
- `npm run build` passando;
- bugs de hooks/pureza removidos;
- métricas deixam de mascarar erro como zero.

Longo prazo:

- `npm run lint` confiável;
- testes mínimos para domínio de métricas/tracking;
- arquivos grandes modularizados gradualmente;
- squad Opensquad operando em modo audit-first/fix-after-approval.

---

## 10. Decisão pendente do Luca

Antes de aplicar qualquer patch de código, decidir:

1. Posso criar o relatório de triagem de lint em `docs/audits/2026-08-25-lint-triage-quizfunnel.md`?
2. Para `scripts/*.cjs`, prefere:
   - ignorar no lint padrão do app; ou
   - manter lint separado com config própria para CommonJS?
3. O primeiro lote de correção aprovado será o lote 2A de baixo risco?

Enquanto essas decisões não forem confirmadas, este plano fica como workflow de auditoria/correção, sem alteração de código de aplicação.
