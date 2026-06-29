"use client";

import { useEffect, useRef, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Funnel } from "@/lib/quiz/types";
import type { InleadStep, Layer, LayerType } from "@/lib/quiz/layers/types";
import LayersRunner from "@/components/quiz/layers/LayersRunner";
import FunnelSettingsPanel from "@/components/builder/FunnelSettingsPanel";
import { saveFunnelAction } from "@/app/builder/[slug]/actions";

function genId() {
  try { return crypto.randomUUID().slice(0, 8); } catch { return `l-${Math.random().toString(36).slice(2, 10)}`; }
}
const strip = (h?: string) => (h || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const BLOCK_META: Record<string, { icon: string; label: string }> = {
  text: { icon: "🔤", label: "Texto" }, image: { icon: "🖼️", label: "Imagem" }, button: { icon: "🔘", label: "Botão" },
  options: { icon: "☑️", label: "Opções" }, field: { icon: "📝", label: "Campo" }, alert: { icon: "⚠️", label: "Alerta" },
  timer: { icon: "⏱️", label: "Timer" }, loading: { icon: "⏳", label: "Loading" }, notification: { icon: "🔔", label: "Notificação" },
  graphics: { icon: "📊", label: "Gráfico" }, clear: { icon: "↕️", label: "Espaço" }, embed: { icon: "▶️", label: "Vídeo/Embed" },
  video: { icon: "▶️", label: "Vídeo" }, roulette: { icon: "🎡", label: "Roleta" }, slider: { icon: "🎚️", label: "Slider" },
  carousel: { icon: "🎠", label: "Carrossel" },
};
/** Paleta categorizada (ordem/categorias dos prints do inlead). */
const CATS: { name: string; items: [string, string][] }[] = [
  { name: "Formulário", items: [["field", "Campo"], ["email", "E-mail"], ["phone", "Telefone"], ["button", "Botão"], ["number", "Número"], ["textarea", "Textarea"], ["date", "Data"], ["height", "Altura"], ["weight", "Peso"]] },
  { name: "Quiz", items: [["options", "Opções"], ["multi", "Múltipla Escolha"], ["single", "Escolha Única"], ["yesno", "Sim/Não"], ["videoanswer", "Vídeo Resposta"]] },
  { name: "Mídia e conteúdo", items: [["text", "Texto"], ["image", "Imagem"], ["video", "Vídeo"], ["audio", "Áudio"]] },
  { name: "Atenção", items: [["alert", "Alerta"], ["notification", "Notificação"], ["timer", "Timer"], ["loading", "Loading"], ["level", "Nível"]] },
  { name: "Argumentação", items: [["arguments", "Argumentos"], ["testimonials", "Depoimentos"], ["faq", "FAQ"], ["price", "Preço"], ["checklist", "Checklist"], ["beforeafter", "Antes/Depois"], ["carousel", "Carrossel"]] },
  { name: "Gráficos", items: [["graphics", "Métricas"], ["charts", "Gráficos"]] },
  { name: "Personalização", items: [["clear", "Espaço"], ["html", "HTML/Script"]] },
];
const PALETTE_ICON: Record<string, string> = {
  field: "📝", email: "✉️", phone: "📞", button: "🔘", number: "🔢", textarea: "📄", date: "📅", height: "📏", weight: "⚖️",
  options: "☑️", multi: "🗂️", single: "⚪", yesno: "🔀", videoanswer: "🎬", text: "🔤", image: "🖼️", video: "▶️", audio: "🔊",
  alert: "⚠️", notification: "🔔", timer: "⏱️", loading: "⏳", level: "📶", arguments: "💬", testimonials: "⭐", faq: "❓",
  price: "💲", checklist: "✅", beforeafter: "🔁", carousel: "🎠", graphics: "📊", charts: "📈", clear: "↕️", html: "▟",
};
/** Tipos que o construtor já adiciona funcionais (o resto é "em breve"). */
const ADDABLE = new Set(["text", "image", "button", "options", "field", "alert", "timer", "loading", "clear", "embed", "email", "phone", "video", "carousel"]);

function newLayer(type: LayerType): Layer {
  const id = genId();
  const base = { id, type, content: { id: genId() } } as Layer;
  switch (type) {
    case "text": return { ...base, content: { id, text: "<p class=\"ql-align-center\">Novo texto</p>" } };
    case "alert": return { ...base, design: { style: "danger", padding: 14 }, content: { id, text: "<p class=\"ql-align-center\">Aviso importante</p>" } };
    case "button": return { ...base, design: { style: "success", basis: 100, pulse: true, backgroundColor: "#ea580c", color: "#FFFFFF" }, content: { id, label: "Continuar", type: "next", destination: "next" } };
    case "image": return { ...base, design: { basis: 100 }, content: { id, image: { type: "image", src: "" } } };
    case "options": return { ...base, design: { background: "contrast", icon: "right", iconPosition: "start", border: "border-[2px]" }, content: { id, cols: "grid-cols-1", options: [{ id: genId(), label: "<p>Opção 1</p>", destination: "next" }, { id: genId(), label: "<p>Opção 2</p>", destination: "next" }] } };
    case "field": return { ...base, content: { id, name: "telefone", title: "Seu WhatsApp (com DDD)", placeholder: "(00) 00000-0000", type: "phone", mask: "phone_br", required: true } };
    case "timer": return { ...base, design: { backgroundColor: "#e3eeff", color: "#1c72f1", borderColor: "#c7dcfe", padding: 10 }, content: { id, text: "<p><strong>Oferta acaba em: [time]</strong></p>", time: 300 } };
    case "loading": return { ...base, content: { id, title: "Carregando…", seconds: 4, type: "none", show_title: true, show_percent: true, show_progress: true } };
    case "clear": return { ...base, content: { id, clear: "h-[1rem]" } };
    case "carousel": return { ...base, design: { basis: 100 }, content: { id, images: [], interval: 2 } };
    case "embed": case "video": return { ...base, content: { id, embedHtml: "" } };
    default: return base;
  }
}

/** contentEditable WYSIWYG simples (negrito + cor) que devolve o HTML. */
function HtmlField({ value, onChange, theme = "#ea580c" }: { value?: string; onChange: (v: string) => void; theme?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // contentEditable NÃO-controlado: re-sincroniza o HTML SÓ quando a mudança vem de
  // fora (ex: alinhamento na aba Aparência) E o campo NÃO está focado. Enquanto você
  // digita (campo focado), nunca re-seta → não reposiciona o cursor.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== (value || "")) el.innerHTML = value || "";
  }, [value]);
  const cmd = (c: string, v?: string) => { ref.current?.focus(); document.execCommand(c, false, v); if (ref.current) onChange(ref.current.innerHTML); };
  return (
    <div>
      <div className="mb-1 flex gap-1">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("bold"); }} className="rounded border border-neutral-300 px-2 py-0.5 text-xs font-bold">B</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("foreColor", theme); }} className="rounded border border-neutral-300 px-2 py-0.5 text-xs font-bold" style={{ color: theme }}>Cor</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("foreColor", "#000000"); }} className="rounded border border-neutral-300 px-2 py-0.5 text-xs">Preto</button>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML || "")}
        className="min-h-[44px] rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900" />
    </div>
  );
}

function ImageField({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const up = async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (j.url) onChange(j.url);
    } catch { /* noop */ }
    setBusy(false);
  };
  return (
    <div className="space-y-1.5">
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="https://…/imagem.jpg" className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs" />
      <label className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-neutral-900 px-2 py-1 text-xs font-semibold text-white">
        {busy ? "Enviando…" : "⬆ Upload"}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && up(e.target.files[0])} />
      </label>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="mt-1 max-h-24 rounded-md border border-neutral-200 object-contain" />
      ) : null}
    </div>
  );
}

const Lbl = ({ children }: { children: React.ReactNode }) => <label className="mb-1 mt-2 block text-[11px] font-semibold text-neutral-500">{children}</label>;
const inp = "w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs";

/** Lê/escreve o alinhamento (classe ql-align-*) no HTML do bloco. */
function htmlAlign(html?: string): "left" | "center" | "right" {
  const m = (html || "").match(/ql-align-(center|right)/);
  return (m?.[1] as "center" | "right") || "left";
}
function setHtmlAlign(html: string, align: "left" | "center" | "right"): string {
  if (typeof document === "undefined") return html;
  const div = document.createElement("div");
  div.innerHTML = html || "";
  div.querySelectorAll("p,h1,h2,h3").forEach((el) => {
    el.classList.remove("ql-align-center", "ql-align-right", "ql-align-justify");
    if (align !== "left") el.classList.add(`ql-align-${align}`);
  });
  return div.innerHTML;
}

/** Painel "Aparência" do bloco (alinhamento + largura). */
function Appearance({ layer, onChange }: { layer: Layer; onChange: (l: Layer) => void }) {
  const hasText = typeof layer.content.text === "string";
  const align = hasText ? htmlAlign(layer.content.text) : "left";
  const basis = Number(layer.design?.basis) || 100;
  const setAlign = (a: "left" | "center" | "right") => onChange({ ...layer, content: { ...layer.content, text: setHtmlAlign(layer.content.text || "", a) } });
  const setBasis = (b: number) => onChange({ ...layer, design: { ...(layer.design || {}), basis: b } });
  return (
    <div className="mt-3 border-t border-neutral-200 pt-2">
      <Lbl>Aparência</Lbl>
      {hasText ? (
        <div className="mb-2 flex gap-1">
          {([["left", "⬅"], ["center", "↔"], ["right", "➡"]] as const).map(([a, ic]) => (
            <button key={a} onClick={() => setAlign(a)} className={`flex-1 rounded border px-2 py-1 text-xs ${align === a ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"}`}>{ic}</button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-neutral-500">Largura {basis}%</span>
        <input type="range" min={40} max={100} value={basis} onChange={(e) => setBasis(Number(e.target.value))} className="flex-1" />
      </div>
    </div>
  );
}

/** Linha arrastável (render-prop injeta o "handle" ⠿). */
function SortableItem({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = <span {...attributes} {...listeners} className="cursor-grab select-none text-neutral-300 hover:text-neutral-500" title="Arrastar">⠿</span>;
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>{children(handle)}</div>;
}

/** Aba "Componente": campos de conteúdo por tipo de bloco. */
function LayerFields({ layer, steps, onChange }: { layer: Layer; steps: InleadStep[]; onChange: (l: Layer) => void }) {
  const c = layer.content;
  const setC = (patch: Record<string, unknown>) => onChange({ ...layer, content: { ...c, ...patch } });
  const setD = (patch: Record<string, unknown>) => onChange({ ...layer, design: { ...(layer.design || {}), ...patch } });
  const destOptions = (
    <>
      <option value="next">→ Próxima lâmina</option>
      {steps.map((s) => <option key={s.id} value={s.id}>↪ {s.title || s.id}</option>)}
    </>
  );

  switch (layer.type) {
    case "text":
      return (<><Lbl>Texto</Lbl><HtmlField value={c.text} onChange={(v) => setC({ text: v })} /></>);
    case "alert":
      return (<>
        <Lbl>Estilo</Lbl>
        <select value={layer.design?.style || "danger"} onChange={(e) => setD({ style: e.target.value })} className={inp}>
          <option value="danger">Destaque (laranja)</option><option value="success">Sucesso (verde)</option><option value="theme">Tema</option><option value="default">Neutro</option>
        </select>
        <Lbl>Texto do alerta</Lbl><HtmlField value={c.text} onChange={(v) => setC({ text: v })} />
      </>);
    case "button":
      return (<>
        <Lbl>Rótulo do botão</Lbl><input value={c.label || ""} onChange={(e) => setC({ label: e.target.value })} className={inp} />
        <Lbl>Ícone / emoji (opcional, antes do texto)</Lbl><input value={c.icon || ""} onChange={(e) => setC({ icon: e.target.value })} placeholder="ex: 👉 🔥 ✅" className={inp} />
        <Lbl>Cor do botão</Lbl>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-neutral-600"><input type="color" value={layer.design?.backgroundColor || "#ea580c"} onChange={(e) => setD({ backgroundColor: e.target.value })} className="h-7 w-9 cursor-pointer rounded border border-neutral-300" /> Fundo</label>
          <label className="flex items-center gap-1.5 text-xs text-neutral-600"><input type="color" value={layer.design?.color || "#ffffff"} onChange={(e) => setD({ color: e.target.value })} className="h-7 w-9 cursor-pointer rounded border border-neutral-300" /> Texto</label>
        </div>
        <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
          <input type="checkbox" checked={!!layer.design?.borderColor} onChange={(e) => setD({ borderColor: e.target.checked ? (layer.design?.backgroundColor || "#ea580c") : undefined, backgroundColor: e.target.checked ? "transparent" : (layer.design?.borderColor || "#ea580c") })} className="h-3.5 w-3.5 accent-neutral-900" /> Botão vazado (só contorno)
        </label>
        <Lbl>Ao clicar</Lbl>
        <select value={/^https?:/.test(c.destination || "") ? "__url" : (c.destination || "next")} onChange={(e) => setC({ destination: e.target.value === "__url" ? "https://" : e.target.value })} className={inp}>
          {destOptions}<option value="__url">🔗 Link externo (checkout)</option>
        </select>
        {/^https?:/.test(c.destination || "") ? <input value={c.destination} onChange={(e) => setC({ destination: e.target.value })} placeholder="https://pay.hotmart.com/…" className={`${inp} mt-1`} /> : null}
        <Lbl>Revelar após (s) — pitch da VSL (0 = já)</Lbl><input type="number" value={c.revealAt ?? 0} onChange={(e) => setC({ revealAt: Number(e.target.value) })} className={inp} />
      </>);
    case "image":
      return (<><Lbl>Imagem</Lbl><ImageField value={c.image?.src || ""} onChange={(v) => setC({ image: { ...(c.image || {}), type: "image", src: v } })} />
        <Lbl>Largura (%)</Lbl><input type="number" value={layer.design?.basis ?? 100} onChange={(e) => setD({ basis: Number(e.target.value) })} className={inp} /></>);
    case "field":
      return (<>
        <Lbl>Tipo</Lbl>
        <select value={c.type || "text"} onChange={(e) => setC({ type: e.target.value, mask: e.target.value === "phone" ? "phone_br" : undefined, name: e.target.value === "phone" ? "telefone" : e.target.value === "email" ? "email" : "nome" })} className={inp}>
          <option value="text">Nome</option><option value="phone">Telefone</option><option value="email">Email</option>
        </select>
        <Lbl>Rótulo</Lbl><input value={c.title || ""} onChange={(e) => setC({ title: e.target.value })} className={inp} />
        <Lbl>Placeholder</Lbl><input value={c.placeholder || ""} onChange={(e) => setC({ placeholder: e.target.value })} className={inp} />
      </>);
    case "options":
      return (<>
        <Lbl>Colunas</Lbl>
        <select value={c.cols || "grid-cols-1"} onChange={(e) => setC({ cols: e.target.value })} className={inp}>
          <option value="grid-cols-1">1 (empilhado)</option><option value="grid-cols-2">2</option><option value="grid-cols-3">3</option>
        </select>
        <Lbl>Opções</Lbl>
        <div className="space-y-1.5">
          {(c.options || []).map((o, i) => (
            <div key={o.id} className="flex items-center gap-1">
              <input value={strip(o.label)} onChange={(e) => setC({ options: c.options!.map((x, k) => k === i ? { ...x, label: `<p>${e.target.value}</p>` } : x) })} className={`${inp} flex-1`} />
              <button onClick={() => setC({ options: c.options!.filter((_, k) => k !== i) })} className="px-1 text-red-400">✕</button>
            </div>
          ))}
          <button onClick={() => setC({ options: [...(c.options || []), { id: genId(), label: "<p>Nova opção</p>", destination: "next" }] })} className="rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-500">+ opção</button>
        </div>
      </>);
    case "timer":
      return (<><Lbl>Tempo (segundos)</Lbl><input type="number" value={c.time ?? 300} onChange={(e) => setC({ time: Number(e.target.value) })} className={inp} />
        <Lbl>Texto (use [time])</Lbl><HtmlField value={c.text} onChange={(v) => setC({ text: v })} /></>);
    case "loading":
      return (<><Lbl>Título</Lbl><input value={c.title || ""} onChange={(e) => setC({ title: e.target.value })} className={inp} />
        <Lbl>Duração (s)</Lbl><input type="number" value={c.seconds ?? 4} onChange={(e) => setC({ seconds: Number(e.target.value) })} className={inp} />
        <Lbl>Auto-avançar ao terminar?</Lbl>
        <select value={c.type === "none" ? "no" : "yes"} onChange={(e) => setC({ type: e.target.value === "no" ? "none" : "advance" })} className={inp}><option value="no">Não (revela a lâmina)</option><option value="yes">Sim</option></select></>);
    case "clear":
      return (<><Lbl>Altura</Lbl>
        <select value={c.clear || "h-[1rem]"} onChange={(e) => setC({ clear: e.target.value })} className={inp}>
          {["h-[0.5rem]", "h-[1rem]", "h-[2rem]", "h-[3rem]"].map((h) => <option key={h} value={h}>{h.replace(/h-\[|\]/g, "")}</option>)}
        </select></>);
    case "embed": case "video":
      return (<><Lbl>Embed do player (cole o &lt;script&gt;+&lt;iframe&gt; do VTurb)</Lbl>
        <textarea value={c.embedHtml || ""} onChange={(e) => setC({ embedHtml: e.target.value })} rows={5} className={`${inp} font-mono`} /></>);
    case "carousel": {
      const imgs: string[] = (c.images as string[]) || [];
      return (<>
        <Lbl>Passar a cada (segundos)</Lbl>
        <input type="number" min={1} value={Number(c.interval) || 2} onChange={(e) => setC({ interval: Number(e.target.value) })} className={inp} />
        <Lbl>Fotos do carrossel</Lbl>
        <div className="space-y-2">
          {imgs.map((src, idx) => (
            <div key={idx} className="rounded-md border border-neutral-200 p-2">
              <div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-semibold text-neutral-500">Foto {idx + 1}</span><button onClick={() => setC({ images: imgs.filter((_, k) => k !== idx) })} className="text-red-400">✕</button></div>
              <ImageField value={src} onChange={(v) => setC({ images: imgs.map((x, k) => k === idx ? v : x) })} />
            </div>
          ))}
          <button onClick={() => setC({ images: [...imgs, ""] })} className="rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-500">+ foto</button>
        </div>
      </>);
    }
    default:
      return <p className="mt-2 text-xs text-neutral-500">Bloco “{BLOCK_META[layer.type]?.label || layer.type}” — em breve. O conteúdo é preservado e renderiza no funil.</p>;
  }
}

/** Aba "Exibição": revelação e visibilidade do bloco. */
function Exibicao({ layer, onChange }: { layer: Layer; onChange: (l: Layer) => void }) {
  const starts = Number(layer.effects?.starts) || 0;
  const hidden = !!layer.design?.hidden;
  return (
    <div>
      <Lbl>Revelar após (segundos) — 0 = já aparece</Lbl>
      <input type="number" min={0} value={starts} onChange={(e) => onChange({ ...layer, effects: { ...(layer.effects || {}), starts: Number(e.target.value) } })} className={inp} />
      <label className="mt-3 flex cursor-pointer items-center justify-between text-sm">
        <span className="text-neutral-600">Ocultar bloco</span>
        <input type="checkbox" checked={hidden} onChange={(e) => onChange({ ...layer, design: { ...(layer.design || {}), hidden: e.target.checked } })} className="h-4 w-4 accent-neutral-900" />
      </label>
    </div>
  );
}

/** Painel direito: Componente / Aparência / Exibição (estilo inlead). */
function RightPanel({ layer, steps, onChange }: { layer: Layer; steps: InleadStep[]; onChange: (l: Layer) => void }) {
  const [t, setT] = useState<"componente" | "aparencia" | "exibicao">("componente");
  return (
    <div>
      <div className="flex border-b border-neutral-200 text-xs font-semibold">
        {([["componente", "Componente"], ["aparencia", "Aparência"], ["exibicao", "Exibição"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setT(k)} className={`flex-1 py-2.5 ${t === k ? "border-b-2 border-neutral-900 text-neutral-900" : "text-neutral-400"}`}>{label}</button>
        ))}
      </div>
      <div className="p-3">
        {t === "componente" ? <LayerFields layer={layer} steps={steps} onChange={onChange} /> : null}
        {t === "aparencia" ? <Appearance layer={layer} onChange={onChange} /> : null}
        {t === "exibicao" ? <Exibicao layer={layer} onChange={onChange} /> : null}
      </div>
    </div>
  );
}

// ───────────────────────── B — DESIGN ─────────────────────────
function DesignTab({ funnel, setFunnel }: { funnel: Funnel; setFunnel: (fn: (f: Funnel) => Funnel) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = ((funnel.settings?.design as any) || {}) as Record<string, any>;
  const setDesign = (patch: Record<string, unknown>) =>
    setFunnel((f) => ({ ...f, settings: { ...(f.settings || {}), design: { ...((f.settings?.design as object) || {}), ...patch } } }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hdr = (((funnel.settings as any)?.header) || {}) as Record<string, boolean>;
  const setHeader = (patch: Record<string, boolean>) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFunnel((f) => ({ ...f, settings: { ...(f.settings || {}), header: { ...(((f.settings as any)?.header) || {}), ...patch } } as any }));
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2.5"><span className="text-sm text-neutral-600">{label}</span><div className="flex items-center gap-2">{children}</div></div>
  );
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="mb-3 text-base font-bold">🎨 Design global</h2>
      <Row label="Cor do tema (botões/destaques)"><input type="color" value={d.themeColor || "#ea580c"} onChange={(e) => setDesign({ themeColor: e.target.value })} className="h-8 w-12" /></Row>
      <Row label="Fundo da página"><input type="color" value={d.backgroundColor || "#ffffff"} onChange={(e) => setDesign({ backgroundColor: e.target.value })} className="h-8 w-12" /></Row>
      <Row label="Cor do título"><input type="color" value={d.titleColor || "#000000"} onChange={(e) => setDesign({ titleColor: e.target.value })} className="h-8 w-12" /></Row>
      <Row label="Cor do texto"><input type="color" value={d.contentColor || "#000000"} onChange={(e) => setDesign({ contentColor: e.target.value })} className="h-8 w-12" /></Row>
      <Row label="Tamanho do texto (px)"><input type="number" value={Number(d.contentSize) || 17} onChange={(e) => setDesign({ contentSize: String(e.target.value) })} className="w-20 rounded border border-neutral-300 px-2 py-1 text-xs" /></Row>
      <Row label="Largura do container">
        <select value={d.container || "max-w-[34rem]"} onChange={(e) => setDesign({ container: e.target.value })} className="rounded border border-neutral-300 px-2 py-1 text-xs">
          {["max-w-[30rem]", "max-w-[34rem]", "max-w-[40rem]"].map((c) => <option key={c} value={c}>{c.replace(/max-w-\[|\]/g, "")}</option>)}
        </select>
      </Row>
      <Row label="Fonte">
        <select value={funnel.font || "poppins"} onChange={(e) => setFunnel((f) => ({ ...f, font: e.target.value as Funnel["font"] }))} className="rounded border border-neutral-300 px-2 py-1 text-xs">
          <option value="poppins">Poppins</option><option value="serif">Serif (Fraunces)</option>
        </select>
      </Row>
      <Lbl>Logo (topo das lâminas, quando ativado)</Lbl>
      <ImageField value={d.logo?.src || ""} onChange={(v) => setDesign({ logo: { type: "image", src: v } })} />
      <div className="mt-4 border-t border-neutral-100 pt-3">
        <p className="mb-1 text-sm font-bold text-neutral-700">Header (todas as lâminas, exceto hero e VSL)</p>
        {([["show_logo", "Mostrar logo"], ["show_progress", "Mostrar barra de progresso"], ["show_back", "Mostrar botão voltar"]] as const).map(([k, label]) => (
          <label key={k} className="flex cursor-pointer items-center justify-between py-1.5 text-sm"><span className="text-neutral-600">{label}</span>
            <input type="checkbox" checked={!!hdr[k]} onChange={(e) => setHeader({ [k]: e.target.checked })} className="h-4 w-4 accent-neutral-900" /></label>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── C — FLUXO (canvas de nós, estilo typebot) ─────────────────────────
interface FlowExit { layerId: string; optId: string | null; label: string; dest?: string }
const FLOW = { W: 250, HEAD: 42, ROW: 30, GAPY: 64, COLX: 96, PADB: 14 } as const;
const flowExits = (s: InleadStep): FlowExit[] => {
  const exits: FlowExit[] = [];
  (s.layers || []).forEach((l) => {
    if (l.type === "button") exits.push({ layerId: l.id, optId: null, label: `🔘 ${strip(l.content.label) || "Botão"}`, dest: l.content.destination });
    if (l.type === "options") (l.content.options || []).forEach((o) => exits.push({ layerId: l.id, optId: o.id, label: `☑️ ${strip(o.label) || "Opção"}`, dest: o.destination }));
  });
  return exits;
};
const nodeH = (nExits: number) => FLOW.HEAD + Math.max(1, nExits) * FLOW.ROW + FLOW.PADB;

function FluxoTab({ steps, setSteps }: { steps: InleadStep[]; setSteps: (s: InleadStep[]) => void }) {
  const setDest = (si: number, layerId: string, optId: string | null, dest: string) =>
    setSteps(steps.map((s, i) => i !== si ? s : {
      ...s, layers: (s.layers || []).map((l) => {
        if (l.id !== layerId) return l;
        if (optId) return { ...l, content: { ...l.content, options: (l.content.options || []).map((o) => o.id === optId ? { ...o, destination: dest } : o) } };
        return { ...l, content: { ...l.content, destination: dest } };
      }),
    }));

  // layout automático: espinha vertical, cada nó abaixo do anterior
  const autoLayout = (): Record<string, { x: number; y: number }> => {
    const pos: Record<string, { x: number; y: number }> = {};
    let y = 32;
    steps.forEach((s) => { pos[s.id] = { x: FLOW.COLX, y }; y += nodeH(flowExits(s).length) + FLOW.GAPY; });
    return pos;
  };
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>(autoLayout);
  // re-encaixa nós novos/removidos sem perder os já arrastados
  useEffect(() => {
    setPos((prev) => {
      const auto = autoLayout(); const next = { ...auto };
      for (const id of Object.keys(auto)) if (prev[id]) next[id] = prev[id];
      return next;
    });
  }, [steps.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const ids = new Set(steps.map((s) => s.id));
  const targetId = (dest: string | undefined, fromIdx: number): string | null | undefined => {
    if (!dest || dest === "next") return steps[fromIdx + 1]?.id;        // sequência
    if (/^https?:/.test(dest)) return null;                              // link externo
    return ids.has(dest) ? dest : steps[fromIdx + 1]?.id;               // destino inválido → próxima
  };

  // arrastar nó (pointer capture, sem libs)
  const startDrag = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    const o = pos[id] || { x: FLOW.COLX, y: 32 };
    const sx = e.clientX, sy = e.clientY;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => setPos((p) => ({ ...p, [id]: { x: Math.max(8, o.x + (ev.clientX - sx)), y: Math.max(8, o.y + (ev.clientY - sy)) } }));
    const up = () => { el.releasePointerCapture(e.pointerId); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
  };

  // arestas (setas) a partir das saídas
  type Edge = { id: string; x1: number; y1: number; x2: number; y2: number; kind: "seq" | "jump" };
  const edges: Edge[] = [];
  steps.forEach((s, i) => {
    const np = pos[s.id]; if (!np) return;
    const exits = flowExits(s);
    if (exits.length === 0) {
      const t = steps[i + 1]; const tp = t && pos[t.id];
      if (tp) edges.push({ id: `${s.id}-seq`, x1: np.x + FLOW.W / 2, y1: np.y + nodeH(0), x2: tp.x + FLOW.W / 2, y2: tp.y, kind: "seq" });
      return;
    }
    exits.forEach((x, k) => {
      const tid = targetId(x.dest, i); if (tid === null || tid === undefined) return; // externo/sem destino: sem seta
      const tp = pos[tid]; if (!tp) return;
      const y1 = np.y + FLOW.HEAD + k * FLOW.ROW + FLOW.ROW / 2;
      const seq = (!x.dest || x.dest === "next") && tid === steps[i + 1]?.id;
      edges.push({ id: `${s.id}-${x.layerId}-${k}`, x1: np.x + FLOW.W, y1, x2: tp.x + FLOW.W / 2, y2: tp.y, kind: seq ? "seq" : "jump" });
    });
  });

  const canvasW = Math.max(820, ...steps.map((s) => (pos[s.id]?.x ?? 0) + FLOW.W)) + 220;
  const canvasH = Math.max(360, ...steps.map((s) => (pos[s.id]?.y ?? 0) + nodeH(flowExits(s).length))) + 60;
  const curve = (e: Edge) => {
    const dx = Math.max(50, Math.abs(e.x2 - e.x1) * 0.5);
    const dy = Math.max(40, Math.abs(e.y2 - e.y1) * 0.4);
    return `M ${e.x1} ${e.y1} C ${e.x1 + dx} ${e.y1}, ${e.x2} ${e.y2 - dy}, ${e.x2} ${e.y2}`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-neutral-500">Arraste os nós. As setas mostram para onde cada botão/opção leva.</p>
        <button onClick={() => setPos(autoLayout())} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">⤢ Auto-organizar</button>
      </div>
      <div className="relative h-[68vh] overflow-auto rounded-xl border border-neutral-200"
        style={{ backgroundColor: "#fafafa", backgroundImage: "radial-gradient(#d4d4d4 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
        <div className="relative" style={{ width: canvasW, height: canvasH }}>
          {/* setas */}
          <svg className="pointer-events-none absolute inset-0" width={canvasW} height={canvasH}>
            <defs>
              <marker id="fl-seq" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" /></marker>
              <marker id="fl-jump" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#ea580c" /></marker>
            </defs>
            {edges.map((e) => (
              <path key={e.id} d={curve(e)} fill="none" strokeWidth={2}
                stroke={e.kind === "seq" ? "#94a3b8" : "#ea580c"} strokeDasharray={e.kind === "seq" ? "5 5" : undefined}
                markerEnd={`url(#${e.kind === "seq" ? "fl-seq" : "fl-jump"})`} />
            ))}
          </svg>
          {/* nós */}
          {steps.map((s, i) => {
            const np = pos[s.id]; if (!np) return null;
            const exits = flowExits(s);
            return (
              <div key={s.id} className="absolute rounded-xl border border-neutral-200 bg-white shadow-sm" style={{ left: np.x, top: np.y, width: FLOW.W }}>
                <div onPointerDown={startDrag(s.id)} className="flex cursor-grab items-center gap-2 rounded-t-xl border-b border-neutral-100 bg-neutral-50 px-3 py-2.5 active:cursor-grabbing select-none">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-bold text-white">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-neutral-800">{s.title || s.id}</span>
                  <span className="text-neutral-300">⠿</span>
                </div>
                <div className="px-2.5 py-2" style={{ minHeight: Math.max(1, exits.length) * FLOW.ROW }}>
                  {exits.length ? exits.map((x, k) => (
                    <div key={k} className="flex items-center justify-between gap-2 py-0.5 text-xs" style={{ height: FLOW.ROW }}>
                      <span className="min-w-0 flex-1 truncate text-neutral-600">{x.label}</span>
                      <div className="flex items-center gap-1">
                        <select value={/^https?:/.test(x.dest || "") ? "__url" : (x.dest || "next")} onChange={(ev) => setDest(i, x.layerId, x.optId, ev.target.value)}
                          className="max-w-[110px] truncate rounded border border-neutral-300 px-1 py-0.5 text-[11px]">
                          <option value="next">→ próxima</option>
                          {steps.map((t, ti) => <option key={t.id} value={t.id}>↪ {ti + 1}. {strip(t.title) || t.id}</option>)}
                          {/^https?:/.test(x.dest || "") ? <option value="__url">🔗 link</option> : null}
                        </select>
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: /^https?:/.test(x.dest || "") ? "#a3a3a3" : "#ea580c" }} />
                      </div>
                    </div>
                  )) : <p className="flex items-center text-[11px] text-neutral-400" style={{ height: FLOW.ROW }}>segue → próxima lâmina</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── D — LEADS ─────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Analytics { performance: any; resultados: { question: string; total: number; options: { label: string; value: number; pct: number }[] }[]; questions: string[]; questionStats?: { question: string; total: number; pct: number }[]; respostas: { session: string; name: string | null; phone: string | null; when: string | null; answers: Record<string, string>; track?: Record<string, string> }[] }
/** Colunas de tracking (Onda B) — exibidas na tabela de Respostas, estilo inlead. */
const TRACK_COLS: { key: string; label: string }[] = [
  { key: "utm_source", label: "utm_source" }, { key: "utm_medium", label: "utm_medium" },
  { key: "utm_campaign", label: "utm_campaign" }, { key: "utm_content", label: "utm_content" },
  { key: "utm_term", label: "utm_term" }, { key: "src", label: "src" },
  { key: "fbclid", label: "fbclid" }, { key: "ctwa_clid", label: "ctwa_clid" }, { key: "source_id", label: "source_id" },
  { key: "viewport", label: "viewport" }, { key: "screen", label: "screen" },
  { key: "platform", label: "platform" }, { key: "user_agent", label: "userAgent" },
];

/** Anel de % (estilo inlead) no header de cada etapa. */
function PctRing({ pct }: { pct: number }) {
  const color = pct >= 80 ? "#16a34a" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <span className="relative inline-grid h-7 w-7 shrink-0 place-items-center">
      <svg viewBox="0 0 36 36" className="h-7 w-7 -rotate-90">
        <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle cx="18" cy="18" r="15" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 94.2} 94.2`} />
      </svg>
      <span className="absolute text-[8px] font-bold text-neutral-600">{pct}%</span>
    </span>
  );
}

function Bar({ pct, color = "#3b82f6" }: { pct: number; color?: string }) {
  return <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>;
}

/** Data yyyy-mm-dd no fuso de São Paulo (offset em dias: 0 = hoje, 1 = ontem). */
const spYmd = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(Date.now() - offsetDays * 86400000));
/** Limites UTC de um dia (00:00–23:59) no fuso BR (-03:00, sem horário de verão). */
const dayBounds = (ymd: string): { from: string; to: string } => ({
  from: new Date(`${ymd}T00:00:00.000-03:00`).toISOString(),
  to: new Date(`${ymd}T23:59:59.999-03:00`).toISOString(),
});
const sinceDays = (n: number): { from: string } => ({ from: new Date(Date.now() - n * 86400000).toISOString() });
const PERIODOS: { key: string; label: string; make: () => { from?: string; to?: string } }[] = [
  { key: "tudo", label: "Tudo", make: () => ({}) },
  { key: "hoje", label: "Hoje", make: () => dayBounds(spYmd(0)) },
  { key: "ontem", label: "Ontem", make: () => dayBounds(spYmd(1)) },
  { key: "7d", label: "7 dias", make: () => sinceDays(7) },
  { key: "30d", label: "30 dias", make: () => sinceDays(30) },
];

/** Aba Leads = sub-abas Respostas / Resultados / Performance (estilo inlead).
 *  Exportada pra ser reusada também no FunnelBuilder (motor typed). */
export function LeadsTab({ slug }: { slug: string }) {
  const [d, setD] = useState<Analytics | null>(null);
  const [sub, setSub] = useState<"respostas" | "resultados" | "performance">("respostas");
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [range, setRange] = useState<{ key: string; from?: string; to?: string }>({ key: "tudo" });
  const [day, setDay] = useState("");
  // Onda A: busca, filtros (etapas/colunas), paginação
  const [search, setSearch] = useState("");
  const [hiddenQ, setHiddenQ] = useState<Set<string>>(new Set());
  const [showMeta, setShowMeta] = useState(true); // colunas Lead/Telefone/Data
  const [hiddenTrack, setHiddenTrack] = useState<Set<string>>(new Set(TRACK_COLS.map((c) => c.key))); // tracking oculto por padrão
  const [openFilter, setOpenFilter] = useState<"etapas" | "colunas" | null>(null);
  const [page, setPage] = useState(0);
  const PER = 50;
  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ slug });
    if (range.from) qs.set("from", range.from);
    if (range.to) qs.set("to", range.to);
    fetch(`/api/funnel-analytics?${qs.toString()}`).then((r) => r.json()).then(setD).catch(() => { }).finally(() => setLoading(false));
  };
  useEffect(load, [slug, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const reset = async () => {
    if (!window.confirm("Tem certeza? Isso apaga TODOS os dados (respostas, sessões e leads) DESTE funil. Extraia o CSV antes!")) return;
    setResetting(true);
    try { await fetch(`/api/reset-funnel-data`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }); } catch { /* noop */ }
    setResetting(false); load();
  };
  const p = d?.performance;
  const fmtT = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, "0")}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m ${String(s % 60).padStart(2, "0")}s`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200">
        <nav className="flex gap-1">
          {([["respostas", "📋 Respostas"], ["resultados", "📊 Resultados"], ["performance", "📈 Performance"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setSub(k)} className={`px-3 py-2.5 text-sm font-semibold ${sub === k ? "border-b-2 border-neutral-900 text-neutral-900" : "text-neutral-400 hover:text-neutral-700"}`}>{l}</button>
          ))}
        </nav>
        <div className="flex items-center gap-4 pb-2">
          <a href={`/api/export-leads?slug=${encodeURIComponent(slug)}`} className="text-xs font-semibold text-neutral-600 hover:text-neutral-900">⬇ Exportar leads</a>
          <button onClick={reset} disabled={resetting} className="text-xs font-semibold text-red-500 hover:text-red-700">{resetting ? "Limpando…" : "♻ Resetar dados"}</button>
        </div>
      </div>

      {/* filtro de período (aplica às 3 sub-abas) */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-neutral-400">Período:</span>
        <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1">
          {PERIODOS.map((pr) => (
            <button key={pr.key} onClick={() => { setDay(""); setRange({ key: pr.key, ...pr.make() }); }}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${range.key === pr.key ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-800"}`}>
              {pr.label}
            </button>
          ))}
        </div>
        <label className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${range.key === "dia" ? "border-neutral-900 text-neutral-900" : "border-neutral-200 text-neutral-500"}`}>
          📅 Dia
          <input type="date" value={day} max={spYmd(0)}
            onChange={(e) => { const ymd = e.target.value; setDay(ymd); setRange(ymd ? { key: "dia", ...dayBounds(ymd) } : { key: "tudo" }); }}
            className="bg-transparent text-neutral-800 outline-none" />
        </label>
      </div>

      {loading ? <p className="p-8 text-center text-sm text-neutral-400">Carregando…</p> : !d ? <p className="p-8 text-center text-sm text-neutral-400">Sem dados.</p> : (
        <>
          {/* RESPOSTAS — tabela por lead (colunas = etapas com %) + busca + filtros + paginação */}
          {sub === "respostas" ? (() => {
            const statById = new Map((d.questionStats || []).map((s) => [s.question, s.pct]));
            const visQ = d.questions.filter((q) => !hiddenQ.has(q));
            const visTrack = TRACK_COLS.filter((c) => !hiddenTrack.has(c.key));
            const term = search.trim().toLowerCase();
            const rows = d.respostas.filter((r) => !term || [r.name, r.phone, ...Object.values(r.answers)].join(" ").toLowerCase().includes(term));
            const pages = Math.max(1, Math.ceil(rows.length / PER));
            const pg = Math.min(page, pages - 1);
            const slice = rows.slice(pg * PER, pg * PER + PER);
            return (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Pesquisar nome, telefone, resposta…"
                      className="w-64 rounded-lg border border-neutral-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-neutral-400" />
                    <span className="pointer-events-none absolute left-2.5 top-1.5 text-neutral-400">🔎</span>
                  </div>
                  <div className="relative">
                    <button onClick={() => setOpenFilter(openFilter === "etapas" ? null : "etapas")} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">▦ Etapas ▾</button>
                    {openFilter === "etapas" ? (
                      <div className="absolute z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
                        {d.questions.map((q, i) => (
                          <label key={q} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-neutral-50">
                            <span className="min-w-0 flex-1 truncate text-neutral-700">{i + 1}. {strip(q)}</span>
                            <input type="checkbox" checked={!hiddenQ.has(q)} onChange={() => setHiddenQ((s) => { const n = new Set(s); if (n.has(q)) n.delete(q); else n.add(q); return n; })} className="h-3.5 w-3.5 accent-neutral-900" />
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="relative">
                    <button onClick={() => setOpenFilter(openFilter === "colunas" ? null : "colunas")} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">▥ Colunas ▾</button>
                    {openFilter === "colunas" ? (
                      <div className="absolute z-20 mt-1 max-h-72 w-56 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
                        <label className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-neutral-50">
                          <span className="font-semibold text-neutral-700">Lead / Telefone / Data</span>
                          <input type="checkbox" checked={showMeta} onChange={() => setShowMeta((v) => !v)} className="h-3.5 w-3.5 accent-neutral-900" />
                        </label>
                        <p className="mt-1 px-2 pb-0.5 pt-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400">Tracking</p>
                        {TRACK_COLS.map((c) => (
                          <label key={c.key} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-neutral-50">
                            <span className="text-neutral-700">{c.label}</span>
                            <input type="checkbox" checked={!hiddenTrack.has(c.key)} onChange={() => setHiddenTrack((s) => { const n = new Set(s); if (n.has(c.key)) n.delete(c.key); else n.add(c.key); return n; })} className="h-3.5 w-3.5 accent-neutral-900" />
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span className="ml-auto text-xs text-neutral-400">{rows.length} resposta{rows.length === 1 ? "" : "s"}</span>
                </div>

                {slice.length ? (
                  <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
                    <table className="w-full text-xs">
                      <thead className="bg-neutral-50 text-left text-neutral-500">
                        <tr>
                          {showMeta ? (<><th className="whitespace-nowrap px-3 py-2.5 font-semibold">Lead</th><th className="whitespace-nowrap px-3 py-2.5 font-semibold">Telefone</th><th className="whitespace-nowrap px-3 py-2.5 font-semibold">Data</th></>) : null}
                          {visQ.map((q, i) => (
                            <th key={q} className="whitespace-nowrap px-3 py-2.5">
                              <div className="flex items-center gap-1.5"><PctRing pct={statById.get(q) ?? 0} /><span className="font-semibold text-neutral-700">{i + 1}. {strip(q).slice(0, 26)}</span></div>
                            </th>
                          ))}
                          {visTrack.map((c) => <th key={c.key} className="whitespace-nowrap px-3 py-2.5 font-semibold text-violet-500">{c.label}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {slice.map((r, i) => (
                          <tr key={i} className="border-t border-neutral-100 hover:bg-neutral-50">
                            {showMeta ? (<>
                              <td className="whitespace-nowrap px-3 py-2 font-semibold text-neutral-800">{r.name || `#${r.session}`}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-neutral-600">{r.phone || "—"}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-neutral-400">{r.when ? new Date(r.when).toLocaleDateString("pt-BR") : "—"}</td>
                            </>) : null}
                            {visQ.map((q) => <td key={q} className="whitespace-nowrap px-3 py-2 text-neutral-600">{r.answers[q] || "—"}</td>)}
                            {visTrack.map((c) => <td key={c.key} className="max-w-[160px] truncate whitespace-nowrap px-3 py-2 text-neutral-400" title={r.track?.[c.key] || ""}>{r.track?.[c.key] || "—"}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="p-8 text-center text-sm text-neutral-400">{term ? "Nenhuma resposta bate com a busca." : "Nenhuma resposta ainda. Passe um lead pelo funil."}</p>}

                {pages > 1 ? (
                  <div className="flex items-center justify-center gap-2 text-xs">
                    <button onClick={() => setPage(Math.max(0, pg - 1))} disabled={pg === 0} className="rounded border border-neutral-200 px-2 py-1 font-semibold disabled:opacity-40">←</button>
                    <span className="text-neutral-500">Página {pg + 1} de {pages}</span>
                    <button onClick={() => setPage(Math.min(pages - 1, pg + 1))} disabled={pg >= pages - 1} className="rounded border border-neutral-200 px-2 py-1 font-semibold disabled:opacity-40">→</button>
                  </div>
                ) : null}
              </div>
            );
          })() : null}

          {/* RESULTADOS — por pergunta, opções com % */}
          {sub === "resultados" ? (
            d.resultados.length ? (
              <div className="space-y-4">
                {d.resultados.map((r) => (
                  <div key={r.question} className="rounded-xl border border-neutral-200 bg-white p-4">
                    <p className="mb-2 text-sm font-bold text-neutral-800">{r.question} <span className="ml-1 text-xs font-normal text-neutral-400">({r.total} respostas)</span></p>
                    <div className="space-y-2">
                      {r.options.map((o, i) => (
                        <div key={i}>
                          <div className="mb-0.5 flex items-center justify-between text-xs"><span className="text-neutral-700">{o.label}</span><span className="font-semibold text-neutral-500">{o.value} · {o.pct}%</span></div>
                          <Bar pct={o.pct} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="p-8 text-center text-sm text-neutral-400">Sem respostas de quiz ainda.</p>
          ) : null}

          {/* PERFORMANCE — cards + funil + campanhas */}
          {sub === "performance" && p ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[["Score", `${p.score}`], ["Visitantes", `${p.visitantes}`], ["Respostas", `${p.respostas}`], ["Leads", `${p.leads}`], ["Tempo médio", fmtT(p.tempoMedioSeg)]].map(([l, v]) => (
                  <div key={l} className="rounded-xl border border-neutral-200 bg-white p-3"><p className="text-[11px] text-neutral-400">{l}</p><p className="text-lg font-bold text-neutral-800">{v}</p></div>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="mb-1 text-sm font-bold text-neutral-700">Funil · conversão {p.taxaConclusao}%</p>
                  {p.funil.map((f: { label: string; value: number; pct: number }) => (
                    <div key={f.label} className="mb-2">
                      <div className="mb-0.5 flex items-center justify-between text-xs"><span className="text-neutral-700">{f.label}</span><span className="font-semibold text-neutral-500">{f.value} · {f.pct}%</span></div>
                      <Bar pct={f.pct} color="#ea580c" />
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="mb-2 text-sm font-bold text-neutral-700">Campanhas <span className="text-xs font-normal text-neutral-400">· melhor origem: {p.melhorOrigem}</span></p>
                  {p.campanhas.length ? p.campanhas.map((c: { name: string; value: number; pct: number }) => (
                    <div key={c.name} className="mb-2"><div className="mb-0.5 flex items-center justify-between text-xs"><span className="min-w-0 flex-1 truncate text-neutral-700">{c.name}</span><span className="font-semibold text-neutral-500">{c.value} · {c.pct}%</span></div><Bar pct={c.pct} color="#8b5cf6" /></div>
                  )) : <p className="text-xs text-neutral-400">Sem dados de campanha (UTM/src) ainda.</p>}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function LayersBuilder({ initial }: { initial: Funnel }) {
  const [funnel, setFunnel] = useState<Funnel>(initial);
  const steps = funnel.steps as unknown as InleadStep[];
  const [selStep, setSelStep] = useState(0);
  const [selLayer, setSelLayer] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [tab, setTab] = useState<"construtor" | "fluxo" | "design" | "leads">("construtor");
  const [showSettings, setShowSettings] = useState(false);

  const theme = (funnel.settings?.design as { themeColor?: string })?.themeColor || "#ea580c";
  const setSteps = (next: InleadStep[]) => setFunnel((f) => ({ ...f, steps: next as unknown as Funnel["steps"] }));
  const patchStep = (i: number, patch: Partial<InleadStep>) => setSteps(steps.map((s, k) => k === i ? { ...s, ...patch } : s));
  const setLayers = (next: Layer[]) => patchStep(selStep, { layers: next });

  const step = steps[selStep];
  const layers = step?.layers || [];

  const save = async () => {
    setSaving(true); setMsg(null);
    const r = await saveFunnelAction(funnel);
    setSaving(false);
    setMsg(r.ok ? "✓ Salvo" : `Erro: ${r.error ?? "falhou"}`);
    setTimeout(() => setMsg(null), 4000);
    if (r.ok) setNonce((n) => n + 1);
  };

  // ── operações de lâmina ──
  const addStep = () => {
    const s: InleadStep = { id: genId(), title: "Nova lâmina", layers: [], options: { show_logo: false, show_progress: false } };
    const next = [...steps.slice(0, selStep + 1), s, ...steps.slice(selStep + 1)];
    setSteps(next); setSelStep(selStep + 1);
  };
  const delStep = (i: number) => { if (steps.length <= 1) return; const next = steps.filter((_, k) => k !== i); setSteps(next); setSelStep(Math.min(i, next.length - 1)); };

  // ── importar lâmina de outro funil ──
  const [importOpen, setImportOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [importFunnels, setImportFunnels] = useState<any[] | null>(null);
  const [importSel, setImportSel] = useState("");
  const openImport = () => {
    setImportOpen(true);
    if (!importFunnels) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetch("/api/funnels-export").then((r) => r.json()).then((d: any) => { setImportFunnels(d.funnels || []); setImportSel(d.funnels?.[0]?.slug || ""); }).catch(() => setImportFunnels([]));
    }
  };
  // clona uma lâmina com IDs NOVOS em tudo (step, blocos, conteúdo, opções e a
  // referência `step` de cada bloco) — evita qualquer colisão/edição travada.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cloneStepFresh = (srcStep: any) => {
    const s = JSON.parse(JSON.stringify(srcStep));
    s.id = genId();
    delete s.position; delete s.selected; delete s.chosen;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (Array.isArray(s.layers)) s.layers = s.layers.map((l: any) => {
      const nl = { ...l, id: genId(), step: s.id };
      if (nl.content) {
        nl.content = { ...nl.content, id: genId() };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (Array.isArray(nl.content.options)) nl.content.options = nl.content.options.map((o: any) => ({ ...o, id: genId() }));
      }
      return nl;
    });
    return s;
  };
  // inserir clone após a atual + selecionar (limpa o bloco selecionado pra abrir limpo)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertStepAfter = (s: any) => {
    setSteps([...steps.slice(0, selStep + 1), s, ...steps.slice(selStep + 1)] as InleadStep[]);
    setSelStep(selStep + 1); setSelLayer(null);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const importStep = (srcStep: any) => { insertStepAfter(cloneStepFresh(srcStep)); setImportOpen(false); };
  const dupStep = () => { const s = cloneStepFresh(steps[selStep]); s.title = `${s.title || "Lâmina"} (cópia)`; insertStepAfter(s); };

  // ── operações de bloco ──
  const addPaletteItem = (key: string, label: string) => {
    if (!ADDABLE.has(key)) { window.alert(`Bloco "${label}" — em breve. Vamos ativar sob demanda.`); return; }
    let l: Layer;
    if (key === "email") { l = newLayer("field"); l.content = { ...l.content, name: "email", title: "Seu e-mail", placeholder: "voce@email.com", type: "email", mask: undefined }; }
    else if (key === "phone") { l = newLayer("field"); }
    else if (key === "video") { l = newLayer("embed"); }
    else { l = newLayer(key as LayerType); }
    setLayers([...layers, l]); setSelLayer(l.id);
  };
  const delLayer = (id: string) => setLayers(layers.filter((l) => l.id !== id));
  const updateLayer = (id: string, l: Layer) => setLayers(layers.map((x) => x.id === id ? l : x));
  const onSelect = (id: string) => setSelLayer(id);
  const onAction = (id: string, action: "copy" | "hide" | "delete") => {
    const i = layers.findIndex((l) => l.id === id); if (i < 0) return;
    if (action === "delete") { delLayer(id); setSelLayer(null); return; }
    if (action === "copy") { const copy = { ...JSON.parse(JSON.stringify(layers[i])), id: genId() } as Layer; setLayers([...layers.slice(0, i + 1), copy, ...layers.slice(i + 1)]); setSelLayer(copy.id); return; }
    if (action === "hide") { const l = layers[i]; updateLayer(id, { ...l, design: { ...(l.design || {}), hidden: !l.design?.hidden } }); }
  };
  // arrastar bloco no canvas (⠿) → reordena
  const onReorder = (activeId: string, overId: string) => {
    const from = layers.findIndex((l) => l.id === activeId);
    const to = layers.findIndex((l) => l.id === overId);
    if (from < 0 || to < 0) return;
    setLayers(arrayMove(layers, from, to));
  };

  const sel = layers.find((l) => l.id === selLayer);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const onStepDragEnd = (e: DragEndEvent) => {
    const { active, over } = e; if (!over || active.id === over.id) return;
    const from = steps.findIndex((s) => s.id === active.id); const to = steps.findIndex((s) => s.id === over.id);
    if (from < 0 || to < 0) return; setSteps(arrayMove(steps, from, to)); setSelStep(to);
  };
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">← Funis</a>
          <div>
            <h1 className="text-sm font-bold">Construtor · {funnel.name} <span className="ml-1 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">LAYERS</span></h1>
            <p className="text-xs text-neutral-500">/{funnel.slug} · {steps.length} lâminas</p>
          </div>
        </div>
        <nav className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1">
          {([["construtor", "🧩 Construtor"], ["fluxo", "🔀 Fluxo"], ["design", "🎨 Design"], ["leads", "👥 Leads"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${tab === k ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"}`}>{label}</button>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {msg ? <span className={`text-xs font-semibold ${msg.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>{msg}</span> : null}
          <button onClick={() => setShowSettings(true)} title="Configurações do funil" className="rounded-lg border border-neutral-300 px-2.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">⚙</button>
          <button onClick={save} disabled={saving} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Salvando…" : "💾 Salvar"}</button>
          <a href={funnel.domain ? `https://${funnel.domain}/${funnel.slug}` : `/${funnel.slug}`} target="_blank" rel="noreferrer" className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white">Ver ao vivo ↗</a>
        </div>
      </header>

      {tab === "design" && <div className="p-4"><DesignTab funnel={funnel} setFunnel={setFunnel} /></div>}
      {tab === "fluxo" && <div className="p-4"><FluxoTab steps={steps} setSteps={setSteps} /></div>}
      {tab === "leads" && <div className="p-4"><LeadsTab slug={funnel.slug} /></div>}

      {tab === "construtor" && (
      <div className="grid h-[calc(100vh-49px)] grid-cols-[180px_180px_1fr_300px] bg-neutral-100">
        {/* 1 · ETAPAS */}
        <aside className="overflow-y-auto border-r border-neutral-200 bg-white p-2">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Etapas</span>
            <div className="flex items-center gap-1">
              <button onClick={openImport} title="Importar lâmina de outro funil" className="rounded border border-neutral-300 px-1.5 py-0.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">⬇</button>
              <button onClick={dupStep} title="Duplicar esta lâmina" className="rounded border border-neutral-300 px-1.5 py-0.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">⧉</button>
              <button onClick={addStep} title="Nova etapa" className="rounded bg-neutral-900 px-1.5 py-0.5 text-xs font-semibold text-white">+</button>
            </div>
          </div>
          <DndContext id="ll-steps" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onStepDragEnd}>
            <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {steps.map((s, i) => (
                  <SortableItem key={s.id} id={s.id}>{(handle) => (
                    <div className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-sm ${i === selStep ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"}`}>
                      <span className={i === selStep ? "text-white/50" : "text-neutral-300"}>{handle}</span>
                      <button onClick={() => { setSelStep(i); setSelLayer(null); }} className={`flex min-w-0 flex-1 items-center gap-1.5 text-left ${s.disabled ? "opacity-45" : ""}`}>
                        <span className={`text-[10px] ${i === selStep ? "text-white/60" : "text-neutral-400"}`}>{i + 1}</span>
                        <span className={`min-w-0 flex-1 truncate font-medium ${s.disabled ? "line-through" : ""}`}>{s.title || s.id}</span>
                        {s.disabled ? <span className="shrink-0 rounded bg-neutral-200 px-1 text-[9px] font-bold uppercase text-neutral-500">off</span> : null}
                      </button>
                      <button onClick={() => delStep(i)} className={`px-0.5 opacity-0 group-hover:opacity-100 ${i === selStep ? "text-white/70" : "text-red-400"}`}>✕</button>
                    </div>
                  )}</SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </aside>

        {/* 2 · PALETA categorizada */}
        <aside className="overflow-y-auto border-r border-neutral-200 bg-neutral-50 p-2">
          {CATS.map((cat) => (
            <div key={cat.name} className="mb-2.5">
              <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400">{cat.name}</p>
              <div className="space-y-0.5">
                {cat.items.map(([key, label]) => (
                  <button key={key} onClick={() => addPaletteItem(key, label)} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-white hover:shadow-sm ${ADDABLE.has(key) ? "text-neutral-700" : "text-neutral-400"}`}>
                    <span>{PALETTE_ICON[key] || "▫️"}</span><span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        {/* 3 · CANVAS (celular, edição inline) */}
        <div className="flex items-start justify-center overflow-y-auto p-6">
          <div className="h-[700px] w-[360px] shrink-0 overflow-hidden rounded-[2.2rem] border-[11px] border-neutral-900 bg-white shadow-2xl" style={{ fontFamily: "'Poppins', system-ui, sans-serif" }}>
            <div className="h-full overflow-y-auto transform-gpu" onClick={() => setSelLayer(null)}>
              <LayersRunner key={`${selStep}-${nonce}`} funnel={funnel} startIndex={selStep} preview editor={{ selectedId: selLayer || undefined, onSelect, onAction, onReorder }} />
            </div>
          </div>
        </div>

        {/* 4 · PAINEL direito (Componente/Aparência/Exibição OU Etapa) */}
        <aside className="overflow-y-auto border-l border-neutral-200 bg-white">
          {sel ? (
            <RightPanel key={sel.id} layer={sel} steps={steps} onChange={(nl) => updateLayer(sel.id, nl)} />
          ) : (
            <div className="space-y-3 p-4">
              <p className="text-sm font-bold text-neutral-700">Etapa</p>
              <label className="flex cursor-pointer items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm">
                <span className="font-semibold text-neutral-700">{step?.disabled ? "Lâmina desativada" : "Lâmina ativa"}</span>
                <input type="checkbox" checked={!step?.disabled} onChange={(e) => patchStep(selStep, { disabled: !e.target.checked })} className="h-4 w-4 accent-green-600" />
              </label>
              {step?.disabled ? <p className="-mt-1 text-[11px] text-amber-600">Esta lâmina é PULADA no funil publicado (continua aqui pra reativar).</p> : null}
              <div><Lbl>Título</Lbl><input value={step?.title || ""} onChange={(e) => patchStep(selStep, { title: e.target.value })} className={inp} /></div>
              {/* Editor dedicado de slider/roleta (hero especial — não tem blocos clicáveis) */}
              {(() => {
                const special = (step?.layers || []).find((l) => l.type === "slider" || l.type === "roulette");
                if (!special) return null;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const sc: any = special.content || {};
                const patchSpecial = (patch: Record<string, unknown>) => patchStep(selStep, { layers: (step!.layers || []).map((l) => l.id === special.id ? { ...l, content: { ...l.content, ...patch } } : l) });
                if (special.type === "slider") {
                  return (
                    <div className="space-y-2 rounded-xl border border-orange-200 bg-orange-50/40 p-3">
                      <p className="text-sm font-bold text-neutral-700">🎚️ Slider (hero)</p>
                      <div><Lbl>Pergunta (use ==destaque==)</Lbl><input value={sc.question || ""} onChange={(e) => patchSpecial({ question: e.target.value })} className={inp} /></div>
                      <div><Lbl>Ajuda (linha menor)</Lbl><input value={sc.help || ""} onChange={(e) => patchSpecial({ help: e.target.value })} className={inp} /></div>
                      <div className="grid grid-cols-3 gap-2">
                        <div><Lbl>Mín</Lbl><input type="number" value={sc.min ?? 0} onChange={(e) => patchSpecial({ min: Number(e.target.value) })} className={inp} /></div>
                        <div><Lbl>Máx</Lbl><input type="number" value={sc.max ?? 10} onChange={(e) => patchSpecial({ max: Number(e.target.value) })} className={inp} /></div>
                        <div><Lbl>Passo</Lbl><input type="number" value={sc.step ?? 1} onChange={(e) => patchSpecial({ step: Number(e.target.value) })} className={inp} /></div>
                      </div>
                      <div><Lbl>Imagem (rodapé)</Lbl><ImageField value={sc.image || ""} onChange={(v) => patchSpecial({ image: v })} /></div>
                    </div>
                  );
                }
                return (
                  <div className="space-y-2 rounded-xl border border-orange-200 bg-orange-50/40 p-3">
                    <p className="text-sm font-bold text-neutral-700">🎡 Roleta (hero)</p>
                    <div><Lbl>Pergunta</Lbl><input value={sc.question || ""} onChange={(e) => patchSpecial({ question: e.target.value })} className={inp} /></div>
                    <p className="text-[11px] text-neutral-400">Segmentos/prêmios da roleta são configuração avançada — me peça que eu ajusto.</p>
                  </div>
                );
              })()}
              <p className="rounded-lg bg-neutral-50 p-2 text-[11px] text-neutral-500">O <b>Header</b> (logo/progresso/voltar) agora é configuração <b>geral</b>, na aba <b>🎨 Design</b> — vale pra todas as lâminas (exceto hero e VSL).</p>
              <p className="text-xs text-neutral-400">👆 Clique num bloco no celular pra editar.</p>
            </div>
          )}
        </aside>
      </div>
      )}

      {showSettings ? (
        <FunnelSettingsPanel funnel={funnel} onPatch={(patch) => setFunnel((f) => ({ ...f, ...patch }))} onClose={() => setShowSettings(false)} />
      ) : null}

      {/* ── Modal: importar lâmina de outro funil ── */}
      {importOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setImportOpen(false)}>
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
              <h2 className="text-sm font-bold text-neutral-800">⬇ Importar lâmina</h2>
              <button onClick={() => setImportOpen(false)} className="text-neutral-400 hover:text-neutral-700">✕</button>
            </div>
            {!importFunnels ? (
              <p className="p-8 text-center text-sm text-neutral-400">Carregando funis…</p>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                <label className="text-xs font-semibold text-neutral-500">De qual funil?
                  <select value={importSel} onChange={(e) => setImportSel(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm">
                    {importFunnels.map((f) => <option key={f.slug} value={f.slug}>{f.name} (/{f.slug})</option>)}
                  </select>
                </label>
                <p className="text-xs font-semibold text-neutral-500">Qual lâmina importar?</p>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-neutral-200">
                  {(importFunnels.find((f) => f.slug === importSel)?.steps || []).map((s: { id: string; title: string; types?: string[]; step: Record<string, unknown> }, i: number) => (
                    <button key={s.id} onClick={() => importStep(s.step)} className="group flex w-full items-center gap-2 border-b border-neutral-100 px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-orange-50">
                      <span className="min-w-0 flex-1 truncate"><span className="mr-1.5 text-xs font-bold text-neutral-400">{i + 1}.</span><span className="font-semibold text-neutral-800">{s.title}</span> <span className="text-[10px] text-neutral-400">{(s.types || []).slice(0, 5).join(" · ")}</span></span>
                      <span className="shrink-0 rounded bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100">Importar</span>
                    </button>
                  ))}
                  {!(importFunnels.find((f) => f.slug === importSel)?.steps || []).length ? <p className="p-6 text-center text-xs text-neutral-400">Esse funil não tem lâminas.</p> : null}
                </div>
                <p className="text-[11px] text-neutral-400">A lâmina entra logo após a atual, com IDs novos (sem conflito). Clique em 💾 Salvar pra persistir.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
