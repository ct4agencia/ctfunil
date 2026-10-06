# Construtor estilo inlead (plataforma do CTFUNNEL)

## Status
- Criada: 2026-06-26
- Sessão: clone da plataforma inlead (UI/UX/organização) no quizzfunnel
- Referências visuais (spec literal): `fotos quizzes/inlead/*.png` (31 prints da plataforma inlead)

## Objetivo
Fazer o painel do CTFUNNEL **parecer e funcionar como o inlead** — "olhar pro quizzfunnel e me sentir dentro do inlead". Não é sobre os funis publicados (esses já estão fiéis); é sobre a **plataforma**: layout, organização, distribuição das ferramentas e o jeito de editar (no canvas). Sem quebrar nenhum funil já produzido.

## Contexto
- Motor `layers` já existe: funis `cdb-estado`, `cdb-r`, `cdb-slide` (engine="layers"), renderizados pelo `LayersRunner`/`blocks.tsx`. Schema do bloco = `Layer` (lib/quiz/layers/types.ts): `{ id, type, content, design, effects }`.
- Existe um `LayersBuilder` v1 (lista lateral) que será **reorganizado** para o layout/edição do inlead — sem mudar o schema dos blocos nem os dados salvos.
- Save: `saveFunnelAction(funnel)` (grava `steps` jsonb). Não muda.
- O construtor abre em `/builder/[slug]`; engine="layers" → este construtor.

## Layout-alvo (dos prints)
- **Topo**: abas `Construtor · Fluxo · Design · Leads` (esquerda) + `⚙ · compartilhar · ▶preview · Salvar · Publicar` (direita). Fundo branco, aba ativa sublinhada.
- **Construtor = 4 zonas**: (1) **lista de etapas** (coluna fina à esquerda, numerada), (2) **paleta de blocos categorizada**, (3) **canvas central** (celular, edição inline), (4) **painel direito** com abas `Componente · Aparência · Exibição`.
- **Canvas**: o celular É a área de trabalho. Clicar num bloco no celular o **seleciona** (contorno azul + toolbar flutuante: ≡ arrastar / copiar / arquivar / excluir) e abre os campos dele no painel direito.
- **Paleta** (categorias e ordem dos prints): Formulário (Campo, E-mail, Telefone, Botão, Número, Textarea, Data, Altura, Peso) · Quiz (Opções, Múltipla Escolha, Escolha Única, Sim/Não, Vídeo Resposta) · Mídia e conteúdo (Texto, Imagem, Vídeo, Áudio) · Atenção (Alerta, Notificação, Timer, Loading, Nível) · Argumentação (Argumentos, Depoimentos, FAQ, Preço, Checklist, Antes/Depois, Carrossel) · Gráficos (Métricas, Gráficos) · Personalização (Espaço, HTML/Script).
- **Painel direito** muda por tipo de bloco (ex.: Campo → Tipo/Título/Placeholder/Máscara/obrigatório; Aparência → Cor e borda, Contraste, Arredondamento, Margem interna, Largura, Alinhamento; Exibição → condições/visibilidade).

## Requisitos exatos

### Topo + navegação
- [ ] REQ-1: Barra superior com as 4 abas (Construtor/Fluxo/Design/Leads) à esquerda e os botões `Salvar` + `Publicar` à direita (+ ⚙/compartilhar/preview como ícones), fiel ao print. Aba ativa destacada.
- [ ] REQ-2: `Salvar` grava no Supabase via `saveFunnelAction` (comportamento atual). `Publicar` é visual por ora (status já é "published"); não pode dar erro.

### Construtor — 4 zonas
- [ ] REQ-3: Coluna de **etapas** à esquerda, numerada (1, 2, 3…), com nome da lâmina, selecionável, reordenável por drag-drop, com adicionar/excluir.
- [ ] REQ-4: **Paleta de blocos** categorizada exatamente nas categorias/ordem dos prints (acima). Todos os ~34 itens **aparecem**. Clicar num item adiciona o bloco na lâmina selecionada.
- [ ] REQ-5: **Canvas central** renderiza a lâmina selecionada **dentro de um celular** (mantém o frame de celular — pedido do Luca) usando o `LayersRunner` em modo preview.
- [ ] REQ-6: **Edição inline**: clicar num bloco no canvas o seleciona (contorno + toolbar flutuante ≡/copiar/arquivar/excluir) e abre o painel direito daquele bloco.
- [ ] REQ-7: **Painel direito** com abas `Componente · Aparência · Exibição`. "Componente" = campos de conteúdo do bloco (ex.: editor de texto rico p/ Texto/Alerta; Tipo/Máscara/Placeholder p/ Campo; rótulo/destino p/ Botão; opções p/ Opções; etc.). "Aparência" = Cor, Arredondamento, Margem, Largura, Alinhamento. "Exibição" = atraso de revelação (`effects.starts`) e on/off de visibilidade.
- [ ] REQ-8: Blocos **funcionais** (renderizam no funil + editor completo): texto, imagem, botão, opções, campo, alerta, timer, loading, notificação, gráfico/métricas, vídeo/embed, espaço, slider, roleta. Os demais da paleta (Número, Textarea, Data, Altura, Peso, Múltipla Escolha, Escolha Única, Sim/Não, Vídeo Resposta, Áudio, Nível, Argumentos, Depoimentos, FAQ, Preço, Checklist, Antes/Depois, Carrossel, HTML/Script) aparecem na paleta e, ao adicionar, criam um bloco placeholder marcado "em breve" SEM quebrar o funil.
- [ ] REQ-9: Toolbar flutuante do bloco selecionado: **copiar** (duplica), **arquivar/ocultar** (toggle de visibilidade), **excluir**, **arrastar** (reordenar).

### Fluxo
- [ ] REQ-10: Aba **Fluxo** mostra as lâminas como **cards/nós conectados por setas** (não lista), com botão "Auto-organizar", refletindo os destinos (`button.destination` / `option.destination`). Destinos editáveis.

### Design
- [ ] REQ-11: Aba **Design** com os tokens globais (cor do tema, fundo, cor de título/texto, fonte, container, logo) no visual do inlead. Aplicam ao `LayersRunner`.

### Leads
- [ ] REQ-12: Aba **Leads** com sub-abas `Respostas · Resultados · Performance` (estilo inlead): Respostas = tabela por etapa (paginada 50/100/200) + Exportar CSV; Performance = funil + campanhas + dispositivos. (Reusa dados já existentes.)

### Fidelidade visual
- [ ] REQ-13: Cores, espaçamentos, tipografia e ícones das 4 telas seguem os prints de `fotos quizzes/inlead/` o mais fiel possível (fundo cinza do canvas, cards brancos, abas, paleta categorizada, painel direito).

## Casos extremos a tratar
- EDGE-1: Funil tipado (engine ≠ layers) → continua no `FunnelBuilder` antigo, intacto. → o construtor inlead só vale p/ engine="layers".
- EDGE-2: Lâmina sem blocos → canvas mostra estado vazio ("adicione um bloco"); paleta funciona.
- EDGE-3: Bloco de tipo desconhecido/"em breve" no canvas → renderiza um placeholder discreto, NUNCA quebra o preview nem o funil publicado.
- EDGE-4: Salvar com a mesma estrutura → os funis publicados (cdb-estado/cdb-r/cdb-slide) continuam renderizando idênticos (schema preservado).
- EDGE-5: Roleta/slider (hero tipado dentro do layers) no canvas → seleção/edição básica sem quebrar o branch especial do `LayersRunner`.

## Fora de escopo
- Tornar 100% funcionais os ~18 blocos "em breve" (Número, Data, Depoimentos, FAQ, Preço, Carrossel, etc.) — entram só visualmente na paleta; ativação é fase futura, um a um, sob demanda.
- Mudar o schema dos blocos (`Layer`) ou os dados dos funis já produzidos.
- Publicação/versionamento, templates, temas, colaboração multi-usuário.
- Pixel-perfect absoluto (cada sombra/à 1px) — meta é "sentir-se dentro do inlead", calibrável por print depois.

## Definição de "concluído"
- [ ] Todos os REQ-1..REQ-13 implementados (cada um verificável por print/uso).
- [ ] `npm run build` verde.
- [ ] Abrir `/builder/cdb-estado` → sinto que estou no inlead: topo com 4 abas, etapas à esquerda, paleta categorizada, canvas-celular editável inline, painel Componente/Aparência/Exibição à direita.
- [ ] Editar um bloco no canvas (clicar no celular) → painel direito abre e a mudança reflete no preview.
- [ ] Os 3 funis publicados continuam **idênticos** ao vivo (nada desconfigurado).
- [ ] Preview mantém o **frame de celular**.
- [ ] Validação final do Luca (comparando com os prints).

## Notas pra /review
- Verificar `/builder/cdb-estado` e `/builder/cdb-slide`: 4 zonas + edição inline (clicar bloco no celular seleciona).
- Verificar que `curl https://viverdebolsas.com.br/cdb-estado|cdb-r|cdb-slide` segue 200 e o conteúdo/visual idêntico (EDGE-4).
- Conferir a paleta: as 7 categorias e os ~34 itens na ordem dos prints (REQ-4).
- Conferir painel direito troca por tipo de bloco (REQ-7) e que "em breve" não quebra (EDGE-3).
- Build order sugerida: Fase 1 Construtor (REQ-1..9,13) → Fase 2 Fluxo (REQ-10) → Fase 3 Design (REQ-11) → Fase 4 Leads (REQ-12).
