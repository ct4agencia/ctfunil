"use client";

import { useEffect, useRef, useState } from "react";
import { Popover, Select } from "radix-ui";
import { Check, ChevronDown, Search } from "lucide-react";
import "./workspace-select.css";

type WorkspaceSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  label: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  preserveFocus?: boolean;
  searchable?: boolean;
};

export function WorkspaceSelect(props: WorkspaceSelectProps) {
  const { searchable, ...selectProps } = props;
  return searchable ? <SearchableSelect {...selectProps} /> : <StandardSelect {...selectProps} />;
}

function SearchableSelect({ value, onChange, options, label, disabled, className, id, preserveFocus }: WorkspaceSelectProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const selected = useRef(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const currentOption = options.find(option => option.value === value);
  const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
  const needle = normalize(query.trim());
  const visibleOptions = options.filter(option => normalize(option.label + " " + option.value).includes(needle));

  return (
    <Popover.Root open={open} onOpenChange={next => { setOpen(next); setQuery(""); }}>
      <Popover.Trigger ref={trigger} id={id} type="button" disabled={disabled} className={`ct-select-trigger ${className || ""}`} aria-label={`${label}: ${currentOption?.label || value || "Selecionar"}`}>
        <span>{currentOption?.label || value || "Selecionar"}</span><ChevronDown size={14} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal container={trigger.current?.closest("dialog") || undefined}>
        <Popover.Content
          className="ct-select-content ct-select-searchable"
          aria-label={label}
          align="start"
          sideOffset={5}
          onOpenAutoFocus={event => { event.preventDefault(); search.current?.focus(); }}
          onCloseAutoFocus={event => {
            if (preserveFocus && selected.current) event.preventDefault();
            selected.current = false;
          }}
        >
          <div className="ct-select-search-field">
            <Search size={14} aria-hidden="true" />
            <input ref={search} type="search" aria-label={`Buscar em ${label.toLocaleLowerCase("pt-BR")}`} placeholder="Buscar opções" value={query} onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter") event.preventDefault();
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  event.currentTarget.parentElement?.nextElementSibling?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
                }
              }}
            />
          </div>
          <div className="ct-select-search-options" role="group" aria-label="Opções"
            onKeyDown={event => {
              if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
              const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
              const index = buttons.findIndex(button => button === event.target);
              if (index < 0) return;
              event.preventDefault();
              if (event.key === "Home") buttons[0]?.focus();
              if (event.key === "End") buttons.at(-1)?.focus();
              if (event.key === "ArrowDown") buttons[index + 1]?.focus();
              if (event.key === "ArrowUp") {
                if (index === 0) search.current?.focus();
                else buttons[index - 1]?.focus();
              }
            }}>
            {visibleOptions.map(option => (
              <button key={option.value} type="button" className="ct-select-item" aria-pressed={option.value === value} disabled={option.disabled}
                onClick={() => {
                  selected.current = true;
                  onChange(option.value);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span>{option.label}</span>{option.value === value && <Check size={14} aria-hidden="true" />}
              </button>
            ))}
            {!visibleOptions.length && <p role="status">Nenhuma opção encontrada.</p>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function StandardSelect({value,onChange,options,label,disabled,className,id,preserveFocus}: WorkspaceSelectProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = useRef(false);
  const [portalHost,setPortalHost] = useState<HTMLElement|null>(null);
  useEffect(()=>{setPortalHost(trigger.current?.closest("dialog") || null);},[]);
  return <Select.Root disabled={disabled} value={value || "__ct_empty__"} onValueChange={next=>{selected.current=true;onChange(next === "__ct_empty__" ? "" : next);}}>
    <Select.Trigger ref={trigger} id={id} className={`ct-select-trigger ${className || ""}`} aria-label={label}><Select.Value/><Select.Icon><ChevronDown size={14}/></Select.Icon></Select.Trigger>
    <Select.Portal container={portalHost || undefined}><Select.Content className="ct-select-content" position="popper" sideOffset={5} align="start" onCloseAutoFocus={event=>{if(preserveFocus&&selected.current)event.preventDefault();selected.current=false;}}><Select.Viewport>
      {value && !options.some(option=>option.value===value) && <Select.Item className="ct-select-item" value={value}><Select.ItemText>{value}</Select.ItemText><Select.ItemIndicator><Check size={14}/></Select.ItemIndicator></Select.Item>}
      {options.map(option=><Select.Item className="ct-select-item" value={option.value || "__ct_empty__"} disabled={option.disabled} key={option.value}><Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator><Check size={14}/></Select.ItemIndicator></Select.Item>)}
    </Select.Viewport></Select.Content></Select.Portal>
  </Select.Root>;
}
