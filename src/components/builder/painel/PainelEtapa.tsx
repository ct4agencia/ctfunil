"use client";
/**
 * Painel da ETAPA (nada selecionado no canvas), no padrão aprovado pelo Luca em
 * 26/11 a partir do Inlead: título da etapa à vista; cabeçalho com os
 * interruptores; Fundo, Títulos e Textos minimizados, com "Editar" e, quando
 * mudados, "Redefinir"; e os elementos da etapa, cada um levando ao painel dele.
 *
 * Grava onde o funil publicado lê (modelo.ts). Numa lâmina de tela cheia, o
 * fundo e o título vão para o bloco, e o que não chega ao funil aparece como
 * "Não vale aqui".
 */
import { useState, type ReactNode } from "react";
import type { Funnel } from "@/lib/quiz/types";
import type { InleadStep } from "@/lib/quiz/layers/types";
import {
  AJUSTES, POSICOES, lerCabecalho, lerFundo, lerTipografia, origemDoTexto, patchCabecalho, patchFundo, patchTipografia,
  restaurarTexto, rotuloPeso, type Texto,
} from "./modelo";
import {
  CabecalhoGrupo, EscolhaCurta, FonteComPrevia, GrupoMinimizado, LigaDesliga, LinhaCor, LinhaImagem, LinhaNumero, NaoValeAqui, SeletorPeso,
} from "./pecas";

type Grupo = "fundo" | "titulos" | "textos" | "vsl";
const ALINHAMENTOS = [{ valor: "left", rotulo: "Esquerda" }, { valor: "center", rotulo: "Centro" }, { valor: "right", rotulo: "Direita" }];

function Amostra({ fundo }: { fundo?: string }) {
  return <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-neutral-300" style={{ background: fundo }} />;
}

/** "Do funil · …": o valor herdado à vista, numa linha, com o grupo fechado. */
function DoFunil({ children }: { children: ReactNode }) {
  return <><span className="shrink-0">Do funil ·</span><span className="flex min-w-0 items-center gap-1.5 truncate">{children}</span></>;
}

export function PainelEtapa({ step, funnel, indice, onPatch, campoId, elementos, fundoVsl }: {
  step: InleadStep; funnel: Funnel; indice: number; onPatch: (patch: Partial<InleadStep>) => void;
  /** campo de ID com validação, que vive no construtor */
  campoId: ReactNode;
  /** lista dos blocos da lâmina (arrastar, duplicar, ocultar, excluir, editar) */
  elementos: ReactNode;
  /** campo próprio de fundo das lâminas de VSL, quando houver */
  fundoVsl?: { valor?: string; campo: ReactNode };
}) {
  const [abertos, setAbertos] = useState<Partial<Record<Grupo, boolean>>>({});
  const [avancado, setAvancado] = useState(false);
  const abrir = (grupo: Grupo, aberto: boolean) => setAbertos(a => ({ ...a, [grupo]: aberto }));

  const f = lerFundo(step, funnel);
  const t = lerTipografia(step, funnel);
  const h = lerCabecalho(step, funnel);
  const origemTitulos = origemDoTexto(t, "titulos");
  const origemTextos = origemDoTexto(t, "textos");

  return (
    <div>
      {step.disabled ? (
        <div role="status" className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] leading-snug text-amber-900">
          <span className="min-w-0 flex-1"><strong>Lâmina desativada:</strong> é pulada no funil publicado.</span>
          <button type="button" onClick={() => onPatch({ disabled: false })} className="shrink-0 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100">Reativar</button>
        </div>
      ) : null}

      <div className="border-b border-neutral-200 px-4 py-3">
        <label className="block text-xs font-medium text-ct-ink">Título da etapa
          <input value={step.title || ""} onChange={e => onPatch({ title: e.target.value })}
            className="mt-1.5 h-9 w-full rounded-md border border-neutral-300 px-2.5 text-sm text-ct-ink" />
        </label>
        <span className="mt-1 block text-[10px] text-neutral-500">Aparece nos dados e no mapa do funil, não na página.</span>
        <button type="button" aria-expanded={avancado} onClick={() => setAvancado(a => !a)}
          className="mt-2 flex min-h-8 items-center text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500 hover:text-ct-ink">
          {avancado ? "−" : "+"} Avançado
        </button>
        {avancado ? (
          <div className="mt-1 space-y-2">
            {campoId}
            <LigaDesliga rotulo="Lâmina ativa" ajuda={step.disabled ? "Pulada no funil publicado" : undefined} ligado={!step.disabled} onMudar={v => onPatch({ disabled: !v })} />
          </div>
        ) : null}
      </div>

      <section aria-labelledby={`etapa-${indice}-cabecalho`} className="border-b border-neutral-200 px-4 py-3">
        <CabecalhoGrupo id={`etapa-${indice}-cabecalho`} titulo="Cabeçalho">
          {h.origem !== "funil" ? (
            <button type="button" onClick={() => onPatch(patchCabecalho(step, "restaurar"))} aria-label="Redefinir cabeçalho: voltar ao do funil"
              className="flex min-h-8 items-center rounded-md px-2 text-xs font-semibold text-ct-ink hover:bg-neutral-100">Redefinir</button>
          ) : null}
        </CabecalhoGrupo>
        <div className="mt-1">
          {h.itens.map(item => (
            <LigaDesliga key={item.chave} rotulo={item.rotulo} ligado={item.ligado} herdado={item.herdado} semEfeito={item.semEfeito}
              onMudar={v => onPatch(patchCabecalho(step, item.chave, v))} />
          ))}
        </div>
        {h.telaCheia ? <p className="mt-1 text-[11px] leading-snug text-neutral-500">Lâmina de tela cheia: só a setinha aparece no funil.</p> : null}
      </section>

      <GrupoMinimizado titulo="Fundo" personalizado={f.origem !== "funil"} aberto={!!abertos.fundo}
        onEditar={() => abrir("fundo", true)} onFechar={() => abrir("fundo", false)}
        onRedefinir={() => { onPatch(patchFundo(step, { restaurar: true })); abrir("fundo", false); }}
        resumo={<DoFunil><Amostra fundo={f.padrao.cor ?? f.padrao.css} />{f.padrao.cor ? f.padrao.cor.toUpperCase() : f.padrao.texto}</DoFunil>}>
        <CamposFundo step={step} funnel={funnel} onPatch={onPatch} />
      </GrupoMinimizado>

      {fundoVsl ? (
        <GrupoMinimizado titulo="Fundo da VSL" personalizado={!!fundoVsl.valor} aberto={!!abertos.vsl}
          onEditar={() => abrir("vsl", true)} onFechar={() => abrir("vsl", false)}
          onRedefinir={() => { onPatch({ fundo: undefined } as Partial<InleadStep>); abrir("vsl", false); }}
          resumo={<DoFunil>deriva da cor do tema</DoFunil>}>
          {fundoVsl.campo}
        </GrupoMinimizado>
      ) : null}

      <GrupoMinimizado titulo="Títulos" personalizado={origemTitulos !== "funil"} aberto={!!abertos.titulos}
        onEditar={() => abrir("titulos", true)} onFechar={() => abrir("titulos", false)}
        onRedefinir={() => { onPatch(restaurarTexto(step, "titulos")); abrir("titulos", false); }}
        resumo={<DoFunil>{resumoTexto(t.titulos, t.telaCheia)}</DoFunil>}>
        {t.telaCheia ? (
          <EscolhaCurta rotulo="Alinhamento" opcoes={ALINHAMENTOS} valor={t.alinhamento} padrao="center"
            onMudar={v => onPatch(patchTipografia(step, "titulos", "alinhamento", v))} />
        ) : null}
        <CamposTexto x={t.titulos} alterar={(campo, valor) => onPatch(patchTipografia(step, "titulos", campo, valor))} />
        {t.telaCheia ? <p className="text-[11px] leading-snug text-neutral-500">Lâmina de tela cheia: a fonte e o espaço entre linhas seguem o tema do bloco.</p> : null}
      </GrupoMinimizado>

      <GrupoMinimizado titulo="Textos" personalizado={origemTextos !== "funil"} aberto={!!abertos.textos} semEfeito={t.telaCheia}
        onEditar={() => abrir("textos", true)} onFechar={() => abrir("textos", false)}
        onRedefinir={() => { onPatch(restaurarTexto(step, "textos")); abrir("textos", false); }}
        resumo={t.telaCheia ? <span>Os textos desta lâmina seguem o tema do bloco.</span> : <DoFunil>{resumoTexto(t.textos, false)}</DoFunil>}>
        <CamposTexto x={t.textos} alterar={(campo, valor) => onPatch(patchTipografia(step, "textos", campo, valor))} />
      </GrupoMinimizado>

      <section aria-labelledby={`etapa-${indice}-elementos`} className="px-4 py-3">
        <CabecalhoGrupo id={`etapa-${indice}-elementos`} titulo="Elementos desta etapa" />
        <div className="mt-1.5">{elementos}</div>
      </section>
    </div>
  );
}

function resumoTexto(x: Texto, telaCheia: boolean) {
  const partes = [telaCheia ? null : x.padrao.fonte, `${x.padrao.tamanho} px`, rotuloPeso(x.padrao.peso)].filter(Boolean);
  return <><Amostra fundo={x.padrao.cor} />{x.padrao.cor.toUpperCase()} · {partes.join(" · ")}</>;
}

function CamposTexto({ x, alterar }: { x: Texto; alterar: (campo: "fonte" | "tamanho" | "peso" | "linha" | "cor", valor?: string | number) => void }) {
  return (
    <>
      {x.semEfeito.has("fonte") ? null : <FonteComPrevia rotulo="Fonte" valor={x.fonte} padrao={x.padrao.fonte} onMudar={v => alterar("fonte", v)} />}
      <LinhaCor rotulo="Cor" valor={x.cor} padrao={x.padrao.cor} onMudar={v => alterar("cor", v)} />
      <LinhaNumero rotulo="Tamanho" valor={x.tamanho} padrao={x.padrao.tamanho} unidade="px" min={10} max={96} onMudar={v => alterar("tamanho", v)} />
      <SeletorPeso rotulo="Peso" valor={x.peso} padrao={x.padrao.peso} onMudar={v => alterar("peso", v)} />
      {x.semEfeito.has("linha") ? null : (
        <LinhaNumero rotulo="Entre linhas" valor={x.linha} padrao={x.padrao.linha} unidade="×" min={1} max={3} passo={0.05} onMudar={v => alterar("linha", v)} />
      )}
    </>
  );
}

/** Fundo no jeito do Inlead: cor de fundo e, embaixo, o plano de fundo (nenhum ou imagem). */
function CamposFundo({ step, funnel, onPatch }: { step: InleadStep; funnel: Funnel; onPatch: (patch: Partial<InleadStep>) => void }) {
  const f = lerFundo(step, funnel);
  const [escolhido, setPlano] = useState<"nenhum" | "imagem">("nenhum");
  // Com imagem gravada, o plano é "imagem"; sem ela, vale o que a pessoa escolheu agora.
  const plano = f.imagem ? "imagem" : escolhido;
  const patch = (m: Parameters<typeof patchFundo>[1]) => onPatch(patchFundo(step, m));
  const escolherPlano = (proximo: "nenhum" | "imagem") => {
    setPlano(proximo);
    if (proximo === "nenhum" && f.imagem) patch({ imagem: null });
  };
  return (
    <>
      {f.telaCheia ? <NaoValeAqui>Lâmina de tela cheia: o fundo é o do bloco. A cor e a imagem se substituem; escolher uma tira a outra.</NaoValeAqui> : null}
      {f.css && !f.imagem ? <p className="text-[11px] leading-snug text-neutral-600">Hoje há um gradiente próprio. Escolher uma cor ou uma imagem troca o gradiente.</p> : null}
      {f.telaCheia && plano === "imagem" ? null : (
        <LinhaCor rotulo="Cor de fundo" valor={f.cor} padrao={f.css ? "gradiente próprio" : f.padrao.cor ?? f.padrao.texto} padraoDoFunil={!f.css} onMudar={cor => patch({ cor: cor ?? null })} />
      )}
      <EscolhaCurta rotulo="Plano de fundo" opcoes={[{ valor: "nenhum" as const, rotulo: "Nenhum" }, { valor: "imagem" as const, rotulo: "Imagem" }]}
        valor={plano} onMudar={escolherPlano} />
      {plano === "imagem" ? (
        <>
          <LinhaImagem rotulo="Imagem" src={f.imagem} onMudar={src => patch({ imagem: src ?? null })} />
          {f.imagem ? (
            <>
              {/* tela cheia usa o valor direto como background-size do CSS, onde "Esticar" (fill) não existe */}
              <EscolhaCurta rotulo="Encaixe" opcoes={f.telaCheia ? AJUSTES.filter(a => a.valor !== "fill") : AJUSTES} valor={f.ajuste} onMudar={v => patch({ ajuste: v })} />
              <EscolhaCurta rotulo="Posição" opcoes={POSICOES} valor={f.posicao} onMudar={v => patch({ posicao: v })} />
              {f.telaCheia ? null : <LinhaNumero rotulo="Opacidade" valor={f.opacidade} padrao={100} unidade="%" min={0} max={100} passo={5} onMudar={v => patch({ opacidade: v ?? 100 })} />}
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
