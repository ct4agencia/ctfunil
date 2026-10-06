"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { InleadStep, Layer, LayerType } from "@/lib/quiz/layers/types";
import {
  FLOW, buildNodes, buildEdges, layout, edgePath, nodeH, EDGE_COLOR,
  rowY, defaultDotY, type FlowEdge,
} from "./graph";

/**
 * Aba FLUXO — quadro infinito, estilo Miro.
 *
 * O mapa antigo era uma espinha VERTICAL e desenhava uma seta por saída: seis
 * opções com destino "próxima" viravam seis curvas idênticas empilhadas. Aqui
 * cada nó tem UMA bolinha de saída padrão no rodapé (a que vale "independente
 * do botão clicado") e só as saídas com destino EXPLÍCITO ganham linha própria.
 *
 * Três coisas mudaram nesta versão:
 *  - **uma faixa só**: o layout não serpenteia mais (era o "quebrando na
 *    vertical"); o canvas cresce para a direita e quem navega é o pan/zoom;
 *  - **pan + zoom** por arrasto do fundo, scroll, pinça do touchpad e botões;
 *  - **arrastar a bolinha** para conectar numa lâmina existente, ou soltar no
 *    vazio para criar uma lâmina nova já conectada.
 *
 * As posições NÃO são persistidas: o layout é recalculado do grafo a cada
 * abertura, então editar o funil nunca deixa o mapa desatualizado.
 */

const Z_MIN = 0.2, Z_MAX = 2;
const trava = (z: number) => Math.max(Z_MIN, Math.min(Z_MAX, z));

/** Tipos oferecidos ao soltar a linha no vazio. Os mais usados, não todos —
 *  a paleta completa continua na aba Construtor. */
const TIPOS_RAPIDOS: [LayerType | "vazia", string][] = [
  ["options", "🗳️ Opções"],
  ["text", "📝 Texto"],
  ["image", "🖼️ Imagem"],
  ["field", "✏️ Campo"],
  ["button", "🔘 Botão"],
  ["video", "🎬 Vídeo"],
  ["loading", "⏳ Loading"],
  ["confirm", "🎉 Parabéns"],
  ["scratch", "🎟️ Raspadinha"],
  ["vsl", "🎥 VSL"],
  ["vazia", "⬜ Lâmina vazia"],
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
      title: (TIPOS_RAPIDOS.find(([t]) => t === tipo)?.[1] ?? "· Nova lâmina").replace(/^\S+\s/, ""),
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
    const a = ponto(e.from);
    const x1 = a.x + FLOW.W, y1 = a.y + e.fromY;
    if (!e.to) return { x1, y1, x2: x1 + 56, y2: y1 };     // link externo: toco curto
    const b = ponto(e.to);
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
    if (destino) setDest(lig.si, lig.layerId, lig.optId, destino);
    else setMenu(lig);       // soltou no vazio → oferece criar lâmina
    setLig(null); setAlvo(null);
  };

  /** começa a puxar um cabo a partir de uma bolinha */
  const pegarBolinha = (ev: React.PointerEvent, si: number, layerId: string, optId: string | null, nodeId: string, dy: number) => {
    ev.stopPropagation();
    ev.preventDefault();
    const p = ponto(nodeId);
    const m = paraCanvas(ev.clientX, ev.clientY);
    setLig({ si, layerId, optId, x0: p.x + FLOW.W, y0: p.y + dy, x: m.x, y: m.y });
  };

  const botao = "grid h-6 w-6 place-items-center rounded-lg border border-neutral-300 bg-white text-sm font-bold text-neutral-600 hover:bg-neutral-50";

  return (
    <div ref={areaRef} className="flex h-full flex-col">
      <style>{`
        @keyframes lf-dash { to { stroke-dashoffset: -24 } }
        .lf-edge { fill: none; stroke-width: 2; stroke-dasharray: 6 6 }
        .lf-run  { animation: lf-dash .9s linear infinite }
        @media (prefers-reduced-motion: reduce) { .lf-run { animation: none } }
      `}</style>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Fluxo</span>
        <span className="text-[11px] text-neutral-400">
          {nodes.length} lâminas · {edges.length} conexões
        </span>
        <div className="ml-auto flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4" style={{ background: EDGE_COLOR.seq }} />segue</span>
          <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4" style={{ background: EDGE_COLOR.jump }} />pula</span>
          <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4" style={{ background: EDGE_COLOR.back }} />volta</span>
          <button onClick={alternarAnim} className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 font-semibold text-neutral-600 hover:bg-neutral-50">
            {animar ? "✨ animação ligada" : "animação desligada"}
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => zoomNoCentro(1 / 1.2)} className={botao} title="Diminuir zoom">−</button>
            <span className="w-9 text-center tabular-nums text-neutral-500">{Math.round(view.z * 100)}%</span>
            <button onClick={() => zoomNoCentro(1.2)} className={botao} title="Aumentar zoom">+</button>
            <button onClick={ajustar} className="ml-1 rounded-lg border border-neutral-300 bg-white px-2 py-1 font-semibold text-neutral-600 hover:bg-neutral-50" title="Enquadrar o funil inteiro">ajustar</button>
          </div>
        </div>
      </div>

      <div
        ref={vpRef}
        onPointerDown={aoPegarFundo}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        className={`relative flex-1 overflow-hidden rounded-xl border border-neutral-200 ${pegando ? "cursor-grabbing" : "cursor-grab"}`}
        style={{
          backgroundColor: "#fafafa",
          backgroundImage: "radial-gradient(#d4d4d4 1px, transparent 1px)",
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
                <g key={e.id}>
                  <path d={d} className={`lf-edge ${correndo ? "lf-run" : ""}`} stroke={EDGE_COLOR[e.kind]} markerEnd={`url(#lf-${e.kind})`} />
                  {e.kind === "extern" ? (
                    <text x={x2 + 4} y={y2 + 3} fontSize="10" fill="#a3a3a3">🔗 sai do funil</text>
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
            const mirando = alvo === n.id && lig?.si !== n.idx;
            const arrastandoEste = posTemp?.id === n.id;
            return (
              <div
                key={n.id}
                data-node={n.id}
                className={`absolute rounded-xl border bg-white ${arrastandoEste ? "shadow-xl" : "shadow-sm"} ${n.disabled ? "border-dashed border-neutral-300 opacity-60" : "border-neutral-200"} ${mirando ? "ring-2 ring-orange-400" : ""}`}
                style={{ left: p.x, top: p.y, width: FLOW.W, height: nodeH(n.exits.length), zIndex: arrastandoEste ? 5 : undefined }}
              >
                <div
                  onPointerDown={(ev) => pegarNo(ev, n.id)}
                  onDoubleClick={() => onOpenStep?.(n.idx)}
                  className="flex w-full cursor-grab items-center gap-1.5 rounded-t-xl px-3 text-left hover:bg-neutral-50 active:cursor-grabbing"
                  style={{ height: FLOW.HEAD, touchAction: "none" }}
                  title="Arraste para posicionar · clique duas vezes para abrir no construtor"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-neutral-900 text-[10px] font-bold text-white">{n.idx + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-neutral-700">{n.title}</span>
                  {n.fixado ? (
                    <span role="button" tabIndex={0}
                      onPointerDown={(ev) => ev.stopPropagation()}
                      onClick={(ev) => { ev.stopPropagation(); soltarPos(n.id); }}
                      onKeyDown={(ev) => { if (ev.key === "Enter") soltarPos(n.id); }}
                      className="shrink-0 cursor-pointer text-[9px] opacity-60 hover:opacity-100"
                      title="Posição fixada à mão — clique para voltar ao layout automático">📌</span>
                  ) : null}
                  {n.disabled ? <span className="shrink-0 rounded bg-neutral-200 px-1 text-[9px] font-bold uppercase text-neutral-500">off</span> : null}
                </div>

                {/* SAÍDAS: uma linha por botão/opção */}
                {n.exits.map((x, k) => {
                  const explicito = !!x.dest && x.dest !== "next";
                  return (
                    <div key={x.key} className="flex items-center gap-1.5 px-3" style={{ height: FLOW.ROW }}>
                      <span className="shrink-0 text-[10px]">{x.icon}</span>
                      <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-600" title={x.label}>{x.label}</span>
                      {x.editable ? (
                        <select
                          value={/^https?:/.test(x.dest || "") ? "__url" : (x.dest || "next")}
                          onChange={(ev) => setDest(n.idx, x.layerId, x.optId, ev.target.value)}
                          className="max-w-[86px] shrink-0 truncate rounded border border-neutral-200 bg-white px-1 py-0.5 text-[10px] text-neutral-600"
                        >
                          <option value="next">→ próxima</option>
                          {steps.map((t, ti) => <option key={t.id} value={t.id}>↪ {ti + 1}. {String(t.title || t.id).replace(/<[^>]+>/g, "").slice(0, 22)}</option>)}
                          {/^https?:/.test(x.dest || "") ? <option value="__url">🔗 link</option> : null}
                        </select>
                      ) : (
                        // o runtime ignora o destino aqui — oferecer um seletor
                        // gravaria dado morto e o mapa mentiria
                        <span className="shrink-0 text-[9px] text-neutral-300" title="este bloco sempre vai para a próxima lâmina">fixo</span>
                      )}
                      {x.editable ? (
                        <span
                          onPointerDown={(ev) => pegarBolinha(ev, n.idx, x.layerId, x.optId, n.id, rowY(k))}
                          title="Arraste para uma lâmina — ou solte no vazio para criar uma"
                          className="shrink-0 cursor-crosshair rounded-full transition hover:scale-125"
                          style={{
                            width: 10, height: 10,
                            background: explicito ? EDGE_COLOR.jump : "transparent",
                            border: `2px solid ${explicito ? EDGE_COLOR.jump : "#cbd5e1"}`,
                          }}
                        />
                      ) : (
                        <span className="shrink-0 rounded-full" style={{ width: 8, height: 8, border: "2px solid #e5e5e5" }} />
                      )}
                    </div>
                  );
                })}

                {/* BOLINHA PADRÃO — a saída que vale "independente do botão
                    clicado". Sempre presente enquanto houver próxima lâmina. */}
                <div className="flex items-center gap-1.5 border-t border-neutral-100 px-3" style={{ height: FLOW.PADB }}>
                  <span className="flex-1 truncate text-[10px] text-neutral-400">
                    {steps[n.idx]?.nextStep ? "↪ segue para (fixado)" : n.proxima ? "→ próxima lâmina" : "🏁 fim do funil"}
                  </span>
                  {steps[n.idx]?.nextStep ? (
                    <button type="button" onClick={() => setSteps(steps.map((s, i) => i === n.idx ? { ...s, nextStep: undefined } : s))}
                      className="shrink-0 text-[9px] text-neutral-300 hover:text-red-500" title="Voltar a seguir a ordem das lâminas">✕</button>
                  ) : null}
                  <span
                    onPointerDown={(ev) => pegarBolinha(ev, n.idx, SAIDA_PADRAO, null, n.id, defaultDotY(n.exits.length))}
                    title="Arraste para escolher a lâmina que vem depois desta"
                    className="shrink-0 cursor-crosshair rounded-full transition hover:scale-125"
                    style={{
                      width: 10, height: 10, touchAction: "none",
                      background: steps[n.idx]?.nextStep ? EDGE_COLOR.jump : n.proxima ? EDGE_COLOR.seq : "transparent",
                      border: `2px solid ${steps[n.idx]?.nextStep ? EDGE_COLOR.jump : n.proxima ? EDGE_COLOR.seq : "#cbd5e1"}`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* popup: soltou o cabo no vazio */}
        {menu ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-neutral-900/20 p-4" onPointerDown={(e) => e.stopPropagation()}>
            <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-4 shadow-xl">
              <p className="text-sm font-bold text-neutral-800">Criar lâmina e conectar</p>
              <p className="mt-0.5 text-[11px] text-neutral-500">A nova lâmina entra no fim do funil, já ligada a esta saída.</p>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {TIPOS_RAPIDOS.map(([t, rotulo]) => (
                  <button key={t} onClick={() => criarEConectar(menu, t)}
                    className="rounded-lg border border-neutral-200 px-2 py-1.5 text-left text-xs text-neutral-700 hover:border-neutral-900 hover:bg-neutral-50">
                    {rotulo}
                  </button>
                ))}
              </div>
              <button onClick={() => setMenu(null)} className="mt-3 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs font-semibold text-neutral-500 hover:bg-neutral-50">
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        <p className="pointer-events-none absolute bottom-2 left-3 text-[10px] text-neutral-400">
          arraste o fundo para mover · scroll para deslocar · ctrl+scroll (ou pinça) para zoom
        </p>
      </div>
    </div>
  );
}
