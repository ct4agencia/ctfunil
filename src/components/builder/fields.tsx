"use client";

import { useRef } from "react";
import type { QuizOption } from "@/lib/quiz/types";

const base =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900";

export function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-semibold text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

export function Text({ value, onChange, placeholder }: { value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className={base} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Area({ value, onChange, rows = 3 }: { value?: string; onChange: (v: string) => void; rows?: number }) {
  return <textarea className={base} rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
}

/**
 * Campo de texto com TOOLBAR de formatação (estilo inlead, Fase 1 do WYSIWYG).
 * Negrito (**…**) e Destaque/pílula (==…==) envolvem o texto selecionado.
 * A renderização desses marcadores já existe no funil (RichText).
 */
export function RichField({ value, onChange, rows = 2, placeholder }: { value?: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const wrap = (mark: string) => {
    const el = ref.current; if (!el) return;
    const v = value ?? "";
    const s = el.selectionStart ?? v.length, e = el.selectionEnd ?? v.length;
    const sel = v.slice(s, e) || "texto";
    onChange(v.slice(0, s) + mark + sel + mark + v.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + mark.length, s + mark.length + sel.length); });
  };
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-300 bg-white focus-within:border-neutral-900">
      <div className="flex items-center gap-1 border-b border-neutral-200 bg-neutral-50 px-2 py-1">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap("**")} className="grid h-6 w-6 place-items-center rounded font-bold hover:bg-neutral-200" title="Negrito (realce na cor do tema)">B</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap("==")} className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ background: "linear-gradient(95deg,#e8842a,#f4b85c)" }} title="Destaque (pílula gradiente)">Destaque</button>
        <span className="ml-auto text-[10px] text-neutral-400">selecione o texto e clique</span>
      </div>
      <textarea ref={ref} className="w-full resize-y px-3 py-2 text-sm text-neutral-900 outline-none" rows={rows} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Num({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return <input type="number" className={base} value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} />;
}

export function Toggle({ label, value, onChange }: { label: string; value?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-neutral-900" />
      {label}
    </label>
  );
}

export function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <select className={base} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/** Lista editável de strings (galeria de imagens, slides de loading, etc.). */
export function StringList({ items, onChange, placeholder, addLabel }: { items: string[]; onChange: (v: string[]) => void; placeholder?: string; addLabel?: string }) {
  const set = (i: number, v: string) => onChange(items.map((x, k) => (k === i ? v : x)));
  const add = () => onChange([...items, ""]);
  const remove = (i: number) => onChange(items.filter((_, k) => k !== i));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className={base} value={it} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} />
          <button type="button" onClick={() => remove(i)} className="shrink-0 rounded-md px-2 py-1 text-sm text-red-500">✕</button>
        </div>
      ))}
      <button type="button" onClick={add} className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-semibold text-white">+ {addLabel ?? "Adicionar"}</button>
    </div>
  );
}

/** Lista de opções de pergunta (emoji + texto). */
export function OptionsList({ items, onChange }: { items: QuizOption[]; onChange: (v: QuizOption[]) => void }) {
  const set = (i: number, patch: Partial<QuizOption>) => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const add = () => onChange([...items, { label: "Nova opção" }]);
  const remove = (i: number) => onChange(items.filter((_, k) => k !== i));
  return (
    <div className="space-y-2">
      {items.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className={`${base} w-14 text-center`} value={o.emoji ?? ""} placeholder="🙂" onChange={(e) => set(i, { emoji: e.target.value })} />
          <input className={base} value={o.label} onChange={(e) => set(i, { label: e.target.value })} />
          <button type="button" onClick={() => remove(i)} disabled={items.length <= 1} className="shrink-0 rounded-md px-2 py-1 text-sm text-red-500 disabled:opacity-30">✕</button>
        </div>
      ))}
      <button type="button" onClick={add} className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-semibold text-white">+ Opção</button>
    </div>
  );
}
