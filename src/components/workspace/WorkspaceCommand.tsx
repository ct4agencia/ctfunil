"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Search, X } from "lucide-react";
import { sectionLinks } from "./section-links";

const destinations = [
  { label: "Meus funis", href: "/dashboard", group: "Painel", terms: "dashboard biblioteca funis" },
  { label: "Projetos", href: "/ctfunil", group: "Painel", terms: "páginas quizzes" },
  { label: "Analytics", href: "/analytics", group: "Painel", terms: "métricas relatórios leads" },
  { label: "Configurações", href: "/ctfunil/configuracoes", group: "Painel", terms: "geral preferências configurações" },
  { label: "Configurações do assistente", href: "/ctfunil/configuracoes?tab=assistente", group: "Assistente", terms: "api gemini chave modelo" },
  { label: "Configurações de importação", href: "/ctfunil/configuracoes?tab=importacao", group: "Editor", terms: "zip html design" },
  { label: "Assistente de criação", href: "/ctfunil#assistente", group: "Assistente", terms: "chat gemini configuração ia" },
  { label: "Laboratório do construtor", href: "/lab/construtor", group: "Editor", terms: "rascunho configurar design fluxo etapas" },
  { label: "Anexar referência", href: "/ctfunil#anexar-referencia", group: "Assistente", terms: "importar arquivo zip html" },
  { label: "Editar o exemplo da Sônia", href: "/lab/sonia?view=builder", group: "Editor", terms: "roleta componentes configurações" },
  ...sectionLinks.flatMap(section => section.tabs.map(([key, label]) => ({
    label, href: `${section.path}?tab=${key}`, group: section.group, terms: key,
  }))),
];

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export default function WorkspaceCommand() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const listId = useId();
  const list = useRef<HTMLUListElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const options = destinations.filter(({ label, group, terms }) =>
    normalize(query).split(/\s+/).every(term => normalize(`${label} ${group} ${terms}`).includes(term))
  );

  function open() {
    setQuery("");
    setActive(0);
    if (!dialog.current?.open) dialog.current?.showModal();
    input.current?.focus();
  }

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    if (dialog.current?.open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, query]);

  function navigate(href: string) {
    dialog.current?.close();
    const target = new URL(href, window.location.href);
    if (target.hash && target.pathname === window.location.pathname) {
      target.search = window.location.search;
      window.location.assign(target);
      document.getElementById(target.hash.slice(1))?.scrollIntoView({ block: "start" });
    } else if (target.hash || target.search) {
      window.location.assign(target);
    } else {
      router.push(href);
    }
  }

  return <>
    <button type="button" className="ct-icon-button ct-command-trigger" onClick={open} aria-label="Buscar no CTFunil" title="Buscar no CTFunil (Ctrl+K)">
      <Search size={17} aria-hidden="true" /><kbd aria-hidden="true">Ctrl K</kbd>
    </button>
    <dialog className="ct-command" ref={dialog} aria-label="Buscar no CTFunil" onClick={event => {
      if (event.target === dialog.current) dialog.current.close();
    }}>
      <div className="ct-command-surface">
        <div className="ct-command-input">
          <Search size={20} aria-hidden="true" />
          <input ref={input} aria-label="Buscar telas e ações" aria-controls={listId} value={query}
            onChange={event => { setQuery(event.target.value); setActive(0); }}
            onKeyDown={event => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const delta = event.key === "ArrowDown" ? 1 : -1;
                if (options.length) setActive(index => (index + delta + options.length) % options.length);
              } else if (event.key === "Enter" && options[active]) {
                event.preventDefault();
                navigate(options[active].href);
              }
            }}
            placeholder="Buscar telas e ações…" />
          <button type="button" className="ct-icon-button" onClick={() => dialog.current?.close()} aria-label="Fechar busca"><X size={17} /></button>
        </div>
        <ul id={listId} ref={list}>
          {options.map(({ href, label, group }, index) => <li key={href}>
            <button type="button" data-active={index === active} onMouseEnter={() => setActive(index)} onClick={() => navigate(href)}>
              <span>{label}<small>{group}</small></span><ArrowUpRight size={15} aria-hidden="true" />
            </button>
          </li>)}
        </ul>
        {options.length === 0 && <p role="status">Nenhuma tela encontrada.</p>}
      </div>
    </dialog>
  </>;
}
