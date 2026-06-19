"use client";

import { useState } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Funnel, Step, StepType } from "@/lib/quiz/types";
import { STEP_LABELS, newStep } from "@/lib/quiz/types";
import { PALETTES, getPalette } from "@/lib/quiz/theme";
import QuizRunner from "@/components/quiz/QuizRunner";
import StepEditor from "./StepEditor";
import FunnelSettingsPanel from "./FunnelSettingsPanel";
import { saveFunnelAction } from "@/app/builder/[slug]/actions";

const TYPE_ICON: Record<StepType, string> = {
  roulette: "🎡", scratch: "🎟️", measure: "📏", slider: "🎚️", hero: "🏠", name: "✍️", confirm: "💖", question: "❓", loading: "⏳", gauge: "📊",
  result: "🎯", offer: "🎁", capture: "📱", post_capture: "✅", bridge: "🌉", vsl: "▶️",
};

const CATEGORIES: { name: string; types: StepType[] }[] = [
  { name: "Início", types: ["hero", "name", "confirm"] },
  { name: "Quiz", types: ["question", "measure", "slider", "roulette", "scratch"] },
  { name: "Transição", types: ["loading", "gauge", "result"] },
  { name: "Conversão", types: ["offer", "capture", "post_capture", "bridge", "vsl"] },
];

function genId() {
  try { return crypto.randomUUID(); } catch { return `s-${Math.random().toString(36).slice(2)}`; }
}

function stepSnippet(s: Step): string {
  if ("title" in s && s.title) return s.title;
  if (s.type === "question") return s.question;
  return STEP_LABELS[s.type];
}

function Row({ step, index, active, onSelect, onDup, onDel }: {
  step: Step; index: number; active: boolean; onSelect: () => void; onDup: () => void; onDel: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className={`group flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-sm ${active ? "border-neutral-900 bg-white shadow-sm" : "border-transparent hover:bg-white"}`}>
      <button {...attributes} {...listeners} className="cursor-grab text-neutral-400" title="Arrastar">⠿</button>
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className="shrink-0">{TYPE_ICON[step.type]}</span>
        <span className="min-w-0 flex-1 truncate">
          <span className="block truncate font-medium text-neutral-800">{stepSnippet(step)}</span>
          <span className="block text-[10px] uppercase tracking-wide text-neutral-400">{index + 1} · {STEP_LABELS[step.type]}</span>
        </span>
      </button>
      <button onClick={onDup} title="Duplicar" className="px-1 text-neutral-400 opacity-0 group-hover:opacity-100">⧉</button>
      <button onClick={onDel} title="Excluir" className="px-1 text-red-400 opacity-0 group-hover:opacity-100">✕</button>
    </div>
  );
}

export default function FunnelBuilder({ initial }: { initial: Funnel }) {
  const [funnel, setFunnel] = useState<Funnel>(initial);
  const [selectedId, setSelectedId] = useState<string>(initial.steps[0]?.id ?? "");
  const [nonce, setNonce] = useState(0);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const patchFunnel = (patch: Partial<Funnel>) => setFunnel((f) => ({ ...f, ...patch }));

  const save = async () => {
    setSaving(true); setSavedMsg(null);
    const r = await saveFunnelAction(funnel);
    setSaving(false);
    setSavedMsg(r.ok ? "✓ Salvo no Supabase" : `Erro: ${r.error ?? "falhou"}`);
    setTimeout(() => setSavedMsg(null), 4000);
  };

  const steps = funnel.steps;
  const selIdx = Math.max(0, steps.findIndex((s) => s.id === selectedId));
  const selected = steps[selIdx];
  const pal = getPalette(funnel.paletteId);

  const setSteps = (next: Step[]) => setFunnel((f) => ({ ...f, steps: next }));
  const patchStep = (patch: Partial<Step>) =>
    setSteps(steps.map((s, i) => (i === selIdx ? ({ ...s, ...patch } as Step) : s)));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = steps.findIndex((s) => s.id === active.id);
    const to = steps.findIndex((s) => s.id === over.id);
    setSteps(arrayMove(steps, from, to));
  };
  const duplicate = (i: number) => {
    const copy = { ...steps[i], id: genId() } as Step;
    const next = [...steps.slice(0, i + 1), copy, ...steps.slice(i + 1)];
    setSteps(next); setSelectedId(copy.id);
  };
  const remove = (i: number) => {
    if (steps.length <= 1) return;
    const next = steps.filter((_, k) => k !== i);
    setSteps(next);
    if (steps[i].id === selectedId) setSelectedId(next[Math.min(i, next.length - 1)].id);
  };
  const add = (type: StepType) => {
    const s = newStep(type, genId());
    const next = [...steps.slice(0, selIdx + 1), s, ...steps.slice(selIdx + 1)];
    setSteps(next); setSelectedId(s.id); setAdding(false);
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">← Funis</a>
          <div>
            <h1 className="text-sm font-bold">Construtor · {funnel.name}</h1>
            <p className="text-xs text-neutral-500">/{funnel.slug} · {steps.length} lâminas</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {savedMsg ? <span className={`text-xs font-semibold ${savedMsg.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>{savedMsg}</span> : null}
          <button onClick={() => setShowSettings(true)} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">⚙ Configurações</button>
          <button onClick={save} disabled={saving} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Salvando..." : "💾 Salvar"}</button>
          <a href={`/q/${funnel.slug}`} target="_blank" rel="noreferrer" className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white">Ver ao vivo ↗</a>
        </div>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[260px_1fr_380px]">
        {/* SIDEBAR: paleta + lâminas */}
        <aside className="space-y-4">
          <section className="rounded-xl border-2 border-neutral-900 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold">🎨 Paleta</span>
              <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: pal.primary }} title={pal.primary} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PALETTES.map((p) => (
                <button key={p.id} title={p.name} onClick={() => setFunnel((f) => ({ ...f, paletteId: p.id }))}
                  className={`h-7 w-7 rounded-full border-2 ${p.id === funnel.paletteId ? "border-neutral-900 ring-2 ring-neutral-900/15" : "border-white shadow"}`}
                  style={{ background: p.primary }} />
              ))}
              <label title="Cor personalizada" className="relative grid h-7 w-7 cursor-pointer place-items-center overflow-hidden rounded-full border-2 text-[11px]"
                style={funnel.paletteId.startsWith("#") ? { background: funnel.paletteId, borderColor: "#171717" } : { borderStyle: "dashed", borderColor: "#cbcbcb" }}>
                {funnel.paletteId.startsWith("#") ? "" : "🎨"}
                <input type="color" value={funnel.paletteId.startsWith("#") ? funnel.paletteId : "#6d46b8"} onChange={(e) => setFunnel((f) => ({ ...f, paletteId: e.target.value }))} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
            </div>
            <p className="mt-1.5 text-[11px] text-neutral-500">{pal.name}{funnel.paletteId.startsWith("#") ? ` ${funnel.paletteId}` : ""}</p>
            <div className="mt-3 border-t border-neutral-100 pt-2.5">
              <span className="mb-1.5 block text-xs font-bold">🔤 Tipografia</span>
              <div className="flex gap-1.5">
                {([["serif", "Serif (Fraunces)"], ["poppins", "Poppins (vivadevelas)"]] as const).map(([id, label]) => (
                  <button key={id} onClick={() => setFunnel((f) => ({ ...f, font: id }))}
                    className={`flex-1 rounded-lg border-2 px-2 py-1.5 text-[11px] font-semibold transition ${((funnel.font ?? "serif") === id) ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-xl border-2 border-neutral-900 bg-white p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="text-xs font-bold">🔊 Áudio (Imersão)</span>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-2 py-1 text-xs">
              <span className="text-neutral-700">Som de clique ao avançar</span>
              <input type="checkbox" checked={!!funnel.clickSound}
                onChange={(e) => setFunnel((f) => ({ ...f, clickSound: e.target.checked }))}
                className="h-4 w-4 accent-neutral-900" />
            </label>
            <label className="mt-1.5 block text-[11px] font-semibold text-neutral-500">Trilha sonora (URL .mp3, loop)</label>
            <input type="url" value={funnel.music ?? ""} placeholder="https://…/trilha.mp3"
              onChange={(e) => setFunnel((f) => ({ ...f, music: e.target.value || undefined }))}
              className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1 text-xs" />
            <p className="mt-1 text-[10px] leading-tight text-neutral-400">A trilha inicia no 1º toque do usuário (regra de autoplay). Royalty-free: pixabay.com/music, freesound.org.</p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-2">
            <div className="mb-1.5 flex items-center justify-between px-1">
              <span className="text-xs font-bold text-neutral-600">Lâminas</span>
              <button onClick={() => setAdding((a) => !a)} className="rounded-md bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white">+ Adicionar</button>
            </div>
            {adding ? (
              <div className="mb-2 max-h-[320px] space-y-2 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-2">
                {CATEGORIES.map((cat) => (
                  <div key={cat.name}>
                    <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400">{cat.name}</p>
                    <div className="grid grid-cols-2 gap-1">
                      {cat.types.map((t) => (
                        <button key={t} onClick={() => add(t)} className="flex items-center gap-1 rounded-md border border-neutral-200 px-1.5 py-1.5 text-left text-xs hover:border-neutral-400 hover:bg-neutral-50">
                          <span>{TYPE_ICON[t]}</span><span className="truncate">{STEP_LABELS[t]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <DndContext id="builder-laminas" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {steps.map((s, i) => (
                    <Row key={s.id} step={s} index={i} active={s.id === selectedId}
                      onSelect={() => setSelectedId(s.id)} onDup={() => duplicate(i)} onDel={() => remove(i)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </section>
        </aside>

        {/* EDITOR da lâmina selecionada */}
        <main className="rounded-xl border border-neutral-200 bg-white p-5">
          {selected ? (
            <>
              <div className="mb-4 flex items-center gap-2 border-b border-neutral-100 pb-3">
                <span className="text-lg">{TYPE_ICON[selected.type]}</span>
                <h2 className="text-base font-bold">{STEP_LABELS[selected.type]}</h2>
                <span className="ml-auto text-xs text-neutral-400">lâmina {selIdx + 1} de {steps.length}</span>
              </div>
              <StepEditor step={selected} onChange={patchStep} />
            </>
          ) : null}
        </main>

        {/* PREVIEW ao vivo (pula pra lâmina selecionada) */}
        <div className="lg:sticky lg:top-4 lg:h-fit">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">Preview · lâmina {selIdx + 1}</span>
            <button onClick={() => setNonce((n) => n + 1)} className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold">↻ Reiniciar</button>
          </div>
          <div className="mx-auto h-[680px] w-[340px] max-w-full overflow-hidden rounded-[2rem] border-[10px] border-neutral-900 bg-white shadow-xl"
            style={{
              ["--q-display" as string]: (funnel.font === "poppins" || funnel.paletteId === "ambar-velas") ? "'Poppins', system-ui, sans-serif" : "Georgia, serif",
              fontFamily: (funnel.font === "poppins" || funnel.paletteId === "ambar-velas") ? "'Poppins', system-ui, sans-serif" : undefined,
            }}>
            <div className="h-full overflow-y-auto">
              <QuizRunner key={`${selectedId}-${funnel.paletteId}-${nonce}`} funnel={funnel} startIndex={selIdx} preview />
            </div>
          </div>
        </div>
      </div>

      {showSettings ? (
        <FunnelSettingsPanel funnel={funnel} onPatch={patchFunnel} onClose={() => setShowSettings(false)} />
      ) : null}
    </div>
  );
}
