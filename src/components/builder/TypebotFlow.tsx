"use client";

import { useMemo, useRef, useState } from "react";
import type { TbFunnel, TbGroup } from "@/lib/quiz/typebot/types";

const W = 250;            // largura do nó
const HEAD = 34;          // altura do cabeçalho do nó
const ROW = 26;           // altura de cada linha de bloco
const PAD = 12;           // padding vertical do corpo
const COL_GAP = 90;       // espaço horizontal entre colunas
const ROW_GAP = 260;      // espaço vertical entre nós da mesma coluna

interface Pt { x: number; y: number }

const ICON: Record<string, string> = {
  text: "💬", image: "🖼️", audio: "🎧", video: "🎬", voice: "🎤", embed: "🔗",
  date: "📅", call: "📞", system: "🔒", document: "📄", link: "🪧", location: "📍", contact: "👤",
  "input-text": "✏️", "input-number": "🔢", "input-email": "📧", "input-phone": "📱", "input-choice": "🔘",
  "input-url": "🌐", "input-date": "📆", "input-time": "🕐", "input-rating": "⭐", "input-picture": "🖼️", "input-cards": "🃏", "input-file": "📎",
  wait: "⏲️", "set-variable": "🧮", condition: "🔀", redirect: "↗️", vsl: "📺",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function preview(b: any): string {
  switch (b.type) {
    case "text": return (b.richText || "").replace(/\*\*/g, "").replace(/<[^>]+>/g, "").trim().slice(0, 38) || "(texto)";
    case "image": return "Imagem"; case "audio": return "Áudio"; case "video": return "Vídeo"; case "embed": return "Embed";
    case "voice": return `Nota de voz ${b.duration || ""}`; case "date": return b.label || "Data";
    case "call": return `Chamada de ${b.mode === "video" ? "vídeo" : "voz"}`; case "system": return `Aviso: ${b.variant}`;
    case "document": return b.name || "Documento"; case "link": return b.title || b.url || "Link";
    case "location": return b.address || "Localização"; case "contact": return b.name || "Contato";
    case "input-choice": return `Botões: ${(b.items || []).map((i: { label: string }) => i.label).join(" / ").slice(0, 26)}`;
    case "input-picture": return `Imagens: ${(b.items || []).map((i: { label: string }) => i.label).join(" / ").slice(0, 22)}`;
    case "input-cards": return `Cards (${(b.items || []).length})`;
    case "condition": return `Condição (${(b.items || []).length})`;
    case "wait": return `Esperar ${b.seconds}s`;
    case "set-variable": return `${b.variable} = ${(b.expression || "").slice(0, 16)}`;
    case "redirect": return `→ ${(b.url || "").slice(0, 22)}`;
    case "vsl": return "VSL (página)";
    default: return b.type?.startsWith("input-") ? `Resposta → {${b.variable || "?"}}` : b.type || "Bloco";
  }
}

/** Mapa visual do funil typebot: cada grupo = nó com seus blocos dentro; setas = edges.
 *  Layout em CAMADAS horizontais (esquerda→direita) + zoom. */
export default function TypebotFlow({ tb, setGroups, onSelect }: {
  tb: TbFunnel;
  setGroups: (gs: TbGroup[]) => void;
  onSelect: (groupId: string) => void;
}) {
  void setGroups;
  const groups = useMemo(() => tb.groups || [], [tb.groups]);
  const byId = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])), [groups]);
  const hOf = (g?: TbGroup) => HEAD + Math.max(1, g?.blocks.length || 1) * ROW + PAD;

  // saídas (edges) de cada grupo: to padrão + item.to de botões/condição
  const adj = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const g of groups) {
      m[g.id] = [];
      if (g.to) m[g.id].push(g.to);
      for (const b of g.blocks) if (b.type === "input-choice" || b.type === "condition") for (const it of b.items) if (it.to) m[g.id].push(it.to);
    }
    return m;
  }, [groups]);

  // layout em camadas: coluna = profundidade a partir do Start; linhas empilham na coluna
  const layout = useMemo(() => {
    const level: Record<string, number> = {};
    groups.forEach((g) => (level[g.id] = 0));
    const start = (tb.startGroup && byId[tb.startGroup]) ? tb.startGroup : groups[0]?.id;
    if (start) level[start] = 0;
    for (let pass = 0; pass < groups.length; pass++) {
      let changed = false;
      for (const g of groups) for (const t of adj[g.id] || []) if (byId[t] && level[t] < level[g.id] + 1) { level[t] = level[g.id] + 1; changed = true; }
      if (!changed) break;
    }
    const cols: Record<number, TbGroup[]> = {};
    groups.forEach((g) => { (cols[level[g.id]] = cols[level[g.id]] || []).push(g); });
    const m: Record<string, Pt> = {};
    Object.keys(cols).forEach((cs) => { const c = Number(cs); cols[c].forEach((g, r) => { m[g.id] = { x: 40 + c * (W + COL_GAP), y: 40 + r * ROW_GAP }; }); });
    return m;
  }, [groups, adj, byId, tb.startGroup]);

  const [pos, setPos] = useState<Record<string, Pt>>(layout);
  const [zoom, setZoom] = useState(0.85);
  const moved = useRef(false);

  const startDrag = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    moved.current = false;
    const o = pos[id] || { x: 40, y: 40 };
    const sx = e.clientX, sy = e.clientY;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - sx) > 3 || Math.abs(ev.clientY - sy) > 3) moved.current = true;
      setPos((p) => ({ ...p, [id]: { x: Math.max(8, o.x + (ev.clientX - sx) / zoom), y: Math.max(8, o.y + (ev.clientY - sy) / zoom) } }));
    };
    const up = () => { el.releasePointerCapture(e.pointerId); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
  };

  // arestas
  type Edge = { from: string; to: string; kind: "seq" | "branch"; bi: number };
  const edges: Edge[] = [];
  for (const g of groups) {
    if (g.to && byId[g.to]) edges.push({ from: g.id, to: g.to, kind: "seq", bi: 0 });
    let bi = 0;
    for (const b of g.blocks) if (b.type === "input-choice" || b.type === "condition") for (const it of b.items) { if (it.to && byId[it.to]) edges.push({ from: g.id, to: it.to, kind: "branch", bi: bi }); if (it.to) bi++; }
  }

  const maxX = Math.max(600, ...groups.map((g) => (pos[g.id]?.x || 0) + W + 120));
  const maxY = Math.max(500, ...groups.map((g) => (pos[g.id]?.y || 0) + hOf(g) + 80));

  const path = (e: Edge) => {
    const a = pos[e.from], b = pos[e.to]; if (!a || !b) return "";
    // saída pela DIREITA do nó de origem, entrada pela ESQUERDA do destino (horizontal)
    const y1 = e.kind === "branch" ? a.y + HEAD + 14 + e.bi * 16 : a.y + hOf(byId[e.from]) / 2;
    const x1 = a.x + W, x2 = b.x, y2 = b.y + hOf(byId[e.to]) / 2;
    const dx = Math.max(40, Math.abs(x2 - x1) / 2);
    return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
  };

  const relayout = () => setPos(layout);

  return (
    <div className="relative flex-1 overflow-auto bg-neutral-100" style={{ backgroundImage: "radial-gradient(#d4d4d4 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
      <div className="sticky left-0 top-0 z-20 flex items-center gap-2 p-2">
        <button onClick={relayout} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50">⇄ Auto-organizar</button>
        <div className="flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-1 py-0.5 shadow-sm">
          <button onClick={() => setZoom((z) => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))} className="grid h-6 w-6 place-items-center rounded text-sm font-bold text-neutral-700 hover:bg-neutral-100">−</button>
          <span className="w-10 text-center text-xs font-semibold text-neutral-600">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(1.6, Math.round((z + 0.1) * 10) / 10))} className="grid h-6 w-6 place-items-center rounded text-sm font-bold text-neutral-700 hover:bg-neutral-100">+</button>
        </div>
        <span className="text-xs text-neutral-500">Arraste os nós · clique para editar · zoom</span>
      </div>
      <div style={{ width: maxX * zoom, height: maxY * zoom }}>
        <div className="relative" style={{ width: maxX, height: maxY, transform: `scale(${zoom})`, transformOrigin: "0 0" }}>
          <svg className="pointer-events-none absolute inset-0" width={maxX} height={maxY}>
            <defs>
              <marker id="tbf-s" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#9ca3af" /></marker>
              <marker id="tbf-b" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#ea580c" /></marker>
            </defs>
            {edges.map((e, i) => (
              <path key={i} d={path(e)} fill="none" stroke={e.kind === "branch" ? "#ea580c" : "#9ca3af"} strokeWidth={2} markerEnd={`url(#${e.kind === "branch" ? "tbf-b" : "tbf-s"})`} />
            ))}
          </svg>
          {groups.map((g, gi) => {
            const p = pos[g.id]; if (!p) return null;
            const branchCount = g.blocks.reduce((n, b) => n + (b.type === "input-choice" || b.type === "condition" ? b.items.length : 0), 0);
            return (
              <div key={g.id} onPointerDown={startDrag(g.id)} onClick={() => { if (moved.current) { moved.current = false; return; } onSelect(g.id); }}
                className="absolute cursor-grab overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-md active:cursor-grabbing hover:border-violet-400"
                style={{ left: p.x, top: p.y, width: W }}>
                <div className="flex items-center justify-between border-b border-neutral-100 bg-violet-50 px-2.5 py-1.5">
                  <span className="truncate text-[12.5px] font-bold text-violet-900">{gi === 0 ? "▶ " : ""}{g.title}</span>
                  <span className="ml-1 shrink-0 text-[10px] text-violet-400">{g.blocks.length}</span>
                </div>
                <div className="px-1.5 py-1">
                  {g.blocks.length ? g.blocks.map((b) => (
                    <div key={b.id} className="flex items-center gap-1.5 rounded px-1 py-[3px]" style={{ height: ROW }}>
                      <span className="text-[12px] leading-none">{ICON[b.type] || "•"}</span>
                      <span className="truncate text-[11px] text-neutral-600">{preview(b)}</span>
                    </div>
                  )) : <div className="px-1 py-1 text-[11px] italic text-neutral-300">vazio</div>}
                </div>
                {g.to ? <span className="absolute h-2.5 w-2.5 rounded-full border-2 border-white" style={{ right: -6, top: hOf(g) / 2 - 5, background: "#9ca3af" }} /> : null}
                {Array.from({ length: branchCount }).map((_, k) => (
                  <span key={k} className="absolute h-2.5 w-2.5 rounded-full border-2 border-white" style={{ right: -6, top: HEAD + 9 + k * 16, background: "#ea580c" }} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
