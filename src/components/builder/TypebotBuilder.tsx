"use client";

import { StatefulButton } from "@/components/referencias/beui/motion/button/stateful";
import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";
import ActiveTab from "@/components/ui/ActiveTab";
import { funnelPublicUrl } from "@/lib/quiz/public-url";
import WorkspaceNotice from "@/components/ui/WorkspaceNotice";
import WorkspaceNoticeHistory, { recordWorkspaceNotice } from "@/components/workspace/WorkspaceNoticeHistory";
import { EditorTop } from "@/components/workspace/WorkspaceFrame";

import { useContext, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Funnel } from "@/lib/quiz/types";
import type { TbBlock, TbFunnel, TbGroup } from "@/lib/quiz/typebot/types";
import { TB_BLOCK_LABEL, TB_DEFAULT_THEME, isInput } from "@/lib/quiz/typebot/types";
import ViewCurrentPage from "./ViewCurrentPage";
import ChatRunner from "@/components/quiz/typebot/ChatRunner";
import { LeadsTab } from "@/components/builder/LayersBuilder";
import type { DateRange } from "@/components/ui/WorkspaceDateRange";
import { ImageField, LocalDraftContext } from "@/components/builder/fields";
import ColorField from "@/components/ui/ColorField";
import FunnelSettingsPanel from "@/components/builder/FunnelSettingsPanel";
import TypebotFlow from "@/components/builder/TypebotFlow";
import DeleteConfirmationIcon from "@/components/ui/DeleteConfirmationIcon";
import { saveFunnelAction } from "@/app/builder/[slug]/actions";

type BlockPatch = Record<string, unknown> | ((current: TbBlock) => Record<string, unknown>);

function genId() {
  try { return "b" + crypto.randomUUID().slice(0, 8); } catch { return "b" + Math.random().toString(36).slice(2, 10); }
}
const inp = "w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm outline-none focus:border-neutral-500";
const Lbl = ({ children }: { children: React.ReactNode }) => <label className="mb-0.5 mt-2 block text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{children}</label>;

const ADD_TYPES: [string, string[]][] = [
  ["Bolhas", ["text", "image", "audio", "video", "embed"]],
  ["WhatsApp", ["date", "voice", "call", "system", "document", "link", "location", "contact"]],
  ["Inputs", ["input-text", "input-number", "input-email", "input-phone", "input-url", "input-date", "input-time", "input-rating", "input-choice", "input-picture", "input-cards", "input-file"]],
  ["Lógica", ["wait", "set-variable", "condition", "redirect"]],
  ["Página", ["vsl"]],
];

function newBlock(type: string): TbBlock {
  const id = genId();
  switch (type) {
    case "text": return { id, type: "text", richText: "Nova mensagem" };
    case "image": return { id, type: "image", url: "" };
    case "audio": return { id, type: "audio", url: "" };
    case "video": return { id, type: "video", url: "" };
    case "embed": return { id, type: "embed", html: "" };
    case "date": return { id, type: "date", label: "Hoje" };
    case "voice": return { id, type: "voice", duration: "0:08" };
    case "call": return { id, type: "call", mode: "voice", status: "outgoing", duration: "" };
    case "system": return { id, type: "system", variant: "encrypted" };
    case "document": return { id, type: "document", name: "Documento.pdf", size: "PDF · 1,2 MB" };
    case "link": return { id, type: "link", url: "https://", title: "Título do link", desc: "", image: "" };
    case "location": return { id, type: "location", address: "", image: "" };
    case "contact": return { id, type: "contact", name: "", phone: "", avatar: "" };
    case "input-text": return { id, type: "input-text", variable: "resposta", placeholder: "Digite aqui…", button: "Enviar" };
    case "input-url": return { id, type: "input-url", variable: "site", placeholder: "https://…", button: "Enviar" };
    case "input-date": return { id, type: "input-date", variable: "data", button: "Enviar" };
    case "input-time": return { id, type: "input-time", variable: "hora", button: "Enviar" };
    case "input-rating": return { id, type: "input-rating", variable: "avaliacao", max: 5, icon: "star" };
    case "input-picture": return { id, type: "input-picture", variable: "escolha", items: [{ id: genId(), label: "Opção 1", image: "" }] };
    case "input-cards": return { id, type: "input-cards", items: [{ id: genId(), title: "Card 1", desc: "", image: "", button: "Selecionar" }] };
    case "input-file": return { id, type: "input-file", variable: "arquivo", button: "Anexar arquivo" };
    case "input-number": return { id, type: "input-number", variable: "numero", placeholder: "Digite…", button: "Enviar" };
    case "input-email": return { id, type: "input-email", variable: "email", placeholder: "seu@email.com", button: "Enviar" };
    case "input-phone": return { id, type: "input-phone", variable: "whatsapp", placeholder: "WhatsApp com DDD", button: "Enviar" };
    case "input-choice": return { id, type: "input-choice", variable: "opcao", items: [{ id: genId(), label: "Opção 1" }] };
    case "wait": return { id, type: "wait", seconds: 2 };
    case "set-variable": return { id, type: "set-variable", variable: "var", expression: "" };
    case "condition": return { id, type: "condition", items: [{ id: genId(), variable: "var", op: "igual", value: "" }] };
    case "redirect": return { id, type: "redirect", url: "https://", newTab: false };
    case "vsl": return { id, type: "vsl", title: "Assista o vídeo abaixo e veja como ativar sua Bolsa de Estudos 👇", barText: "⚠️ ATENÇÃO: ESTE VÍDEO SAI DO AR EM BREVE", embedHtml: "", checkoutUrl: "https://", ctaText: "QUERO GARANTIR MINHA VAGA", pitchRevealAt: 8, effect: "shine-pulse", background: "#ffffff" };
    default: return { id, type: "text", richText: "" };
  }
}

const ICON: Record<string, string> = {
  text: "💬", image: "🖼️", audio: "🎧", video: "🎬", embed: "🔗",
  date: "📅", voice: "🎤", call: "📞", system: "🔒",
  document: "📄", link: "🪧", location: "📍", contact: "👤",
  "input-text": "✏️", "input-number": "🔢", "input-email": "📧", "input-phone": "📱", "input-choice": "🔘",
  "input-url": "🌐", "input-date": "📆", "input-time": "🕐", "input-rating": "⭐",
  "input-picture": "🖼️", "input-cards": "🃏", "input-file": "📎",
  wait: "⏲️", "set-variable": "🧮", condition: "🔀", redirect: "↗️", vsl: "📺",
};

export default function TypebotBuilder({ initial, saveLocal, reportHref, sourceSlug, initialGroupId, openLeads = false, initialRange, dashboardHref = "/dashboard", accountEmail }: {
  initial: Funnel;
  reportHref?: string;
  sourceSlug?: string;
  initialGroupId?: string;
  openLeads?: boolean;
  initialRange?: DateRange;
  dashboardHref?: string;
  accountEmail?: string;
  saveLocal?: (funnel: Funnel) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [funnel, setFunnel] = useState<Funnel>(initial);
  const tb = (funnel.settings?.typebot || { startGroup: "", groups: [], variables: [], theme: TB_DEFAULT_THEME, typing: { enabled: true, speed: 28, maxDelay: 1.4 } }) as TbFunnel;
  const groups = tb.groups || [];
  const [selG, setSelG] = useState(() => Math.max(0, groups.findIndex(group => group.id === initialGroupId)));
  const [selB, setSelB] = useState<string | null>(null);
  const [tab, setTab] = useState<"chat" | "fluxo" | "tema" | "leads">(openLeads ? "leads" : "chat");
  const [leadsOpened, setLeadsOpened] = useState(openLeads);
  const canViewLeads = !saveLocal || Boolean(sourceSlug);
  const [panel, setPanel] = useState<"groups" | "blocks" | "preview">("groups");
  const panelId = useId();
  const blocksButton = useRef<HTMLButtonElement>(null);
  const addBlockButton = useRef<HTMLButtonElement>(null);
  const groupDeleteButton = useRef<HTMLButtonElement>(null);
  const groupDeleteCancel = useRef<HTMLButtonElement>(null);
  const [pendingGroupDelete, setPendingGroupDelete] = useState<string | null>(null);
  const [pendingBlockDelete, setPendingBlockDelete] = useState<string | null>(null);
  const blockDeleteTrigger = useRef<HTMLButtonElement>(null);
  const blockDeleteCancel = useRef<HTMLButtonElement>(null);
  const groupTitleField = useRef<HTMLInputElement>(null);
  const [groupDeleteResult, setGroupDeleteResult] = useState<"deleted" | "kept" | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const group = groups[selG];
  const groupDeleteOpen = !!group && pendingGroupDelete === group.id && groups.length > 1;
  const block = group?.blocks.find((b) => b.id === selB) || null;
  const groupOpts = useMemo(() => groups.map((g) => ({ id: g.id, title: g.title })), [groups]);

  const setTb = (next: Partial<TbFunnel> | ((current: TbFunnel) => Partial<TbFunnel>)) =>
    setFunnel(f => {
      const current = (f.settings?.typebot as TbFunnel | undefined) ?? tb;
      const patch = typeof next === "function" ? next(current) : next;
      return { ...f, settings: { ...f.settings, engine: "typebot", typebot: { ...current, ...patch } } };
    });
  const setGroups = (gs: TbGroup[]) => setTb({ groups: gs });
  const patchGroup = (gi: number, patch: Partial<TbGroup>) => setGroups(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const patchBlock = (bid: string, patch: BlockPatch) =>
    setTb(current => ({
      groups: current.groups.map(target => target.id === group?.id ? {
        ...target,
        blocks: target.blocks.map(b => b.id === bid ? { ...b, ...(typeof patch === "function" ? patch(b) : patch) } as TbBlock : b),
      } : target),
    }));
  const addBlock = (type: string) => { const b = newBlock(type); patchGroup(selG, { blocks: [...group.blocks, b] }); setSelB(b.id); setAddOpen(false); addBlockButton.current?.focus(); };
  const delBlock = (bid: string) => { patchGroup(selG, { blocks: group.blocks.filter((b) => b.id !== bid) }); if (selB === bid) setSelB(null); };
  const moveBlock = (bid: string, dir: -1 | 1) => {
    const i = group.blocks.findIndex((b) => b.id === bid); const j = i + dir;
    if (i < 0 || j < 0 || j >= group.blocks.length) return;
    const bs = [...group.blocks];[bs[i], bs[j]] = [bs[j], bs[i]]; patchGroup(selG, { blocks: bs });
  };
  const addGroup = () => {
    const g: TbGroup = { id: genId(), title: `Grupo ${groups.length + 1}`, x: 40, y: 40, blocks: [] };
    setGroups([...groups, g]); setSelG(groups.length); setSelB(null);
  };
  function selectGroup(index: number) {
    setPendingBlockDelete(null);
    setPendingGroupDelete(null);
    setGroupDeleteResult(null);
    setSelG(index);
    setSelB(null);
    setAddOpen(false);
    setPanel("blocks");
    if (matchMedia("(max-width: 900px)").matches) requestAnimationFrame(() => blocksButton.current?.focus());
  }
  function resolveGroupDelete(deleted: boolean) {
    setPendingBlockDelete(null);
    setPendingGroupDelete(null);
    setGroupDeleteResult(deleted ? "deleted" : "kept");
    if (deleted) delGroup(selG);
    requestAnimationFrame(() => (deleted ? groupTitleField.current : groupDeleteButton.current)?.focus());
  }
  function resolveBlockDelete(blockId: string, deleted: boolean) {
    setPendingBlockDelete(null);
    if (deleted) delBlock(blockId);
    requestAnimationFrame(() => (deleted ? addBlockButton.current : blockDeleteTrigger.current)?.focus());
  }
  function delGroup(index: number) {
    const removed = groups[index];
    if (!removed || groups.length <= 1) return;

    function clearDestination<T extends { to?: string }>(item: T): T {
      return item.to === removed.id ? { ...item, to: undefined } : item;
    }

    const remaining = groups.filter(g => g.id !== removed.id).map(g => ({
      ...clearDestination(g),
      blocks: g.blocks.map(b => {
        switch (b.type) {
          case "input-choice":
          case "input-picture":
          case "input-cards":
          case "condition":
            return { ...b, items: b.items.map(item => clearDestination(item)) } as TbBlock;
          default:
            return b;
        }
      }),
    }));
    setTb({ groups: remaining, startGroup: tb.startGroup === removed.id ? remaining[0].id : tb.startGroup });
    setSelG(Math.max(0, index - 1));
    setSelB(null);
  }

  function notify(message: string, error = false) {
    setNotice(recordWorkspaceNotice("Editor", message, error));
  }

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const renamed = funnel.slug !== initial.slug;
      const result = saveLocal
        ? await saveLocal(funnel)
        : await saveFunnelAction(funnel, renamed ? initial.slug : undefined);
      if (result.ok) {
        setGroupDeleteResult(null);
        notify(saveLocal ? "Rascunho salvo neste navegador" : "Salvo");
      }
      else notify(result.error ? `Erro: ${result.error}` : "Erro: não foi possível salvar a conversa.", true);
      if (result.ok && renamed && !saveLocal) window.location.href = `/builder/${funnel.slug}`;
    } catch {
      notify("Erro: não foi possível salvar a conversa.", true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ct-workspace ct-controls ct-typebot-editor flex h-[100dvh] flex-col">
      <EditorTop accountEmail={accountEmail} label={saving ? "Salvando" : "Edição de conversa"} busy={saving}/>
      {/* HEADER */}
      <header className="ct-toolbar ct-typebot-toolbar flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-2.5">
        <div className="ct-typebot-name flex min-w-0 items-center gap-3">
          <Link href={dashboardHref} className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-ct-line px-2 text-xs font-semibold text-ct-dim hover:bg-ct-raised">← Dashboard</Link>
          <input aria-label="Nome do funil" value={funnel.name} onChange={(e) => setFunnel((f) => ({ ...f, name: e.target.value }))} className="w-64 rounded border border-transparent px-1 py-0.5 text-sm font-bold text-neutral-900 hover:border-neutral-200" />
          <span className="text-xs text-neutral-500">/{funnel.slug}</span>
        </div>
        <nav aria-label="Seções do editor conversacional" className="ct-segments">
          {([["chat", "Construtor"], ["fluxo", "Fluxo"], ["tema", "Design"], ["leads", "Leads"]] as const).map(([k, l]) => (
            <button type="button" key={k} disabled={k === "leads" && !canViewLeads} aria-pressed={tab === k} onClick={() => {
              if (k === "leads") setLeadsOpened(true);
              setTab(k);
            }}>
              {tab === k && <ActiveTab group="typebot-builder-tabs" />}<span>{l}</span>
            </button>
          ))}
        </nav>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          {notice && <div className="ct-notice-stack" aria-label="Avisos do editor">
            <WorkspaceNotice {...notice} onDismiss={() => setNotice(null)} />
          </div>}
          <WorkspaceNoticeHistory />
          <button onClick={() => setShowSettings(true)} aria-label="Configurações do funil" title="Configurações do funil (pixel, checkout, domínio, webhooks)" className="rounded-lg border border-neutral-300 px-2.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">⚙</button>
          <StatefulButton type="button" onClick={save} state={saving ? "loading" : "idle"}
            aria-label={saving ? "Salvando…" : "Salvar"} loadingText="Salvando…" size="sm"
            className="ct-primary rounded-lg px-3 text-xs font-bold text-white disabled:opacity-50">
            Salvar
          </StatefulButton>
          <ViewCurrentPage disabled={Boolean(saveLocal) && saving} initialStageId={group?.id}
            stages={groups.map((item, index) => ({ value: item.id, label: `${index + 1}. ${item.title || "Grupo"}` }))}
            prepare={saveLocal ? async () => {
              setSaving(true);
              try {
                const result = await saveLocal(funnel);
                if (!result.ok) notify(result.error || "Não foi possível abrir a visualização.", true);
                return result.ok;
              } finally {
                setSaving(false);
              }
            } : undefined}>
            {groupId => <ChatRunner key={groupId} funnel={funnel} startGroupId={groupId || undefined} preview localOnly />}
          </ViewCurrentPage>
          {!saveLocal && <a href={funnelPublicUrl(funnel)} target="_blank" rel="noreferrer" className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white">Ver ao vivo ↗</a>}
        </div>
      </header>

      {leadsOpened && canViewLeads && (
        <div hidden={tab !== "leads"} className="flex-1 overflow-auto p-4">
          <LeadsTab showStageRetention={false} slug={sourceSlug ?? funnel.slug} readOnly={Boolean(saveLocal)} reportHref={reportHref} initialRange={initialRange} />
        </div>
      )}
      {tab === "leads" ? null : tab === "fluxo" ? (
        <TypebotFlow tb={tb} setGroups={setGroups} onSelect={(gid) => { const i = groups.findIndex((g) => g.id === gid); if (i >= 0) { selectGroup(i); setTab("chat"); } }} />
      ) : tab === "tema" ? (
        <ThemeTab tb={tb} setTb={setTb} />
      ) : (
        <div className="ct-typebot-chat flex min-h-0 flex-1 flex-col">
          <nav aria-label="Painéis do construtor" className="ct-typebot-panel-tabs ct-segments">
            {([["groups", "Grupos"], ["blocks", "Blocos"], ["preview", "Prévia"]] as const).map(([key, label]) => (
              <button key={key} type="button" ref={key === "blocks" ? blocksButton : undefined} aria-pressed={panel === key}
                aria-controls={`${panelId}-${key}`} onClick={() => setPanel(key)}><span>{label}</span></button>
            ))}
          </nav>
          <div className="ct-typebot-panels flex min-h-0 flex-1 overflow-auto bg-neutral-50" data-panel={panel}>
          {/* GRUPOS */}
          <aside id={`${panelId}-groups`} data-typebot-panel="groups" aria-label="Grupos da conversa" className="w-56 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white p-2">
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Grupos</span>
              <button onClick={addGroup} className="text-xs font-bold text-ct-blue">+ grupo</button>
            </div>
            {groups.map((g, i) => (
              <button key={g.id} onClick={() => selectGroup(i)} aria-pressed={i === selG}
                className={`mb-1 w-full rounded-lg px-2.5 py-2 text-left text-xs ${i === selG ? "bg-ct-selected ring-1 ring-ct-blue" : "hover:bg-neutral-50"}`}>
                <div className="font-semibold text-neutral-800">{g.title}</div>
                <div className="text-[10px] text-neutral-400">{g.blocks.length} bloco(s)</div>
              </button>
            ))}
          </aside>

          {/* BLOCOS + EDITOR */}
          <section id={`${panelId}-blocks`} data-typebot-panel="blocks" aria-label="Blocos do grupo" className="w-[360px] shrink-0 overflow-y-auto border-r border-neutral-200 bg-white p-3">
            {group ? (
              <>
                <div onKeyDown={event => {
                  if (!groupDeleteOpen || event.key !== "Escape") return;
                  event.preventDefault();
                  event.stopPropagation();
                  resolveGroupDelete(false);
                }}>
                  <div className="flex items-center gap-2">
                    <input ref={groupTitleField} aria-label="Título do grupo" value={group.title} onChange={(e) => patchGroup(selG, { title: e.target.value })} className={`${inp} min-w-0 font-semibold`} />
                    {groups.length > 1 && <button ref={groupDeleteButton} type="button" aria-expanded={groupDeleteOpen}
                      aria-controls={`${panelId}-delete-group`} className="ct-step-control shrink-0 text-red-600" onClick={() => {
                        if (groupDeleteOpen) {
                          resolveGroupDelete(false);
                          return;
                        }
                        setGroupDeleteResult(null);
                        setPendingGroupDelete(group.id);
                        requestAnimationFrame(() => groupDeleteCancel.current?.focus());
                      }}>Excluir grupo</button>}
                  </div>
                  <div id={`${panelId}-delete-group`}>
                    {groupDeleteOpen && <div role="group" aria-labelledby={`${panelId}-delete-label`} className="ct-group-delete-confirmation mt-2 space-y-2 rounded-xl border border-ct-line bg-ct-surface p-3">
                      <div className="flex items-center gap-2"><DeleteConfirmationIcon /><p id={`${panelId}-delete-label`} className="font-semibold">Excluir grupo?</p></div>
                      <p className="text-sm text-ct-dim">O grupo “{group.title}” e seus blocos serão removidos ao salvar.</p>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button ref={groupDeleteCancel} type="button" className="ct-step-control" onClick={() => resolveGroupDelete(false)}>Cancelar</button>
                        <button type="button" className="ct-step-control text-red-600" onClick={() => resolveGroupDelete(true)}>Confirmar exclusão</button>
                      </div>
                    </div>}
                  </div>
                </div>
                <div role="status" aria-live="polite">
                  {groupDeleteResult && <p className="ct-group-delete-result mt-2 flex items-center gap-2 text-xs text-ct-dim">
                    <span aria-hidden="true">{groupDeleteResult === "deleted" ? "✓" : "↶"}</span>
                    {groupDeleteResult === "deleted" ? "Grupo removido. Salve para manter a alteração." : "Grupo mantido."}
                  </p>}
                </div>
                <Lbl>Próximo grupo (ao terminar)</Lbl>
                <WorkspaceSelect searchable label="Próximo grupo" value={group.to||''} onChange={value=>patchGroup(selG,{to:value||undefined})} options={[{value:'',label:'Fim do funil'},...groupOpts.filter(o=>o.id!==group.id).map(o=>({value:o.id,label:o.title}))]}/>

                <div className="mb-1 mt-3 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Blocos</span>
                  <div className="relative" onKeyDown={event => {
                    if (event.key !== "Escape" || !addOpen) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setAddOpen(false);
                    addBlockButton.current?.focus();
                  }}>
                    <button type="button" ref={addBlockButton} aria-expanded={addOpen} aria-controls={`${panelId}-add-blocks`}
                      onClick={() => setAddOpen(open => !open)} className="rounded bg-ct-action px-2 py-1 text-[11px] font-bold text-white">+ bloco</button>
                    <div id={`${panelId}-add-blocks`} role="group" aria-label="Biblioteca de blocos" hidden={!addOpen}
                      className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
                      {ADD_TYPES.map(([cat, types]) => (
                        <div key={cat} className="mb-1">
                          <p className="px-1 py-0.5 text-[10px] font-bold uppercase text-neutral-400">{cat}</p>
                          {types.map((t) => (
                            <button type="button" key={t} onClick={() => addBlock(t)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-neutral-50">
                              <span aria-hidden="true">{ICON[t]}</span>{TB_BLOCK_LABEL[t]}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  {group.blocks.map((b) => (
                    <div key={b.id} className={`rounded-lg border px-2 py-1.5 ${selB === b.id ? "border-violet-400 bg-ct-selected" : "border-neutral-200"}`} onKeyDown={event => {
                      if (pendingBlockDelete !== b.id || event.key !== "Escape") return;
                      event.preventDefault();
                      resolveBlockDelete(b.id, false);
                    }}>
                      <div className="flex items-center gap-1">
                      <button onClick={() => setSelB(b.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <span>{ICON[b.type]}</span>
                        <span className="truncate text-xs text-neutral-700">{blockPreview(b)}</span>
                      </button>
                      <button onClick={() => moveBlock(b.id, -1)} className="text-neutral-300 hover:text-neutral-600">▲</button>
                      <button onClick={() => moveBlock(b.id, 1)} className="text-neutral-300 hover:text-neutral-600">▼</button>
                      <button type="button" aria-label={`Excluir bloco ${TB_BLOCK_LABEL[b.type]}`} aria-expanded={pendingBlockDelete === b.id}
                        aria-controls={`${panelId}-delete-block-${b.id}`} className="ct-step-control shrink-0 text-red-600"
                        onClick={event => {
                          if (pendingBlockDelete === b.id) {
                            resolveBlockDelete(b.id, false);
                            return;
                          }
                          blockDeleteTrigger.current = event.currentTarget;
                          setPendingBlockDelete(b.id);
                          requestAnimationFrame(() => blockDeleteCancel.current?.focus());
                        }}>✕</button>
                      </div>
                      <div id={`${panelId}-delete-block-${b.id}`}>
                        {pendingBlockDelete === b.id && <div role="group" aria-label="Confirmar exclusão de bloco" className="ct-group-delete-confirmation mt-2 space-y-2 rounded-xl border border-ct-line bg-ct-surface p-3">
                          <div className="flex items-center gap-2"><DeleteConfirmationIcon /><p className="text-sm">Excluir este bloco?</p></div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <button ref={blockDeleteCancel} type="button" className="ct-step-control" onClick={() => resolveBlockDelete(b.id, false)}>Cancelar</button>
                            <button type="button" className="ct-step-control text-red-600" onClick={() => resolveBlockDelete(b.id, true)}>Confirmar exclusão</button>
                          </div>
                        </div>}
                      </div>
                    </div>
                  ))}
                  {!group.blocks.length ? <p className="px-1 py-4 text-center text-xs text-neutral-400">Nenhum bloco. Clique em + bloco.</p> : null}
                </div>

                {block ? <div className="mt-3 border-t border-neutral-100 pt-3"><BlockEditor block={block} patch={(p) => patchBlock(block.id, p)} groupOpts={groupOpts.filter((o) => o.id !== group.id)} /></div> : null}
              </>
            ) : <p className="text-sm text-neutral-400">Sem grupos.</p>}
          </section>

          {/* PREVIEW */}
          <div id={`${panelId}-preview`} data-typebot-panel="preview" className="flex min-w-0 flex-1 flex-col items-center justify-start overflow-hidden bg-neutral-100 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-400">Pré-visualização</span>
              <button onClick={() => setNonce((n) => n + 1)} className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold">↺ Reiniciar</button>
            </div>
            <div className="h-full w-full max-w-[400px] overflow-hidden rounded-[2rem] border-8 border-neutral-800 bg-white shadow-xl">
              <div className="qf-device h-full overflow-hidden">
                <ChatRunner key={`${nonce}-${selG}`} funnel={funnel} preview localOnly={!!saveLocal} startGroupId={group?.id} />
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {showSettings ? (
        <FunnelSettingsPanel sourceSlug={sourceSlug} funnel={funnel} onPatch={(patch) => setFunnel((f) => ({ ...f, ...patch }))} onClose={() => setShowSettings(false)} />
      ) : null}
    </div>
  );
}

function blockPreview(b: TbBlock): string {
  if (b.type === "text") return b.richText.replace(/\*\*/g, "").slice(0, 40) || "(texto vazio)";
  if (b.type === "image") return "Imagem";
  if (b.type === "audio") return "Áudio";
  if (b.type === "video") return "Vídeo";
  if (b.type === "embed") return "Embed";
  if (b.type === "date") return `Data: ${b.label || "Hoje"}`;
  if (b.type === "voice") return `Nota de voz ${b.duration || ""}`;
  if (b.type === "call") return `Chamada de ${b.mode === "video" ? "vídeo" : "voz"}`;
  if (b.type === "system") return `Aviso: ${b.variant}`;
  if (b.type === "document") return `Documento: ${b.name || ""}`;
  if (b.type === "link") return `Link: ${(b.title || b.url || "").slice(0, 30)}`;
  if (b.type === "location") return `Localização: ${(b.address || "").slice(0, 26)}`;
  if (b.type === "contact") return `Contato: ${b.name || ""}`;
  if (b.type === "input-picture") return `Escolha por imagem (${b.items.length})`;
  if (b.type === "input-cards") return `Cards (${b.items.length})`;
  if (b.type === "input-choice") return `Botões: ${b.items.map((i) => i.label).join(" / ").slice(0, 34)}`;
  if (isInput(b)) return `${TB_BLOCK_LABEL[b.type]} → {${b.variable || "?"}}`;
  if (b.type === "wait") return `Esperar ${b.seconds}s`;
  if (b.type === "set-variable") return `{${b.variable}} = ${b.expression.slice(0, 20)}`;
  if (b.type === "condition") return `Condição (${b.items.length})`;
  if (b.type === "redirect") return `Redirect → ${b.url.slice(0, 28)}`;
  if (b.type === "vsl") return `VSL (página) → ${(b.checkoutUrl || "").slice(0, 22)}`;
  return "Bloco";
}

function BlockEditor({ block: b, patch, groupOpts }: { block: TbBlock; patch: (p: BlockPatch) => void; groupOpts: { id: string; title: string }[] }) {
  if (b.type === "text") return (<>
    <Lbl>Texto (use **negrito** e {`{variavel}`})</Lbl><textarea value={b.richText} onChange={(e) => patch({ richText: e.target.value })} rows={4} className={inp} />
    <Lbl>Reação (emoji no canto da bolha — opcional)</Lbl>
    <div className="flex flex-wrap items-center gap-1">
      {["", "👍", "❤️", "😂", "😮", "😢", "🙏", "🔥"].map((e) => (
        <button key={e || "none"} onClick={() => patch({ reaction: e || undefined })} className={`h-8 w-8 rounded-full border text-base ${(b.reaction || "") === e ? "border-violet-500 bg-ct-selected" : "border-neutral-200"}`}>{e || "∅"}</button>
      ))}
    </div>
  </>);
  if (b.type === "image") return <><Lbl>Imagem</Lbl><ImageField value={b.url} onChange={url => patch({ url })} /></>;
  if (b.type === "audio" || b.type === "video") return (<>
    <Lbl>{b.type === "audio" ? "Áudio" : "Vídeo"}</Lbl>
    <ImgUpload value={b.url} onChange={(v) => patch({ url: v })} accept={b.type === "audio" ? "audio/*" : "video/*"} />
  </>);
  if (b.type === "embed") return (<><Lbl>HTML / iframe</Lbl><textarea value={b.html} onChange={(e) => patch({ html: e.target.value })} rows={4} className={inp} /></>);
  if (b.type === "date") return (<><Lbl>Texto do separador de data</Lbl><input value={b.label || ""} onChange={(e) => patch({ label: e.target.value })} placeholder="Hoje / Ontem / 21/06/2025" className={inp} /></>);
  if (b.type === "voice") return (<>
    <Lbl>Áudio (upload ou URL)</Lbl><ImgUpload value={b.url} onChange={(v) => patch({ url: v })} accept="audio/*" />
    <Lbl>Duração exibida</Lbl><input value={b.duration || ""} onChange={(e) => patch({ duration: e.target.value })} placeholder="0:08" className={inp} />
    <p className="mt-1 text-[11px] text-neutral-400">Visual de nota de voz (waveform + foto). O ▶ toca o áudio anexado.</p>
  </>);
  if (b.type === "call") return (<>
    <Lbl>Tipo</Lbl>
    <WorkspaceSelect label="Tipo de chamada" value={b.mode} onChange={value=>patch({mode:value})} options={[{value:'voice',label:'Chamada de voz'},{value:'video',label:'Chamada de vídeo'}]}/>
    <Lbl>Situação</Lbl>
    <WorkspaceSelect label="Situação" value={b.status||'outgoing'} onChange={value=>patch({status:value})} options={[["outgoing","Realizada"],["incoming","Recebida"],["missed","Perdida"]].map(([value,label])=>({value,label}))}/>
    <Lbl>Duração (vazio = &quot;Tocando…&quot;)</Lbl>
    <input value={b.duration || ""} onChange={(e) => patch({ duration: e.target.value })} placeholder="0:42" className={inp} />
  </>);
  if (b.type === "system") return (<>
    <Lbl>Tipo de aviso</Lbl>
    <WorkspaceSelect label="Tipo de mensagem" value={b.variant} onChange={value=>patch({variant:value})} options={[["encrypted","Criptografia de ponta a ponta"],["deleted","Mensagem apagada"],["disappearing","Mensagens temporárias"],["custom","Texto personalizado"]].map(([value,label])=>({value,label}))}/>
    {b.variant === "custom" ? (<><Lbl>Texto</Lbl><input value={b.text || ""} onChange={(e) => patch({ text: e.target.value })} className={inp} /></>) : null}
  </>);
  if (b.type === "input-text" || b.type === "input-number" || b.type === "input-email" || b.type === "input-phone" || b.type === "input-url" || b.type === "input-date" || b.type === "input-time") return (<>
    <Lbl>Salvar na variável</Lbl><input value={b.variable || ""} onChange={(e) => patch({ variable: e.target.value })} placeholder="ex: nome" className={inp} />
    {b.type === "input-date" || b.type === "input-time" ? null : <><Lbl>Placeholder</Lbl><input value={b.placeholder || ""} onChange={(e) => patch({ placeholder: e.target.value })} className={inp} /></>}
    <Lbl>Texto do botão</Lbl><input value={b.button || ""} onChange={(e) => patch({ button: e.target.value })} className={inp} />
    {b.type === "input-text" && <label className="mt-2 flex items-center gap-2 text-xs text-ct-dim">
      <input type="checkbox" checked={!!b.long} onChange={e => patch({ long: e.target.checked || undefined })} />
      Permitir resposta em várias linhas
    </label>}
    {b.type === "input-phone" ? <p className="mt-1 text-[11px] text-amber-600">📱 Este input dispara a captura do lead (webhook Datacrazy).</p> : null}
  </>);
  if (b.type === "input-rating") return (<>
    <Lbl>Salvar na variável</Lbl><input value={b.variable || ""} onChange={(e) => patch({ variable: e.target.value })} placeholder="ex: avaliacao" className={inp} />
    <Lbl>Quantidade</Lbl><input type="number" min={2} max={10} value={b.max ?? 5} onChange={(e) => patch({ max: Number(e.target.value) })} className={inp} />
    <Lbl>Ícone</Lbl>
    <WorkspaceSelect label="Tipo de avaliação" value={b.icon||'star'} onChange={value=>patch({icon:value})} options={[["star","Estrelas"],["heart","Corações"],["number","Números"]].map(([value,label])=>({value,label}))}/>
  </>);
  if (b.type === "input-file") return (<>
    <Lbl>Salvar na variável</Lbl><input value={b.variable || ""} onChange={(e) => patch({ variable: e.target.value })} placeholder="ex: arquivo" className={inp} />
    <Lbl>Texto do botão</Lbl><input value={b.button || ""} onChange={(e) => patch({ button: e.target.value })} className={inp} />
  </>);
  if (b.type === "input-picture") return (<>
    <Lbl>Salvar na variável</Lbl><input value={b.variable || ""} onChange={(e) => patch({ variable: e.target.value })} placeholder="ex: escolha" className={inp} />
    <Lbl>Opções (imagem + rótulo)</Lbl>
    {b.items.map((it) => (
      <div key={it.id} className="mb-2 rounded-lg border border-neutral-200 p-2">
        <input value={it.label} onChange={(e) => patch({ items: b.items.map((x) => x.id === it.id ? { ...x, label: e.target.value } : x) })} placeholder="rótulo" className={`${inp} mb-1`} />
        <div className="mb-1"><ImgUpload value={it.image} onChange={image => patch(current => current.type === "input-picture" ? {
          items: current.items.map(option => option.id === it.id ? { ...option, image } : option),
        } : {})} /></div>
        <div className="flex items-center gap-1">
          <WorkspaceSelect searchable label="Destino da opção" value={it.to||''} onChange={value=>patch({items:b.items.map(x=>x.id===it.id?{...x,to:value||undefined}:x)})} options={[{value:'',label:'Padrão'},...groupOpts.map(o=>({value:o.id,label:o.title}))]}/>
          <button onClick={() => patch({ items: b.items.filter((x) => x.id !== it.id) })} className="shrink-0 text-red-400">✕</button>
        </div>
      </div>
    ))}
    <button onClick={() => patch({ items: [...b.items, { id: genId(), label: `Opção ${b.items.length + 1}`, image: "" }] })} className="text-xs font-semibold text-ct-blue">+ opção</button>
  </>);
  if (b.type === "input-cards") return (<>
    <Lbl>Cards</Lbl>
    {b.items.map((c) => (
      <div key={c.id} className="mb-2 rounded-lg border border-neutral-200 p-2">
        <input value={c.title || ""} onChange={(e) => patch({ items: b.items.map((x) => x.id === c.id ? { ...x, title: e.target.value } : x) })} placeholder="título" className={`${inp} mb-1`} />
        <input value={c.desc || ""} onChange={(e) => patch({ items: b.items.map((x) => x.id === c.id ? { ...x, desc: e.target.value } : x) })} placeholder="descrição" className={`${inp} mb-1`} />
        <div className="mb-1"><ImgUpload value={c.image} onChange={image => patch(current => current.type === "input-cards" ? {
          items: current.items.map(option => option.id === c.id ? { ...option, image } : option),
        } : {})} /></div>
        <div className="flex items-center gap-1">
          <input value={c.button || ""} onChange={(e) => patch({ items: b.items.map((x) => x.id === c.id ? { ...x, button: e.target.value } : x) })} placeholder="botão" className="w-24 rounded border border-neutral-300 px-1.5 py-1 text-[11px]" />
          <WorkspaceSelect searchable label="Destino da opção" value={c.to||''} onChange={value=>patch({items:b.items.map(x=>x.id===c.id?{...x,to:value||undefined}:x)})} options={[{value:'',label:'Padrão'},...groupOpts.map(o=>({value:o.id,label:o.title}))]}/>
          <button onClick={() => patch({ items: b.items.filter((x) => x.id !== c.id) })} className="shrink-0 text-red-400">✕</button>
        </div>
      </div>
    ))}
    <button onClick={() => patch({ items: [...b.items, { id: genId(), title: `Card ${b.items.length + 1}`, button: "Selecionar" }] })} className="text-xs font-semibold text-ct-blue">+ card</button>
  </>);
  if (b.type === "document") return (<>
    <Lbl>Nome do arquivo</Lbl><input value={b.name || ""} onChange={(e) => patch({ name: e.target.value })} placeholder="Apostila.pdf" className={inp} />
    <Lbl>Subtítulo (tipo · tamanho)</Lbl><input value={b.size || ""} onChange={(e) => patch({ size: e.target.value })} placeholder="PDF · 1,2 MB" className={inp} />
    <Lbl>URL do documento</Lbl><input type="url" aria-label="URL do documento" value={b.url || ""} onChange={(e) => patch({ url: e.target.value })} placeholder="https://…" className={inp} />
  </>);
  if (b.type === "link") return (<>
    <Lbl>URL</Lbl><input value={b.url} onChange={(e) => patch({ url: e.target.value })} placeholder="https://…" className={inp} />
    <Lbl>Título</Lbl><input value={b.title || ""} onChange={(e) => patch({ title: e.target.value })} className={inp} />
    <Lbl>Descrição</Lbl><input value={b.desc || ""} onChange={(e) => patch({ desc: e.target.value })} className={inp} />
    <Lbl>Imagem de preview</Lbl><ImgUpload value={b.image} onChange={(v) => patch({ image: v })} />
  </>);
  if (b.type === "location") return (<>
    <Lbl>Endereço</Lbl><input value={b.address || ""} onChange={(e) => patch({ address: e.target.value })} placeholder="Av. Paulista, 1000 — São Paulo" className={inp} />
    <Lbl>Imagem do mapa</Lbl><ImgUpload value={b.image} onChange={(v) => patch({ image: v })} />
  </>);
  if (b.type === "contact") return (<>
    <Lbl>Nome</Lbl><input value={b.name || ""} onChange={(e) => patch({ name: e.target.value })} className={inp} />
    <Lbl>Telefone</Lbl><input value={b.phone || ""} onChange={(e) => patch({ phone: e.target.value })} placeholder="+55 …" className={inp} />
    <Lbl>Avatar</Lbl><ImgUpload value={b.avatar} onChange={(v) => patch({ avatar: v })} />
  </>);
  if (b.type === "input-choice") return (<>
    <Lbl>Salvar na variável (opcional)</Lbl><input value={b.variable || ""} onChange={(e) => patch({ variable: e.target.value })} placeholder="ex: idade" className={inp} />
    <Lbl>Opções (botões)</Lbl>
    {b.items.map((it, i) => (
      <div key={it.id} className="mb-1 flex items-center gap-1">
        <input value={it.label} onChange={(e) => patch({ items: b.items.map((x) => x.id === it.id ? { ...x, label: e.target.value } : x) })} className={inp} />
        <WorkspaceSelect searchable label="Destino da opção" value={it.to||''} onChange={value=>patch({items:b.items.map(x=>x.id===it.id?{...x,to:value||undefined}:x)})} options={[{value:'',label:'Padrão'},...groupOpts.map(o=>({value:o.id,label:o.title}))]}/>
        <button onClick={() => patch({ items: b.items.filter((x) => x.id !== it.id) })} className="shrink-0 text-red-400">✕</button>
      </div>
    ))}
    <button onClick={() => patch({ items: [...b.items, { id: genId(), label: `Opção ${b.items.length + 1}` }] })} className="mt-1 text-xs font-semibold text-ct-blue">+ opção</button>
  </>);
  if (b.type === "wait") return (<><Lbl>Esperar (segundos)</Lbl><input type="number" min={0} step={0.5} value={b.seconds} onChange={(e) => patch({ seconds: Number(e.target.value) })} className={inp} /></>);
  if (b.type === "set-variable") return (<>
    <Lbl>Variável</Lbl><input value={b.variable} onChange={(e) => patch({ variable: e.target.value })} className={inp} />
    <Lbl>Expressão (JS — use {`{{variavel}}`})</Lbl><textarea value={b.expression} onChange={(e) => patch({ expression: e.target.value })} rows={3} className={inp} />
  </>);
  if (b.type === "condition") return (<>
    <Lbl>Condições (primeira verdadeira ganha)</Lbl>
    {b.items.map((it) => (
      <div key={it.id} className="mb-1 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1">
        <input value={it.variable} onChange={(e) => patch({ items: b.items.map((x) => x.id === it.id ? { ...x, variable: e.target.value } : x) })} placeholder="var" className="rounded border border-neutral-300 px-1.5 py-1 text-xs" />
        <WorkspaceSelect label="Condição" value={it.op} onChange={value=>patch({items:b.items.map(x=>x.id===it.id?{...x,op:value as typeof x.op}:x)})} options={['igual','diferente','contém','maior','menor'].map(value=>({value,label:value}))}/>
        <input value={it.value} onChange={(e) => patch({ items: b.items.map((x) => x.id === it.id ? { ...x, value: e.target.value } : x) })} placeholder="valor" className="rounded border border-neutral-300 px-1.5 py-1 text-xs" />
        <WorkspaceSelect searchable label="Destino da opção" value={it.to||''} onChange={value=>patch({items:b.items.map(x=>x.id===it.id?{...x,to:value||undefined}:x)})} options={[{value:'',label:'Padrão'},...groupOpts.map(o=>({value:o.id,label:o.title}))]}/>
      </div>
    ))}
    <button onClick={() => patch({ items: [...b.items, { id: genId(), variable: "var", op: "igual", value: "" }] })} className="mt-1 text-xs font-semibold text-ct-blue">+ condição</button>
  </>);
  if (b.type === "redirect") return (<>
    <Lbl>URL de destino (checkout/VSL)</Lbl><input value={b.url} onChange={(e) => patch({ url: e.target.value })} placeholder="https://…" className={inp} />
    <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600"><input type="checkbox" checked={!!b.newTab} onChange={(e) => patch({ newTab: e.target.checked })} className="h-3.5 w-3.5 accent-neutral-900" /> Abrir em nova aba</label>
  </>);
  if (b.type === "vsl") return (<>
    <p className="mb-2 rounded-lg bg-ct-selected px-2.5 py-2 text-[11px] leading-snug text-violet-700">📺 Repaginação no mesmo domínio: ao chegar neste bloco, o chat é coberto pela página de VSL (banner + player + botão liberado após o pitch).</p>
    <Lbl>Barra de escassez (topo)</Lbl><input value={b.barText || ""} onChange={(e) => patch({ barText: e.target.value })} placeholder="⚠️ ATENÇÃO: ESTE VÍDEO SAI DO AR EM BREVE" className={inp} />
    <Lbl>Título (use **negrito** e {`{variavel}`})</Lbl><textarea value={b.title || ""} onChange={(e) => patch({ title: e.target.value })} rows={2} className={inp} />
    <Lbl>Embed do player (cole o &lt;script&gt;/&lt;div&gt; do VTurb)</Lbl><textarea value={b.embedHtml || ""} onChange={(e) => patch({ embedHtml: e.target.value })} rows={4} placeholder="<vturb-smartplayer …></vturb-smartplayer><script …></script>" className={`${inp} font-mono text-[11px]`} />
    <Lbl>Liberar botão após (segundos do pitch)</Lbl><input type="number" min={0} value={b.pitchRevealAt ?? 0} onChange={(e) => patch({ pitchRevealAt: Number(e.target.value) || 0 })} className={inp} />
    <Lbl>Texto do botão</Lbl><input value={b.ctaText || ""} onChange={(e) => patch({ ctaText: e.target.value })} placeholder="QUERO GARANTIR MINHA VAGA" className={inp} />
    <Lbl>Efeito de animação do botão</Lbl>
    <WorkspaceSelect label="Efeito do botão" value={b.effect||'none'} onChange={value=>patch({effect:value})} options={[["none","Nenhum"],["shine","Brilho"],["pulse","Pulsar"],["shine-pulse","Brilho e pulsar"]].map(([value,label])=>({value,label}))}/>
    <Lbl>URL do checkout (abre ao clicar no botão)</Lbl><input value={b.checkoutUrl || ""} onChange={(e) => patch({ checkoutUrl: e.target.value })} placeholder="https://…" className={inp} />
    <Lbl>Fundo da página (CSS — ex: #ffffff)</Lbl><input value={b.background || ""} onChange={(e) => patch({ background: e.target.value })} placeholder="#ffffff" className={inp} />
  </>);
  return null;
}

type MediaFieldProps = { value?: string; onChange: (v: string) => void; placeholder?: string; accept?: string };

function ImgUpload({ value, onChange, placeholder, accept }: MediaFieldProps) {
  const local = useContext(LocalDraftContext);
  if (!local) return <RemoteMediaField value={value} onChange={onChange} placeholder={placeholder} accept={accept} />;
  if (!accept || accept === "image/*") return <ImageField value={value} onChange={onChange} />;
  return <input aria-label={accept.startsWith("audio/") ? "URL do áudio" : "URL do vídeo"} value={value || ""}
    onChange={event => onChange(event.target.value)} placeholder={placeholder || "https://…"} className={inp} />;
}

function RemoteMediaField({ value, onChange, placeholder, accept }: MediaFieldProps) {
  const [busy, setBusy] = useState(false);
  const up = async (f: File) => {
    setBusy(true);
    try { const fd = new FormData(); fd.append("file", f); const r = await fetch("/api/upload", { method: "POST", body: fd }); const j = await r.json(); if (j.url) onChange(j.url); else alert(j.error || "Falha no upload"); } catch { alert("Falha no upload"); }
    setBusy(false);
  };
  return (
    <div className="flex items-center gap-2">
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || "https://… ou faça upload"} className={`${inp} flex-1`} />
      <label className="shrink-0 cursor-pointer rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white hover:bg-neutral-700">{busy ? "…" : "⭱ Upload"}<input type="file" accept={accept || "image/*"} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) up(f); e.currentTarget.value = ""; }} /></label>
    </div>
  );
}

const Toggle = ({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex cursor-pointer items-center justify-between gap-2 py-1.5 text-sm max-md:min-h-11"><span className="text-neutral-700">{label}</span>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-neutral-900" /></label>
  );
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-3 rounded-xl border border-neutral-200 bg-white p-4"><p className="mb-2 text-[13px] font-bold text-neutral-800">{title}</p>{children}</div>
  );

function ThemeTab({ tb, setTb }: { tb: TbFunnel; setTb: (n: Partial<TbFunnel> | ((current: TbFunnel) => Partial<TbFunnel>)) => void }) {
  const t = { ...TB_DEFAULT_THEME, ...tb.theme };
  const set = (p: Partial<typeof t>) => setTb(current => ({ theme: { ...TB_DEFAULT_THEME, ...current.theme, ...p } }));
  const color = (label: string, k: keyof typeof t) => (
    <div className="flex items-center justify-between py-1.5 text-sm"><span className="text-neutral-600">{label}</span>
      <ColorField value={(t[k] as string) || "#000000"} onChange={(v) => set({ [k]: v })} className="h-8 w-12 max-md:h-11" label={label} /></div>
  );
  return (
    <div className="flex-1 overflow-auto bg-neutral-50 p-4">
      <div className="mx-auto max-w-xl">
        <Card title="📱 Aparelho & layout">
          <div className="mb-2 flex gap-1 rounded-lg bg-neutral-100 p-1">
            {(["ios", "android"] as const).map((d) => (
              <button key={d} onClick={() => set({ device: d })} className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${(t.device || "ios") === d ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"}`}>{d === "ios" ? " iPhone (iOS)" : "🤖 Android"}</button>
            ))}
          </div>
          <div className="mb-1 flex gap-2">
            <button onClick={() => set({ dark: false, bg: "#efeae2", hostBubbleBg: "#ffffff", hostBubbleColor: "#111b21", guestBubbleBg: "#e6ffda", guestBubbleColor: "#111b21", buttonBg: "#008069", buttonColor: "#ffffff" })} className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold hover:bg-neutral-50">☀️ WhatsApp Claro</button>
            <button onClick={() => set({ dark: true })} className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold hover:bg-neutral-50">🌙 WhatsApp Escuro</button>
          </div>
          <Toggle label="Modo escuro" on={!!t.dark} onChange={(v) => set({ dark: v })} />
          <Toggle label="Esconder header" on={!!t.hideHeader} onChange={(v) => set({ hideHeader: v })} />
          <Toggle label="Esconder rodapé (input)" on={!!t.hideFooter} onChange={(v) => set({ hideFooter: v })} />
          <Toggle label="Ícone de silenciado no header" on={!!t.headerSilent} onChange={(v) => set({ headerSilent: v })} />
          <Toggle label="Ícone de chamada de vídeo (header)" on={!!t.showCallVideo} onChange={(v) => set({ showCallVideo: v })} />
          <Toggle label="Ícone de chamada de voz (header)" on={!!t.showCallVoice} onChange={(v) => set({ showCallVoice: v })} />
          <Toggle label="Aviso de criptografia no topo" on={t.encryptionBanner !== false} onChange={(v) => set({ encryptionBanner: v })} />
          {t.encryptionBanner !== false ? <input value={t.encryptionText || ""} onChange={(e) => set({ encryptionText: e.target.value })} placeholder="Texto do aviso (🔒 já vem na frente)" className={`${inp} mb-1`} /> : null}
          <div className="flex items-center justify-between py-1.5 text-sm"><span className="text-neutral-700">Tamanho do texto</span>
            <WorkspaceSelect label="Tamanho do texto" value={t.textSize||'default'} onChange={value=>set({textSize:value as 'small'|'default'|'large'})} options={[["small","Pequeno"],["default","Padrão"],["large","Grande"]].map(([value,label])=>({value,label}))}/>
          </div>
          <div className="flex items-center justify-between py-1.5 text-sm"><span className="text-neutral-700">Tipografia (fonte)</span>
            <WorkspaceSelect label="Fonte" value={(t.font||'poppins').toLowerCase()} onChange={value=>set({font:value})} options={[["system","Sistema"],["poppins","Poppins"],["opensans","Open Sans"],["roboto","Roboto"]].map(([value,label])=>({value,label}))}/>
          </div>
          <Toggle label="Relógio 12h (AM/PM)" on={!!t.clock12h} onChange={(v) => set({ clock12h: v })} />
        </Card>

        <Card title="🔋 Barra de status">
          <Toggle label="Mostrar barra de status" on={t.showStatusBar !== false} onChange={(v) => set({ showStatusBar: v })} />
          <div className="grid grid-cols-3 gap-2">
            <div><Lbl>Hora</Lbl><input value={t.statusTime || ""} onChange={(e) => set({ statusTime: e.target.value })} placeholder="10:04" className={inp} /></div>
            <div><Lbl>Rede</Lbl><input value={t.network || ""} onChange={(e) => set({ network: e.target.value })} placeholder="5G" className={inp} /></div>
            <div><Lbl>Bateria %</Lbl><input type="number" min={0} max={100} value={t.battery ?? 80} onChange={(e) => set({ battery: Number(e.target.value) })} className={inp} /></div>
          </div>
          <Toggle label="Bateria carregando ⚡" on={!!t.charging} onChange={(v) => set({ charging: v })} />
          <Toggle label="Mostrar % da bateria" on={!!t.showBatteryPct} onChange={(v) => set({ showBatteryPct: v })} />
          <Toggle label="Dual SIM (2 sinais)" on={!!t.dualSim} onChange={(v) => set({ dualSim: v })} />
          <p className="text-[11px] text-neutral-400">A barra de status aparece só na pré-visualização.</p>
        </Card>

        <Card title="👤 Contato">
          <Lbl>Nome no topo</Lbl><input value={t.botName || ""} onChange={(e) => set({ botName: e.target.value })} placeholder="ex: Sônia 🧡" className={inp} />
          <Lbl>Status</Lbl><input value={t.online || ""} onChange={(e) => set({ online: e.target.value })} placeholder="online" className={inp} />
          <Lbl>Avatar</Lbl><ImgUpload value={t.avatarUrl} onChange={(v) => set({ avatarUrl: v })} />
        </Card>

        <Card title="🖼️ Fundo do chat">
          <ImgUpload value={t.chatBgImage} onChange={(v) => set({ chatBgImage: v })} placeholder="Faça upload da sua imagem de fundo" />
          {t.chatBgImage ? <button onClick={() => set({ chatBgImage: undefined })} className="mt-2 text-xs font-semibold text-red-500">Remover (volta ao padrão)</button> : <p className="mt-1 text-[11px] text-neutral-400">Vazio = doodle padrão. Suba a sua imagem pra usar 1:1.</p>}
        </Card>

        <Card title="🎨 Cores das bolhas">
          {color("Cor do fundo (sob a imagem)", "bg")}
          {color("Bolha do bot — fundo", "hostBubbleBg")}
          {color("Bolha do bot — texto", "hostBubbleColor")}
          {color("Bolha do lead — fundo", "guestBubbleBg")}
          {color("Bolha do lead — texto", "guestBubbleColor")}
          {color("Botões — fundo", "buttonBg")}
          {color("Botões — texto", "buttonColor")}
          {color("Barra de topo (Android)", "headerColor")}
        </Card>

        <Card title="⌨️ Digitação">
          <Toggle label="Emular digitação (indicador …)" on={!!tb.typing?.enabled} onChange={(v) => setTb({ typing: { ...tb.typing, enabled: v } })} />
          <div className="flex items-center justify-between py-1.5 text-sm"><span className="text-neutral-600">Velocidade (car/seg)</span><input type="number" min={5} max={120} value={tb.typing?.speed || 28} onChange={(e) => setTb({ typing: { ...tb.typing, speed: Number(e.target.value) } })} className="w-20 rounded border border-neutral-300 px-2 py-1 text-xs" /></div>
          <div className="flex items-center justify-between py-1.5 text-sm"><span className="text-neutral-600">Atraso máx./bolha (s)</span><input type="number" min={0.3} max={5} step={0.1} value={tb.typing?.maxDelay || 1.4} onChange={(e) => setTb({ typing: { ...tb.typing, maxDelay: Number(e.target.value) } })} className="w-20 rounded border border-neutral-300 px-2 py-1 text-xs" /></div>
        </Card>
      </div>
    </div>
  );
}
