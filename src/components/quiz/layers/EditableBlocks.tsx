"use client";

/**
 * Renderização dos blocos no MODO EDITOR (drag & drop com dnd-kit).
 * Fica num arquivo separado e é carregado via next/dynamic SÓ no construtor —
 * assim o @dnd-kit (core + sortable + utilities) e o EditBlock NÃO entram no
 * bundle do funil público (perf/connect rate).
 */
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Layer } from "@/lib/quiz/layers/types";
import { Block, BlockToolbar, type LayersCtx, type LayersEdit } from "./blocks";

function EditBlock({ layer, ctx, question, edit }: { layer: Layer; ctx: LayersCtx; question: string; edit: LayersEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: layer.id });
  const selected = edit.selectedId === layer.id;
  const hidden = !!layer.design?.hidden;
  return (
    <div
      ref={setNodeRef}
      data-editor-block={layer.id}
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest("[data-block-toolbar]")) return; // toolbar/⠿ funcionam
        e.stopPropagation(); e.preventDefault(); edit.onSelect(layer.id);
      }}
      className="relative cursor-pointer rounded-md transition hover:outline hover:outline-1 hover:outline-blue-300"
      style={{
        transform: CSS.Transform.toString(transform), transition,
        outline: selected ? "2px solid #2563eb" : undefined, outlineOffset: 3,
        opacity: isDragging ? 0.5 : (hidden ? 0.4 : 1), zIndex: isDragging ? 40 : undefined,
      }}
    >
      {selected ? <BlockToolbar onAction={(a) => edit.onAction(layer.id, a)} dragProps={{ ...attributes, ...listeners }} /> : null}
      <Block layer={layer} ctx={ctx} question={question} />
    </div>
  );
}

/** Lista de blocos arrastáveis (⠿) do canvas do construtor. */
export function EditableBlockList({ layers, ctx, question, editor }: { layers: Layer[]; ctx: LayersCtx; question: string; editor: LayersEdit }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      onDragEnd={(e: DragEndEvent) => { const { active, over } = e; if (over && active.id !== over.id) editor.onReorder?.(String(active.id), String(over.id)); }}>
      <SortableContext items={layers.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        {layers.map((l) => <EditBlock key={l.id} layer={l} ctx={ctx} question={question} edit={editor} />)}
      </SortableContext>
    </DndContext>
  );
}
