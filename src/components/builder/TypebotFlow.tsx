"use client";

import { useMemo, useRef, useState } from "react";
import type { TbFunnel, TbGroup } from "@/lib/quiz/typebot/types";

const W = 250;            // largura do nó
const HEAD = 34;          // altura do cabeçalho do nó
const ROW = 26;           // altura de cada linha de bloco
const PAD = 12;           // padding vertical do corpo

interface Pt { x: number; y: number }

const ICON: Record<string, string> = {
  text: "💬", image: "🖼️", audio: "🎧", video: "🎬", voice: "🎤", embed: "🔗",
  date: "📅", call: "📞", system: "🔒", document: "📄", link: "🪧", location: "📍", contact: "👤",
  "input-text": "✏️", "input-number": "🔢", "input-email": "📧", "input-phone": "📱", "input-choice": "🔘",
  "input-url": "🌐", "input-date": "📆", "input-time": "🕐", "input-rating": "⭐", "input-picture": "🖼️", "input-cards": "🃏", "input-file": "📎",
  wait: "⏲️", "set-variable": "🧮", condition: "🔀", redirect: "↗️",
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
    default: return b.type?.startsWith("input-") ? `Resposta → {${b.variable || "?"}}` : b.type || "Bloco";
  }
}

/** Mapa visual do funil typebot: cada grupo = nó com seus blocos dentro; setas = edges. */
export default function TypebotFlow({ tb, setGroups, onSelect }: {
  tb: TbFunnel;
  setGroups: (gs: TbGroup[]) => void;
  onSelect: (groupId: string) => void;
}) {
  const groups = tb.groups || [];
  const byId = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])), [groups]);
  const hOf = (g?: TbGroup) => HEAD + Math.max(1, g?.blocks.length || 1) * ROW + PAD;

  const initial = useMemo(() => {
    const flat = groups.length > 1 && groups.every((g) => g.y === groups[0].y);
    const m: Record<string, Pt> = {};
    let y = 40;
    groups.forEach((g) => { m[g.id] = flat ? { x: 80, y } : { x: g.x ?? 80, y: g.y ?? y }; y += hOf(g) + 56; });
    return m;
  }, [groups]); // eslint-disable-line react-hooks/exhaustive-deps
  const [pos, setPos] = useState<Record<string, Pt>>(initial);
  const moved = useRef(false);

  const persist = (p: Record<string, Pt>) => setGroups(groups.map((g) => (p[g.id] ? { ...g, x: p[g.id].x, y: p[g.id].y } : g)));

  const startDrag = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    moved.current = false;
    const o = pos[id] || { x: 80, y: 40 };
    const sx = e.clientX, sy = e.clientY;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - sx) > 3 || Math.abs(ev.clientY - sy) > 3) moved.current = true;
      setPos((p) => ({ ...p, [id]: { x: Math.max(8, o.x + (ev.clientX - sx)), y: Math.max(8, o.y + (ev.clientY - sy)) } }));
    };
    const up = () => { el.releasePointerCapture(e.pointerId); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); setPos((p) => { persist(p); return p; }); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
  };

  // arestas: to padrão (cinza, sai pela base) + saídas de botões/condição (laranja, saem pela direita)
  type Edge = { from: string; to: string; kind: "seq" | "branch"; bi: number };
  const edges: Edge[] = [];
  const seen = new Set<string>();
  for (const g of groups) {
    if (g.to && byId[g.to]) { const k = `${g.id}>${g.to}>s`; if (!seen.has(k)) { seen.add(k); edges.push({ from: g.id, to: g.to, kind: "seq", bi: 0 }); } }
    let bi = 0;
    for (const b of g.blocks) {
      const items = b.type === "input-choice" || b.type === "condition" ? b.items : [];
      for (const it of items) { if (it.to && byId[it.to]) { edges.push({ from: g.id, to: it.to, kind: "branch", bi: bi++ }); } else if (it.to === undefined) { /* segue padrão */ } }
    }
  }

  const maxX = Math.max(500, ...Object.values(pos).map((p) => p.x + W + 120));
  const maxY = Math.max(500, ...groups.map((g) => (pos[g.id]?.y || 0) + hOf(g) + 80));

  const path = (e: Edge) => {
    const a = pos[e.from], b = pos[e.to]; if (!a || !b) return "";
    if (e.kind === "seq") {
      const x1 = a.x + W / 2, y1 = a.y + hOf(byId[e.from]), x2 = b.x + W / 2, y2 = b.y;
      const dy = Math.max(30, Math.abs(y2 - y1) / 2);
      return `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`;
    }
    const x1 = a.x + W, y1 = a.y + HEAD + 14 + e.bi * 16, x2 = b.x, y2 = b.y + hOf(byId[e.to]) / 2;
    const dx = Math.max(40, Math.abs(x2 - x1) / 2);
    return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
  };

  const autoLayout = () => {
    const p: Record<string, Pt> = {}; let y = 40;
    groups.forEach((g) => { p[g.id] = { x: 80, y }; y += hOf(g) + 56; });
    setPos(p); persist(p);
  };

  return (
    <div className="relative flex-1 overflow-auto bg-neutral-100" style={{ backgroundImage: "radial-gradient(#d4d4d4 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
      <div className="sticky left-0 top-0 z-20 flex items-center gap-2 p-2">
        <button onClick={autoLayout} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50">↕ Auto-organizar</button>
        <span className="text-xs text-neutral-500">Arraste os nós · clique para editar o grupo</span>
      </div>
      <div className="relative" style={{ width: maxX, height: maxY }}>
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
              {/* saída padrão (base) */}
              {g.to ? <span className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-white" style={{ bottom: -6, background: "#9ca3af" }} /> : null}
              {/* saídas de ramificação (direita) */}
              {Array.from({ length: branchCount }).map((_, k) => (
                <span key={k} className="absolute h-2.5 w-2.5 rounded-full border-2 border-white" style={{ right: -6, top: HEAD + 9 + k * 16, background: "#ea580c" }} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
