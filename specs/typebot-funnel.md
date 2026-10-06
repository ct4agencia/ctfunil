# Funil Typebot (chat conversacional)

## Status
- Criada: 2026-06-30 (rascunho gerado no loop autônomo a partir do export real do Luca)
- Sessão: pedido recorrente desde o início; referência = export `typebot-export-funil-emagrecimento` + prints do editor Typebot
- **PENDENTE DE APROVAÇÃO do Luca antes do /build** (escopo MVP a confirmar)

## Objetivo
Adicionar um SEGUNDO tipo de funil ao CTFUNNEL: um funil em formato de **chat/conversa**
(estilo Typebot/WhatsApp). O "bot" envia bolhas de mensagem em sequência (com indicador
de digitação), o lead responde no próprio chat, e o fluxo ramifica conforme as respostas /
variáveis — terminando em captura + redirect pro checkout. É distinto do funil quiz/layers
atual e da aba Fluxo (que é só o mapa de caminhos do quiz e NÃO deve ser tocada).

## Contexto
- App: Next 16 + Supabase + Tailwind, motor "layers" já existe (`settings.engine="layers"`).
- A rota /builder/[slug] e /[slug] já ramificam por `settings.engine`. Adicionar o ramo "typebot".
- Reaproveitar o máximo: PixelScripts, /api/funnel-lead (captura+webhook Datacrazy), métricas/Leads,
  ImageField/upload, paleta/tema, e o conceito de canvas da aba Fluxo (nós + setas).
- Modelo de dados do Typebot (do export): `groups[]` (nó: title, graphCoordinates, blocks[]),
  `blocks[]` (bubble/input/logic), `edges[]` (from blockId/itemId → to groupId), `variables[]`,
  `theme`, `settings.typingEmulation`, `settings.metadata.customHeadCode`.

## Requisitos exatos (MVP)
- [ ] REQ-1: Novo engine `settings.engine="typebot"`. /builder/[slug] → `TypebotBuilder`; /[slug] → `ChatRunner`.
- [ ] REQ-2: Preset "💬 Typebot (chat conversacional)" no modal "Criar funil" que cria um funil-chat inicial (Start → boas-vindas → 1 input → fim).
- [ ] REQ-3: Canvas de nós (grupos) com blocos ordenados dentro; setas ligam a saída (fim do grupo / item de choice / branch de condição) ao grupo destino. Arrastar nós, adicionar/excluir grupo e bloco.
- [ ] REQ-4: Bubbles (mensagens do bot, bolha à esquerda c/ avatar): **texto** (rich: negrito/itálico/sublinhado + `{{variavel}}` interpolado), **imagem**, **áudio**, **vídeo/embed**.
- [ ] REQ-5: Bloco **Wait** (segundos) + **indicador de digitação** ("…") antes de cada bolha; `typingEmulation` global (velocidade) no Settings.
- [ ] REQ-6: Inputs (resposta do lead, bolha à direita): **texto**, **número**, **email**, **telefone/WhatsApp**, **botões (choice)**. Cada um grava numa **variável** nomeada; a resposta vira bolha do usuário.
- [ ] REQ-7: Lógica: **Set variable** (expressão, incl. eval JS tipo `if ({{imc}}<=18.5){return 'Abaixo do peso'}…`), **Condition** (ramifica por comparação de variável), **Wait**, **Redirect** (URL final → checkout).
- [ ] REQ-8: Store de variáveis + interpolação `{{var}}` em todas as bolhas/labels; Set variable avaliado no cliente.
- [ ] REQ-9: Aba **Theme**: cor de fundo/texto das bolhas do bot, das bolhas do usuário, dos botões, dos inputs, avatar do bot (imagem), fonte, fundo da página.
- [ ] REQ-10: Tracking: reusar `PixelScripts` + `/api/funnel-lead` (grava lead + dispara webhook Datacrazy com nome/telefone/respostas/estado, igual o quiz) + eventos Meta (Lead no input de telefone, InitiateCheckout no redirect). Custom head code por funil.
- [ ] REQ-11: Aba **Leads**: tabela de submissões (1 linha por sessão, colunas = variáveis/inputs) — reusar a infra de analytics.
- [ ] REQ-12: Runner mobile-first: conversa rola como messenger, auto-scroll pra bolha nova, bolhas aparecem progressivamente respeitando os Waits.

## Casos extremos a tratar
- EDGE-1: input inválido (texto em campo número, telefone curto) → re-pergunta / não avança.
- EDGE-2: `{{var}}` referenciada mas não setada → renderiza vazio (não quebra a frase).
- EDGE-3: expressão do Set variable lança erro → ignora o set, segue o fluxo (best-effort, não trava o chat).
- EDGE-4: Condition sem nenhum ramo verdadeiro → segue saída default / próximo grupo.
- EDGE-5: autoplay de áudio/vídeo bloqueado pelo navegador → mostra controles (não depende de autoplay).
- EDGE-6: conversa longa (muitas bolhas) → scroll performático, sem travar.
- EDGE-7: lead recarrega no meio → decisão: reinicia do começo (MVP) vs retomar (fora de escopo v1).

## Fora de escopo (v1)
Integrações avançadas (OpenAI, Sheets, HTTP request, Zapier/Make/Pabbly, ElevenLabs, Dify, Mistral,
Chatwoot, Cal.com, ChatNode, QR), AB Test, Webhook genérico, blocos File/Payment/Cards/Pic choice/
Rating/Date/Time/Website, eventos Command/Reply/Invalid customizados, Jump/Return, multi-idioma,
retomar sessão, importador de .json do Typebot. (Todos adicionáveis depois.)

## Definição de "concluído"
- [ ] Todos os REQ-N implementados (cada um verificável no builder + no /slug publicado).
- [ ] Todos os EDGE-N tratados.
- [ ] Reproduzir o fluxo do "Funil Emagrecimento": boas-vindas (texto+áudio+imagem) → coleta nome/peso/altura → calcula IMC → ramifica em 6 classificações → pitch (promessa/prova social/benefícios/oferta) → captura WhatsApp → Redirect pro checkout.
- [ ] Pixel/UTMify dispara; lead capturado vai pro Datacrazy com as respostas; submissões aparecem na aba Leads.
- [ ] `npm run build` verde; deploy Vercel; validação final do Luca.

## Notas pra /review
- Verificar engine: criar funil pelo preset Typebot → /builder/[slug] abre o TypebotBuilder (não o LayersBuilder).
- Verificar typing: bolhas respeitam o Wait + mostram "…" antes; medir que um Wait de 2s atrasa ~2s.
- Verificar variáveis/condição: setar peso/altura → IMC calculado bate com `peso/(altura²)` → cai no ramo certo.
- Verificar captura: passar um lead com telefone → linha em funnel_leads + payload Datacrazy com `respostas`.
- Não tocar: aba Fluxo do quiz/layers, nem os 4 funis CDB no ar.
- Decisão de modelagem a confirmar com o Luca: reaproveitar o schema `Funnel.steps` (cada group = step com blocks) OU criar `settings.typebot = { groups, edges, variables }` à parte. Recomendação: `settings.typebot` separado, pra não colidir com o motor layers.
