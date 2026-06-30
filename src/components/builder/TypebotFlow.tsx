"use client";

import { useMemo, useRef, useState } from "react";
import type { TbFunnel, TbGroup } from "@/lib/quiz/typebot/types";

const W = 230;   // largura do nó
const H = 74;    // altura assumida p/ ancorar as setas

interface Pt { x: number; y: number }

/** Mapa visual do funil typebot: grupos = nós, setas = edges (to padrão + item.to). */
export default function TypebotFlow({ tb, setGroups, onSelect }: {
  tb: TbFunnel;
  setGroups: (gs: TbGroup[]) => void;
  onSelect: (groupId: string) => void;
}) {
  const groups = tb.groups || [];
  // posições: usa g.x/g.y; se vierem todas iguais (layout linear antigo), arruma vertical
  const initial = useMemo(() => {
    const flat = groups.length > 1 && groups.every((g) => g.y === groups[0].y);
    const m: Record<string, Pt> = {};
    groups.forEach((g, i) => { m[g.id] = flat ? { x: 80, y: 40 + i * 120 } : { x: g.x ?? 80, y: g.y ?? 40 + i * 120 }; });
    return m;
  }, [groups]);
  const [pos, setPos] = useState<Record<string, Pt>>(initial);
  const dragId = useRef<string | null>(null);

  const persist = (p: Record<string, Pt>) => setGroups(groups.map((g) => (p[g.id] ? { ...g, x: p[g.id].x, y: p[g.id].y } : g)));

  const startDrag = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragId.current = id;
    const o = pos[id] || { x: 80, y: 40 };
    const sx = e.clientX, sy = e.clientY;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => setPos((p) => ({ ...p, [id]: { x: Math.max(8, o.x + (ev.clientX - sx)), y: Math.max(8, o.y + (ev.clientY - sy)) } }));
    const up = () => { dragId.current = null; el.releasePointerCapture(e.pointerId); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); setPos((p) => { persist(p); return p; }); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
  };

  // arestas: to padrão (cinza) + saídas de botões/condição (laranja)
  type Edge = { from: string; to: string; kind: "seq" | "branch" };
  const edges: Edge[] = [];
  const seen = new Set<string>();
  const addEdge = (from: string, to: string | undefined, kind: Edge["kind"]) => {
    if (!to || !pos[to] || !pos[from]) return;
    const key = `${from}>${to}>${kind}`; if (seen.has(key)) return; seen.add(key);
    edges.push({ from, to, kind });
  };
  for (const g of groups) {
    addEdge(g.id, g.to, "seq");
    for (const b of g.blocks) {
      if (b.type === "input-choice") b.items.forEach((it) => addEdge(g.id, it.to, "branch"));
      if (b.type === "condition") b.items.forEach((it) => addEdge(g.id, it.to, "branch"));
    }
  }

  const maxX = Math.max(400, ...Object.values(pos).map((p) => p.x + W + 80));
  const maxY = Math.max(400, ...Object.values(pos).map((p) => p.y + H + 120));

  const path = (a: Pt, b: Pt) => {
    const x1 = a.x + W / 2, y1 = a.y + H, x2 = b.x + W / 2, y2 = b.y;
    const dy = Math.max(40, (y2 - y1) / 2);
    return `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`;
  };

  const autoLayout = () => {
    const p: Record<string, Pt> = {};
    groups.forEach((g, i) => { p[g.id] = { x: 80, y: 40 + i * 120 }; });
    setPos(p); persist(p);
  };

  return (
    <div className="relative flex-1 overflow-auto bg-neutral-100" style={{ backgroundImage: "radial-gradient(#d4d4d4 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
      <div className="sticky left-0 top-0 z-10 flex items-center gap-2 p-2">
        <button onClick={autoLayout} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50">↕ Auto-organizar</button>
        <span className="text-xs text-neutral-500">Arraste os nós · clique para editar o grupo</span>
      </div>
      <div className="relative" style={{ width: maxX, height: maxY }}>
        <svg className="pointer-events-none absolute inset-0" width={maxX} height={maxY}>
          <defs>
            <marker id="tb-arrow" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#9ca3af" /></marker>
            <marker id="tb-arrow-b" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#ea580c" /></marker>
          </defs>
          {edges.map((e, i) => (
            <path key={i} d={path(pos[e.from], pos[e.to])} fill="none"
              stroke={e.kind === "branch" ? "#ea580c" : "#9ca3af"} strokeWidth={2}
              markerEnd={`url(#${e.kind === "branch" ? "tb-arrow-b" : "tb-arrow"})`} />
          ))}
        </svg>
        {groups.map((g, i) => {
          const p = pos[g.id]; if (!p) return null;
          const first = g.blocks.find((b) => b.type === "text") as { richText?: string } | undefined;
          const exits = g.blocks.reduce((n, b) => n + (b.type === "input-choice" ? b.items.length : b.type === "condition" ? b.items.length : 0), 0);
          return (
            <div key={g.id} onPointerDown={startDrag(g.id)} onClick={() => onSelect(g.id)}
              className="absolute cursor-grab rounded-xl border border-neutral-300 bg-white p-2.5 shadow-sm active:cursor-grabbing hover:border-violet-400"
              style={{ left: p.x, top: p.y, width: W }}>
              <div className="flex items-center justify-between">
                <span className="truncate text-sm font-bold text-neutral-900">{i === 0 ? "▶ " : ""}{g.title}</span>
                <span className="ml-1 shrink-0 text-[10px] text-neutral-400">{g.blocks.length}b</span>
              </div>
              {first?.richText ? <p className="mt-1 line-clamp-2 text-[11px] text-neutral-500">{first.richText.replace(/\*\*/g, "")}</p> : null}
              {exits > 0 ? <p className="mt-1 text-[10px] font-semibold text-orange-500">{exits} saída(s)</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
