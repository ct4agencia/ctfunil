"use client";

import Link from "next/link";
import WorkspaceCommand from "./WorkspaceCommand";
import WorkspaceNoticeHistory from "./WorkspaceNoticeHistory";
import { sectionLinks } from "./section-links";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Activity, ChevronDown, ChevronRight, FolderKanban, GitBranch, Menu, MessageSquare, Monitor, Moon, Sun, X } from "lucide-react";
import { ThinkingOrb, type OrbSize, type OrbState } from "thinking-orbs";

const destinations = [
  { href: "/ctfunil", label: "Projetos", icon: FolderKanban },
  { href: "/dashboard", label: "Meus funis", icon: GitBranch },
  { href: "/analytics", label: "Analytics", icon: Activity },
];

function subscribeAppearance(notify: () => void) {
  const media = [matchMedia("(prefers-color-scheme: dark)"), matchMedia("(prefers-reduced-motion: reduce)")];
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ct-mode"] });
  media.forEach((item) => item.addEventListener("change", notify));
  return () => {
    observer.disconnect();
    media.forEach((item) => item.removeEventListener("change", notify));
  };
}

function isLight() {
  const mode = document.documentElement.dataset.ctMode;
  return mode === "light" || (mode === "system" && matchMedia("(prefers-color-scheme: light)").matches);
}

const appearanceOptions = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

function appearanceMode() {
  const mode = document.documentElement.dataset.ctMode;
  return mode === "light" || mode === "system" ? mode : "dark";
}

export function ThemeButton() {
  const mode = useSyncExternalStore(subscribeAppearance, appearanceMode, () => "dark");
  const menu = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const Icon = appearanceOptions.find(option => option.value === mode)?.icon || Moon;
  const choose = (next: (typeof appearanceOptions)[number]["value"]) => {
    const commit = () => {
      document.documentElement.dataset.ctMode = next;
      try { localStorage.setItem("ct-workspace-theme", next); } catch {}
    };
    if (next !== mode && document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.startViewTransition(commit);
    } else commit();
    if (menu.current) menu.current.open = false;
    summary.current?.focus();
  };

  return <details ref={menu} className="ct-theme-picker" onKeyDown={event => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (menu.current) menu.current.open = false;
    summary.current?.focus();
  }}>
    <summary ref={element => { summary.current = element; }} className="ct-icon-button ct-theme-button ct-expand-icon" aria-label="Aparência" title="Aparência">
      <Icon size={18} aria-hidden="true" />
      <span className="ct-expand-icon-label" aria-hidden="true">Aparência</span>
    </summary>
    <div className="ct-theme-options" role="group" aria-label="Tema do CTFunil">
      {appearanceOptions.map(({ value, label, icon: ItemIcon }) => <button type="button" key={value} aria-pressed={mode === value} onClick={() => choose(value)}>
        <ItemIcon size={16} aria-hidden="true" />{label}
      </button>)}
    </div>
  </details>;
}

export function WorkspaceOrb({ state, size }: { state: OrbState; size: OrbSize }) {
  const paused = useSyncExternalStore(subscribeAppearance, () => matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
  const light = useSyncExternalStore(subscribeAppearance, isLight, () => false);
  return <ThinkingOrb state={state} theme={light ? "light" : "dark"} size={size} paused={paused} aria-hidden="true" />;
}

export function ActivityPill({ label, busy = false, receiving = false, decorative = false }: { label: string; busy?: boolean; receiving?: boolean; decorative?: boolean }) {
  return <span className="ct-activity-pill" data-busy={busy} data-receiving={receiving || undefined} role={decorative ? undefined : "status"} aria-hidden={decorative || undefined}>
    <WorkspaceOrb state={receiving ? "composing" : busy ? "working" : "breathing"} size={32} />
    <span className="ct-activity-label" key={label}>{label}</span>
  </span>;
}

function BrandOrb() {
  return <span className="ct-mark" aria-hidden="true"><WorkspaceOrb state="breathing" size={32} /></span>;
}

export function Brand() {
  return <span className="ct-wordmark"><BrandOrb /><span>CTFunil</span></span>;
}

export function AccessOrb() {
  return <WorkspaceOrb state="breathing" size={64} />;
}

export function EditorTop({ label, busy }: { label: string; busy?: boolean }) {
  return <div className="ct-editor-top"><Brand/><div className="ct-top-tools"><WorkspaceCommand /><ActivityPill label={label} busy={busy}/><ThemeButton/></div></div>;
}

export function WorkspaceFrame({ title, activeTab, demo = false, children }: { title: string; activeTab?: string; demo?: boolean; children: ReactNode }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const pageContent = useRef<HTMLElement>(null);
  const mobileNav = useRef<HTMLElement>(null);
  const [projectsSection, setProjectsSection] = useState<"biblioteca" | "assistente">("biblioteca");
  useEffect(() => { drawer.current?.close(); }, [path]);
  useEffect(() => {
    if (path !== "/ctfunil") return;
    const content = pageContent.current;
    const assistant = content?.querySelector("#assistente");
    if (!content || !assistant) return;
    let frame = 0;
    function update() {
      frame = 0;
      const bounds = assistant!.getBoundingClientRect();
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      const inAssistant = bounds.top <= window.innerHeight * .5 || (atBottom && bounds.top < window.innerHeight - 40);
      setProjectsSection(inAssistant ? "assistente" : "biblioteca");
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    const observer = new ResizeObserver(schedule);
    observer.observe(content);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    schedule();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [path]);
  const assistantCurrent = path === "/ctfunil" && projectsSection === "assistente";
  const renderLinks = (mobile = false) => destinations.map(({ href, label, icon: Icon }) => (
    <Link key={href} href={href} aria-current={(path === href || path.startsWith(href + "/")) && !(href === "/ctfunil" && assistantCurrent && !mobile) ? "page" : undefined}
      aria-label={label} title={label} onClick={() => drawer.current?.close()}><Icon size={17} /><span>{label}</span></Link>
  ));
  const activeSection = sectionLinks.find(section => section.path === path);
  const tabLabel = activeSection?.tabs.find(([key]) => key === activeTab)?.[1];
  const renderSectionLinks = () => sectionLinks.map(section => (
    <details key={section.path} className="ct-nav-section" open={section === activeSection}>
      <summary>{section.label}<ChevronDown size={14} aria-hidden="true" /></summary>
      <ul>
        {section.tabs.map(([key, label]) => {
          const current = section === activeSection && key === activeTab;
          return <li key={key}>
            <Link href={`${section.path}?tab=${key}`} aria-current={current ? "page" : undefined}
              onClick={() => drawer.current?.close()}>{label}</Link>
          </li>;
        })}
      </ul>
    </details>
  ));
  const assistantLink = <Link href="/ctfunil#assistente" aria-current={assistantCurrent ? "location" : undefined} aria-label="Assistente de criação" title="Assistente de criação" onClick={() => drawer.current?.close()}><MessageSquare size={17}/><span>Assistente de criação</span></Link>;
  return <div className="ct-workspace ct-frame" data-collapsed={collapsed}>
    <aside className="ct-rail">
      <Link href="/ctfunil" className="ct-brand-link" aria-label="CTFunil"><Brand /></Link>
      <div className="ct-org"><BrandOrb /><strong>CT4 Educação<small>Espaço de trabalho</small></strong></div>
      <nav aria-label="Navegação principal"><p>Workspace</p>{renderLinks()}{assistantLink}{renderSectionLinks()}</nav>
    </aside>
    <div className="ct-frame-body">
      <header className="ct-frame-top">
        <nav className="ct-crumb" aria-label="Você está em"><button type="button" className="ct-icon-button ct-collapse ct-expand-icon" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed} aria-label="Alternar navegação lateral"><Menu size={18} aria-hidden="true" /><span className="ct-expand-icon-label" aria-hidden="true">Navegação</span></button>
          <Link href="/ctfunil">CTFunil</Link><ChevronRight size={13} aria-hidden="true"/>
          {tabLabel ? <><span>{title}</span><ChevronRight size={13} aria-hidden="true"/>
            <strong key={activeTab} className="ct-current-crumb" aria-current="page">{tabLabel}</strong></> : <strong aria-current="page">{title}</strong>}
        </nav>
        <Link className="ct-mobile-brand" href="/ctfunil" aria-label="CTFunil"><BrandOrb /></Link>
        <div className="ct-top-tools"><WorkspaceCommand /><ActivityPill label={demo ? "Demonstração" : "Workspace"} /><WorkspaceNoticeHistory /><ThemeButton /></div>
      </header>
      {demo && <div className="ct-demo-strip">Demonstração local · projetos de exemplo</div>}
      <main ref={pageContent} className="ct-page" onFocusCapture={event => {
        const target = event.target;
        const nav = mobileNav.current;
        if (!(target instanceof HTMLElement) || !event.currentTarget.contains(target) || !nav?.offsetHeight) return;
        requestAnimationFrame(() => {
          if (document.activeElement !== target || !nav.offsetHeight) return;
          const control = target.getBoundingClientRect();
          const bar = nav.getBoundingClientRect();
          if (control.bottom > bar.top && control.top < bar.bottom &&
              control.right > bar.left && control.left < bar.right) {
            target.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
          }
        });
      }}>{children}</main>
    </div>
    <nav ref={mobileNav} className="ct-bottom-nav" aria-label="Navegação móvel">{renderLinks(true)}<button type="button" aria-haspopup="dialog" aria-label="Mais opções" onClick={() => drawer.current?.showModal()}><Menu size={18} aria-hidden="true"/><span>Mais</span></button></nav>
    <dialog ref={drawer} aria-label="Menu de navegação" className="ct-drawer" onClick={(event) => { if (event.target === drawer.current) drawer.current.close(); }}>
      <div><div className="ct-drawer-head"><Brand/><button type="button" className="ct-icon-button" aria-label="Fechar menu" onClick={() => drawer.current?.close()}><X size={18}/></button></div>
      <nav aria-label="Todas as telas">{renderLinks()}{assistantLink}{renderSectionLinks()}</nav></div>
    </dialog>
  </div>;
}

