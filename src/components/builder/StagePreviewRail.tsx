"use client";

import { useState } from "react";

export default function StagePreviewRail({ stages, selected, onSelect }: {
  stages: { id: string; title?: string; disabled?: boolean }[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const [pointed, setPointed] = useState<number | null>(null);
  if (stages.length < 2) return null;
  const shown = pointed !== null && stages[pointed] ? pointed : selected;
  const stageLabel = (index: number) => stages[index]?.title || `Etapa ${index + 1}`;

  return <nav aria-label="Etapas na prévia" className="ct-preview-rail" onPointerLeave={() => setPointed(null)}>
    <p className="ct-preview-rail-caption">
      <span>{shown + 1} de {stages.length}</span>
      <strong>{stageLabel(shown)}</strong>
      {stages[shown]?.disabled && <small>Desativada</small>}
    </p>
    <div className="ct-preview-ticks">
      {stages.map((stage, index) => <button type="button" key={stage.id}
        aria-current={selected === index ? "step" : undefined}
        aria-label={`Etapa ${index + 1}: ${stageLabel(index)}`}
        data-near={pointed !== null && Math.abs(index - pointed) === 1}
        onPointerEnter={event => { if (event.pointerType !== "touch") setPointed(index); }}
        onFocus={() => setPointed(index)} onBlur={() => setPointed(null)}
        onClick={() => { onSelect(index); setPointed(null); }}>
        <span aria-hidden="true" />
      </button>)}
    </div>
  </nav>;
}
