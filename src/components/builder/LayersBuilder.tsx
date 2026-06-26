"use client";

import { useRef, useState } from "react";
import type { Funnel } from "@/lib/quiz/types";
import type { InleadStep, Layer, LayerType } from "@/lib/quiz/layers/types";
import LayersRunner from "@/components/quiz/layers/LayersRunner";
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
};
const PALETTE: LayerType[] = ["text", "image", "button", "options", "field", "alert", "timer", "loading", "clear", "embed"];

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
    case "embed": case "video": return { ...base, content: { id, embedHtml: "" } };
    default: return base;
  }
}

/** contentEditable WYSIWYG simples (negrito + cor) que devolve o HTML. */
function HtmlField({ value, onChange, theme = "#ea580c" }: { value?: string; onChange: (v: string) => void; theme?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const init = useRef(value || "");
  const cmd = (c: string, v?: string) => { document.execCommand(c, false, v); if (ref.current) onChange(ref.current.innerHTML); };
  return (
    <div>
      <div className="mb-1 flex gap-1">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("bold"); }} className="rounded border border-neutral-300 px-2 py-0.5 text-xs font-bold">B</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("foreColor", theme); }} className="rounded border border-neutral-300 px-2 py-0.5 text-xs font-bold" style={{ color: theme }}>Cor</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("foreColor", "#000000"); }} className="rounded border border-neutral-300 px-2 py-0.5 text-xs">Preto</button>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML || "")}
        className="min-h-[44px] rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        dangerouslySetInnerHTML={{ __html: init.current }} />
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

/** Editor de um bloco (campos por tipo). */
function LayerEditor({ layer, steps, onChange }: { layer: Layer; steps: InleadStep[]; onChange: (l: Layer) => void }) {
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
    default:
      return <p className="mt-2 text-xs text-neutral-500">Bloco “{BLOCK_META[layer.type]?.label || layer.type}” — edição avançada em breve. Conteúdo preservado.</p>;
  }
}

export default function LayersBuilder({ initial }: { initial: Funnel }) {
  const [funnel, setFunnel] = useState<Funnel>(initial);
  const steps = funnel.steps as unknown as InleadStep[];
  const [selStep, setSelStep] = useState(0);
  const [selLayer, setSelLayer] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

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
  const moveStep = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= steps.length) return; const next = [...steps];[next[i], next[j]] = [next[j], next[i]]; setSteps(next); setSelStep(j); };

  // ── operações de bloco ──
  const addLayer = (t: LayerType) => { const l = newLayer(t); setLayers([...layers, l]); setSelLayer(l.id); setAdding(false); };
  const delLayer = (id: string) => setLayers(layers.filter((l) => l.id !== id));
  const moveLayer = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= layers.length) return; const next = [...layers];[next[i], next[j]] = [next[j], next[i]]; setLayers(next); };
  const updateLayer = (id: string, l: Layer) => setLayers(layers.map((x) => x.id === id ? l : x));

  const sel = layers.find((l) => l.id === selLayer);

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
        <div className="flex items-center gap-3">
          {msg ? <span className={`text-xs font-semibold ${msg.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>{msg}</span> : null}
          <button onClick={save} disabled={saving} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Salvando…" : "💾 Salvar"}</button>
          <a href={funnel.domain ? `https://${funnel.domain}/${funnel.slug}` : `/${funnel.slug}`} target="_blank" rel="noreferrer" className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white">Ver ao vivo ↗</a>
        </div>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[230px_1fr_360px]">
        {/* LÂMINAS */}
        <aside className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-neutral-600">Lâminas</span>
            <button onClick={addStep} className="rounded-md bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white">+ Lâmina</button>
          </div>
          <div className="space-y-1">
            {steps.map((s, i) => (
              <div key={s.id} className={`group flex items-center gap-1 rounded-lg border px-2 py-1.5 text-sm ${i === selStep ? "border-neutral-900 bg-white shadow-sm" : "border-transparent hover:bg-white"}`}>
                <button onClick={() => { setSelStep(i); setSelLayer(null); }} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                  <span className="text-[10px] text-neutral-400">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-neutral-800">{s.title || s.id}</span>
                </button>
                <button onClick={() => moveStep(i, -1)} className="px-0.5 text-neutral-300 opacity-0 group-hover:opacity-100">▲</button>
                <button onClick={() => moveStep(i, 1)} className="px-0.5 text-neutral-300 opacity-0 group-hover:opacity-100">▼</button>
                <button onClick={() => delStep(i)} className="px-0.5 text-red-400 opacity-0 group-hover:opacity-100">✕</button>
              </div>
            ))}
          </div>
        </aside>

        {/* BLOCOS da lâmina + editor */}
        <main className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-2">
            <input value={step?.title || ""} onChange={(e) => patchStep(selStep, { title: e.target.value })} className="flex-1 rounded-md border border-neutral-200 px-2 py-1 text-sm font-bold" placeholder="Nome da lâmina" />
            <span className="text-xs text-neutral-400">{layers.length} blocos</span>
          </div>

          <div className="relative">
            <button onClick={() => setAdding((a) => !a)} className="w-full rounded-lg border-2 border-dashed border-neutral-300 py-2 text-xs font-semibold text-neutral-500 hover:border-neutral-900">+ Adicionar bloco</button>
            {adding ? (
              <div className="mt-1 grid grid-cols-3 gap-1 rounded-lg border border-neutral-200 bg-white p-2 shadow">
                {PALETTE.map((t) => (
                  <button key={t} onClick={() => addLayer(t)} className="flex flex-col items-center gap-0.5 rounded-md border border-neutral-200 py-2 text-[11px] hover:border-neutral-900 hover:bg-neutral-50">
                    <span className="text-base">{BLOCK_META[t]?.icon}</span>{BLOCK_META[t]?.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            {layers.map((l, i) => (
              <div key={l.id}>
                <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${sel?.id === l.id ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"}`}>
                  <button onClick={() => setSelLayer(sel?.id === l.id ? null : l.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
                    <span>{BLOCK_META[l.type]?.icon || "▫️"}</span>
                    <span className="min-w-0 flex-1 truncate text-neutral-700">{BLOCK_META[l.type]?.label || l.type}<span className="ml-1 text-xs text-neutral-400">{strip(l.content.text || l.content.label || l.content.title).slice(0, 28)}</span></span>
                  </button>
                  <button onClick={() => moveLayer(i, -1)} className="px-0.5 text-neutral-300">▲</button>
                  <button onClick={() => moveLayer(i, 1)} className="px-0.5 text-neutral-300">▼</button>
                  <button onClick={() => delLayer(l.id)} className="px-0.5 text-red-400">✕</button>
                </div>
                {sel?.id === l.id ? (
                  <div className="mt-1 rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
                    <LayerEditor layer={l} steps={steps} onChange={(nl) => updateLayer(l.id, nl)} />
                  </div>
                ) : null}
              </div>
            ))}
            {!layers.length ? <p className="py-6 text-center text-xs text-neutral-400">Lâmina vazia — adicione um bloco acima.</p> : null}
          </div>
        </main>

        {/* PREVIEW */}
        <div className="lg:sticky lg:top-4 lg:h-fit">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">Preview · lâmina {selStep + 1}</span>
            <button onClick={() => setNonce((n) => n + 1)} className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold">↻ Reiniciar</button>
          </div>
          <div className="mx-auto h-[680px] w-[340px] max-w-full overflow-hidden rounded-[2rem] border-[10px] border-neutral-900 bg-white shadow-xl" style={{ fontFamily: "'Poppins', system-ui, sans-serif" }}>
            <div className="h-full overflow-y-auto transform-gpu">
              <LayersRunner key={`${selStep}-${nonce}`} funnel={funnel} startIndex={selStep} preview />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
