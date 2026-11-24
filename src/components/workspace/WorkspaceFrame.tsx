"use client";

import Link from "next/link";
import WorkspaceCommand from "./WorkspaceCommand";
import WorkspaceSignOut from "./WorkspaceSignOut";
import WorkspaceNoticeHistory from "./WorkspaceNoticeHistory";
import { sectionLinks, settingsSection } from "./section-links";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { Activity, ChevronDown, ChevronRight, FolderKanban, GitBranch, Menu, Monitor, Moon, Settings, Sparkles, Sun, X } from "lucide-react";
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
    const details = event.currentTarget;
    if (event.key === "Escape") {
      if (!details.open) return;
      event.preventDefault();
      event.stopPropagation();
      details.open = false;
      summary.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    if (!details.open && event.target !== summary.current) return;
    event.preventDefault();
    details.open = true;
    const options = Array.from(details.querySelectorAll<HTMLButtonElement>(".ct-theme-options button"));
    const current = options.findIndex(option => option === document.activeElement);
    const last = options.length - 1;
    const next = event.key === "Home" ? 0
      : event.key === "End" ? last
      : event.key === "ArrowDown" ? (current + 1) % options.length
      : current <= 0 ? last : current - 1;
    options[next]?.focus();
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

function WorkspaceAccountDialog({ email, dialogRef }: { email: string; dialogRef: RefObject<HTMLDialogElement | null> }) {
  return <dialog id="ct-workspace-account-dialog" ref={dialogRef} className="ct-confirm" aria-labelledby="ct-workspace-account-title">
      <h2 id="ct-workspace-account-title" className="font-semibold">Minha conta</h2>
      <p className="mt-2 break-all text-sm text-ct-dim">{email}</p>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button type="button" autoFocus className="ct-confirm-cancel" onClick={() => dialogRef.current?.close()}>Fechar</button>
        <WorkspaceSignOut className="ct-action-link" />
      </div>
    </dialog>;
}

export function EditorTop({ label, busy, accountEmail }: { label: string; busy?: boolean; accountEmail?: string }) {
  const accountDialog = useRef<HTMLDialogElement>(null);
  return <div className="ct-editor-top"><Brand/><div className="ct-top-tools">
    <WorkspaceCommand /><ActivityPill label={label} busy={busy}/><ThemeButton/>
    {accountEmail && <button type="button" className="ct-icon-button ct-editor-account" aria-label="Minha conta"
      aria-haspopup="dialog" aria-controls="ct-workspace-account-dialog" onClick={() => accountDialog.current?.showModal()}>
      <span className="ct-workspace-account-avatar" aria-hidden="true">{accountEmail[0].toLocaleUpperCase("pt-BR")}</span>
    </button>}
  </div>{accountEmail && <WorkspaceAccountDialog email={accountEmail} dialogRef={accountDialog} />}</div>;
}

let pendingRailSelection: { href: string; top: number } | undefined;

export function WorkspaceFrame({ title, activeTab, demo = false, accountEmail, children }: { title: string; activeTab?: string; demo?: boolean; accountEmail?: string; children: ReactNode }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(sessionStorage.getItem("ctfunil-sidebar-collapsed") === "true"); } catch {}
  }, []);

  function toggleNavigation() {
    const next = !collapsed;
    setCollapsed(next);
    try { sessionStorage.setItem("ctfunil-sidebar-collapsed", String(next)); } catch {}
  }
  const drawer = useRef<HTMLDialogElement>(null);
  const accountDialog = useRef<HTMLDialogElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const desktopToggle = useRef<HTMLButtonElement>(null);
  const pageContent = useRef<HTMLElement>(null);
  const mobileNav = useRef<HTMLElement>(null);
  const [projectsSection, setProjectsSection] = useState<"biblioteca" | "assistente">("biblioteca");
  useEffect(() => { drawer.current?.close(); }, [path]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    function closeMobileDrawer(event: MediaQueryListEvent) {
      const dialog = drawer.current;
      if (!event.matches || !dialog?.open) return;
      dialog.close();
      desktopToggle.current?.focus();
    }
    desktop.addEventListener("change", closeMobileDrawer);
    return () => desktop.removeEventListener("change", closeMobileDrawer);
  }, []);
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
  useEffect(() => {
    if (path !== "/ctfunil") return;
    function focusAssistantFromHash() {
      if (window.location.hash === "#assistente") {
        document.getElementById("ctfunil-builder-title")?.focus({ preventScroll: true });
      }
    }
    window.addEventListener("hashchange", focusAssistantFromHash);
    focusAssistantFromHash();
    return () => window.removeEventListener("hashchange", focusAssistantFromHash);
  }, [path]);
  const assistantCurrent = path === "/ctfunil/assistente" || (path === "/ctfunil" && projectsSection === "assistente");
  function selectDestination(href: string) {
    const current = document.querySelector<HTMLElement>('#ct-side-navigation a[aria-current="page"]:has(> svg)');
    pendingRailSelection = current?.offsetWidth && path !== href
      ? { href, top: current.getBoundingClientRect().top }
      : undefined;
    drawer.current?.close();
  }

  useEffect(() => {
    const previous = pendingRailSelection;
    pendingRailSelection = undefined;
    if (previous?.href !== path || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const next = document.querySelector<HTMLElement>('#ct-side-navigation a[aria-current="page"]:has(> svg)');
    if (!next?.offsetWidth) return;
    const shift = previous.top - next.getBoundingClientRect().top;
    if (!shift) return;
    next.style.setProperty("--ct-rail-selection-start", `${shift}px`);
    next.dataset.railSelectionMoving = "true";
    return () => {
      next.style.removeProperty("--ct-rail-selection-start");
      delete next.dataset.railSelectionMoving;
    };
  }, [path]);

  const renderLinks = () => destinations.map(({ href, label, icon: Icon }) => (
    <Link key={href} href={href} aria-current={(path === href || (href !== "/ctfunil" && path.startsWith(href + "/"))) && !(href === "/ctfunil" && assistantCurrent) ? "page" : undefined}
      aria-label={label} title={label} onNavigate={() => selectDestination(href)}><Icon size={17} aria-hidden="true" /><span>{label}</span></Link>
  ));
  const activeSection = [...sectionLinks, settingsSection].find(section => section.path === path);
  const tabLabel = activeSection?.tabs.find(([key]) => key === activeTab)?.[1];
  function renderSectionLinks(sections: readonly (typeof sectionLinks[number] | typeof settingsSection)[] = sectionLinks) {
    return sections.map(section => (
    <details key={section.path} className="ct-nav-section" open={section === activeSection}>
      <summary>{section.label}<ChevronDown size={14} aria-hidden="true" /></summary>
      <ul>
        {section.tabs.map(([key, label]) => {
          const current = section === activeSection && key === activeTab;
          return <li key={key}>
            <Link href={`${section.path}?tab=${key}`} aria-current={current ? "page" : undefined}
              onNavigate={() => drawer.current?.close()}>{label}</Link>
          </li>;
        })}
      </ul>
    </details>
    ));
  }
  const settingsLink = <Link href="/ctfunil/configuracoes" aria-current={path === "/ctfunil/configuracoes" ? "page" : undefined} aria-label="Configurações" title="Configurações" onNavigate={() => selectDestination("/ctfunil/configuracoes")}><Settings size={17} aria-hidden="true" /><span>Configurações</span></Link>;
  const assistantLink = <Link href="/ctfunil/assistente" aria-current={assistantCurrent ? "page" : undefined} aria-label="Assistente de criação" title="Assistente de criação" onNavigate={() => selectDestination("/ctfunil/assistente")}>
    <Sparkles size={17} aria-hidden="true" /><span>Assistente</span>
  </Link>;
  const accountButton = accountEmail && <button type="button" className="ct-workspace-account"
    aria-label="Minha conta" aria-haspopup="dialog" aria-controls="ct-workspace-account-dialog"
    onClick={() => accountDialog.current?.showModal()}>
    <span className="ct-workspace-account-avatar" aria-hidden="true">{accountEmail[0].toLocaleUpperCase("pt-BR")}</span>
    <span className="ct-workspace-account-label"><strong>Minha conta</strong><small>{accountEmail}</small></span>
  </button>;
  return <div className="ct-workspace ct-frame" data-collapsed={collapsed}>
    <a className="ct-skip-link" href="#ct-workspace-content">Pular para o conteúdo</a>
    <aside id="ct-side-navigation" className="ct-rail">
      <Link href="/ctfunil" className="ct-brand-link" aria-label="CTFunil"><Brand /></Link>
      <div className="ct-org"><BrandOrb /><strong>CT4 Educação<small>Espaço de trabalho</small></strong></div>
      <nav aria-label="Navegação principal">
        <div role="group" aria-label="Workspace"><p>Workspace</p>{renderLinks()}{renderSectionLinks()}</div>
        <div className="ct-rail-group" role="group" aria-label="Seu espaço"><p>Seu espaço</p>{assistantLink}{settingsLink}{renderSectionLinks([settingsSection])}</div>
      </nav>
      {accountButton && <footer>{accountButton}</footer>}
    </aside>
    <button type="button" className="ct-sidebar-edge" tabIndex={-1} aria-controls="ct-side-navigation"
      aria-expanded={!collapsed} aria-label={collapsed ? "Expandir navegação lateral" : "Recolher navegação lateral"}
      title={collapsed ? "Expandir navegação lateral" : "Recolher navegação lateral"} onClick={() => {
        toggleNavigation();
        desktopToggle.current?.focus({ preventScroll: true });
      }} />
    <div className="ct-frame-body">
      <header className="ct-frame-top">
        <nav className="ct-crumb" aria-label="Você está em"><button ref={desktopToggle} type="button" className="ct-icon-button ct-collapse ct-expand-icon" onClick={toggleNavigation} aria-controls="ct-side-navigation" aria-expanded={!collapsed} aria-label="Alternar navegação lateral"><Menu size={18} aria-hidden="true" /><span className="ct-expand-icon-label" aria-hidden="true">Navegação</span></button>
          <Link href="/ctfunil">CTFunil</Link><ChevronRight size={13} aria-hidden="true"/>
          {tabLabel ? <><span>{title}</span><ChevronRight size={13} aria-hidden="true"/>
            <strong key={activeTab} className="ct-current-crumb" aria-current="page">{tabLabel}</strong></> : <strong aria-current="page">{title}</strong>}
        </nav>
        <Link className="ct-mobile-brand" href="/ctfunil" aria-label="CTFunil"><BrandOrb /></Link>
        <div className="ct-top-tools"><WorkspaceCommand /><ActivityPill label={demo ? "Demonstração" : "Workspace"} /><WorkspaceNoticeHistory /><ThemeButton /></div>
      </header>
      {demo && <div className="ct-demo-strip">Demonstração local · projetos de exemplo</div>}
      <main id="ct-workspace-content" tabIndex={-1} ref={pageContent} className="ct-page" onFocusCapture={event => {
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
    <nav ref={mobileNav} className="ct-bottom-nav" aria-label="Navegação móvel">
      {renderLinks()}{assistantLink}
      <button type="button" aria-haspopup="dialog" aria-controls="ct-mobile-menu" aria-expanded={drawerOpen} aria-label="Mais opções"
        data-current={path === "/ctfunil/configuracoes" || undefined}
        onClick={() => {
          drawer.current?.showModal();
          setDrawerOpen(true);
        }}><Menu size={18} aria-hidden="true"/><span>Mais</span></button>
    </nav>
    <dialog ref={drawer} id="ct-mobile-menu" onClose={() => { if (!drawer.current?.open) setDrawerOpen(false); }} aria-label="Menu de navegação" className="ct-drawer" onClick={(event) => { if (event.target === drawer.current) drawer.current.close(); }}>
      <div><div className="ct-drawer-head"><Brand/><button type="button" className="ct-icon-button" aria-label="Fechar menu" onClick={() => drawer.current?.close()}><X size={18}/></button></div>
      <nav aria-label="Todas as telas">{renderLinks()}{assistantLink}{settingsLink}{renderSectionLinks([settingsSection])}{renderSectionLinks()}</nav>{accountButton}</div>
    </dialog>
    {accountEmail && <WorkspaceAccountDialog email={accountEmail} dialogRef={accountDialog} />}
  </div>;
}

