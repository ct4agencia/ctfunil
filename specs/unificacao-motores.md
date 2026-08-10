# Unificação dos motores de funil (1 construtor, 1 fluxo, 1 modelo)

## Status
- Criada: 2026-08-04
- Sessão: CTFUNNEL — mapeamento da centralização
- Estado: aguardando aprovação do Luca. **Nenhum código escrito.**

## Objetivo

Hoje o CTFUNNEL tem **três motores** de funil convivendo no mesmo app. Cada um tem
seu runtime, seu construtor e seu formato de lâmina. Um recurso criado num motor
não existe nos outros, e o Luca precisa lembrar qual funil usa qual motor antes
de pedir qualquer coisa.

O objetivo é ficar com **um motor só** (`layers`), sem perder nenhuma
funcionalidade e sem tocar nos 12 funis que rodam tráfego hoje.

## Contexto — o estado medido (04/08/2026)

| Motor | Funis | Situação |
|---|---|---|
| `layers` | 12 | Os CDB. Todos publicados, rodando tráfego |
| `tipado` | 3 | `cdb-rr`, `teste`, `premio-sonia` |
| `typebot` | 2 | `cdb-type01`, `cdb-type01-a` — **0 lâminas, vazios** |

Os três gravam no **mesmo** `funnels.steps` (jsonb). O motor é escolhido por
`settings.engine`. Converter um funil = reescrever o JSON e trocar a string.

### O gap real é UM bloco

O `layers` já suporta 16 blocos: `text`, `clear`, `options`, `button`, `image`,
`alert`, `loading`, `field`, `graphics`, `embed`, `timer`, `slider`, `roulette`,
`carousel`, `notification`, `video`.

As "lâminas" do motor tipado são composições disso:

| Lâmina (tipado) | Equivalente no layers | Falta? |
|---|---|---|
| `question` | `text` + `options` | não |
| `hero` | `text` + `image` + `button` | não |
| `capture` | `text` + `field` + `button` | não |
| `result` / `offer` / `bridge` / `post_capture` | `text` + `image` + `button` + `timer` | não |
| `vsl` | `embed` | não |
| `loading` | `loading` | não |
| `roulette` | `roulette` | não |
| **`scratch`** | — | **SIM** |

**A raspadinha é o único bloqueio técnico.** O resto já existe.

### Onde um bloco do layers se registra (8 pontos)

Levantado a partir do `roulette`, que é o análogo mais próximo da raspadinha
(bloco-hero, ocupa a tela toda, tem sorteio e trava de replay):

| # | Arquivo | Papel |
|---|---|---|
| 1 | `src/lib/quiz/layers/types.ts:14` | união de tipos de bloco |
| 2 | `src/components/quiz/layers/blocks.tsx` | runtime (render) |
| 3 | `src/components/builder/LayersBuilder.tsx:32` | catálogo "adicionar bloco" |
| 4 | `src/components/builder/LayersBuilder.tsx:47` | conjunto `ADDABLE` |
| 5 | `src/components/builder/LayersBuilder.tsx:78` | defaults do bloco novo |
| 6 | `src/components/builder/LayersBuilder.tsx:1220` | editor de bloco-hero |
| 7 | `src/components/quiz/layers/LayersRunner.tsx:177` | tratamento fullscreen |
| 8 | `src/lib/quiz/metrics.ts:290` | `LAYER_Q` — conta como pergunta |

---

## Requisitos exatos

### ONDA 1 — Raspadinha vira bloco do layers

Aditiva. Não altera nenhum funil existente.

- [ ] **REQ-1**: `"scratch"` entra na união de tipos em `layers/types.ts`.
      *Verificar:* `npx tsc --noEmit` limpo com um `Layer` de tipo `"scratch"`.
- [ ] **REQ-2**: `blocks.tsx` renderiza o bloco `scratch` com **paridade total**
      com o `ScratchGrid.tsx` atual — todos os campos abaixo funcionando:
      `cards[]` (label, cor, peso, emoji, popupTitle, popupBody, redeemUrl),
      `columns`, `revealPct`, `oncePerDevice`, `ctaUrl`, `coverText`,
      `coverStyle`/`coverColor`/`coverColor2`/`coverTextColor`/`coverTextSize`,
      `background`/`bgSize`/`bgPosition`, `topSpacing`, `titleShadow`,
      `escurecimento`, `perdedoresOpacidade`, `popupEnabled`, `confete`,
      `sound`, `winTitle`/`winBody`/`winCta`.
      *Verificar:* tabela campo-a-campo no /review; cada um alterado no
      construtor e conferido na tela.
- [ ] **REQ-3**: O sorteio acontece no **primeiro toque** (não no fim da
      raspagem) e os outros cards travam a partir daí — sem spoiler.
      *Verificar:* tocar no card A e tentar raspar o B → B não responde.
- [ ] **REQ-4**: A sensação de raspar é preservada: o card só revela ao passar
      de `revealPct`, nunca limpa inteiro no clique.
      *Verificar:* um clique único sem arrastar não revela nada.
- [ ] **REQ-5**: Peso 100 num card = 100% de chance dele
      (`soma dos pesos` respeitada).
      *Verificar:* 20 execuções seguidas com peso 100 → 20 vezes o mesmo prêmio.
- [ ] **REQ-6**: A raspadinha aparece no catálogo do construtor em
      **"Jogos (hero)"**, ao lado da Roleta, e entra no `ADDABLE`.
      *Verificar:* "adicionar bloco" no LayersBuilder lista "Raspadinha".
- [ ] **REQ-7**: Adicionar o bloco cria uma raspadinha **funcional na hora**,
      sem configurar nada (6 cards, textos padrão, um card premiado).
      *Verificar:* adicionar num funil em branco e raspar no preview.
- [ ] **REQ-8**: `LayersRunner` trata `scratch` como bloco-hero (tela cheia),
      igual a `roulette` e `slider`.
      *Verificar:* linha 177 do LayersRunner inclui `scratch`.
- [ ] **REQ-9**: `metrics.ts` conta a raspadinha como pergunta em `LAYER_Q`,
      pra ela aparecer no funil de conversão do dashboard.
      *Verificar:* dashboard do funil mostra a lâmina da raspadinha na evasão.
- [ ] **REQ-10**: Som e confete rodam **também no preview** do construtor; a
      trava `oncePerDevice` **não** roda no preview.
      *Verificar:* raspar no preview 3x seguidas → confete nas 3.
- [ ] **REQ-11**: Nenhum dos 12 funis `layers` muda de comportamento.
      *Verificar:* `node scripts/regressao.cjs check` → 17/17.

### ONDA 2 — Converter os 3 funis tipados

- [ ] **REQ-12**: Existe um conversor (script) que lê um funil `tipado` e
      devolve o mesmo funil em `layers`, mapeando cada lâmina para os blocos
      equivalentes da tabela do Contexto.
      *Verificar:* rodar em `teste` (funil descartável) primeiro.
- [ ] **REQ-13**: A conversão preserva `id` de cada lâmina.
      **Crítico:** as métricas históricas (`step_events.step_id`) referenciam
      esses ids; trocar id = perder o histórico do funil.
      *Verificar:* comparar `steps[].id` antes/depois — lista idêntica.
- [ ] **REQ-14**: Ordem de conversão: `teste` → `premio-sonia` → `cdb-rr`.
      Do menos crítico ao mais crítico.
- [ ] **REQ-15**: Cada funil convertido é validado **em produção** (visual +
      raspar/girar + botão de saída) antes do próximo.
      *Verificar:* screenshot antes/depois de cada um.
- [ ] **REQ-16**: O JSON original de cada funil é salvo em arquivo antes da
      conversão, pra rollback de 1 comando.
      *Verificar:* `specs/backups/<slug>-<data>.json` existe e é válido.

### ONDA 3 — Remover o motor tipado

Só depois que os 3 funis estiverem convertidos e validados.

- [ ] **REQ-17**: Apagar `QuizRunner.tsx`, `steps.tsx`, `ScratchGrid.tsx` e o
      que ficar órfão. `FunnelBuilder.tsx` sai junto (era o construtor do tipado).
      *Verificar:* `npx tsc --noEmit` limpo; `grep -r` sem referências vivas.
- [ ] **REQ-18**: O bundle do `/q/[slug]` **encolhe**.
      *Verificar:* comparar o tamanho da rota no `npm run build` antes/depois.
      Se aumentar, a onda falhou.
- [ ] **REQ-19**: Nenhum funil publicado quebra.
      *Verificar:* `regressao.cjs check` 17/17 + HTTP 200 nos 17 slugs.

### ONDA 4 — Tela "criar funil" com 3 opções

- [ ] **REQ-20**: Ao clicar em "criar funil", aparecem exatamente **3** opções:
      **1. Quizz · 2. Typebot WhatsApp · 3. Em branco**.
      *Verificar:* a tela não mostra nenhum outro modelo.
- [ ] **REQ-21**: "Quizz" cria um funil `layers` já montado e publicável.
- [ ] **REQ-22**: "Em branco" cria um funil `layers` com 1 lâmina vazia.
- [ ] **REQ-23**: "Clonar do inlead" cai no **nosso** construtor (layers),
      não em tela de terceiro.
      *Verificar:* clonar e editar uma lâmina.

## Casos extremos a tratar

- **EDGE-1**: Funil tipado com lâmina sem equivalente exato no layers →
  o conversor **para e avisa qual lâmina**, não converte pela metade.
- **EDGE-2**: `oncePerDevice` já gravado no `localStorage` de um visitante →
  ao converter, a chave muda e ele poderia raspar de novo.
  Comportamento esperado: **manter a mesma chave** (derivada do slug).
- **EDGE-3**: Conversão rodando enquanto alguém está no funil →
  fazer em janela de baixo tráfego; o visitante em curso termina no formato
  antigo (o JSON já está no cliente).
- **EDGE-4**: Bloco `scratch` adicionado numa lâmina que já tem outros blocos →
  ele é bloco-hero (tela cheia). Comportamento esperado: **avisar no construtor**
  que ele ocupa a lâmina inteira, igual à roleta.
- **EDGE-5**: `revealPct` alto (ex: 95) em tela pequena → raspar fica penoso.
  Comportamento esperado: aceitar, mas o padrão continua 80.
- **EDGE-6**: Todos os cards com peso 0 → divisão por zero no sorteio.
  Comportamento esperado: cair no sorteio uniforme, nunca quebrar.

## Fora de escopo

- Mexer nos 12 funis `layers` que rodam tráfego (só a Onda 3 os toca, e apenas
  removendo código que eles não usam).
- Decidir o destino dos 2 funis `typebot` vazios — **decisão adiada** pelo Luca.
- Os 4 problemas de performance pré-existentes (SDK Supabase no caminho da lead,
  motor VSL morto em `/[slug]`, `/q/[slug]` sem cache de borda, `motion` inteiro).
  São independentes desta unificação.
- Erro de banco deixar de virar `0` na tela (fail-fast + flag `degraded`).
- Hottok da Hotmart (bloqueio do Luca, fecha o ciclo até a venda).

## Definição de "concluído"

Para considerar entregue, TODOS estes itens devem ser verdadeiros:

- [ ] REQ-1 a REQ-23 implementados, cada um com a verificação indicada
- [ ] EDGE-1 a EDGE-6 tratados
- [ ] `npx tsc --noEmit` e `npx eslint` limpos
- [ ] `npm run build` verde
- [ ] `node scripts/regressao.cjs check` → 17/17 funis
- [ ] Bundle do `/q/[slug]` **menor** que hoje (REQ-18)
- [ ] `settings.engine` só tem os valores `layers` e `typebot` no banco
- [ ] Validação do Luca no navegador, em produção, nos 3 funis convertidos

## Notas pra /review

- **Paridade da raspadinha (REQ-2)**: montar tabela campo-a-campo comparando
  `ScratchStep` (`lib/quiz/types.ts`) com o `content` do bloco novo. Campo que
  não aparecer na tabela = campo esquecido.
- **REQ-13 é o de maior risco.** Conferir com:
  `select step_id, count(*) from step_events where funnel_slug='<slug>' group by 1`
  antes e depois. As contagens têm que bater.
- **REQ-18**: guardar o output do `npm run build` de hoje como linha de base
  antes de começar a Onda 3.
- O `premio-sonia` tem 1 lâmina só — é o melhor caso de teste da Onda 2, mas
  **converter o `teste` primeiro** (REQ-14), que é descartável.
- Cuidado com `patchStep`/`patchLayer` no LayersBuilder: o `FunnelBuilder` tinha
  o bug de ler o estado do closure (corrigido em `3faf84f`). Conferir se o
  LayersBuilder tem o mesmo padrão antes de confiar em dois patches seguidos.
