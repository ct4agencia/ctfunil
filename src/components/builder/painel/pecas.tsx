"use client";
/**
 * Peças do painel direito no padrão aprovado pelo Luca em 26/11 (vista C, no
 * jeito do Inlead): grupos minimizados com "Editar" e, na etapa, "Redefinir"
 * para voltar ao do funil; linhas de campo com o valor herdado à vista.
 * Reaproveitam o ColorField, o ImageField e os tokens --ct-*; sem dependência nova.
 */
import { useId, type ReactNode } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import ColorField from "@/components/ui/ColorField";
import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";
import { ImageField } from "@/components/builder/fields";
import { FUNNEL_FONTS, fontFamily } from "@/lib/quiz/layers/design";
import { PESOS } from "./modelo";

const ROTULO_GRUPO = "min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500";
const ACAO_GRUPO = "flex min-h-8 shrink-0 items-center rounded-md px-2 text-xs font-semibold text-ct-ink hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ct-blue";

/** "do funil" ao lado de um valor herdado: mostra que ele vem do Design do funil. */
export function TagDoFunil({ texto = "do funil" }: { texto?: string }) {
  return <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">{texto}</span>;
}

/** O ajuste existe, mas não chega ao funil nesta situação. */
export function TagNaoVale() {
  return <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">Não vale aqui</span>;
}

export function NaoValeAqui({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-neutral-50 px-2.5 py-2 text-[11px] leading-snug text-neutral-500 ring-1 ring-neutral-200">{children}</p>;
}

/** Título de um grupo, em caixa alta, com a ação à direita. */
export function CabecalhoGrupo({ id, titulo, children }: { id: string; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-2">
      <h3 id={id} className={ROTULO_GRUPO}>{titulo}</h3>
      {children}
    </div>
  );
}

/**
 * Grupo da etapa. Fechado, segue o funil e oferece "Editar", com o valor do
 * funil em uma linha. Com algo mudado, fica aberto e oferece "Redefinir", que
 * volta ao do funil e fecha. Aberto sem mudança, oferece "Fechar". Assim, os
 * grupos abertos com "Redefinir" são exatamente os personalizados.
 */
export function GrupoMinimizado({ titulo, resumo, personalizado, aberto, onEditar, onFechar, onRedefinir, semEfeito, children }: {
  titulo: string; resumo?: ReactNode; personalizado: boolean; aberto: boolean;
  onEditar: () => void; onFechar: () => void; onRedefinir: () => void; semEfeito?: boolean; children?: ReactNode;
}) {
  const corpo = useId();
  const rotulo = useId();
  const visivel = !semEfeito && (aberto || personalizado);
  return (
    <section aria-labelledby={rotulo} className="border-b border-neutral-200 px-4 py-3">
      <CabecalhoGrupo id={rotulo} titulo={titulo}>
        {semEfeito ? <span className="text-[11px] text-neutral-500">Não vale aqui</span>
          : personalizado ? (
            <button type="button" onClick={onRedefinir} aria-label={`Redefinir ${titulo.toLowerCase()}: voltar ao do funil`} className={ACAO_GRUPO}>
              <RotateCcw size={12} aria-hidden="true" className="mr-1" />Redefinir
            </button>
          ) : aberto ? (
            <button type="button" aria-expanded aria-controls={corpo} onClick={onFechar} aria-label={`Fechar ${titulo.toLowerCase()}`} className={ACAO_GRUPO}>Fechar</button>
          ) : (
            <button type="button" aria-expanded={false} aria-controls={corpo} onClick={onEditar} aria-label={`Editar ${titulo.toLowerCase()} desta etapa`} className={ACAO_GRUPO}>Editar</button>
          )}
      </CabecalhoGrupo>
      {!visivel && resumo ? <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-neutral-500">{resumo}</div> : null}
      <div id={corpo} hidden={!visivel} className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

/**
 * Grupo dentro de um componente: resumo do que está valendo e "Editar"/"Fechar".
 * `extra` vai no cabeçalho (por exemplo, o liga/desliga do grupo); `aviso`
 * troca o "Editar" quando o grupo não vale na situação atual.
 */
export function GrupoComponente({ titulo, resumo, aberto, onAlternar, extra, aviso, children }: {
  titulo: string; resumo?: ReactNode; aberto: boolean; onAlternar: () => void; extra?: ReactNode; aviso?: string; children?: ReactNode;
}) {
  const corpo = useId();
  const rotulo = useId();
  const visivel = aberto && !aviso;
  return (
    <section aria-labelledby={rotulo} className="border-b border-neutral-200 px-4 py-3">
      <CabecalhoGrupo id={rotulo} titulo={titulo}>
        {extra}
        {aviso ? <span className="text-[11px] text-neutral-500">{aviso}</span> : (
          <button type="button" aria-expanded={visivel} aria-controls={corpo} onClick={onAlternar}
            aria-label={`${visivel ? "Fechar" : "Editar"} ${titulo.toLowerCase()}`} className={ACAO_GRUPO}>
            {visivel ? "Fechar" : "Editar"}
          </button>
        )}
      </CabecalhoGrupo>
      {!visivel && resumo ? <div className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-[11px] text-neutral-500">{resumo}</div> : null}
      <div id={corpo} hidden={!visivel} className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

/** Interruptor compacto, para o cabeçalho de um grupo. */
export function Interruptor({ rotulo, ligado, onMudar }: { rotulo: string; ligado: boolean; onMudar: (ligado: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} onClick={() => onMudar(!ligado)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ct-blue ${ligado ? "bg-neutral-900" : "bg-neutral-500"}`}>
      <span aria-hidden="true" className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] ${ligado ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

function Linha({ rotulo, children, desativada }: { rotulo: string; children: ReactNode; desativada?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${desativada ? "opacity-60" : ""}`}>
      <span className="w-24 shrink-0 text-xs text-neutral-600">{rotulo}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Cor com o valor herdado à vista: vazio, a amostra mostra a cor do funil com
 * borda tracejada (sem gravar nada); escolher uma cor grava só nesta etapa.
 */
export function LinhaCor({ rotulo, valor, padrao, onMudar, semEfeito, padraoDoFunil = true }: {
  rotulo: string; valor?: string; padrao?: string; onMudar: (cor: string | undefined) => void; semEfeito?: boolean;
  /** false quando o valor mostrado vazio não vem do funil (por exemplo, um gradiente próprio da etapa) */
  padraoDoFunil?: boolean;
}) {
  if (semEfeito) return <Linha rotulo={rotulo} desativada><TagNaoVale /></Linha>;
  const herdadaVisivel = !valor && padrao && HEX.test(padrao);
  return (
    <Linha rotulo={rotulo}>
      <span className="relative shrink-0">
        <ColorField value={valor ?? ""} onChange={cor => onMudar(cor || undefined)} allowEmpty className="h-8 w-10" label={rotulo} />
        {herdadaVisivel ? (
          <span aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-8 w-10 rounded-lg border border-dashed border-neutral-400" style={{ background: padrao }} />
        ) : null}
      </span>
      <span className={`min-w-0 truncate text-xs ${valor ? "text-ct-ink" : "text-neutral-500"}`}>{(valor ?? padrao ?? "").toUpperCase()}</span>
      {valor || !padraoDoFunil ? null : <TagDoFunil />}
    </Linha>
  );
}

export function LinhaNumero({ rotulo, valor, padrao, unidade, min, max, passo = 1, onMudar, semEfeito }: {
  rotulo: string; valor?: number; padrao: number; unidade: string; min: number; max: number; passo?: number;
  onMudar: (valor: number | undefined) => void; semEfeito?: boolean;
}) {
  if (semEfeito) return <Linha rotulo={rotulo} desativada><TagNaoVale /></Linha>;
  const atual = valor ?? padrao;
  const ajustar = (delta: number) => onMudar(Math.min(max, Math.max(min, Math.round((atual + delta) * 100) / 100)));
  return (
    <Linha rotulo={rotulo}>
      <button type="button" aria-label={`Diminuir ${rotulo.toLowerCase()}`} onClick={() => ajustar(-passo)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-neutral-300 hover:bg-neutral-50"><Minus size={14} aria-hidden="true" /></button>
      <span className="flex h-8 min-w-0 flex-1 items-center gap-1 rounded-md border border-neutral-300 px-2">
        <input type="number" min={min} max={max} step={passo} value={valor ?? ""} placeholder={String(padrao)} aria-label={rotulo}
          onChange={e => onMudar(e.target.value === "" ? undefined : Number(e.target.value))}
          className="w-12 min-w-0 border-0 bg-transparent p-0 text-xs text-ct-ink placeholder:text-neutral-500 focus:outline-none" />
        <span aria-hidden="true" className="text-[11px] text-neutral-500">{unidade}</span>
        {valor === undefined ? <span className="ml-auto"><TagDoFunil /></span> : null}
      </span>
      <button type="button" aria-label={`Aumentar ${rotulo.toLowerCase()}`} onClick={() => ajustar(passo)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-neutral-300 hover:bg-neutral-50"><Plus size={14} aria-hidden="true" /></button>
    </Linha>
  );
}

export function EscolhaCurta<T extends string | number>({ rotulo, opcoes, valor, padrao, onMudar }: {
  rotulo: string; opcoes: { valor: T; rotulo: string }[]; valor?: T; padrao?: T; onMudar: (valor: T) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="block text-xs text-neutral-600">{rotulo}</span>
      <div role="group" aria-label={rotulo} className="grid gap-0.5 rounded-lg bg-neutral-100 p-0.5" style={{ gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` }}>
        {opcoes.map(opcao => {
          const escolhida = valor === opcao.valor;
          const herdada = valor === undefined && padrao === opcao.valor;
          return (
            <button type="button" key={String(opcao.valor)} aria-pressed={escolhida || herdada} onClick={() => onMudar(opcao.valor)}
              title={herdada ? "Valor do funil" : undefined}
              className={`h-8 truncate rounded-md px-1 text-[11px] ${escolhida ? "bg-white font-bold text-ct-ink shadow-sm" : herdada ? "border border-dashed border-neutral-400 bg-white font-semibold text-neutral-600" : "text-neutral-600 hover:bg-white/60"}`}>
              {opcao.rotulo}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Peso da fonte numa lista (de 300 a 900), com o do funil como primeira opção. */
export function SeletorPeso({ rotulo, valor, padrao, onMudar }: { rotulo: string; valor?: number; padrao: number; onMudar: (peso: number | undefined) => void }) {
  const rotuloPadrao = PESOS.find(p => p.valor === padrao)?.rotulo ?? String(padrao);
  return (
    <Linha rotulo={rotulo}>
      <div className="min-w-0 flex-1">
        <WorkspaceSelect label={rotulo} value={valor ? String(valor) : ""} onChange={v => onMudar(v ? Number(v) : undefined)}
          options={[{ value: "", label: `${rotuloPadrao} · do funil` }, ...PESOS.map(p => ({ value: String(p.valor), label: p.rotulo }))]} />
      </div>
    </Linha>
  );
}

export function LigaDesliga({ rotulo, ligado, herdado, onMudar, semEfeito, ajuda }: {
  rotulo: string; ligado: boolean; herdado?: boolean; onMudar: (ligado: boolean) => void; semEfeito?: boolean; ajuda?: string;
}) {
  return (
    <label className={`flex min-h-9 items-center gap-2 ${semEfeito ? "opacity-60" : "cursor-pointer"}`}>
      <span className="min-w-0 flex-1 text-xs text-ct-ink">{rotulo}{ajuda ? <span className="block text-[10px] text-neutral-500">{ajuda}</span> : null}</span>
      {semEfeito ? <TagNaoVale /> : herdado ? <TagDoFunil /> : null}
      <input type="checkbox" role="switch" checked={ligado} disabled={semEfeito} onChange={e => onMudar(e.target.checked)}
        className="h-4 w-8 shrink-0 cursor-pointer accent-neutral-900" />
    </label>
  );
}

export function FonteComPrevia({ rotulo, valor, padrao, onMudar }: {
  rotulo: string; valor?: string; padrao: string; onMudar: (fonte: string | undefined) => void;
}) {
  return (
    <Linha rotulo={rotulo}>
      <select aria-label={rotulo} value={valor ?? ""} onChange={e => onMudar(e.target.value || undefined)}
        style={{ fontFamily: fontFamily(valor ?? padrao) }}
        className="h-8 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 text-xs text-ct-ink">
        <option value="">{padrao} · do funil</option>
        {FUNNEL_FONTS.map(fonte => <option key={fonte} value={fonte} style={{ fontFamily: fontFamily(fonte) }}>{fonte}</option>)}
      </select>
    </Linha>
  );
}

/** Imagem só por anexo (o ImageField do construtor não tem mais campo de URL). */
export function LinhaImagem({ rotulo, src, onMudar }: { rotulo: string; src?: string; onMudar: (src: string | undefined) => void }) {
  return (
    <div className="space-y-1">
      <span className="block text-xs text-neutral-600">{rotulo}</span>
      <ImageField value={src ?? ""} onChange={valor => onMudar(valor || undefined)} />
    </div>
  );
}
