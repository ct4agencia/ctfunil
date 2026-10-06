# Retorno do visitante — o que o funil lembra, e o que não lembra

> **Status: mapeamento, não implementado.** Decidido em 18/08/2026 manter o
> comportamento atual (só a trava de 24 h da roleta). Este documento existe para
> a decisão não precisar ser reconstruída do zero depois.

## O caso que motivou

O link do `cdb-insta` vai para a bio do Instagram. A mesma pessoa clica várias
vezes: entra, responde, sai, volta. A pergunta do Luca: ela refaz tudo? Gira a
roleta de novo? Espera a VSL outra vez?

## Como está hoje

| O que ela fez | Ao voltar | Onde vive |
|---|---|---|
| Respostas do quiz | **Perde** — refaz as 5 perguntas | `useState` do `LayersRunner`, some no unload |
| Nome e WhatsApp | **Digita de novo**, e vira lead duplicado | idem |
| Roleta | **Lembra 24 h** — prêmio restaurado sem animar | `localStorage['cdb-rl-<stepId>']` (`steps.tsx:213` grava, `:242` lê) |
| VSL | **Espera os 16:45 de novo** | `setTimeout` que nasce na montagem (`ResinaVSL.tsx`) |

A trava da roleta é a única persistência real, e o prazo de 24 h está **fixo no
código** (`steps.tsx:245`), não é campo do funil.

## O furo que custa dinheiro

A VSL. Quem assistiu 17 minutos, viu o botão e fechou antes de comprar, ao
voltar **espera 16:45 outra vez**. Quem já esperou uma vez não espera de novo.

## O limite que decide o desenho: `localStorage` é por navegador

O navegador interno do Instagram é um programa **separado** do Chrome e do
Safari. Nada é compartilhado entre eles.

| Abriu em | Voltou em | Lembra |
|---|---|---|
| Insta | Insta | sim |
| Insta | Chrome | **não** |
| Chrome | Safari | **não** |

Pior: o in-app browser do Instagram no **iOS limpa o storage** com frequência,
às vezes ao fechar o app — então nem Insta → Insta é garantido.

**Cache não resolve.** Cache guarda arquivos (imagens, JS) para carregar rápido;
estado ("já girou", "já assistiu") não passa por ele.

## As duas camadas possíveis

| Camada | Cobre | Alcance | Custo |
|---|---|---|---|
| Aparelho (`localStorage`) | tudo, desde a 1ª tela | só o mesmo navegador | baixo — já existe para a roleta |
| Servidor (chave = telefone) | roleta, VSL, lead duplicado | **qualquer navegador** | mexe em API + tabela |

A camada de servidor **só funciona depois da captura**: antes de informar o
telefone a visitante é anônima, e não há como reconhecer quem não se
identificou. Na prática as duas se somam — o aparelho cobre do começo, o
servidor assume a partir do telefone, que é justamente onde estão a roleta e a
VSL.

## O que o Luca pediu, quando for a hora

1. **Prazo configurável por funil**, não fixo em 24 h: horas (24/48/168…),
   "para sempre" ou desligado — e um prazo por item, porque o sentido difere:
   prêmio de roleta pode renovar toda semana; "já assistiu a VSL" faz sentido
   guardar para sempre.
2. **Não duplicar lead** quando o mesmo telefone volta, também com prazo.
3. Idealmente com a camada de servidor, para atravessar navegadores.

## Cuidado ao implementar

`lockReplay` é lido por **três funis com tráfego pago**, incluindo o
`premio-sonia` (4 mil sessões). Trocar o 24 h fixo por campo exige que a
ausência do campo continue significando 24 h — senão a trava vira "nenhuma" nos
funis existentes e o prêmio passa a poder ser girado infinitas vezes.
