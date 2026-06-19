"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { updateVsl } from "@/app/admin/actions";
import ImageField from "@/components/admin/ImageField";
import { buildDefaultBlocks } from "@/lib/default-blocks";
import {
  BLOCK_LABELS,
  newBlock,
  type Block,
  type BlockType,
  type PopupAlign,
  type Vsl,
} from "@/lib/types";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500";
const lbl = "mb-1 block text-xs font-medium text-slate-600";

// Seletor de cor: swatch (color picker) + hex + botão limpar (vazio = tema/padrão).
function ColorField({
  label,
  value,
  onChange,
  emptyHint = "vazio = tema",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  emptyHint?: string;
}) {
  return (
    <label className="block">
      <span className={lbl}>{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-300"
        />
        <input
          className={inputCls}
          placeholder={emptyHint}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 text-xs text-slate-400 hover:text-slate-600"
          >
            limpar
          </button>
        )}
      </div>
    </label>
  );
}

function uid() {
  try {
    return crypto.randomUUID();
  } catch {
    return "b-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

// Resumo curto de um bloco (pra pré-visualização do gerador).
function blockSummary(b: Block): string {
  const p = b.props as Record<string, unknown>;
  switch (b.type) {
    case "text":
    case "destaque":
      return String(p.content ?? "").slice(0, 60);
    case "button":
      return String(p.label ?? "");
    case "vagas":
      return p.mode === "texto"
        ? String(p.text ?? "")
        : `${p.inicial}/${p.total} vagas`;
    case "capture":
      return String(p.title ?? "Captura");
    case "image":
      return "imagem";
    case "video":
      return "vídeo VTurb";
    case "spacer":
      return "espaço";
    case "html":
      return "html";
    default:
      return "";
  }
}

// ── Editor de props por tipo ──────────────────────────────────
function PropsEditor({
  block,
  set,
}: {
  block: Block;
  set: (k: string, v: unknown) => void;
}) {
  const p = block.props as Record<string, unknown>;
  const alignField = (
    <label className="block">
      <span className={lbl}>Alinhamento</span>
      <select
        className={inputCls}
        value={(p.align as PopupAlign) ?? "center"}
        onChange={(e) => set("align", e.target.value)}
      >
        <option value="left">Esquerda</option>
        <option value="center">Centro</option>
        <option value="right">Direita</option>
      </select>
    </label>
  );
  const revealField = (
    <label className="block">
      <span className={lbl}>Revelar após (s do vídeo)</span>
      <input
        type="number"
        className={inputCls}
        value={Number(p.revealAfter ?? 0)}
        onChange={(e) => set("revealAfter", Number(e.target.value))}
      />
    </label>
  );

  switch (block.type) {
    case "text":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={lbl}>Texto</span>
            <textarea
              className={inputCls}
              rows={2}
              value={String(p.content ?? "")}
              onChange={(e) => set("content", e.target.value)}
            />
          </label>
          <label className="block">
            <span className={lbl}>Tamanho (px)</span>
            <input type="number" className={inputCls} value={Number(p.fontSize ?? 16)} onChange={(e) => set("fontSize", Number(e.target.value))} />
          </label>
          <label className="block">
            <span className={lbl}>Peso</span>
            <select className={inputCls} value={Number(p.weight ?? 600)} onChange={(e) => set("weight", Number(e.target.value))}>
              <option value={400}>Normal</option>
              <option value={600}>Semibold</option>
              <option value={800}>Bold</option>
              <option value={900}>Black</option>
            </select>
          </label>
          <label className="block">
            <span className={lbl}>Cor</span>
            <input type="color" className="h-10 w-14 rounded border border-slate-300" value={String(p.color || "#ffffff")} onChange={(e) => set("color", e.target.value)} />
          </label>
          {alignField}
          {revealField}
        </div>
      );
    case "destaque":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={lbl}>Texto</span>
            <input className={inputCls} value={String(p.content ?? "")} onChange={(e) => set("content", e.target.value)} />
          </label>
          <ColorField label="Cor de preenchimento (grifo)" emptyHint="#F5C842" value={String(p.bgColor ?? "")} onChange={(v) => set("bgColor", v)} />
          <ColorField label="Cor do texto" emptyHint="#0a1428" value={String(p.textColor ?? "")} onChange={(v) => set("textColor", v)} />
          <label className="block">
            <span className={lbl}>Tamanho (px)</span>
            <input type="number" className={inputCls} value={Number(p.fontSize ?? 16)} onChange={(e) => set("fontSize", Number(e.target.value))} />
          </label>
          <label className="block">
            <span className={lbl}>Arredondamento (px)</span>
            <input type="number" className={inputCls} value={Number(p.radius ?? 8)} onChange={(e) => set("radius", Number(e.target.value))} />
          </label>
          {alignField}
          {revealField}
        </div>
      );
    case "image":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <ImageField label="Imagem" value={(p.url as string) || null} onChange={(v) => set("url", v || "")} />
          </div>
          <label className="block">
            <span className={lbl}>Largura máx (px)</span>
            <input type="number" className={inputCls} value={Number(p.maxWidth ?? 400)} onChange={(e) => set("maxWidth", Number(e.target.value))} />
          </label>
          <label className="block">
            <span className={lbl}>Arredondamento (px)</span>
            <input type="number" className={inputCls} value={Number(p.radius ?? 12)} onChange={(e) => set("radius", Number(e.target.value))} />
          </label>
          {alignField}
          {revealField}
        </div>
      );
    case "button":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={lbl}>Texto do botão</span>
            <input className={inputCls} value={String(p.label ?? "")} onChange={(e) => set("label", e.target.value)} />
          </label>
          <label className="block">
            <span className={lbl}>Destino</span>
            <select className={inputCls} value={String(p.linkType ?? "checkout")} onChange={(e) => set("linkType", e.target.value)}>
              <option value="checkout">Checkout (Hotmart da página)</option>
              <option value="url">URL personalizada</option>
            </select>
          </label>
          {p.linkType === "url" && (
            <label className="block">
              <span className={lbl}>URL</span>
              <input className={inputCls} placeholder="https://..." value={String(p.url ?? "")} onChange={(e) => set("url", e.target.value)} />
            </label>
          )}
          <label className="block">
            <span className={lbl}>Cor do botão</span>
            <input className={inputCls} placeholder="vazio = verde" value={String(p.bgColor ?? "")} onChange={(e) => set("bgColor", e.target.value)} />
          </label>
          <label className="block">
            <span className={lbl}>Cor do texto</span>
            <input type="color" className="h-10 w-14 rounded border border-slate-300" value={String(p.textColor || "#ffffff")} onChange={(e) => set("textColor", e.target.value)} />
          </label>
          {alignField}
          {revealField}
          <label className="block">
            <span className={lbl}>Pulse (pulsante)</span>
            <label className="flex items-center gap-2 py-2 text-sm text-slate-700">
              <input type="checkbox" checked={Boolean(p.pulse ?? true)} onChange={(e) => set("pulse", e.target.checked)} /> Ativo
            </label>
          </label>
          <label className="block">
            <span className={lbl}>Reflexo (brilho passando)</span>
            <label className="flex items-center gap-2 py-2 text-sm text-slate-700">
              <input type="checkbox" checked={Boolean(p.shine ?? true)} onChange={(e) => set("shine", e.target.checked)} /> Ativo
            </label>
          </label>
        </div>
      );
    case "video":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={lbl}>Largura máx (px)</span>
            <input type="number" className={inputCls} value={Number(p.maxWidth ?? 400)} onChange={(e) => set("maxWidth", Number(e.target.value))} />
          </label>
          <p className="self-end text-xs text-slate-400">
            Usa o Player/Account VTurb configurado na aba Conteúdo.
          </p>
        </div>
      );
    case "vagas":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={lbl}>Tipo da barra</span>
            <select className={inputCls} value={String(p.mode ?? "escassez")} onChange={(e) => set("mode", e.target.value)}>
              <option value="escassez">Escassez (conta vagas)</option>
              <option value="texto">Cabeçalho (texto fixo)</option>
            </select>
          </label>

          {p.mode === "texto" ? (
            <label className="block sm:col-span-2">
              <span className={lbl}>Texto do cabeçalho</span>
              <input className={inputCls} placeholder="🔥 OFERTA POR TEMPO LIMITADO" value={String(p.text ?? "")} onChange={(e) => set("text", e.target.value)} />
            </label>
          ) : (
            <>
              <label className="block">
                <span className={lbl}>Vaga inicial</span>
                <input type="number" className={inputCls} value={Number(p.inicial ?? 37)} onChange={(e) => set("inicial", Number(e.target.value))} />
              </label>
              <label className="block">
                <span className={lbl}>Limite (onde trava)</span>
                <input type="number" className={inputCls} value={Number(p.limite ?? 48)} onChange={(e) => set("limite", Number(e.target.value))} />
              </label>
              <label className="block">
                <span className={lbl}>Total exibido</span>
                <input type="number" className={inputCls} value={Number(p.total ?? 50)} onChange={(e) => set("total", Number(e.target.value))} />
              </label>
              <label className="block">
                <span className={lbl}>Intervalo do decremento (ms)</span>
                <input type="number" className={inputCls} value={Number(p.intervalMs ?? 15000)} onChange={(e) => set("intervalMs", Number(e.target.value))} />
              </label>
              <label className="block sm:col-span-2">
                <span className={lbl}>Texto após o número</span>
                <input className={inputCls} placeholder="PROMOCIONAIS JÁ FORAM GARANTIDAS..." value={String(p.suffix ?? "")} onChange={(e) => set("suffix", e.target.value)} />
              </label>
              <ColorField label="Cor do número" emptyHint="vazio = dourado" value={String(p.numberColor ?? "")} onChange={(v) => set("numberColor", v)} />
            </>
          )}

          <ColorField label="Cor da barra (fundo)" value={String(p.bgColor ?? "")} onChange={(v) => set("bgColor", v)} />
          <ColorField label="Cor do texto" value={String(p.textColor ?? "")} onChange={(v) => set("textColor", v)} />
          {revealField}
        </div>
      );
    case "capture":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={lbl}>Título</span>
            <input className={inputCls} value={String(p.title ?? "")} onChange={(e) => set("title", e.target.value)} />
          </label>
          <label className="block sm:col-span-2">
            <span className={lbl}>Subtítulo</span>
            <input className={inputCls} value={String(p.subtitle ?? "")} onChange={(e) => set("subtitle", e.target.value)} />
          </label>
          <label className="block">
            <span className={lbl}>Texto do botão</span>
            <input className={inputCls} value={String(p.buttonLabel ?? "")} onChange={(e) => set("buttonLabel", e.target.value)} />
          </label>
          <label className="block">
            <span className={lbl}>ID do botão (componente)</span>
            <input className={inputCls} placeholder="captura" value={String(p.buttonId ?? "")} onChange={(e) => set("buttonId", e.target.value)} />
          </label>
          <ColorField label="Cor de fundo" value={String(p.bgColor ?? "")} onChange={(v) => set("bgColor", v)} />
          <ColorField label="Cor do botão" emptyHint="vazio = verde" value={String(p.accentColor ?? "")} onChange={(v) => set("accentColor", v)} />
          <label className="block sm:col-span-2">
            <span className={lbl}>Mensagem pós-captura (obrigado)</span>
            <input className={inputCls} value={String(p.thankYou ?? "")} onChange={(e) => set("thankYou", e.target.value)} />
          </label>
          <label className="block">
            <span className={lbl}>Obrigado fixado</span>
            <label className="flex items-center gap-2 py-2 text-sm text-slate-700">
              <input type="checkbox" checked={p.thankYouSticky !== false} onChange={(e) => set("thankYouSticky", e.target.checked)} /> Fica na tela (off = some após 4s)
            </label>
          </label>
          <label className="block">
            <span className={lbl}>Efeitos do botão</span>
            <div className="flex gap-4 py-2 text-sm text-slate-700">
              <label className="flex items-center gap-1"><input type="checkbox" checked={p.pulse !== false} onChange={(e) => set("pulse", e.target.checked)} /> Pulse</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={p.shine !== false} onChange={(e) => set("shine", e.target.checked)} /> Reflexo</label>
            </div>
          </label>
          {revealField}
        </div>
      );
    case "spacer":
      return (
        <label className="block max-w-xs">
          <span className={lbl}>Altura (px)</span>
          <input type="number" className={inputCls} value={Number(p.height ?? 32)} onChange={(e) => set("height", Number(e.target.value))} />
        </label>
      );
    case "html":
      return (
        <label className="block">
          <span className={lbl}>HTML</span>
          <textarea className={inputCls + " font-mono text-xs"} rows={5} value={String(p.code ?? "")} onChange={(e) => set("code", e.target.value)} />
        </label>
      );
    default:
      return null;
  }
}

// ── Card arrastável ───────────────────────────────────────────
function SortableCard({
  block,
  onSet,
  onToggle,
  onDuplicate,
  onRemove,
}: {
  block: Block;
  onSet: (k: string, v: unknown) => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });
  const [open, setOpen] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="rounded-xl border border-slate-200 bg-white"
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* drag handle (6 pontinhos) */}
        <button
          type="button"
          className="cursor-grab touch-none px-1 text-slate-400 hover:text-slate-600"
          aria-label="Arrastar"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {BLOCK_LABELS[block.type]}
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex-1 text-left text-sm text-slate-500 hover:text-slate-800"
        >
          {open ? "▾ editar" : "▸ editar"}
        </button>

        <label className="flex items-center gap-1 text-xs text-slate-500" title="Ativar/desativar">
          <input type="checkbox" checked={block.enabled} onChange={onToggle} />
          {block.enabled ? "ativo" : "off"}
        </label>
        <button type="button" onClick={onDuplicate} className="px-2 text-xs text-slate-500 hover:text-sky-600" title="Duplicar">
          ⧉
        </button>
        <button type="button" onClick={onRemove} className="px-2 text-xs text-red-500 hover:text-red-700" title="Excluir">
          ✕
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-100 p-4">
          <PropsEditor block={block} set={onSet} />
        </div>
      )}
    </div>
  );
}

// ── Editor principal ──────────────────────────────────────────
export default function BlockEditor({
  vslId,
  vsl,
  initial,
}: {
  vslId: string;
  vsl: Vsl;
  initial: Block[];
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [genPreview, setGenPreview] = useState<Block[] | null>(null);
  const [genInclude, setGenInclude] = useState<Record<string, boolean>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function mut(next: Block[]) {
    setBlocks(next);
    setSaved(false);
  }
  const setProp = (id: string, k: string, v: unknown) =>
    mut(blocks.map((b) => (b.id === id ? { ...b, props: { ...b.props, [k]: v } } : b)));
  const toggle = (id: string) =>
    mut(blocks.map((b) => (b.id === id ? { ...b, enabled: !b.enabled } : b)));
  const remove = (id: string) => mut(blocks.filter((b) => b.id !== id));
  const duplicate = (id: string) => {
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const copy: Block = { ...blocks[i], id: uid(), props: { ...blocks[i].props } };
    const next = [...blocks];
    next.splice(i + 1, 0, copy);
    mut(next);
  };
  const add = (type: BlockType) => mut([...blocks, newBlock(type, uid())]);

  // Abre o painel de pré-visualização do que será gerado a partir do Conteúdo.
  const generateFromContent = () => {
    const preview = buildDefaultBlocks(vsl, uid);
    const inc: Record<string, boolean> = {};
    preview.forEach((b) => (inc[b.id] = true));
    setGenPreview(preview);
    setGenInclude(inc);
  };
  // Aplica os blocos selecionados (substitui os atuais).
  const confirmGenerate = () => {
    if (!genPreview) return;
    mut(genPreview.filter((b) => genInclude[b.id]));
    setGenPreview(null);
  };

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = blocks.findIndex((b) => b.id === active.id);
    const newI = blocks.findIndex((b) => b.id === over.id);
    mut(arrayMove(blocks, oldI, newI));
  }

  function save() {
    startTransition(async () => {
      await updateVsl(vslId, { blocks });
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {genPreview && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
          <p className="mb-1 text-sm font-semibold text-slate-800">
            Gerar a partir do Conteúdo
          </p>
          <p className="mb-3 text-xs text-slate-500">
            Estes blocos serão criados a partir do que está na aba Conteúdo.
            Desmarque o que não quiser puxar. Isto <strong>substitui</strong> os
            blocos atuais.
          </p>
          <div className="mb-4 space-y-1">
            {genPreview.map((b) => (
              <label
                key={b.id}
                className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={genInclude[b.id] ?? true}
                  onChange={(e) =>
                    setGenInclude((g) => ({ ...g, [b.id]: e.target.checked }))
                  }
                />
                <span className="font-medium text-slate-700">
                  {BLOCK_LABELS[b.type]}
                </span>
                <span className="truncate text-slate-400">
                  {blockSummary(b)}
                </span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={confirmGenerate}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Confirmar e gerar
            </button>
            <button
              onClick={() => setGenPreview(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={generateFromContent}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          ✨ Gerar a partir do Conteúdo
        </button>
        <span className="ml-2 text-sm text-slate-500">Adicionar bloco:</span>
        {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => (
          <button
            key={t}
            onClick={() => add(t)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            + {BLOCK_LABELS[t]}
          </button>
        ))}
      </div>

      {blocks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">
            Nenhum bloco ainda. (Sem blocos, a página usa o layout padrão da VSL.)
          </p>
          <button
            onClick={generateFromContent}
            className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            ✨ Gerar blocos a partir do Conteúdo
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {blocks.map((b) => (
                <SortableCard
                  key={b.id}
                  block={b}
                  onSet={(k, v) => setProp(b.id, k, v)}
                  onToggle={() => toggle(b.id)}
                  onDuplicate={() => duplicate(b.id)}
                  onRemove={() => remove(b.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Salvar blocos"}
        </button>
        {saved && <span className="text-sm text-emerald-600">Salvo.</span>}
      </div>
    </div>
  );
}
