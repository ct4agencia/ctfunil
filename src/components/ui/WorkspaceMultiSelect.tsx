"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import WorkspaceCheckbox from "./WorkspaceCheckbox";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Option = { value: string; label: string; detail?: string };

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export default function WorkspaceMultiSelect({ label, options, values, onChange, emptyLabel }: {
  label: string;
  options: Option[];
  values: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
}) {
  const id = useId();
  const root = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const reducedMotion = useReducedMotion();
  const selected = new Set(values);
  const visible = options.filter(option => normalize(`${option.label} ${option.detail ?? ""}`).includes(normalize(query)));
  const visibleValues = new Set(visible.map(option => option.value));
  const visibleSelected = visible.filter(option => selected.has(option.value)).length;
  const allVisibleSelected = visible.length > 0 && visibleSelected === visible.length;
  const partiallySelected = visibleSelected > 0 && !allVisibleSelected;

  function toggleVisible() {
    onChange(allVisibleSelected
      ? values.filter(value => !visibleValues.has(value))
      : [...new Set([...values, ...visibleValues])]);
  }

  const toggle = (value: string) => onChange(selected.has(value) ? values.filter(item => item !== value) : [...values, value]);

  return <div className="ct-multi-select">
    <details ref={root} className="ct-filter-disclosure" onKeyDown={event => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (root.current) root.current.open = false;
      trigger.current?.focus();
    }}>
      <summary ref={element => { trigger.current = element; }} aria-controls={id}>
        <span>{label}{!values.length && emptyLabel ? <small>{emptyLabel}</small> : null}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div id={id} className="ct-multi-panel">
        <label className="ct-search"><Search size={15} aria-hidden="true" /><input type="search" aria-label={`Buscar em ${label}`} value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar opção" /></label>
        {visible.length > 1 && <label className="ct-multi-option ct-multi-all">
          <WorkspaceCheckbox checked={allVisibleSelected} mixed={partiallySelected} onChange={toggleVisible} />
          <span>{query.trim() ? "Selecionar resultados da busca" : "Selecionar todas as opções"}</span>
        </label>}
        <fieldset>
          <legend className="sr-only">{label}</legend>
          {visible.map(option => <label className="ct-multi-option" key={option.value}>
            <WorkspaceCheckbox checked={selected.has(option.value)} onChange={() => toggle(option.value)} />
            <span>{option.label}{option.detail && <small>{option.detail}</small>}</span>
          </label>)}
          {!visible.length && <p role="status" className="ct-multi-empty">Nenhuma opção encontrada.</p>}
        </fieldset>
      </div>
    </details>
    {values.length > 0 && <div className="ct-multi-selected">
      <div role="status" className="sr-only">{values.length} {values.length === 1 ? "opção selecionada" : "opções selecionadas"}</div>
      <AnimatePresence initial={false}>{options.filter(option => selected.has(option.value)).map(option =>
        <motion.button key={option.value} type="button" aria-label={`Remover ${option.label}`} onClick={() => {
            toggle(option.value);
            trigger.current?.focus();
          }}
          initial={reducedMotion ? false : { opacity: 0, scale: .94 }} animate={{ opacity: 1, scale: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0, scale: .94 }} transition={{ duration: reducedMotion ? 0 : .16 }}>
          {option.label}<X size={13} aria-hidden="true" />
        </motion.button>
      )}</AnimatePresence>
      <button type="button" onClick={() => {
        onChange([]);
        trigger.current?.focus();
      }}>Limpar seleção</button>
    </div>}
  </div>;
}
