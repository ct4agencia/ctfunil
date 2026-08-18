# cdb-insta — o que falta

> Mapa vivo. Atualizado em 18/08/2026. O objetivo combinado: **o "Editar" do
> construtor mostra o MESMO conteúdo do "Ver resultado" (= o site publicado)**,
> incluindo tudo que hoje a tela "inventa".

## A raiz do problema

Ao portar as telas da referência, embuti elementos **fixos no código**. Eles não
são blocos: aparecem no site, não aparecem no Editar, e não podem ser editados
nem removidos. O inverso também ocorre — a VSL lê só 5 tipos de bloco e
**descarta** os demais em silêncio.

## FASE 1 — cor do tema governando ✅ FEITA (b34d07a)

- gradiente único (`resina.ts::gradienteTema`) para botões e pílulas
- fundo da VSL derivado do tema (`fundoEscuroTema`), com sobrescrita por lâmina
- CTA de checkout segue verde por padrão, com campo para trocar

## FASE 2 — CAPTURA ⬜ PENDENTE

O que a tela inventa e precisa virar bloco:

| Elemento | Hoje | Vira |
|---|---|---|
| Pílula "🎁 PRESENTE EXCLUSIVO" | fixa no código | bloco Alerta (estilo pílula) |
| Rótulo do nome | ignora `field.label`, usa texto fixo | **ler `field.label`** |
| Rótulo do telefone | idem | **ler `field.label`** |
| Prefixo "BR +55" | fixo | opção do bloco de campo |
| Card branco do formulário | fixo | opção "agrupar em card" |
| "🔒 Seus dados protegidos" | fixo | bloco Texto |
| Botão travado até válido | fixo | opção do botão, **ligada por padrão** |

## FASE 3 — VSL ⬜ PENDENTE

| Elemento | Hoje | Vira |
|---|---|---|
| Alerta "⚠️ SAI DO AR EM BREVE" | **descartado** no site | renderizado na ordem |
| Filete acima do título | fixo | bloco Espaço (opção "linha") |
| Texto de espera | fixo no botão | já é `waitText`, expor no painel |
| Rodapé + selo Google | fixo | blocos |

## FASE 4 — HERO e RESULTADO ⬜ PENDENTE

| Tela | Elemento | Vira |
|---|---|---|
| Hero | medalhão 🎁 | bloco Check ✓ (emoji e cor configuráveis) |
| Hero | cápsula do título | opção do bloco Texto |
| Hero | filete | bloco Espaço (linha) |
| Resultado | check verde | bloco Check ✓ |
| Resultado | cor do alerta | `style` do bloco Alerta |

## FASE 5 — OPÇÕES DE ANIMAÇÃO ⬜ PENDENTE

Pulsar, brilho, entrada e travamento viram campos no painel — **já
pré-selecionados** ao adicionar o bloco, para o padrão continuar sendo o certo
sem exigir configuração.

## Fora das fases (pendências de material)

- **Fotos das bolsas** para o carrossel do hero — não existem no funil hoje
- **Imagem de garantia** e **formas de pagamento** (VSL) — espaço pronto, falta arquivo
- **Selo Google** — hoje desenhado em SVG; o arquivo real substitui via `selosImagem`

## Decisões já tomadas (não reabrir)

- CTA de checkout **verde**; demais botões seguem o tema, editáveis um a um
- Pílulas usam o **mesmo gradiente** dos botões
- Barra de progresso do diagnóstico: **uma só**, a da referência
- Roleta: preset **Suspense −4**, trava de 24 h mantida
- Persistência de retorno: **não implementar** agora (ver PERSISTENCIA-RETORNO.md)
