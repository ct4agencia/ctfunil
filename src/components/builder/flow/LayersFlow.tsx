"use client";
import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, GitBranch, Layers, ListChecks, Pin, Pencil } from "lucide-react";
import "./flow.css";
import type { InleadStep, Layer, LayerType } from "@/lib/quiz/layers/types";
import {
  FLOW, buildNodes, buildEdges, layout, edgePath, nodeH, EDGE_COLOR,
  rowY, defaultDotY, type FlowEdge,
} from "./graph";

/**
 * Aba FLUXO — quadro infinito, estilo Miro.
 *
 * Cada resposta tem uma saída própria. O rodapé configura o destino herdado
 * pelos blocos que seguem a próxima etapa.
 *
 * Três coisas mudaram nesta versão:
 *  - **uma faixa só**: o layout não serpenteia mais (era o "quebrando na
 *    vertical"); o canvas cresce para a direita e quem navega é o pan/zoom;
 *  - **pan + zoom** por arrasto do fundo, scroll, pinça do touchpad e botões;
 *  - **arrastar a bolinha** para conectar numa lâmina existente, ou soltar no
 *    vazio para criar uma lâmina nova já conectada.
 *
 * Posições ajustadas e destinos são salvos junto com as etapas.
 */

const Z_MIN = 0.2, Z_MAX = 2;
const trava = (z: number) => Math.max(Z_MIN, Math.min(Z_MAX, z));

/** Tipos oferecidos ao soltar a linha no vazio. Os mais usados, não todos —
 *  a paleta completa continua na aba Construtor. */
const TIPOS_RAPIDOS: [LayerType | "vazia", string][] = [
  ["options", "Opções"],
  ["text", "Texto"],
  ["image", "Imagem"],
  ["field", "Campo"],
  ["button", "Botão"],
  ["video", "Vídeo"],
  ["loading", "Loading"],
  ["confirm", "Parabéns"],
  ["scratch", "Raspadinha"],
  ["vsl", "VSL"],
  ["vazia", "Etapa vazia"],
];

const novoId = () => Math.random().toString(36).slice(2, 10);

interface Ligacao {
  /** índice da lâmina de origem entre as ATIVAS */
  si: number;
  layerId: string;
  optId: string | null;
  /** ponto de partida, em coordenadas do canvas */
  x0: number; y0: number;
  /** ponta do cabo, em coordenadas do canvas */
  x: number; y: number;
}

export default function LayersFlow({
  steps, setSteps, onOpenStep, criarLayer,
}: {
  steps: InleadStep[];
  setSteps: (s: InleadStep[]) => void;
  /** clicar no nó abre a lâmina na aba Construtor */
  onOpenStep?: (i: number) => void;
  /** monta o bloco de um tipo — vem do construtor para não duplicar os presets */
  criarLayer?: (t: LayerType) => Layer;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const vpRef = useRef<HTMLDivElement>(null);
  // Toggle da animação, persistido: se o Luca achar que pesou, desliga e fica.
  // Inicializador preguiçoso em vez de useEffect — o componente é ssr:false,
  // então ler localStorage aqui não diverge da hidratação, e evita o render em
  // cascata que um setState dentro de efeito provoca.
  const [animar, setAnimar] = useState(() => {
    try { return localStorage.getItem("lf_anim") !== "0"; } catch { return true; }
  });
  const alternarAnim = () => {
    const novo = !animar;
    try { localStorage.setItem("lf_anim", novo ? "1" : "0"); } catch { /* storage bloqueado */ }
    setAnimar(novo);
  };

  const [view, setView] = useState({ x: 24, y: 24, z: 1 });
  const [lig, setLig] = useState<Ligacao | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);   // nó sob o cabo
  const [menu, setMenu] = useState<Ligacao | null>(null);  // popup "criar lâmina"
  const [pegando, setPegando] = useState(false);           // só para o cursor
  const [focusedExit, setFocusedExit] = useState<string | null>(null);

  const { nodes, edges, pos, canvasW, canvasH } = useMemo(() => {
    const ns = buildNodes(steps);
    const es = buildEdges(steps, ns);
    // UMA faixa: o funil inteiro na horizontal. Quem navega é o pan/zoom.
    const l = layout(ns, es, Math.max(1, ns.length));
    return { nodes: ns, edges: es, ...l };
  }, [steps]);

  /** Marcador da bolinha do RODAPÉ (a saída padrão). Não é o id de um bloco —
   *  o destino dela mora no próprio step, em `nextStep`. */
  const SAIDA_PADRAO = "__next";

  // grava o destino de uma saída — mesmo caminho de escrita de sempre
  const setDest = (si: number, layerId: string, optId: string | null, dest: string) =>
    setSteps(congelar(steps).map((s, i) => {
      if (i !== si) return s;
      if (layerId === SAIDA_PADRAO) return { ...s, nextStep: dest };
      return {
        ...s,
        layers: (s.layers || []).map((l) => {
          if (l.id !== layerId) return l;
          if (optId) return { ...l, content: { ...l.content, options: (l.content.options || []).map((o) => o.id === optId ? { ...o, destination: dest } : o) } };
          return { ...l, content: { ...l.content, destination: dest } };
        }),
      };
    }));

  /**
   * Fixa TODO nó que ainda não tem posição própria, no lugar onde ele já está.
   *
   * Sem isto, criar ou mudar uma conexão altera os níveis do layout automático
   * e o mapa inteiro se reorganiza — era o "bagunça os blocos". Congelando
   * antes de escrever, só muda o que o Luca mexeu.
   */
  const congelar = (lista: InleadStep[]) =>
    lista.map((s) => s.flowPos ? s : { ...s, flowPos: { x: Math.round(ponto(s.id).x), y: Math.round(ponto(s.id).y) } });

  /** Grava a posição de um nó arrastado. */
  const gravarPos = (id: string, x: number, y: number) =>
    setSteps(congelar(steps).map((s) => s.id === id ? { ...s, flowPos: { x: Math.round(x), y: Math.round(y) } } : s));

  /** Devolve o nó ao layout automático. */
  const soltarPos = (id: string) =>
    setSteps(steps.map((s) => {
      if (s.id !== id) return s;
      const { flowPos: _fora, ...resto } = s;
      void _fora;
      return resto;
    }));

  /** Cria a lâmina e liga a saída nela — numa única escrita, senão o `steps`
   *  do closure ainda não teria a lâmina nova na hora de gravar o destino. */
  const criarEConectar = (l: Ligacao, tipo: LayerType | "vazia") => {
    const id = novoId();
    const bloco = tipo !== "vazia" && criarLayer ? criarLayer(tipo) : null;
    const nova: InleadStep = {
      id,
      title: TIPOS_RAPIDOS.find(([t]) => t === tipo)?.[1] ?? "Nova etapa",
      layers: bloco ? [bloco] : [],
      options: { show_logo: false, show_progress: false },
      // nasce ONDE o cabo foi solto — sem isso ela entra no layout automático e
      // empurra as vizinhas de lugar
      flowPos: { x: Math.round(l.x), y: Math.round(l.y) },
    };
    setSteps([
      ...congelar(steps).map((s, i) => {
        if (i !== l.si) return s;
        if (l.layerId === SAIDA_PADRAO) return { ...s, nextStep: id };
        return {
          ...s,
          layers: (s.layers || []).map((la) => {
            if (la.id !== l.layerId) return la;
            if (l.optId) return { ...la, content: { ...la.content, options: (la.content.options || []).map((o) => o.id === l.optId ? { ...o, destination: id } : o) } };
            return { ...la, content: { ...la.content, destination: id } };
          }),
        };
      }),
      nova,
    ]);
    setMenu(null);
  };

  const ponto = (id: string) => pos[id] ?? { x: 0, y: 0 };
  // animar só quando vale a pena: acima de ~60 linhas o custo de repintar por
  // frame supera o ganho visual
  const correndo = animar && edges.length <= 60;

  const coordenadas = (e: FlowEdge) => {
    const a = posTemp?.id === e.from ? posTemp : ponto(e.from);
    const x1 = a.x + FLOW.W, y1 = a.y + e.fromY;
    if (!e.to) return { x1, y1, x2: x1 + 56, y2: y1 };     // link externo: toco curto
    const b = posTemp?.id === e.to ? posTemp : ponto(e.to);
    return { x1, y1, x2: b.x, y2: b.y + FLOW.HEAD / 2 };
  };

  // ── navegação (pan / zoom) ──────────────────────────────────────────────
  /** tela → canvas (desfaz translate+scale) */
  const paraCanvas = (cx: number, cy: number) => {
    const r = vpRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (cx - r.left - view.x) / view.z, y: (cy - r.top - view.y) / view.z };
  };

  /** Zoom ancorado num ponto da tela: o que está sob o cursor fica sob o cursor. */
  const zoomEm = (cx: number, cy: number, fator: number) => setView((v) => {
    const z = trava(v.z * fator);
    if (z === v.z) return v;
    const r = vpRef.current?.getBoundingClientRect();
    if (!r) return { ...v, z };
    const mx = cx - r.left, my = cy - r.top;
    return { z, x: mx - (mx - v.x) * (z / v.z), y: my - (my - v.y) * (z / v.z) };
  });

  const zoomNoCentro = (fator: number) => {
    const r = vpRef.current?.getBoundingClientRect();
    if (r) zoomEm(r.left + r.width / 2, r.top + r.height / 2, fator);
  };

  const ajustar = () => {
    const r = vpRef.current?.getBoundingClientRect();
    if (!r || !canvasW || !canvasH) return;
    const z = trava(Math.min((r.width - 48) / canvasW, (r.height - 48) / canvasH, 1));
    setView({ z, x: (r.width - canvasW * z) / 2, y: (r.height - canvasH * z) / 2 });
  };

  // enquadra o funil na primeira medição da área (e a cada troca de tamanho
  // grande não faz nada — reenquadrar sozinho tiraria o Luca do lugar onde ele
  // estava olhando)
  const jaEnquadrou = useRef(false);
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (jaEnquadrou.current || !el.clientWidth) return;
      jaEnquadrou.current = true;
      ajustar();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasW, canvasH]);

  /**
   * Roda do mouse. `ctrlKey` é o que o navegador manda na pinça do touchpad
   * (e no ctrl+scroll) → zoom. Scroll normal e de dois dedos → pan.
   *
   * Registrado à mão com `{ passive: false }`: o `onWheel` do React entra como
   * listener PASSIVO, onde `preventDefault()` é ignorado — a página rolava
   * atrás do quadro e o ctrl+scroll dava zoom no navegador em vez de no mapa.
   */
  useEffect(() => {
    const el = vpRef.current; if (!el) return;
    const aoRodar = (ev: WheelEvent) => {
      ev.preventDefault();
      if (ev.ctrlKey) {
        const f = Math.exp(-ev.deltaY / 260);
        setView((v) => {
          const z = trava(v.z * f);
          if (z === v.z) return v;
          const r = el.getBoundingClientRect();
          const mx = ev.clientX - r.left, my = ev.clientY - r.top;
          return { z, x: mx - (mx - v.x) * (z / v.z), y: my - (my - v.y) * (z / v.z) };
        });
        return;
      }
      setView((v) => ({ ...v, x: v.x - ev.deltaX, y: v.y - ev.deltaY }));
    };
    el.addEventListener("wheel", aoRodar, { passive: false });
    return () => el.removeEventListener("wheel", aoRodar);
  }, []);

  const arrasto = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const aoPegarFundo = (ev: React.PointerEvent) => {
    if (ev.button !== 0 || lig) return;
    // só o fundo arrasta o quadro; clique dentro de um nó é do nó
    if ((ev.target as HTMLElement).closest("[data-node]")) return;
    arrasto.current = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y };
    setPegando(true);
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
  };

  /**
   * Arraste de NÓ. A posição corrente vive num estado temporário e só vira
   * `flowPos` no soltar: gravar a cada `pointermove` re-renderizaria o funil
   * inteiro (e marcaria o funil como alterado) dezenas de vezes por segundo.
   */
  const noArrasto = useRef<{ id: string; offX: number; offY: number; x0: number; y0: number; moveu: boolean } | null>(null);
  const [posTemp, setPosTemp] = useState<{ id: string; x: number; y: number } | null>(null);

  const pegarNo = (ev: React.PointerEvent, id: string) => {
    if (ev.button !== 0) return;
    const p = ponto(id);
    const m = paraCanvas(ev.clientX, ev.clientY);
    noArrasto.current = { id, offX: m.x - p.x, offY: m.y - p.y, x0: ev.clientX, y0: ev.clientY, moveu: false };
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
  };

  const aoMover = (ev: React.PointerEvent) => {
    if (noArrasto.current) {
      const a = noArrasto.current;
      // limiar de 3px separa "cliquei pra abrir a lâmina" de "arrastei o card"
      if (!a.moveu && Math.hypot(ev.clientX - a.x0, ev.clientY - a.y0) < 3) return;
      a.moveu = true;
      const m = paraCanvas(ev.clientX, ev.clientY);
      setPosTemp({ id: a.id, x: m.x - a.offX, y: m.y - a.offY });
      return;
    }
    if (arrasto.current) {
      const a = arrasto.current;
      setView((v) => ({ ...v, x: a.vx + (ev.clientX - a.x), y: a.vy + (ev.clientY - a.y) }));
      return;
    }
    if (lig) {
      const p = paraCanvas(ev.clientX, ev.clientY);
      setLig({ ...lig, x: p.x, y: p.y });
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      setAlvo(el?.closest("[data-node]")?.getAttribute("data-node") ?? null);
    }
  };

  const aoSoltar = (ev: React.PointerEvent) => {
    arrasto.current = null;
    setPegando(false);

    if (noArrasto.current) {
      const a = noArrasto.current;
      noArrasto.current = null;
      if (a.moveu && posTemp) gravarPos(posTemp.id, posTemp.x, posTemp.y);
      setPosTemp(null);
      return;
    }

    if (!lig) return;
    const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
    const destino = el?.closest("[data-node]")?.getAttribute("data-node");
    const pointer = paraCanvas(ev.clientX, ev.clientY);
    const moved = Math.hypot(pointer.x - lig.x0, pointer.y - lig.y0) * view.z > 8;
    if (moved && destino && steps.some(s => s.id === destino && !s.disabled)) setDest(lig.si, lig.layerId, lig.optId, destino);
    else if (moved && !destino) setMenu({ ...lig, ...pointer });
    setLig(null); setAlvo(null);
  };

  const cancelarArrasto = () => {
    arrasto.current = null; noArrasto.current = null;
    setPegando(false); setPosTemp(null); setLig(null); setAlvo(null);
  };

  /** começa a puxar um cabo a partir de uma bolinha */
  const pegarBolinha = (ev: React.PointerEvent, si: number, layerId: string, optId: string | null, nodeId: string, dy: number) => {
    if (ev.button !== 0 || steps[si].disabled) return;
    ev.stopPropagation();
    ev.preventDefault();
    const p = ponto(nodeId);
    const m = paraCanvas(ev.clientX, ev.clientY);
    setLig({ si, layerId, optId, x0: p.x + FLOW.W, y0: p.y + dy, x: m.x, y: m.y });
    vpRef.current?.setPointerCapture(ev.pointerId);
  };

  const botao = "grid h-6 w-6 max-md:size-11 place-items-center rounded-lg border border-ct-line-strong bg-ct-surface text-sm font-bold text-ct-dim hover:bg-ct-raised";

  return (
    <div ref={areaRef} className="ct-flow flex h-full flex-col" onKeyDown={event => {
      if (event.key === "Escape") { cancelarArrasto(); setMenu(null); }
    }}>
      <style>{`
        @keyframes lf-dash { to { stroke-dashoffset: -24 } }
        .lf-edge { fill: none; stroke-width: 2; stroke-dasharray: 6 6 }
        .lf-run  { animation: lf-dash .9s linear infinite }
        @media (prefers-reduced-motion: reduce) { .lf-run { animation: none } }
      `}</style>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold"><GitBranch size={16}/>Fluxo</span>
        <span className="text-[11px] text-ct-dim">
          {nodes.length} lâminas · {edges.length} conexões
        </span>
        <div className="ml-auto flex max-w-full flex-wrap items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4" style={{ background: EDGE_COLOR.seq }} />segue</span>
          <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4" style={{ background: EDGE_COLOR.jump }} />pula</span>
          <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4" style={{ background: EDGE_COLOR.back }} />volta</span>
          <button onClick={alternarAnim} className="max-md:min-h-11 rounded-lg border border-ct-line-strong bg-ct-surface px-2.5 py-1 font-semibold text-ct-dim hover:bg-ct-raised">
            {animar ? "Pausar animação" : "Animar conexões"}
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => zoomNoCentro(1 / 1.2)} className={botao} aria-label="Reduzir zoom do fluxo" title="Diminuir zoom">−</button>
            <span className="w-9 text-center tabular-nums text-ct-dim">{Math.round(view.z * 100)}%</span>
            <button onClick={() => zoomNoCentro(1.2)} className={botao} aria-label="Ampliar zoom do fluxo" title="Aumentar zoom">+</button>
            <button onClick={ajustar} className="ml-1 max-md:min-h-11 rounded-lg border border-ct-line-strong bg-ct-surface px-2 py-1 font-semibold text-ct-dim hover:bg-ct-raised" title="Enquadrar o funil inteiro">ajustar</button>
          </div>
        </div>
      </div>

      <div
        ref={vpRef}
        onPointerDown={aoPegarFundo}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={cancelarArrasto}
        aria-label="Mapa de conexões"
        className={`relative flex-1 overflow-hidden rounded-xl border border-ct-line ${pegando ? "cursor-grabbing" : "cursor-grab"}`}
        style={{
          backgroundColor: "var(--ct-raised, #fafafa)",
          backgroundImage: "radial-gradient(var(--ct-line, #d4d4d4) 1px, transparent 1px)",
          backgroundSize: `${22 * view.z}px ${22 * view.z}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
          touchAction: "none",
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: canvasW, height: canvasH, transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}
        >
          <svg className="absolute inset-0 overflow-visible" width={canvasW} height={canvasH} style={{ pointerEvents: "none" }}>
            <defs>
              {(["seq", "jump", "back", "extern"] as const).map((k) => (
                <marker key={k} id={`lf-${k}`} markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill={EDGE_COLOR[k]} />
                </marker>
              ))}
            </defs>
            {edges.map((e) => {
              const { x1, y1, x2, y2 } = coordenadas(e);
              const d = edgePath(x1, y1, x2, y2, e.kind);
              return (
                <g key={e.id} data-connection={e.id} aria-label={`${e.label || "Próxima etapa"} → ${nodes.find(n => n.id === e.to)?.title || "Link externo"}`}
                  style={{ opacity: focusedExit && focusedExit !== e.id ? .2 : 1 }}>
                  <title>{e.label || "Próxima etapa"} → {nodes.find(n => n.id === e.to)?.title || "Link externo"}</title>
                  <path d={d} className={`lf-edge ${correndo ? "lf-run" : ""}`} stroke={EDGE_COLOR[e.kind]} markerEnd={`url(#lf-${e.kind})`} />
                  {e.kind === "extern" ? (
                    <text x={x2 + 4} y={y2 + 3} fontSize="10" fill="var(--ct-faint)">Link externo</text>
                  ) : null}
                </g>
              );
            })}
            {/* cabo em construção */}
            {lig ? (
              <path d={edgePath(lig.x0, lig.y0, lig.x, lig.y, "jump")} className="lf-edge"
                stroke={EDGE_COLOR.jump} strokeDasharray="4 4" />
            ) : null}
          </svg>

          {nodes.map((n) => {
            const p = posTemp?.id === n.id ? posTemp : ponto(n.id);
            const mirando = alvo === n.id && !n.disabled;
            const arrastandoEste = posTemp?.id === n.id;
            return (
              <div
                key={n.id}
                data-node={n.id}
                className={`ct-flow-node absolute rounded-xl border bg-ct-surface ${n.disabled ? "border-dashed border-ct-line-strong opacity-60" : "border-ct-line"}`}
                data-target={mirando}
                style={{ left: p.x, top: p.y, width: FLOW.W, height: nodeH(n.exits.length), zIndex: arrastandoEste ? 5 : undefined }}
              >
                <span className="ct-flow-inlet" aria-hidden="true" />
                <div
                  onPointerDown={(ev) => pegarNo(ev, n.id)}
                  onDoubleClick={() => onOpenStep?.(n.idx)}
                  className="flex w-full cursor-grab items-center gap-1.5 rounded-t-xl px-3 text-left hover:bg-ct-raised active:cursor-grabbing"
                  style={{ height: FLOW.HEAD, touchAction: "none" }}
                  title="Arraste para posicionar · clique duas vezes para abrir no construtor"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-neutral-900 text-[10px] font-bold text-white">{n.idx + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ct-ink">{n.title}</span>
                  <button type="button" aria-label={`Editar etapa ${n.idx + 1}: ${n.title}`} onPointerDown={event => event.stopPropagation()}
                    onClick={() => onOpenStep?.(n.idx)} className="ct-flow-edit"><Pencil size={13}/></button>
                  {n.fixado ? (
                    <span role="button" tabIndex={0}
                      onPointerDown={(ev) => ev.stopPropagation()}
                      onClick={(ev) => { ev.stopPropagation(); soltarPos(n.id); }}
                      onKeyDown={(ev) => { if (ev.key === "Enter") soltarPos(n.id); }}
                      className="shrink-0 cursor-pointer text-[9px] opacity-60 hover:opacity-100"
                      title="Voltar ao layout automático"><Pin size={12}/></span>
                  ) : null}
                  {n.disabled ? <span className="shrink-0 rounded bg-ct-raised px-1 text-[9px] font-bold uppercase text-ct-dim">off</span> : null}
                </div>

                {/* SAÍDAS: uma linha por botão/opção */}
                {n.exits.map((x, k) => {
                  const explicito = !!x.dest && x.dest !== "next";
                  return (
                    <div key={x.key} className="ct-flow-exit flex items-center gap-1.5 px-3" style={{ height: FLOW.ROW }}
                      onMouseEnter={() => setFocusedExit(`${n.id}:${x.key}`)} onMouseLeave={() => setFocusedExit(null)}
                      onFocus={() => setFocusedExit(`${n.id}:${x.key}`)} onBlur={() => setFocusedExit(null)}>
                      <ListChecks size={13} className="shrink-0 text-ct-dim" aria-hidden="true"/>
                      <span className="min-w-0 flex-1 truncate text-[11px] text-ct-dim" title={x.label}>{x.label}</span>
                      {x.editable ? (
                        <WorkspaceSelect className="ct-flow-destination" label={`Destino de ${x.label} na etapa ${n.idx+1}`} disabled={n.disabled} value={/^https?:/.test(x.dest||'')?'__url':(x.dest||'next')} onChange={value=>setDest(n.idx,x.layerId,x.optId,value)} options={[{value:'next',label:'Padrão da etapa'},...steps.map((step,index)=>({value:step.id,label:`${index+1}. ${String(step.title||step.id).replace(/<[^>]+>/g,'')}${step.disabled?' (desativada)':''}`,disabled:step.disabled})),...(x.dest&&x.dest!=='next'&&!/^https?:/i.test(x.dest)&&!steps.some(step=>step.id===x.dest)?[{value:x.dest,label:'Destino removido'}]:[]),...(/^https?:/.test(x.dest||'')?[{value:'__url',label:'Link externo'}]:[])]}/>
                      ) : (
                        // o runtime ignora o destino aqui — oferecer um seletor
                        // gravaria dado morto e o mapa mentiria
                        <span className="shrink-0 text-[10px] text-ct-dim" title="Segue o destino padrão configurado no rodapé da etapa">Padrão da etapa</span>
                      )}
                      {x.editable ? (
                        <button type="button"
                          disabled={n.disabled}
                          aria-label={`Conectar resposta ${x.label} da etapa ${n.idx + 1}`}
                          onClick={event => event.currentTarget.parentElement?.querySelector<HTMLButtonElement>("[role=combobox]")?.focus()}
                          onPointerDown={(ev) => pegarBolinha(ev, n.idx, x.layerId, x.optId, n.id, rowY(k))}
                          title="Arraste para uma lâmina — ou solte no vazio para criar uma"
                          className="ct-flow-port"
                          data-connected={explicito}
                        ><span /></button>
                      ) : (
                        <span className="shrink-0 rounded-full" style={{ width: 8, height: 8, border: "2px solid var(--ct-line-strong)" }} />
                      )}
                    </div>
                  );
                })}

                {/* BOLINHA PADRÃO — a saída que vale "independente do botão
                    clicado". Sempre presente enquanto houver próxima lâmina. */}
                <div className="ct-flow-default flex items-center gap-1.5 border-t border-neutral-100 px-3" style={{ height: FLOW.PADB }}>
                  <ArrowRight size={13} aria-hidden="true"/>
                  <label className="text-[10px] text-ct-dim" htmlFor={`flow-default-${n.id}`}>Padrão</label>
                  <WorkspaceSelect id={`flow-default-${n.id}`} className="ct-flow-default-select" label={`Destino padrão da etapa ${n.idx+1}`} disabled={n.disabled} value={steps[n.idx].nextStep || ''} onChange={value=>setDest(n.idx,SAIDA_PADRAO,null,value)} options={[{value:'',label:'Seguir a ordem'},...steps.map((step,index)=>({value:step.id,label:`${index+1}. ${step.title}${step.disabled?' (desativada)':''}`,disabled:step.disabled}))]}/>
                  {steps[n.idx]?.nextStep ? (
                    <button type="button" onClick={() => setSteps(steps.map((s, i) => i === n.idx ? { ...s, nextStep: undefined } : s))}
                      className="shrink-0 text-[9px] text-ct-dim hover:text-red-500" title="Voltar a seguir a ordem das lâminas">✕</button>
                  ) : null}
                  <button type="button" disabled={n.disabled} className="ct-flow-port"
                    aria-label={`Conectar destino padrão da etapa ${n.idx + 1}`}
                    onClick={event => event.currentTarget.parentElement?.querySelector<HTMLButtonElement>("[role=combobox]")?.focus()}
                    onPointerDown={(ev) => pegarBolinha(ev, n.idx, SAIDA_PADRAO, null, n.id, defaultDotY(n.exits.length))}
                    title="Arraste para escolher a lâmina que vem depois desta"
                  ><span /></button>
                </div>
              </div>
            );
          })}
        </div>

        {/* popup: soltou o cabo no vazio */}
        {menu ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-neutral-900/20 p-4" onPointerDown={(e) => e.stopPropagation()}>
            <div className="w-full max-w-sm rounded-xl border border-ct-line bg-ct-surface p-4 shadow-xl">
              <p className="text-sm font-bold text-ct-ink">Criar etapa e conectar</p>
              <p className="mt-0.5 text-[11px] text-ct-dim">Escolha o conteúdo da nova etapa.</p>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {TIPOS_RAPIDOS.map(([t, rotulo]) => (
                  <button key={t} onClick={() => criarEConectar(menu, t)}
                    className="flex items-center gap-2 rounded-lg border border-ct-line px-2 py-2 text-left text-xs text-ct-ink hover:border-ct-blue hover:bg-ct-raised">
                    <Layers size={14} aria-hidden="true"/>{rotulo}
                  </button>
                ))}
              </div>
              <button onClick={() => setMenu(null)} className="mt-3 w-full rounded-lg border border-ct-line px-2 py-1.5 text-xs font-semibold text-ct-dim hover:bg-ct-raised">
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        <p className="pointer-events-none absolute bottom-2 left-3 text-[10px] text-ct-dim">
          arraste o fundo para mover · scroll para deslocar · ctrl+scroll (ou pinça) para zoom
        </p>
      </div>
    </div>
  );
}
