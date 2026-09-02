# Triagem de Lint e Baseline — QuizFunnel — 2026-08-26

## Escopo

Baseline read-only executado diretamente no projeto, sem alteração de código, commit, push, `.env` ou segredos.

Projeto: `C:\Users\Luca Badaró\PROJETOS VS CODE\quizfunnel-app`

## Status Git no início

```text
## main...origin/main
?? .hermes/
?? docs/audits/
?? spec-compliance/
/c/Users/Luca Badaró/PROJETOS VS CODE/quizfunnel-app
```

Observação: já existiam arquivos não rastreados em `.hermes/`, `docs/audits/` e `spec-compliance/`. Este relatório foi salvo em `docs/audits/`.

## Baseline executado

| Comando | Resultado | Observação |
|---|---:|---|
| `git status --short --branch && pwd` | OK | Retornou imediatamente. O comando travado no Paseo tinha typo: `--shot --branche`. |
| `npm run build` | OK | Build de produção completou. |
| `npx eslint src --format json` | TRAVOU | Ficou sem saída por 10 minutos. Processo `npx eslint` precisou ser encerrado. |
| `./node_modules/.bin/eslint src --format json` | FALHOU COMO ESPERADO | Gerou JSON válido; exit code 1 por problemas de lint. |
| `npm run lint` | FALHOU COMO ESPERADO | Gerou saída textual; exit code 1 por problemas de lint. |

## Resultado do build

- `npm run build`: **passou**.
- Next.js: 16.2.7 com Turbopack.
- Compilação, TypeScript, geração estática e finalização completaram sem erro fatal.

## Lint geral

- Total: **213 problemas**
- Errors: **172**
- Warnings: **41**
- Potencialmente corrigíveis com `--fix`: **2 errors** e **17 warnings**

O lint geral está poluído por arquivos `.cjs` em `scripts/`, principalmente pela regra `@typescript-eslint/no-require-imports`. Por isso, para correção de produto, o alvo mais confiável é separar `src` de scripts operacionais.

## Lint focado em `src`

- Arquivos com problemas: **20**
- Errors: **78**
- Warnings: **41**
- Fatal errors: **0**
- Fixable: **2 errors**, **17 warnings**

### Regras mais frequentes em `src`

| Regra | Ocorrências |
|---|---:|
| `react-hooks/static-components` | 49 |
| `fatal/parser` | 17 |
| `@typescript-eslint/no-unused-vars` | 11 |
| `react-hooks/set-state-in-effect` | 8 |
| `react-hooks/exhaustive-deps` | 7 |
| `react-hooks/rules-of-hooks` | 6 |
| `@next/next/no-img-element` | 6 |
| `@next/next/no-html-link-for-pages` | 3 |
| `react-hooks/refs` | 3 |
| `prefer-const` | 3 |
| `react-hooks/immutability` | 2 |
| `@typescript-eslint/no-namespace` | 2 |
| `@typescript-eslint/no-explicit-any` | 1 |
| `react-hooks/purity` | 1 |

### Arquivos mais problemáticos em `src`

| Arquivo | Errors | Warnings | Fatal |
|---|---:|---:|---:|
| `src\components\builder\TypebotBuilder.tsx` | 27 | 2 | 0 |
| `src\components\builder\LayersBuilder.tsx` | 11 | 5 | 0 |
| `src\components\quiz\layers\blocks.tsx` | 8 | 6 | 0 |
| `src\components\dashboard\GlobalAnalyticsView.tsx` | 6 | 2 | 0 |
| `src\components\vsl\VslView.tsx` | 3 | 5 | 0 |
| `src\components\quiz\layers\LayersRunner.tsx` | 4 | 3 | 0 |
| `src\components\quiz\steps.tsx` | 2 | 4 | 0 |
| `src\app\admin\actions.ts` | 0 | 5 | 0 |
| `src\components\vsl\DebugBar.tsx` | 4 | 0 | 0 |
| `src\components\builder\TypebotFlow.tsx` | 0 | 4 | 0 |
| `src\lib\quiz\funnels-db.ts` | 3 | 0 | 0 |
| `src\components\quiz\ResinaVSL.tsx` | 2 | 1 | 0 |
| `src\components\dashboard\Dashboard.tsx` | 2 | 0 | 0 |
| `src\components\ui\Pagination.tsx` | 2 | 0 | 0 |
| `src\app\lab\roleta\page.tsx` | 1 | 1 | 0 |
| `src\components\vsl\BlockRenderer.tsx` | 1 | 1 | 0 |
| `src\components\builder\fields.tsx` | 1 | 0 | 0 |
| `src\components\dashboard\VslDetail.tsx` | 1 | 0 | 0 |
| `src\components\quiz\VisitBeacon.tsx` | 0 | 1 | 0 |
| `src\components\quiz\typebot\ChatRunner.tsx` | 0 | 1 | 0 |

## Lote 2A proposto — baixo risco

Este lote deve ser aplicado somente após aprovação explícita do Luca.

### `src\app\lab\roleta\page.tsx`

- Errors: **1**
- Warnings: **1**

- Linha 7:31 — `@typescript-eslint/no-unused-vars` — warning: 'LIMITES' is defined but never used.
- Linha 180:7 — `react-hooks/set-state-in-effect` — error: Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

C:\Users\Luca Badaró\PROJETOS VS CODE\quizfunnel-app\src\app\lab\roleta\page.tsx:180:7
  178 |         migrado[k] = Math.max(-ESCALA, Math.min(ESCALA, Math.abs(n) > ESCALA ? Math.round(n / 10) : n));
  179 |       }
> 180 |       setIntensidades(migrado);
      |       ^^^^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  181 |     } catch { /* localStorage é editável pelo usuário: JSON quebrado não derruba a página */ }
  182 |   }, []);
  183 |

### `src\components\ui\Pagination.tsx`

- Errors: **2**
- Warnings: **0**

- Linha 35:8 — `react-hooks/static-components` — error: Error: Cannot create components during render

Components created during render will reset their state each time they are created. Declare components outside of render.

C:\Users\Luca Badaró\PROJETOS VS CODE\quizfunnel-app\src\components\ui\Pagination.tsx:35:8
  33 |   return (
  34 |     <nav className="flex items-center justify-center gap-1.5">
> 35 |       <Arrow dir={-1} disabled={current <= 1} />
     |        ^^^^^ This component is created during render
  36 |       {pageWindow(current, total).map((p, i) =>
  37 |         p === "…" ? (
  38 |           <span key={`e${i}`} className="grid h-9 w-9 place-items-center text-neutral-400">…</span>

C:\Users\Luca Badaró\PROJETOS VS CODE\quizfunnel-app\src\components\ui\Pagination.tsx:26:17
  24 |   if (total <= 1) return null;
  25 |   const go = (p: number) => onChange(Math.max(1, Math.min(total, p)));
> 26 |   const Arrow = ({ dir, disabled }: { dir: -1 | 1; disabled: boolean }) => (
     |                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 27 |     <button onClick={() => go(current + dir)} disabled={disabled}
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 28 |       className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition hover:border-neutral-400 disabled:opacity-30"
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 29 |       aria-label={dir < 0 ? "Anterior" : "Próxima"}>
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 30 |       {dir < 0 ? "‹" : "›"}
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 31 |     </button>
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 32 |   );
     | ^^^^ The component is created during render here
  33 |   return (
  34 |     <nav className="flex items-center justify-center gap-1.5">
  35 |       <Arrow dir={-1} disabled={current <= 1} />
- Linha 51:8 — `react-hooks/static-components` — error: Error: Cannot create components during render

Components created during render will reset their state each time they are created. Declare components outside of render.

C:\Users\Luca Badaró\PROJETOS VS CODE\quizfunnel-app\src\components\ui\Pagination.tsx:51:8
  49 |         ),
  50 |       )}
> 51 |       <Arrow dir={1} disabled={current >= total} />
     |        ^^^^^ This component is created during render
  52 |     </nav>
  53 |   );
  54 | }

C:\Users\Luca Badaró\PROJETOS VS CODE\quizfunnel-app\src\components\ui\Pagination.tsx:26:17
  24 |   if (total <= 1) return null;
  25 |   const go = (p: number) => onChange(Math.max(1, Math.min(total, p)));
> 26 |   const Arrow = ({ dir, disabled }: { dir: -1 | 1; disabled: boolean }) => (
     |                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 27 |     <button onClick={() => go(current + dir)} disabled={disabled}
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 28 |       className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition hover:border-neutral-400 disabled:opacity-30"
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 29 |       aria-label={dir < 0 ? "Anterior" : "Próxima"}>
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 30 |       {dir < 0 ? "‹" : "›"}
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 31 |     </button>
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 32 |   );
     | ^^^^ The component is created during render here
  33 |   return (
  34 |     <nav className="flex items-center justify-center gap-1.5">
  35 |       <Arrow dir={-1} disabled={current <= 1} />

### `src\components\vsl\DebugBar.tsx`

- Errors: **4**
- Warnings: **0**

- Linha 23:5 — `react-hooks/set-state-in-effect` — error: Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

C:\Users\Luca Badaró\PROJETOS VS CODE\quizfunnel-app\src\components\vsl\DebugBar.tsx:23:5
  21 |       return;
  22 |     }
> 23 |     setShow(true);
     |     ^^^^^^^ Avoid calling setState() directly within an effect
  24 |     const check = () =>
  25 |       setSt({
  26 |         fbq: typeof window.fbq === "function",
- Linha 83:12 — `react-hooks/static-components` — error: Error: Cannot create components during render

Components created during render will reset their state each time they are created. Declare components outside of render.

C:\Users\Luca Badaró\PROJETOS VS CODE\quizfunnel-app\src\components\vsl\DebugBar.tsx:83:12
  81 |       <div style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 8 }}>
  82 |         <div>
> 83 |           <Dot ok={st.fbq} /> Pixel Meta (fbq):{" "}
     |            ^^^ This component is created during render
  84 |           <strong>{st.fbq ? "detectado" : "NÃO detectado"}</strong>
  85 |         </div>
  86 |         <div>

C:\Users\Luca Badaró\PROJETOS VS CODE\quizfunnel-app\src\components\vsl\DebugBar.tsx:45:15
  43 |   }
  44 |
> 45 |   const Dot = ({ ok }: { ok: boolean }) => (
     |               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 46 |     <span style={{ color: ok ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 47 |       {ok ? "●" : "●"}
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 48 |     </span>
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 49 |   );
     | ^^^^ The component is created during render here
  50 |   const btn: React.CSSProperties = {
  51 |     padding: "6px 10px",
  52 |     borderRadius: 8,
- Linha 87:12 — `react-hooks/static-components` — error: Error: Cannot create components during render

Components created during render will reset their state each time they are created. Declare components outside of render.

C:\Users\Luca Badaró\PROJETOS VS CODE\quizfunnel-app\src\components\vsl\DebugBar.tsx:87:12
  85 |         </div>
  86 |         <div>
> 87 |           <Dot ok={st.utmify} /> UTMify (pixelId):{" "}
     |            ^^^ This component is created during render
  88 |           <strong>{st.utmify ? "ativo" : "ausente"}</strong>
  89 |         </div>
  90 |         <div>

C:\Users\Luca Badaró\PROJETOS VS CODE\quizfunnel-app\src\components\vsl\DebugBar.tsx:45:15
  43 |   }
  44 |
> 45 |   const Dot = ({ ok }: { ok: boolean }) => (
     |               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 46 |     <span style={{ color: ok ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 47 |       {ok ? "●" : "●"}
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 48 |     </span>
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 49 |   );
     | ^^^^ The component is created during render here
  50 |   const btn: React.CSSProperties = {
  51 |     padding: "6px 10px",
  52 |     borderRadius: 8,
- Linha 91:12 — `react-hooks/static-components` — error: Error: Cannot create components during render

Components created during render will reset their state each time they are created. Declare components outside of render.

C:\Users\Luca Badaró\PROJETOS VS CODE\quizfunnel-app\src\components\vsl\DebugBar.tsx:91:12
  89 |         </div>
  90 |         <div>
> 91 |           <Dot ok={st.google} /> Pixel Google:{" "}
     |            ^^^ This component is created during render
  92 |           <strong>{st.google ? "ativo" : "ausente"}</strong>
  93 |         </div>
  94 |       </div>

C:\Users\Luca Badaró\PROJETOS VS CODE\quizfunnel-app\src\components\vsl\DebugBar.tsx:45:15
  43 |   }
  44 |
> 45 |   const Dot = ({ ok }: { ok: boolean }) => (
     |               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 46 |     <span style={{ color: ok ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 47 |       {ok ? "●" : "●"}
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 48 |     </span>
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 49 |   );
     | ^^^^ The component is created during render here
  50 |   const btn: React.CSSProperties = {
  51 |     padding: "6px 10px",
  52 |     borderRadius: 8,

### `src\lib\quiz\funnels-db.ts`

- Errors: **3**
- Warnings: **0**

- Linha 90:19 — `prefer-const` — error: 'error' is never reassigned. Use 'const' instead.
- Linha 113:11 — `prefer-const` — error: 'data' is never reassigned. Use 'const' instead.
- Linha 113:17 — `prefer-const` — error: 'error' is never reassigned. Use 'const' instead.

## Plano de execução sugerido para o Lote 2A

1. Aplicar somente correções mecânicas e locais: `prefer-const`, componente/helper definido fora do render, import não usado e inicialização localStorage sem padrão frágil.
2. Não alterar comportamento de negócio, tracking, Supabase, rotas, `.env` ou modelos de dados.
3. Validar após patch com:

```bash
./node_modules/.bin/eslint src/lib/quiz/funnels-db.ts src/components/ui/Pagination.tsx src/components/vsl/DebugBar.tsx src/app/lab/roleta/page.tsx
./node_modules/.bin/eslint src --format json > .hermes/tmp/eslint-src-after-lote-2a.json
npm run build
```

## Próximo checkpoint

Luca, posso aplicar o lote 2A?

## Artefatos gerados

- `.hermes/tmp/git-status-quizfunnel-2026-08-26.txt`
- `.hermes/tmp/npm-build-quizfunnel-2026-08-26.log`
- `.hermes/tmp/eslint-src-quizfunnel-2026-08-26.jsonlog`
- `.hermes/tmp/npm-lint-quizfunnel-2026-08-26.log`
- `.hermes/tmp/baseline-summary-quizfunnel-2026-08-26.json`

---

## Atualização — Lote 2A aplicado — 2026-08-26 10:38 -0300

### Escopo alterado

Correções mínimas e locais aplicadas somente nos quatro arquivos aprovados para o Lote 2A:

- `src/lib/quiz/funnels-db.ts`
- `src/components/ui/Pagination.tsx`
- `src/components/vsl/DebugBar.tsx`
- `src/app/lab/roleta/page.tsx`

Não houve commit, push, alteração de `.env*`, leitura/impressão de segredos ou mudança fora do escopo do lote.

### Antes do Lote 2A

No baseline registrado anteriormente, esses quatro arquivos somavam:

| Arquivo | Errors | Warnings | Regras principais |
|---|---:|---:|---|
| `src/lib/quiz/funnels-db.ts` | 3 | 0 | `prefer-const` |
| `src/components/ui/Pagination.tsx` | 2 | 0 | `react-hooks/static-components` |
| `src/components/vsl/DebugBar.tsx` | 4 | 0 | `react-hooks/set-state-in-effect`, `react-hooks/static-components` |
| `src/app/lab/roleta/page.tsx` | 1 | 1 | `react-hooks/set-state-in-effect`, `@typescript-eslint/no-unused-vars` |

Total do lote antes: **10 errors** e **1 warning**.

### Correções aplicadas

- `src/lib/quiz/funnels-db.ts`: removidas reatribuições desnecessárias para cumprir `prefer-const`, preservando o fallback de colunas base quando a migração 0010 ainda não rodou.
- `src/components/ui/Pagination.tsx`: componente `Arrow` movido para fora do render e parametrizado via `onClick`, mantendo classes, labels e comportamento.
- `src/components/vsl/DebugBar.tsx`: componente `Dot` movido para fora do render; a exibição por `?debug=1` passou a ser derivada sem `setShow(true)` síncrono em effect; checagem periódica dos pixels mantida.
- `src/app/lab/roleta/page.tsx`: removido import não usado `LIMITES`; leitura/migração de `localStorage` movida para inicializador lazy de `useState`, com guard para SSR e JSON quebrado.

### Validação real após Lote 2A

#### ESLint focado no Lote 2A

Comando usado para evitar o travamento do `npx` e o problema de stdin sem TTY:

```bash
node ./node_modules/eslint/bin/eslint.js src/lib/quiz/funnels-db.ts src/components/ui/Pagination.tsx src/components/vsl/DebugBar.tsx src/app/lab/roleta/page.tsx --format json
```

Resultado: **OK**, exit code `0`.

Após o patch, os quatro arquivos do Lote 2A ficaram com:

- **0 errors**
- **0 warnings**

#### ESLint focado em `src`

Comando executado:

```bash
node ./node_modules/eslint/bin/eslint.js src --format json > .hermes/tmp/eslint-src-after-lote-2a.json
```

Resultado: falhou como esperado por erros remanescentes fora do Lote 2A, exit code `1`.

Comparativo `src`:

| Métrica | Antes | Depois Lote 2A | Diferença |
|---|---:|---:|---:|
| Arquivos com problemas | 20 | 16 | -4 |
| Errors | 78 | 68 | -10 |
| Warnings | 41 | 40 | -1 |
| Fatal | 0 | 0 | 0 |

Principais regras remanescentes em `src` após Lote 2A:

| Regra | Ocorrências |
|---|---:|
| `react-hooks/static-components` | 44 |
| `fatal/parser`/mensagens sem `ruleId` no JSON | 17 |
| `@typescript-eslint/no-unused-vars` | 10 |
| `react-hooks/exhaustive-deps` | 7 |
| `react-hooks/set-state-in-effect` | 6 |
| `react-hooks/rules-of-hooks` | 6 |
| `@next/next/no-img-element` | 6 |
| `@next/next/no-html-link-for-pages` | 3 |

Principais arquivos remanescentes em `src`:

| Arquivo | Errors | Warnings |
|---|---:|---:|
| `src/components/builder/TypebotBuilder.tsx` | 27 | 2 |
| `src/components/builder/LayersBuilder.tsx` | 11 | 5 |
| `src/components/quiz/layers/blocks.tsx` | 8 | 6 |
| `src/components/dashboard/GlobalAnalyticsView.tsx` | 6 | 2 |
| `src/components/quiz/layers/LayersRunner.tsx` | 4 | 3 |
| `src/components/vsl/VslView.tsx` | 3 | 5 |
| `src/components/quiz/steps.tsx` | 2 | 4 |
| `src/components/quiz/ResinaVSL.tsx` | 2 | 1 |

#### Lint geral

Comando direto executado:

```bash
node ./node_modules/eslint/bin/eslint.js --format json > .hermes/tmp/eslint-all-after-lote-2a.json
```

Resultado: falhou como esperado por backlog remanescente, exit code `1`.

Comparativo lint geral:

| Métrica | Antes | Depois Lote 2A | Diferença |
|---|---:|---:|---:|
| Arquivos com problemas | n/d | 46 | n/d |
| Errors | 172 | 162 | -10 |
| Warnings | 41 | 40 | -1 |
| Fatal | 0 | 0 | 0 |

O lint geral continua poluído por `scripts/*.cjs`, principalmente `@typescript-eslint/no-require-imports` (**94 ocorrências** após o Lote 2A), além dos erros reais ainda existentes em `src`.

#### Build

`npm run build` ainda falhou no shell atual por problema de ambiente/shim:

```text
'"node"' não é reconhecido como um comando interno
ou externo, um programa operável ou um arquivo em lotes.
```

Validação alternativa real executada com o binário do Next via Node:

```bash
node ./node_modules/next/dist/bin/next build
```

Resultado: **OK**, exit code `0`.

Resumo do build:

- Next.js 16.2.7 com Turbopack.
- Compilação concluída com sucesso.
- TypeScript concluído.
- Geração estática concluída: 22/22 páginas.
- Rotas principais renderizadas/geradas sem erro fatal.

### Artefatos após Lote 2A

- `.hermes/tmp/eslint-src-after-lote-2a.json`
- `.hermes/tmp/eslint-all-after-lote-2a.json`

### Proposta de Lote 2B

Como o Lote 2A zerou seus quatro arquivos e a validação agora bloqueia apenas por erros fora do escopo, o próximo lote deve atacar baixo/médio risco antes dos arquivos maiores do builder/runtime.

Sugestão de Lote 2B:

1. `src/components/dashboard/Dashboard.tsx` — 2 errors, foco em correções locais.
2. `src/components/dashboard/VslDetail.tsx` — 1 error, baixo volume.
3. `src/components/vsl/BlockRenderer.tsx` — 1 error e 1 warning, escopo VSL isolado.
4. `src/components/quiz/ResinaVSL.tsx` — 2 errors e 1 warning, validar com cuidado por tocar experiência VSL.

Manter `TypebotBuilder.tsx`, `LayersBuilder.tsx`, `blocks.tsx`, `LayersRunner.tsx` e `steps.tsx` para lotes posteriores, pois concentram mais risco e acoplamento de builder/runtime.

### Verificação complementar — npm scripts — 2026-08-26 10:42 -0300

Após o aviso de verificação pendente, os scripts `npm run` foram reexecutados com o shell correto para evitar o shim quebrado dos `.cmd` em Git Bash:

```bash
PATH="/c/Program Files/nodejs:$PATH" npm_config_script_shell='C:\Program Files\Git\bin\bash.exe' npm run build
```

Resultado: **OK**, exit code `0`.

Resumo real:

- Next.js 16.2.7 com Turbopack.
- Compilação concluída com sucesso em 17.9s.
- TypeScript concluído.
- Geração estática concluída: 22/22 páginas.
- Rotas finalizadas sem erro fatal.

Também foi reexecutado:

```bash
PATH="/c/Program Files/nodejs:$PATH" npm_config_script_shell='C:\Program Files\Git\bin\bash.exe' npm run lint
```

Resultado: falhou como esperado por backlog fora do Lote 2A, exit code `1`.

Resumo real do lint geral após Lote 2A:

- **202 problemas**
- **162 errors**
- **40 warnings**
- **0 errors e 17 warnings** potencialmente corrigíveis com `--fix`

Os quatro arquivos do Lote 2A permanecem verificados separadamente com **0 errors / 0 warnings**. O bloqueio atual do lint geral está nos lotes seguintes e em `scripts/*.cjs`, especialmente `@typescript-eslint/no-require-imports`.

---

## Atualização — Lote 2B aplicado — 2026-09-01

### Escopo alterado

Correções mínimas aplicadas nos quatro arquivos do Lote 2B:

- `src/components/dashboard/Dashboard.tsx`
- `src/components/dashboard/VslDetail.tsx`
- `src/components/vsl/BlockRenderer.tsx`
- `src/components/quiz/ResinaVSL.tsx`

Não houve alteração de `.env*`, impressão de segredos, migration, schema change, deploy manual ou mudança fora do escopo do lote.

### Antes do Lote 2B

Lint focado no Lote 2B sobre o `main` publicado em `8d08f72`:

- **6 errors**
- **2 warnings**
- **0 fatal**

Distribuição:

| Arquivo | Errors | Warnings |
|---|---:|---:|
| `src/components/dashboard/Dashboard.tsx` | 2 | 0 |
| `src/components/dashboard/VslDetail.tsx` | 1 | 0 |
| `src/components/vsl/BlockRenderer.tsx` | 1 | 1 |
| `src/components/quiz/ResinaVSL.tsx` | 2 | 1 |

### Correções aplicadas

- `Dashboard.tsx`: cálculo dos segmentos do donut deixou de mutar `off` durante render; tema inicial passou a vir de inicializador lazy de `useState`, sem `setState` síncrono em effect.
- `VslDetail.tsx`: carregamento automático passou a usar effect assíncrono com cancelamento; o botão de retry preserva `setState("loading")` por ser ação explícita do usuário.
- `BlockRenderer.tsx`: removida augmentation com `namespace JSX`; tipagem do custom element ficou em `HTMLElementTagNameMap`; removido `eslint-disable` não usado no `checkoutHref`.
- `ResinaVSL.tsx`: removido import não usado de `useState`; links legais internos passaram de `<a>` para `next/link`.

### Validação real após Lote 2B

#### ESLint focado no Lote 2B

Comando executado:

```bash
node ./node_modules/eslint/bin/eslint.js src/components/dashboard/Dashboard.tsx src/components/dashboard/VslDetail.tsx src/components/vsl/BlockRenderer.tsx src/components/quiz/ResinaVSL.tsx --format json
```

Resultado: **OK**, exit code `0`.

Após o patch, os quatro arquivos do Lote 2B ficaram com:

- **0 errors**
- **0 warnings**
- **0 fatal**

#### ESLint focado em `src`

Comando executado:

```bash
node ./node_modules/eslint/bin/eslint.js src --format json > %LOCALAPPDATA%/Temp/quizfunnel-eslint-src-after-2b.json
```

Resultado: falhou como esperado por backlog remanescente fora do Lote 2B.

Comparativo `src`:

| Métrica | Depois Lote 2A | Depois Lote 2B | Diferença |
|---|---:|---:|---:|
| Arquivos com problemas | 16 | 12 | -4 |
| Errors | 68 | 62 | -6 |
| Warnings | 40 | 38 | -2 |
| Fatal | 0 | 0 | 0 |

Principais arquivos remanescentes em `src`:

| Arquivo | Errors | Warnings |
|---|---:|---:|
| `src/components/builder/TypebotBuilder.tsx` | 27 | 2 |
| `src/components/builder/LayersBuilder.tsx` | 11 | 5 |
| `src/components/quiz/layers/blocks.tsx` | 8 | 6 |
| `src/components/dashboard/GlobalAnalyticsView.tsx` | 6 | 2 |
| `src/components/vsl/VslView.tsx` | 3 | 5 |
| `src/components/quiz/layers/LayersRunner.tsx` | 4 | 3 |
| `src/components/quiz/steps.tsx` | 2 | 4 |
| `src/app/admin/actions.ts` | 0 | 5 |
| `src/components/builder/TypebotFlow.tsx` | 0 | 4 |
| `src/components/builder/fields.tsx` | 1 | 0 |

#### Build

Comando executado:

```bash
PATH="/c/Program Files/nodejs:$PATH" npm_config_script_shell='C:\Program Files\Git\bin\bash.exe' npm run build
```

Resultado: **OK**, exit code `0`.

Resumo real:

- Next.js 16.2.7 com Turbopack.
- Compilação concluída com sucesso.
- TypeScript concluído.
- Geração estática concluída: 22/22 páginas.
- Rotas finalizadas sem erro fatal.

### Próximo checkpoint

Lote 2B está corrigido e validado localmente, mas ainda **não publicado**. Próximo passo recomendado: revisar diff, commitar/publicar Lote 2B, depois seguir para o próximo lote de backlog (`TypebotBuilder.tsx`, `LayersBuilder.tsx`, `blocks.tsx`, `GlobalAnalyticsView.tsx` etc.).

