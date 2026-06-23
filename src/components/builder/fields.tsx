"use client";

import { useEffect, useRef } from "react";
import type { QuizOption } from "@/lib/quiz/types";

// ── Editor de texto VISUAL (WYSIWYG fase 3b) ──────────────────────
// Mostra o texto JÁ FORMATADO (negrito/pílula), sem exibir os marcadores.
// Converte marcação -> HTML pra exibir e HTML -> marcação ao editar.
const PILL_CSS = "display:inline-block;border-radius:9px;padding:1px 8px;font-weight:800;color:#fff;background:linear-gradient(95deg,#e8842a,#f4b85c)";
const BOLD_CSS = "color:#e8842a;font-weight:800";

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function mdToHtml(md: string): string {
  let h = escHtml(md ?? "");
  h = h.replace(/==([^=\n]+)==/g, `<span data-pill="1" style="${PILL_CSS}">$1</span>`);
  h = h.replace(/\*\*([^*\n]+)\*\*/g, `<b data-bold="1" style="${BOLD_CSS}">$1</b>`);
  h = h.replace(/\*([^*\n]+)\*/g, `<b data-bold="1" style="${BOLD_CSS}">$1</b>`);
  h = h.replace(/\n/g, "<br>");
  return h;
}
function domToMd(el: Node): string {
  let out = "";
  el.childNodes.forEach((node) => {
    if (node.nodeType === 3) { out += node.textContent ?? ""; return; }
    if (node.nodeName === "BR") { out += "\n"; return; }
    const e = node as HTMLElement;
    const txt = e.textContent ?? "";
    if (e.dataset && e.dataset.pill) out += "==" + txt + "==";
    else if ((e.dataset && e.dataset.bold) || e.nodeName === "B" || e.nodeName === "STRONG") out += "**" + txt + "**";
    else if (e.nodeName === "DIV" || e.nodeName === "P") out += (out && !out.endsWith("\n") ? "\n" : "") + domToMd(e);
    else out += domToMd(e);
  });
  return out;
}

export function VisualRichField({ value, onChange, rows = 2, vars = ["nome"] }: { value?: string; onChange: (v: string) => void; rows?: number; vars?: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  // marcação → HTML quando o valor muda DE FORA (e o campo não está focado)
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const html = mdToHtml(value ?? "");
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [value]);

  const emit = () => { const el = ref.current; if (el) onChange(domToMd(el)); };

  const apply = (kind: "bold" | "pill") => {
    const el = ref.current; if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer) || range.collapsed) return;
    const text = range.toString();
    const node = document.createElement(kind === "pill" ? "span" : "b");
    node.setAttribute(kind === "pill" ? "data-pill" : "data-bold", "1");
    node.setAttribute("style", kind === "pill" ? PILL_CSS : BOLD_CSS);
    node.textContent = text;
    range.deleteContents();
    range.insertNode(node);
    sel.removeAllRanges();
    emit();
  };

  const insertVar = (vn: string) => {
    const el = ref.current; if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount && el.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(`{${vn}}`));
      sel.collapseToEnd();
    } else {
      el.appendChild(document.createTextNode(`{${vn}}`));
    }
    emit();
  };

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-300 bg-white focus-within:border-neutral-900">
      <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50 px-2 py-1">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => apply("bold")} className="grid h-6 w-6 place-items-center rounded font-bold hover:bg-neutral-200" title="Negrito (realce na cor do tema)">B</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => apply("pill")} className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ background: "linear-gradient(95deg,#e8842a,#f4b85c)" }} title="Destaque (pílula)">Destaque</button>
        {vars.map((vn) => (
          <button key={vn} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertVar(vn)} className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100" title={`Inserir {${vn}}`}>{`{${vn}}`}</button>
        ))}
        <span className="ml-auto text-[10px] text-neutral-400">edição visual</span>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning onInput={emit} onBlur={emit}
        className="w-full whitespace-pre-wrap break-words px-3 py-2 text-sm text-neutral-900 outline-none"
        style={{ minHeight: `${Math.max(2, rows) * 1.6}rem` }} />
    </div>
  );
}

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
export function RichField({ value, onChange, rows = 2, placeholder, vars = ["nome"] }: { value?: string; onChange: (v: string) => void; rows?: number; placeholder?: string; vars?: string[] }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const wrap = (mark: string) => {
    const el = ref.current; if (!el) return;
    const v = value ?? "";
    const s = el.selectionStart ?? v.length, e = el.selectionEnd ?? v.length;
    const sel = v.slice(s, e) || "texto";
    onChange(v.slice(0, s) + mark + sel + mark + v.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + mark.length, s + mark.length + sel.length); });
  };
  const insert = (text: string) => {
    const el = ref.current; if (!el) return;
    const v = value ?? "";
    const s = el.selectionStart ?? v.length, e = el.selectionEnd ?? v.length;
    onChange(v.slice(0, s) + text + v.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + text.length, s + text.length); });
  };
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-300 bg-white focus-within:border-neutral-900">
      <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50 px-2 py-1">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap("**")} className="grid h-6 w-6 place-items-center rounded font-bold hover:bg-neutral-200" title="Negrito (realce na cor do tema)">B</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap("==")} className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ background: "linear-gradient(95deg,#e8842a,#f4b85c)" }} title="Destaque (pílula gradiente)">Destaque</button>
        {vars.map((vn) => (
          <button key={vn} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(`{${vn}}`)} className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100" title={`Inserir a variável {${vn}}`}>{`{${vn}}`}</button>
        ))}
        <span className="ml-auto text-[10px] text-neutral-400">selecione e clique</span>
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
