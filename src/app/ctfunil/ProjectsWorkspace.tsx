"use client";

import { normalizeSearchText } from "@/lib/text";
import { ASSISTANT_STREAM_TYPE, readAssistantReply } from '@/lib/assistant/stream';
import { StatefulButton } from "@/components/referencias/beui/motion/button/stateful";
import { Button } from "@/components/referencias/beui/motion/button/base";
import ChatParticipants, { ChatAvatar } from "@/components/ui/ChatParticipants";
import AssistantResponse from "@/components/ui/AssistantResponse";
import ProjectFileTree from "@/components/ui/ProjectFileTree";
import VoicePrompt from "@/components/ui/VoicePrompt";
import WorkspaceMultiSelect from "@/components/ui/WorkspaceMultiSelect";
import WorkspaceStatus from "@/components/ui/WorkspaceStatus";
import ActiveTab from "@/components/ui/ActiveTab";
import DeleteConfirmationIcon from "@/components/ui/DeleteConfirmationIcon";
import { ArrowDown, ArrowUp, ChevronDown, FolderKanban, Layers, PanelsTopLeft, GitBranch, PanelLeft, Pencil, KeyRound, MessageSquarePlus, Plus, Paperclip, RefreshCw, Search, Send, Settings2, ThumbsDown, ThumbsUp, Trash2, X } from "lucide-react";
import { AccessOrb, ActivityPill, WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";
import { buildAssistantRequest, MESSAGE_LIMIT, type AssistantMessage } from "@/lib/assistant/messages";
import { assistantAttachments, assistantConversationStorageKey, ASSISTANT_SETTINGS_PATH, geminiKeyPattern, geminiModelPattern, readWorkspaceSettings, type ImportMode } from "@/lib/assistant/workspace-settings";
import { attachmentContext, readProjectAttachment, type ProjectAttachment } from "@/lib/assistant/project-attachment";

type ProjectType = "all" | "quiz" | "pages" | "plus";
export type Project = {
  id: string;
  name: string;
  type: Exclude<ProjectType, "all">;
  kind: string;
  updated: string;
  product: string;
  status: string;
  accent?: string;
  reportHref?: string;
  editorHref?: string;
  preview: string;
  metric: string;
};

const projectTabs: Array<{ id: ProjectType; label: string; hint: string }> = [
  { id: "all", label: "Todos", hint: "Tudo criado no CTFunil" },
  { id: "quiz", label: "Quiz", hint: "Quizzes e funis" },
  { id: "pages", label: "Páginas", hint: "Landing, bridge e VSL" },
  { id: "plus", label: "+", hint: "Spy e futuros módulos" },
];

const productFilters = ["CDB", "SRC", "Resinas", "VSL", "Captura"];

const exampleProjects: Project[] = [
  {
    id: "cdb-quiz",
    name: "CDB Quiz Diagnóstico",
    type: "quiz",
    kind: "Quiz Resinas",
    updated: "Editado hoje",
    product: "CDB",
    status: "Ativo",
    accent: "#236A9F",
    preview: "Pergunta 03 · Oferta UP",
    metric: "94 PageSpeed",
  },
  {
    id: "src-funil",
    name: "SRC Funil Camadas",
    type: "quiz",
    kind: "Quiz + captura",
    updated: "Editado ontem",
    product: "SRC",
    status: "Rascunho",
    accent: "#8CB3CB",
    preview: "Etapa 05 · Motion CTA",
    metric: "128 leads",
  },
  {
    id: "cdb-page",
    name: "Página CDB Black",
    type: "pages",
    kind: "Landing page",
    updated: "Editado 12 set",
    product: "CDB",
    status: "Publicável",
    accent: "#B47556",
    preview: "Hero + prova social",
    metric: "96 PageSpeed",
  },
  {
    id: "resinas-vsl",
    name: "Oferta Resinas VSL",
    type: "pages",
    kind: "Página VSL",
    updated: "Editado 10 set",
    product: "Resinas",
    status: "Revisar",
    accent: "#5D94BE",
    preview: "Blocos de copy",
    metric: "92 PageSpeed",
  },
  {
    id: "spy-ref",
    name: "Spy Referências",
    type: "plus",
    kind: "Módulo futuro",
    updated: "Mock front",
    product: "Captura",
    status: "Planejado",
    accent: "#202631",
    preview: "URL → estrutura editável",
    metric: "34 refs",
  },
];

const quickPrompts = [
  "Sugira um quiz de diagnóstico para CDB",
  "Sugira melhorias para uma página",
  "Como melhorar uma etapa de quiz?",
  "Sugira uma paleta para meu funil",
  "Sugira uma animação leve para o CTA",
];
const ALL_PAGES = '__ctfunil_all_html_pages__';
function preferredPage(project:ProjectAttachment):string {
  const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const terms=normalize(project.name.replace(/\.zip$/i,'').replace(/^lp\s*[-_ ]\s*/i,'')).split(' ').filter(word=>word.length>2);
  return project.pages.find(page=>terms.length>0&&terms.every(term=>normalize(page.path).includes(term)))?.path || project.pages[0].path;
}

type ConversationMessage = AssistantMessage & { streamed?: boolean; model?: string; feedback?: "up" | "down" };

type AssistantConversation = {
  id: number;
  prompt: string;
  messages: ConversationMessage[];
  apiMessages: AssistantMessage[];
  attachment: ProjectAttachment | null;
  selectedPage: string;
  title?: string;
};

function orderConversations<T extends { id: number }>(items: T[], order: number[]) {
  const positions = new Map(order.map((id, index) => [id, index]));
  return items.sort((left, right) =>
    (positions.get(left.id) ?? -1) - (positions.get(right.id) ?? -1) || right.id - left.id
  );
}

const CONVERSATION_TITLE_LIMIT = 60;

function conversationTitle(conversation: AssistantConversation) {
  if (conversation.title) return conversation.title;
  const text = conversation.messages[0]?.text || conversation.prompt || conversation.attachment?.name || "";
  const title = text.split("\n").map(line => line.replace(/\s+/g, " ").trim()).find(Boolean);
  if (!title) return "Nova conversa";
  return title.length > CONVERSATION_TITLE_LIMIT ? `${title.slice(0, CONVERSATION_TITLE_LIMIT - 1).trimEnd()}…` : title;
}

function newArchiveConversationId() {
  const [upper, lower] = crypto.getRandomValues(new Uint32Array(2));
  return ((upper & 0xfffff) * 0x100000000) + lower + 1;
}

async function updateConversationArchive(key: string, update: () => void) {
  if (navigator.locks) await navigator.locks.request(key, update);
  else update();
}

export function HeroPrompt({ avatarUrl, accountId }: { avatarUrl?: string; accountId?: string }) {
  const router = useRouter();
  const [openingReview, startReviewNavigation] = useTransition();
  const [prompt,setPrompt]=useState('');
  const [pendingMessage, setPendingMessage] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [sendCanceled, setSendCanceled] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [configAttempt, setConfigAttempt] = useState(0);
  const [configCheckFailed, setConfigCheckFailed] = useState(false);
  const sessionRetryButton = useRef<HTMLButtonElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const conversationsDialog = useRef<HTMLDialogElement>(null);
  const conversationToggle = useRef<HTMLButtonElement>(null);
  const [conversationRailOpen, setConversationRailOpen] = useState(true);
  const nextConversationId = useRef(1);
  const archiveKey = accountId ? `ctfunil-assistant-history:${accountId}` : undefined;
  const deletedArchiveKey = archiveKey ? `${archiveKey}:deleted` : undefined;
  const [archiveReady, setArchiveReady] = useState(false);
  const lastArchived = useRef(new Map<number, string>());

  function allocateConversationId() {
    if (!archiveKey) return nextConversationId.current++;
    return newArchiveConversationId();
  }
  const [conversationId, setConversationId] = useState(0);
  const [conversationOrder, setConversationOrder] = useState<number[]>([]);
  const draggedConversation = useRef<number | null>(null);
  const [conversationDropTarget, setConversationDropTarget] = useState<number | null>(null);
  const [otherConversations, setOtherConversations] = useState<AssistantConversation[]>([]);
  const [conversationTitleOverride, setConversationTitleOverride] = useState("");
  const renameDialog = useRef<HTMLDialogElement>(null);
  const renameInput = useRef<HTMLInputElement>(null);
  const renameTarget = useRef<number>(0);
  const [historyReady, setHistoryReady] = useState(false);
  const privateHistoryInDemo = useRef(false);
  const [historySaveFailed, setHistorySaveFailed] = useState(false);
  const clearDialog = useRef<HTMLDialogElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const settingsHeading = useRef<HTMLHeadingElement>(null);
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const followThread = useRef(true);
  const [showLatest, setShowLatest] = useState(false);

  const [copyState,setCopyState]=useState<number|null>(null);
  const [messages,setMessages]=useState<ConversationMessage[]>([]);
  const [apiMessages,setApiMessages]=useState<AssistantMessage[]>([]);
  const [attachment,setAttachment]=useState<ProjectAttachment|null>(null);
  const [selectedPage,setSelectedPage]=useState('');
  const [reading,setReading]=useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("design");
  const [preferences, setPreferences] = useState({ model: "", key: "", models: [] as string[] });
  const [chatModel, setChatModel] = useState("");
  useEffect(() => {
    function refreshPreferences() {
      const saved = readWorkspaceSettings();
      setPreferences(current => current.model === saved.model && current.key === saved.key && current.models.join(",") === saved.models.join(",")
        ? current : { model: saved.model, key: saved.key, models: saved.models });
    }
    setImportMode(readWorkspaceSettings().importMode);
    refreshPreferences();
    window.addEventListener("storage", refreshPreferences);
    window.addEventListener("focus", refreshPreferences);
    return () => {
      window.removeEventListener("storage", refreshPreferences);
      window.removeEventListener("focus", refreshPreferences);
    };
  }, []);
  const [serverStatus, setServerStatus] = useState<{ model: string; modelValid: boolean; hasKey: boolean } | null>(null);
  const defaultModel = geminiModelPattern.test(preferences.model) ? preferences.model : undefined;
  const defaultId = defaultModel ?? (serverStatus?.modelValid ? serverStatus.model : "");
  const modelChoices = [...new Set([defaultId, ...preferences.models].filter(Boolean))];
  const picked = modelChoices.includes(chatModel) ? chatModel : "";
  const customModel = picked && picked !== defaultId ? picked : defaultModel;
  const customKey = geminiKeyPattern.test(preferences.key) ? preferences.key : undefined;
  const requestModel = customModel ?? (!defaultId ? modelChoices[0] : undefined);
  const modelValid = Boolean(requestModel || serverStatus?.modelValid);
  const status = serverStatus && {
    model: customModel ?? (defaultId || modelChoices[0] || serverStatus.model),
    modelValid,
    configured: modelValid && Boolean(customKey || serverStatus.hasKey),
  };
  const canChooseModel = !authRequired && Boolean(status) && modelChoices.length > 1;
  const [partialReply, setPartialReply] = useState('');
  const [settings,setSettings]=useState(false),[working,setBusy]=useState(false);
  const busy = working || openingReview;
  const [error, setError] = useState<{ message: string; send?: true } | null>(null);
  const sending = busy && (Boolean(pendingMessage) || regenerating);
  const importing = busy && !sending;
  const [dictating, setDictating] = useState(false);
  const attachmentLocked = busy || reading;

  useEffect(() => {
    if (authRequired) return;
    function toggleConversations(event: KeyboardEvent) {
      if (window.location.pathname !== "/ctfunil/assistente" || event.defaultPrevented || event.repeat ||
          event.isComposing || event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey) ||
          event.key.toLowerCase() !== "b" || clearDialog.current?.open || renameDialog.current?.open) return;
      const dialog = conversationsDialog.current;
      const toggle = conversationToggle.current;
      if (dialog?.open) {
        event.preventDefault();
        dialog.close();
      } else if (toggle?.getClientRects().length) {
        event.preventDefault();
        toggle.focus({ preventScroll: true });
        setConversationRailOpen(open => !open);
      } else if (dialog && !attachmentLocked) {
        event.preventDefault();
        dialog.showModal();
      }
    }
    window.addEventListener("keydown", toggleConversations);
    return () => window.removeEventListener("keydown", toggleConversations);
  }, [attachmentLocked, authRequired]);

  const activityLabel = busy ? (partialReply ? "Recebendo resposta" : regenerating ? "Refazendo resposta" : sending ? "Preparando resposta" : "Preparando importação") : "";
  const currentConversation = { id: conversationId, prompt, messages, apiMessages, attachment, selectedPage, title: conversationTitleOverride };
  const hasCurrentConversation = !!(messages.length || prompt.trim() || attachment || conversationTitleOverride);
  const conversations = orderConversations([currentConversation, ...otherConversations], conversationOrder);
  const limit = attachment ? 1800 : MESSAGE_LIMIT;
  const configLabel = checkingConfig ? "Verificando…" : authRequired ? "Login necessário"
    : status?.configured ? "Configurado" : status?.modelValid === false ? "Modelo inválido"
    : status ? "Chave ausente" : "Indisponível";

  useEffect(() => {
    function focusAttachment() {
      if (window.location.hash === "#anexar-referencia") {
        document.getElementById("anexar-referencia")?.scrollIntoView({ block: "start", behavior: "instant" });
        attachmentInput.current?.focus({ preventScroll: true });
      }
    }

    const frame = requestAnimationFrame(() => {
      focusAttachment();
      if (window.location.hash === "#assistente") {
        document.getElementById("assistente")?.scrollIntoView({ block: "start", behavior: "instant" });
      }
    });
    window.addEventListener("hashchange", focusAttachment);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", focusAttachment);
    };
  }, []);

  function openSettings(trigger: HTMLButtonElement) {
    settingsTrigger.current = trigger;
    setSettings(true);
    requestAnimationFrame(() => settingsHeading.current?.focus());
  }

  function closeSettings() {
    setSettings(false);
    settingsTrigger.current?.focus();
  }

  function retryConfig() {
    if (checkingConfig) return;
    setConfigCheckFailed(false);
    setCheckingConfig(true);
    setConfigAttempt(attempt => attempt + 1);
  }

  const requireAssistantSession = useCallback(() => {
    activeRequest.current?.abort();
    setAuthRequired(true);
    setArchiveReady(false);
    if (archiveKey) {
      setConversationId(newArchiveConversationId());
      setConversationTitleOverride("");
    }
    setConfigCheckFailed(false);
    assistantAttachments.clear();
    setServerStatus(null);
    setOtherConversations([]);
    setConversationOrder([]);
    setMessages([]);
    setApiMessages([]);
    setCopyState(null);
    setSendCanceled(false);
    setShowLatest(false);
    followThread.current = true;
  }, [archiveKey]);

  useEffect(() => {
    const controller = new AbortController();
    async function check() {
      try {
        const response = await fetch('/api/assistant', { cache: 'no-store', signal: controller.signal });
        if (response.status === 401) {
          if (!controller.signal.aborted) requireAssistantSession();
          return;
        }
        if (!response.ok) throw new Error();
        const configuration = await response.json();
        if (typeof configuration?.model !== "string" || typeof configuration.modelValid !== "boolean" ||
            typeof configuration.hasKey !== "boolean") throw new Error();
        if (!controller.signal.aborted) {
          if (accountId && typeof configuration.accountId === "string" && configuration.accountId !== accountId) {
            activeRequest.current?.abort();
            window.location.reload();
            return;
          }
          if (document.activeElement === sessionRetryButton.current) {
            composer.current?.focus({ preventScroll: true });
          }
          setAuthRequired(false);
          setConfigCheckFailed(false);
          setServerStatus({ model: configuration.model, modelValid: configuration.modelValid, hasKey: configuration.hasKey });
        }
      } catch {
        if (!controller.signal.aborted) {
          setConfigCheckFailed(true);
          setServerStatus(null);
        }
      } finally {
        if (!controller.signal.aborted) setCheckingConfig(false);
      }
    }
    void check();
    return () => controller.abort();
  }, [accountId, configAttempt, requireAssistantSession]);

  useEffect(() => {
    function refreshSessionOnReturn() {
      if (document.visibilityState === "visible") setConfigAttempt(attempt => attempt + 1);
    }
    document.addEventListener("visibilitychange", refreshSessionOnReturn);
    return () => document.removeEventListener("visibilitychange", refreshSessionOnReturn);
  }, []);

  useEffect(() => () => activeRequest.current?.abort(), []);
  useEffect(() => {
    if (followThread.current && thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [conversationId, messages.length, pendingMessage, partialReply]);
  useEffect(() => {
    const field = composer.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 224)}px`;
  }, [prompt]);

  function trackThreadScroll() {
    const log = thread.current;
    if (!log) return;
    followThread.current = log.scrollHeight - log.scrollTop - log.clientHeight < 32;
    setShowLatest(!followThread.current);
  }

  function goToLatest() {
    const log = thread.current;
    if (!log) return;
    followThread.current = true;
    log.focus({ preventScroll: true });
    log.scrollTop = log.scrollHeight;
    setShowLatest(false);
  }

  useLayoutEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(assistantConversationStorageKey) || "null");
      const sameOwner = saved?.owner === undefined || saved.owner === accountId;
      privateHistoryInDemo.current = !accountId && !sameOwner;
      const deleted = new Set<number>(deletedArchiveKey ? JSON.parse(localStorage.getItem(deletedArchiveKey) ?? "[]") : []);
      if (sameOwner && Array.isArray(saved?.conversations)) {
        const history = (saved.conversations as AssistantConversation[]).filter(item =>
          Number.isSafeInteger(item?.id) && !deleted.has(item.id) && typeof item.prompt === "string" &&
          Array.isArray(item.messages) && Array.isArray(item.apiMessages)
        ).slice(0, 20).map(item => ({ ...item, attachment: null, selectedPage: "", ...assistantAttachments.get(item.id) }));
        const active = history.find(item => item.id === saved.active);
        if (active) {
          setConversationId(active.id);
          loadConversation(active);
        }
        setConversationOrder(history.map(item => item.id));
        setOtherConversations(history.filter(item => item.id !== active?.id));
        nextConversationId.current = Math.max(0, ...history.map(item => item.id)) + 1;
        if (!active) setConversationId(allocateConversationId());
      }
    } catch {}
    if (archiveKey) setConversationId(id => id || allocateConversationId());
    setHistoryReady(true);
  }, []);

  useLayoutEffect(() => {
    if (!historyReady || privateHistoryInDemo.current) return;
    if (!authRequired) {
      assistantAttachments.clear();
      for (const item of [currentConversation, ...otherConversations]) {
        if (item.attachment) assistantAttachments.set(item.id, { attachment: item.attachment, selectedPage: item.selectedPage });
      }
    }
    const active = { id: conversationId, title: conversationTitleOverride, prompt, messages, apiMessages };
    const items = [
      ...(hasCurrentConversation ? [active] : []),
      ...otherConversations.map(({ id, title, prompt, messages, apiMessages }) => ({ id, title, prompt, messages, apiMessages })),
    ];
    orderConversations(items, conversationOrder);
    try {
      sessionStorage.setItem(assistantConversationStorageKey, JSON.stringify({ owner: accountId, active: conversationId, conversations: items }));
      setHistorySaveFailed(false);
    } catch {
      setHistorySaveFailed(true);
    }
  }, [historyReady, accountId, conversationId, conversationTitleOverride, prompt, messages, apiMessages, otherConversations, hasCurrentConversation, conversationOrder, attachment, selectedPage, authRequired]);

  useEffect(() => {
    if (!archiveKey || !deletedArchiveKey || !historyReady || !serverStatus || archiveReady || authRequired) return;
    try {
      const saved = JSON.parse(localStorage.getItem(archiveKey) ?? "[]") as AssistantConversation[];
      const deleted = new Set<number>(JSON.parse(localStorage.getItem(deletedArchiveKey) ?? "[]"));
      const archived = saved.filter(item => Number.isSafeInteger(item?.id) && !deleted.has(item.id) && Array.isArray(item.messages) && item.messages.at(-1)?.role === "model")
        .map(({ id, title, messages }) => ({ id, title, messages, prompt: "", attachment: null, selectedPage: "",
          apiMessages: messages.map(({ role, text }) => ({ role, text })) }));
      lastArchived.current = new Map(archived.map(({ id, title, messages }) => [id, JSON.stringify({ id, title, messages })]));
      setOtherConversations(items => [...items, ...archived.filter(item => item.id !== conversationId && !items.some(existing => existing.id === item.id))].slice(0, 20));
    } catch {}
    setArchiveReady(true);
  }, [archiveKey, deletedArchiveKey, archiveReady, authRequired, conversationId, historyReady, serverStatus]);

  useEffect(() => {
    if (!archiveKey || !deletedArchiveKey || !archiveReady || !serverStatus || authRequired) return;
    const completed = [{ id: conversationId, title: conversationTitleOverride, messages },
      ...otherConversations.map(({ id, title, messages }) => ({ id, title, messages }))]
      .filter(item => item.messages.at(-1)?.role === "model");
    const changed = completed.filter(item => lastArchived.current.get(item.id) !== JSON.stringify(item));
    if (!changed.length) return;
    let canceled = false;
    void updateConversationArchive(archiveKey, () => {
      if (canceled) return;
      const saved = JSON.parse(localStorage.getItem(archiveKey) ?? "[]") as typeof completed;
      // A tab that had already archived a conversation cannot recreate it after another tab removes it.
      const deleted = new Set<number>(JSON.parse(localStorage.getItem(deletedArchiveKey) ?? "[]"));
      const updates = changed.filter(item => !deleted.has(item.id) &&
        (!lastArchived.current.has(item.id) || saved.some(existing => existing.id === item.id)));
      if (updates.length) {
        const next = [...updates, ...saved.filter(item => !deleted.has(item.id) && !updates.some(update => update.id === item.id))].slice(0, 20);
        localStorage.setItem(archiveKey, JSON.stringify(next));
      }
      for (const item of changed) lastArchived.current.set(item.id, JSON.stringify(item));
    }).catch(() => {
      if (!canceled) setHistorySaveFailed(true);
    });
    return () => { canceled = true; };
  }, [archiveKey, deletedArchiveKey, archiveReady, authRequired, conversationId, conversationTitleOverride, messages, otherConversations, serverStatus]);

  function loadConversation(conversation?: AssistantConversation) {
    followThread.current = true;
    setShowLatest(false);
    setMessages(conversation?.messages ?? []);
    setApiMessages(conversation?.apiMessages ?? []);
    setCopyState(null);
    setSendCanceled(false);
    setConversationTitleOverride(conversation?.title ?? "");
    setPrompt(conversation?.prompt ?? '');
    setAttachment(conversation?.attachment ?? null);
    setSelectedPage(conversation?.selectedPage ?? '');
    setError(null);
  }

  function openConversationRename(target: AssistantConversation) {
    if (!renameInput.current || !renameDialog.current) return;
    renameTarget.current = target.id;
    renameInput.current.value = conversationTitle(target);
    renameDialog.current.showModal();
    renameInput.current.select();
  }

  function requestConversationRemoval(trigger: HTMLButtonElement, target?: AssistantConversation) {
    deleteTrigger.current = trigger;
    setDeleteTarget(target ? { id: target.id, title: conversationTitle(target) } : null);
    clearDialog.current?.showModal();
  }

  async function confirmConversationRemoval() {
    const id = deleteTarget?.id ?? conversationId;
    if (archiveKey && deletedArchiveKey && lastArchived.current.has(id)) {
      try {
        await updateConversationArchive(archiveKey, () => {
          const saved = JSON.parse(localStorage.getItem(archiveKey) ?? "[]") as { id: number }[];
          const deleted = new Set<number>(JSON.parse(localStorage.getItem(deletedArchiveKey) ?? "[]"));
          deleted.add(id);
          localStorage.setItem(deletedArchiveKey, JSON.stringify([...deleted]));
          localStorage.setItem(archiveKey, JSON.stringify(saved.filter(item => item.id !== id)));
          lastArchived.current.delete(id);
        });
      } catch {
        setHistorySaveFailed(true);
        clearDialog.current?.close();
        return;
      }
    }
    setConversationOrder(order => order.filter(item => item !== id));
    deleteTrigger.current = null;
    if (deleteTarget) {
      setOtherConversations(items => items.filter(item => item.id !== id));
    } else {
      setConversationId(allocateConversationId());
      loadConversation();
    }
    clearDialog.current?.close();
  }

  function restoreRemovalFocus() {
    if (clearDialog.current?.open) return;
    const trigger = deleteTrigger.current;
    deleteTrigger.current = null;
    setDeleteTarget(null);
    if (trigger?.isConnected && !trigger.disabled) trigger.focus();
    else if (conversationsDialog.current?.open) conversationsDialog.current.querySelector<HTMLButtonElement>('[aria-label="Fechar conversas"]')?.focus();
    else composer.current?.focus();
  }

  function switchConversation(target?: AssistantConversation) {
    if (busy || reading || target?.id === conversationId) return;
    const remaining = otherConversations.filter(item => item.id !== target?.id);
    if (hasCurrentConversation) remaining.unshift(currentConversation);
    setOtherConversations(remaining);
    setConversationId(target?.id ?? allocateConversationId());
    loadConversation(target);
    conversationsDialog.current?.close();
    composer.current?.focus();
  }

  function moveConversation(items: AssistantConversation[], from: number, to: number) {
    if (from < 0 || to < 0 || to >= items.length || from === to) return;
    const ids = items.map(item => item.id);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id);
    setConversationOrder(ids);
  }

  function finishConversationDrag() {
    draggedConversation.current = null;
    setConversationDropTarget(null);
  }

  function renderConversationList(inDialog = false) {
    const saved = conversations.filter(item => hasCurrentConversation || item.id !== conversationId);
    if (!saved.length) return <p className="ct-chat-history-note">Nenhuma conversa salva neste navegador.</p>;
    return <ul aria-label="Conversas salvas neste navegador" className={inDialog ? "ct-chat-conversation-list min-h-0 overscroll-contain" : "ct-chat-conversation-list"}>
      {saved.map((conversation, index) => {
        const title = conversationTitle(conversation);
        const active = conversation.id === conversationId;
        return <li key={conversation.id} data-drop-target={!inDialog && conversationDropTarget === conversation.id}
          className="flex items-center gap-1 rounded-lg data-[drop-target=true]:outline data-[drop-target=true]:outline-ct-action"
          onDragOver={event => {
            if (inDialog || draggedConversation.current === null || draggedConversation.current === conversation.id) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setConversationDropTarget(conversation.id);
          }}
          onDragLeave={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setConversationDropTarget(null);
          }}
          onDrop={event => {
            if (inDialog || draggedConversation.current === null) return;
            event.preventDefault();
            moveConversation(saved, saved.findIndex(item => item.id === draggedConversation.current), index);
            finishConversationDrag();
          }}>
          <button type="button" className="ct-chat-conversation min-w-0" aria-current={active ? "true" : undefined}
            draggable={!inDialog && saved.length > 1 && !attachmentLocked}
            onDragStart={event => {
              draggedConversation.current = conversation.id;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("application/x-ctfunil-conversation", String(conversation.id));
            }}
            onDragEnd={finishConversationDrag}
            disabled={attachmentLocked} onClick={() => active && inDialog ? conversationsDialog.current?.close() : switchConversation(conversation)}>
            <span>{title}</span>
          </button>
          {saved.length > 1 && <div role="group" aria-label={`Ordem de ${title}`} className="flex shrink-0">
            {([[-1, "Mover para cima", ArrowUp], [1, "Mover para baixo", ArrowDown]] as const).map(([offset, label, Icon]) => {
              const target = index + offset;
              return <button type="button" key={offset} className="ct-icon-button aria-disabled:opacity-30"
                aria-label={`${label} — ${title}`} aria-disabled={target < 0 || target >= saved.length}
                onClick={() => moveConversation(saved, index, target)}><Icon size={14} aria-hidden="true" /></button>;
            })}
          </div>}
          <button type="button" className="ct-icon-button" aria-haspopup="dialog"
            aria-label={`Renomear conversa — ${title}`} title="Renomear conversa" disabled={attachmentLocked}
            onClick={() => openConversationRename(conversation)}>
            <Pencil size={15} aria-hidden="true" />
          </button>
          {!active && <button type="button" className="ct-icon-button" aria-haspopup="dialog"
            aria-label={`Excluir conversa — ${title}`} title="Excluir conversa" disabled={attachmentLocked}
            onClick={event => requestConversationRemoval(event.currentTarget, conversation)}>
            <Trash2 size={15} aria-hidden="true" />
          </button>}
        </li>;
      })}
    </ul>;
  }

  const submit = async () => {
    const text = prompt.trim();
    if (!text || dictating || attachmentLocked || activeRequest.current || authRequired || !status?.configured || messages.length >= 18) return;
    const selected = attachment?.pages.find(page => page.path === selectedPage)
      || (selectedPage === ALL_PAGES ? attachment?.pages.find(page => /\.html?$/i.test(page.path)) : undefined);
    const sentText = selected && attachment ? `${text.slice(0, 1800)}\n\n${attachmentContext(attachment, selected)}` : text;
    const userMessage = { role: 'user' as const, text: selected ? `${text}\nArquivo: ${selected.path}` : text };
    await requestReply(buildAssistantRequest(apiMessages, sentText), userMessage);
  };

  const canRegenerate = messages.at(-1)?.role === "model" &&
    apiMessages.at(-1)?.role === "model" && apiMessages.at(-2)?.role === "user";

  function regenerateReply() {
    if (!canRegenerate || dictating || attachmentLocked || activeRequest.current || authRequired || !status?.configured) return;
    composer.current?.focus({ preventScroll: true });
    void requestReply(apiMessages.slice(0, -1));
  }

  async function requestReply(next: AssistantMessage[], userMessage?: AssistantMessage) {
    const controller = new AbortController();
    activeRequest.current = controller;
    setPendingMessage(userMessage?.text ?? "");
    setRegenerating(!userMessage);
    setSendCanceled(false);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: ASSISTANT_STREAM_TYPE },
        body: JSON.stringify({ accountId, messages: next, model: requestModel, key: customKey }), signal: controller.signal,
      }).catch(() => {
        throw new Error('Não foi possível conectar ao assistente. Tente novamente.');
      });
      if (controller.signal.aborted) return;
      if (response.status === 401) {
        requireAssistantSession();
        return;
      }
      let streamed = false;
      const received = await readAssistantReply(response, value => {
        if (controller.signal.aborted) return;
        streamed ||= Boolean(value);
        setPartialReply(value);
      });
      if (controller.signal.aborted) return;
      const reply = { role: 'model' as const, text: received };
      setApiMessages([...next, reply]);
      const responseModel = response.headers.get('X-CTFunil-Model') ?? '';
      const model = geminiModelPattern.test(responseModel) ? responseModel : undefined;
      const completed = { ...reply, streamed, model };
      setMessages(previous => userMessage
        ? [...previous, userMessage, completed]
        : [...previous.slice(0, -1), completed]);
      if (userMessage) setPrompt("");
    } catch (error) {
      if (!controller.signal.aborted) setError({ message: error instanceof Error ? error.message : 'Não foi possível enviar.', send: userMessage ? true : undefined });
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setPendingMessage('');
        setRegenerating(false);
        setPartialReply('');
        setBusy(false);
        if (controller.signal.aborted) requestAnimationFrame(() => composer.current?.focus());
      }
    }
  }
  function removeAttachment() {
    if (attachmentLocked || activeRequest.current) return;
    setAttachment(null);
    setSelectedPage('');
    if (attachmentInput.current?.disabled) composer.current?.focus();
    else attachmentInput.current?.focus();
  }

  const importPage = async () => {
    if (!attachment || attachmentLocked || activeRequest.current) return;
    const page = attachment.pages.find(item => item.path === selectedPage);
    const pages = page ? [page] : attachment.pages.filter(item => /\.html?$/i.test(item.path));
    if (!pages.length || !page && selectedPage !== ALL_PAGES) return;
    setSendCanceled(false);
    setBusy(true);
    setError(null);
    try {
      const { saveImportDraft } = await import("@/lib/assistant/import-drafts");
      const preserveDesign = importMode === "design" && pages.every(item => /\.html?$/i.test(item.path));
      let result;
      if (preserveDesign) {
        const { importProjectDesign } = await import("@/lib/assistant/import-design");
        result = importProjectDesign(attachment, pages);
      } else {
        const { convertProjectPage, convertProjectPages } = await import("@/lib/assistant/convert-project");
        result = page ? convertProjectPage(page, { assets: attachment.assets }) : convertProjectPages(pages, attachment.assets);
      }
      const id = crypto.randomUUID();
      await saveImportDraft({ id, funnel: result.funnel, warnings: result.warnings, source: page?.path || attachment.name, reviewed: false });
      startReviewNavigation(() => router.push(`/importar/${id}`));
    } catch (error) {
      setError({ message: error instanceof Error ? error.message : "Não foi possível preparar a importação." });
    } finally {
      setBusy(false);
    }
  };
  const assistantSettingsLink = <Link href={ASSISTANT_SETTINGS_PATH} className="ct-chat-config-link">
    <Settings2 size={16} aria-hidden="true" /> Configurações da IA
  </Link>;
  return <div className="ct-assistant-shell" data-conversations-open={conversationRailOpen}>
    <aside id="ct-assistant-conversation-rail" className="ct-assistant-rail" aria-label="Conversas do Assistente">
      <button className="ct-chat-new-conversation" type="button" disabled={attachmentLocked || !hasCurrentConversation || conversations.length >= 20} onClick={() => switchConversation()}><MessageSquarePlus size={16} aria-hidden="true" /> Nova conversa</button>
      <h3>{archiveKey ? "Histórico de conversas" : "Conversas desta sessão"}</h3>
      {renderConversationList()}
      <p className="ct-chat-history-note">{archiveKey ? "Histórico salvo neste navegador." : "Histórico disponível nesta sessão."}</p>
      {assistantSettingsLink}
    </aside>
    <section id="assistente" className="ct-panel ct-composer scroll-mt-16" aria-labelledby="ctfunil-builder-title">
    <dialog ref={renameDialog} className="ct-confirm" aria-labelledby="assistant-rename-title">
      <h2 id="assistant-rename-title" className="font-semibold">Renomear conversa</h2>
      <form className="mt-3" onSubmit={event => {
        event.preventDefault();
        const id = renameTarget.current;
        const title = renameInput.current?.value.replace(/\s+/g, " ").trim().slice(0, CONVERSATION_TITLE_LIMIT) ?? "";
        if (id === conversationId) setConversationTitleOverride(title);
        else setOtherConversations(items => items.map(item => item.id === id ? { ...item, title } : item));
        renameDialog.current?.close();
      }}>
        <label htmlFor="assistant-conversation-name" className="text-sm text-ct-dim">Nome da conversa</label>
        <input ref={renameInput} id="assistant-conversation-name" autoFocus maxLength={CONVERSATION_TITLE_LIMIT}
          className="mt-1 w-full rounded-md border border-ct-line bg-ct-raised px-2 py-1 text-sm" />
        <div className="mt-5 flex justify-end gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => renameDialog.current?.close()}>Cancelar</Button>
          <Button type="submit" size="sm">Salvar nome</Button>
        </div>
      </form>
    </dialog>
    <dialog ref={clearDialog} className="ct-confirm ct-delete-modal-confirmation" aria-labelledby="assistant-clear-title" aria-describedby="assistant-clear-summary" onClose={restoreRemovalFocus}>
      <div className="flex items-center gap-2">
        <DeleteConfirmationIcon />
        <h2 id="assistant-clear-title" className="font-semibold">{deleteTarget ? "Excluir conversa?" : "Limpar conversa?"}</h2>
      </div>
      <p id="assistant-clear-summary" className="mt-2 text-sm text-ct-dim">{deleteTarget ? `As mensagens e o rascunho de “${deleteTarget.title}” serão removidos.` : "As mensagens, o texto em edição e o anexo atual serão removidos."}</p>
      <div className="mt-5 flex justify-end gap-3">
        <Button type="button" variant="secondary" size="sm" className="ct-confirm-cancel" autoFocus onClick={() => clearDialog.current?.close()}>Cancelar</Button>
        <button type="button" className="ct-confirm-delete" onClick={confirmConversationRemoval}>{deleteTarget ? "Excluir conversa" : "Limpar conversa"}</button>
      </div>
    </dialog>
    <dialog id="assistant-conversations" ref={conversationsDialog} className="ct-confirm max-h-[calc(100dvh-1rem)] flex-col open:flex" aria-labelledby="assistant-conversations-title">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 id="assistant-conversations-title" className="font-semibold">{archiveKey ? "Histórico de conversas" : "Conversas desta sessão"}</h2>
        <button type="button" className="ct-icon-button" aria-label="Fechar conversas" autoFocus onClick={() => conversationsDialog.current?.close()}><X size={16} /></button>
      </div>
      <div className="my-3 shrink-0 space-y-2">
        <button type="button" className="ct-confirm-cancel inline-flex items-center gap-2"
          disabled={!hasCurrentConversation || conversations.length >= 20} onClick={() => switchConversation()}><Plus size={16} aria-hidden="true" />Nova conversa</button>
        {conversations.length >= 20 && <p className="text-xs text-ct-dim">Limite de 20 conversas nesta sessão.</p>}
      </div>
      {renderConversationList(true)}
      <div className="mt-3 shrink-0 space-y-2">
        <p className="ct-chat-history-note">{archiveKey ? "Histórico salvo neste navegador." : "Histórico disponível nesta sessão."}</p>
        {assistantSettingsLink}
      </div>
    </dialog>
    <header className="ct-section-heading ct-assistant-header">
      {!authRequired && <>
        <button ref={conversationToggle} type="button" className="ct-icon-button ct-conversation-toggle" aria-label="Alternar painel de conversas"
          aria-keyshortcuts="Control+B Meta+B" title="Alternar conversas (Ctrl+B / ⌘B)"
          aria-controls="ct-assistant-conversation-rail" aria-expanded={conversationRailOpen}
          onClick={() => setConversationRailOpen(open => !open)}><PanelLeft size={17} aria-hidden="true" /></button>
        <button type="button" className="ct-icon-button ct-conversation-dialog-toggle" aria-label="Conversas" aria-haspopup="dialog" aria-controls="assistant-conversations" aria-keyshortcuts="Control+B Meta+B"
          disabled={busy || reading} onClick={() => conversationsDialog.current?.showModal()}><PanelLeft size={17} aria-hidden="true" /></button>
      </>}
      <div className="min-w-0">
        <h2 id="ctfunil-builder-title" tabIndex={-1} className="truncate"
          title={hasCurrentConversation ? conversationTitle(currentConversation) : undefined}>
          {hasCurrentConversation ? conversationTitle(currentConversation) : "Nova conversa"}
        </h2>
        <p className="ct-assistant-header-caption">
          <span>Assistente</span>
          {hasCurrentConversation && <button className="text-ct-blue underline" type="button"
            disabled={attachmentLocked} aria-haspopup="dialog" onClick={() => openConversationRename(currentConversation)}>Renomear</button>}
        </p>
      </div>
      <div className="ct-chat-top-actions">
        <ChatParticipants avatarUrl={avatarUrl} model={status?.model} providerStatus={configLabel} signedOut={authRequired} />
        <button type="button" onClick={event => settings ? closeSettings() : openSettings(event.currentTarget)} aria-expanded={settings} aria-controls="assistant-api-settings" aria-label="Configuração da API" title="Configuração da API" className="rounded-lg border border-ct-line p-2 text-ct-dim hover:bg-ct-raised"><Settings2 size={17} aria-hidden="true"/></button>
      </div>
    </header>
    <section hidden={!settings} id="assistant-api-settings" className="ct-assistant-settings mx-4 mt-4 rounded-xl border border-ct-line bg-ct-raised p-4 text-sm" aria-labelledby="assistant-api-title"
      onKeyDown={event => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        closeSettings();
      }}>
      <div className="flex flex-wrap justify-between gap-2"><h3 id="assistant-api-title" ref={settingsHeading} tabIndex={-1} className="font-semibold">Google Gemini</h3><span role="status" className="text-ct-dim">{configLabel}</span></div>
      {status?.model && <p className="mt-2 text-xs text-ct-dim">Modelo <code>{status.model}</code></p>}
      {authRequired && <p className="mt-2 text-xs text-ct-dim">Entre no CTFunil para consultar a configuração do assistente.</p>}
      {!authRequired && <p className="mt-2 text-xs text-ct-dim"><Link className="text-ct-blue underline" href={ASSISTANT_SETTINGS_PATH}>Configurar chave e modelo do assistente</Link></p>}
      {!authRequired && <StatefulButton type="button" size="sm" variant="outline" onClick={retryConfig}
        state={checkingConfig ? "loading" : status ? "idle" : "error"}
        aria-label={checkingConfig ? "Verificando configuração…" : "Verificar configuração"}
        loadingText="Verificando configuração…" errorText="Verificar configuração"
        className="mt-3 max-w-full rounded-lg border-ct-line text-ct-blue disabled:opacity-50">
        Verificar configuração
      </StatefulButton>}
    </section>
    <div className="px-4 pt-4">
      <div role="status">
        {historySaveFailed && !authRequired && <p className="mb-3 rounded-lg border border-ct-line bg-ct-raised px-3 py-2 text-sm text-ct-dim">
          O navegador não conseguiu atualizar o histórico. As alterações podem se perder se você recarregar esta página.
        </p>}
      </div>
      {!messages.length && !busy && !attachment && !authRequired && <section className="ct-chat-welcome" aria-labelledby="assistant-welcome-title">
        <span aria-hidden="true"><AccessOrb /></span>
        <h3 id="assistant-welcome-title">Como posso ajudar?</h3>
        <p>Peça ajuda para criar um funil ou anexe um ZIP ou HTML para analisar ou importar uma página.</p>
        <ul aria-label="Sugestões de pergunta" onFocus={event => {
          if (!(event.target instanceof HTMLElement)) return;
          const target = event.target;
          const list = event.currentTarget;
          const input = list.closest(".ct-composer")?.querySelector(".ct-chat-input");
          requestAnimationFrame(() => {
            if (document.activeElement !== target) return;
            const bounds = target.getBoundingClientRect();
            if (list.scrollWidth > list.clientWidth) {
              const strip = list.getBoundingClientRect();
              if (bounds.right > strip.right - 4) list.scrollLeft += bounds.right - strip.right + 4;
              else if (bounds.left < strip.left + 4) list.scrollLeft += bounds.left - strip.left - 4;
            }
            if (!input || !window.matchMedia("(max-width: 359px)").matches) return;
            const overlap = bounds.bottom - input.getBoundingClientRect().top + 8;
            if (overlap > 0) window.scrollBy({ top: overlap, behavior: "instant" });
          });
        }}>
          {quickPrompts.map(item => <li key={item}>
            <button type="button" onClick={() => { setPrompt(item); composer.current?.focus(); }}>{item}</button>
          </li>)}
        </ul>
      </section>}
      <p id="assistant-activity-status" role="status" className="sr-only">{activityLabel || (sendCanceled ? "Envio cancelado. Mensagem preservada." : "")}</p>
      {(messages.length > 0 || busy) && <div>
        <div ref={thread} className="ct-chat-thread" aria-label="Conversa" role="log" aria-live="polite" tabIndex={0} onScroll={trackThreadScroll}>
        {messages.map((message, index) => <article className="ct-chat-message" data-role={message.role} key={index}>
          <strong className="ct-chat-message-author"><ChatAvatar role={message.role} photo={message.role === "user" ? avatarUrl : undefined} />{message.role === 'user' ? 'Você' : 'Gemini'}</strong>
          {message.role === 'model' && message.streamed !== undefined && <details className="ct-disclosure mb-2 text-xs text-ct-dim">
            <summary>Atividade da resposta</summary>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Preparando resposta</li>
              {message.streamed && <li>Recebendo resposta em partes</li>}
              <li>Resposta concluída</li>
            </ol>
          </details>}
          {message.role === 'model' ? <AssistantResponse text={message.text} /> : <p>{message.text}</p>}
          {message.role === 'model' && typeof message.model === 'string' && geminiModelPattern.test(message.model) &&
            <p className="mt-2 break-all text-xs text-ct-dim">Modelo <code>{message.model}</code></p>}
          {message.role === 'model' && <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Ações da resposta">
            <button type="button" className="min-h-11 px-2" onClick={async () => {
              try {
                await navigator.clipboard.writeText(message.text);
                setCopyState(index);
              } catch {
                setError({ message: 'Não foi possível copiar a resposta.' });
              }
            }}>{copyState === index ? 'Copiado' : 'Copiar resposta'}</button>
            {index === messages.length - 1 && canRegenerate && <button type="button"
              className="inline-flex min-h-11 items-center gap-2 px-2 disabled:opacity-50"
              disabled={dictating || attachmentLocked || authRequired || !status?.configured} onClick={regenerateReply}>
              <RefreshCw size={15} aria-hidden="true" /> Tentar de novo
            </button>}
            {([["up", "Útil", ThumbsUp], ["down", "Não foi útil", ThumbsDown]] as const).map(([value, label, Icon]) =>
              <button key={value} type="button" aria-label={label} title={label} aria-pressed={message.feedback === value}
                className="inline-grid size-11 place-items-center rounded-lg border border-ct-line aria-pressed:border-ct-action aria-pressed:bg-ct-selected"
                onClick={() => setMessages(items => items.map((item, itemIndex) => itemIndex === index
                  ? { ...item, feedback: item.feedback === value ? undefined : value }
                  : item))}>
                <Icon size={16} aria-hidden="true" />
              </button>
            )}
          </div>}
        </article>)}
        {pendingMessage && <article className="ct-chat-message" data-role="user"><strong className="ct-chat-message-author"><ChatAvatar role="user" photo={avatarUrl} />Você</strong><p>{pendingMessage}</p></article>}
        {sending && <section aria-label="Atividade em andamento" aria-live="off"
          className="mb-2 rounded-lg border border-ct-line bg-ct-raised px-3 py-2 text-xs text-ct-dim">
          <h3 className="mb-1 font-semibold text-ct-ink">Atividade da resposta</h3>
          <ol className="list-decimal space-y-1 pl-5">
            <li aria-current={partialReply ? undefined : "step"}>Preparando resposta</li>
            {partialReply && <li aria-current="step">Recebendo resposta em partes</li>}
          </ol>
        </section>}
        {partialReply && <article className="ct-chat-message" data-role="model" aria-hidden="true">
          <strong className="ct-chat-message-author"><ChatAvatar role="model" />Gemini</strong>
          <p>{partialReply}</p>
        </article>}
        {busy && <ActivityPill label={activityLabel} busy receiving={!!partialReply} decorative />}
        </div>
        {showLatest && <button type="button" className="ct-chat-latest" onClick={goToLatest}>
          Ir à mensagem mais recente <ChevronDown size={14} aria-hidden="true" />
        </button>}
      </div>}
      {error&&<p id="assistant-error" role="alert" className="mt-3 text-xs text-red-400">{error.message}</p>}
      {authRequired && <div className="mt-3 space-y-2 text-xs text-ct-dim">
        <p role="status">{checkingConfig ? "Verificando sessão…" : configCheckFailed
          ? "Não foi possível verificar a sessão. Tente novamente." : "Entre na sua conta para conversar."}</p>
        <p>Após entrar, volte a esta aba para continuar.</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <a className="text-ct-blue underline" href="/admin/login?next=%2Fctfunil%2Fassistente" target="_blank" rel="noopener noreferrer">Entrar no CTFunil em nova aba</a>
          <button ref={sessionRetryButton} type="button" aria-disabled={checkingConfig}
            className="text-ct-blue underline aria-disabled:opacity-50" onClick={retryConfig}>Verificar sessão</button>
        </div>
      </div>}
      {!authRequired && !checkingConfig && !status && <div className="mt-3 space-y-2 text-xs">
        <p role="alert" className="text-ct-dim">Não foi possível verificar a configuração.</p>
        <button type="button" className="text-ct-blue underline" onClick={retryConfig}>Verificar configuração novamente</button>
      </div>}
      {!authRequired && status && !status.configured && <div className="mt-3 rounded-lg bg-ct-raised px-4 py-3">
        <p className="flex items-center gap-2 text-[13px] font-medium">
          <KeyRound size={16} className="shrink-0 text-ct-dim" aria-hidden="true" />
          API de IA indisponível
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ct-dim">
          Configure a API para começar. <Link className="text-ct-blue underline" href={ASSISTANT_SETTINGS_PATH}>Configurações › API (IA)</Link>
        </p>
      </div>}
      {attachment&&<div className="mt-3 rounded-xl border border-ct-line bg-ct-raised p-3 text-sm"><div className="flex items-center justify-between gap-3"><strong className="break-all">{attachment.name}</strong><button type="button" aria-label="Remover arquivo" disabled={attachmentLocked} onClick={removeAttachment}><X size={16}/></button></div><p className="mt-1 text-xs text-ct-dim">{attachment.files.length} arquivos · {attachment.pages.length} páginas e componentes</p><div className="mt-3"><WorkspaceSelect searchable label="Página para análise" disabled={attachmentLocked} value={selectedPage} onChange={setSelectedPage} options={[...attachment.pages.map(page=>({value:page.path,label:page.title+' — '+page.path})),...(attachment.pages.filter(page=>/\.html?$/i.test(page.path)).length>1?[{value:ALL_PAGES,label:'Todas as páginas HTML como etapas'}]:[])]}/></div><ProjectFileTree paths={attachment.files} pages={attachmentLocked ? [] : attachment.pages.map(page => page.path)} selected={selectedPage} onSelect={setSelectedPage} /><div className="mt-3">
        <WorkspaceSelect label="Modo de importação" disabled={attachmentLocked} value={importMode}
          onChange={value => setImportMode(value === "blocks" ? "blocks" : "design")}
          options={[{value:"design",label:"Preservar design"},{value:"blocks",label:"Converter em blocos"}]} />
      </div><p className="mt-2 text-xs leading-relaxed text-ct-dim">{importMode === "design" ? "Preserva HTML, CSS e imagens do arquivo em um rascunho local. Scripts e recursos remotos ficam desativados." : "Separa textos, imagens, campos e botões em blocos editáveis. A composição pode precisar de ajuste."} Ao enviar uma mensagem, trechos da página e dos estilos são enviados ao Gemini.{selectedPage===ALL_PAGES?' Na análise com IA, será usado um trecho da primeira página HTML.':''}</p><StatefulButton type="button" onClick={importPage} size="sm" disabled={sending || reading}
        state={importing ? "loading" : "idle"}
        aria-label={importing ? "Preparando importação…" : "Revisar importação"}
        loadingText="Preparando importação…"
        className="mt-3 rounded-lg bg-ct-action px-3 text-xs font-semibold text-white disabled:opacity-50">
        Revisar importação
      </StatefulButton></div>}
    </div>
    <div className="ct-chat-input px-4 pb-4">
      <label className="sr-only" htmlFor="assistant-prompt">Mensagem para o assistente</label><textarea ref={composer} id="assistant-prompt" value={prompt} readOnly={!!pendingMessage} aria-describedby="assistant-prompt-help"
        enterKeyHint="send"
        onKeyDown={event => {
          if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
          event.preventDefault();
          if (!event.repeat) void submit();
        }} onChange={event=>setPrompt(event.target.value)} maxLength={limit} className="ct-assistant-prompt mt-3 w-full resize-none rounded-xl border border-ct-line bg-ct-surface p-3 text-sm text-ct-ink outline-none focus-visible:ring-2 focus-visible:ring-ct-blue" placeholder="Descreva o que você quer criar…"/>
      <p id="assistant-prompt-help" className="mt-1 text-xs text-ct-dim">{prompt.length.toLocaleString("pt-BR")} de {limit.toLocaleString("pt-BR")} caracteres · {dictating ? "Encerre o ditado para enviar" : "Enter para enviar · Shift + Enter para nova linha"}</p>
      <div id="anexar-referencia" className="mt-3 flex scroll-mt-24 flex-wrap items-center justify-between gap-3"><label className="ct-chat-attachment inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ct-line px-3 py-2 text-xs text-ct-dim hover:text-ct-blue focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ct-action" title="Anexar ZIP ou HTML"><Paperclip size={15} aria-hidden="true"/><span className="ct-chat-attachment-label">{reading?'Lendo…':'Anexar ZIP ou HTML'}</span><input ref={attachmentInput} type="file" accept=".zip,.html,.htm,application/zip,text/html" className="sr-only" disabled={reading||busy} onChange={async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;setReading(true);setError(null);try{const project=await readProjectAttachment(file);setAttachment(project);setSelectedPage(preferredPage(project));if(!prompt.trim())setPrompt('Analise esta página e identifique o que é necessário para recriá-la no CTFunil.');}catch(error){setError({ message: error instanceof Error?error.message:'Não foi possível ler o arquivo.' });}finally{setReading(false);}}}/></label>
      {!authRequired && status?.modelValid && <div className="ct-chat-model">
        {canChooseModel ? <WorkspaceSelect searchable className="ct-chat-model-select"
          label="Modelo do chat" value={status.model} disabled={attachmentLocked} onChange={setChatModel}
          options={modelChoices.map(value => ({ value, label: value }))} /> : <p className="truncate text-xs text-ct-dim" title={status.model}>
          <span className="sr-only">Modelo do assistente </span><code>{status.model}</code>
        </p>}
      </div>}
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{!authRequired && <VoicePrompt key={conversationId} disabled={busy || reading} onListeningChange={setDictating} onTranscript={text => setPrompt(current => [current.trim(), text].filter(Boolean).join(" ").slice(0, attachment ? 1800 : MESSAGE_LIMIT))} />}<Button type="button" variant="ghost" size="icon" ripple title="Limpar conversa" aria-label="Limpar conversa" aria-haspopup="dialog" disabled={busy || reading || !(messages.length || prompt.trim() || attachment)} onClick={event => requestConversationRemoval(event.currentTarget)} className="ct-icon-button rounded-lg border border-ct-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ct-action"><RefreshCw size={16} aria-hidden="true"/></Button><StatefulButton type="button" onClick={submit}
        disabled={dictating || reading || busy || !prompt.trim() || authRequired || !status?.configured || messages.length >= 18}
        state={sending ? "loading" : error?.send ? "error" : "idle"}
        aria-label={sending ? "Enviando…" : error?.send ? "Tentar enviar novamente" : "Enviar"}
        aria-describedby={error?.send ? "assistant-error" : undefined}
        loadingText="Enviando…" errorText="Tentar enviar novamente" icon={<Send size={15} aria-hidden="true" />}
        className="rounded-lg bg-ct-action px-4 text-sm font-semibold text-white disabled:opacity-50">
        Enviar
      </StatefulButton>{sending && <button type="button" onClick={() => { activeRequest.current?.abort(); setSendCanceled(true); }} className="rounded-lg border border-ct-line px-3 py-2 text-xs">Cancelar envio</button>}</div></div>
      {messages.length>=18&&<p className="mt-2 text-xs text-ct-dim">Abra Conversas para começar outra ou limpe esta conversa.</p>}
    </div>
  </section></div>;
}

export default function ProjectsWorkspace({ snapshot, avatarUrl, accountEmail, accountId }: { snapshot?: Project[]; avatarUrl?: string; accountEmail?: string; accountId?: string }) {
  const projects = snapshot ?? exampleProjects;
  const demo = !snapshot;
  const filters = demo ? productFilters : [...new Set(projects.map(project => project.product))]
    .sort((left, right) => left.localeCompare(right, "pt-BR"));
  const [activeTab, setActiveTab] = useState<ProjectType>("all");
  const [activeFilter, setActiveFilter] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [openProject, setOpenProject] = useState<string | null>(null);
  const projectSearch = useRef<HTMLInputElement>(null);
  const normalizedQuery = normalizeSearchText(query);
  const visibleProjects = useMemo(() => projects.filter((p) =>
    (activeTab === "all" || p.type === activeTab) &&
    (!activeFilter.length || activeFilter.some(filter => p.product === filter || p.kind.includes(filter))) &&
    normalizeSearchText(`${p.name} ${p.id}`).includes(normalizedQuery)
  ), [projects, activeTab, activeFilter, normalizedQuery]);
  const stats = [
    { label: "Projetos", count: projects.length, icon: FolderKanban },
    { label: "Quizzes", count: projects.filter(p => p.type === "quiz").length, icon: GitBranch },
    { label: "Páginas", count: projects.filter(p => p.type === "pages").length, icon: PanelsTopLeft },
    { label: demo ? "Outros módulos" : "Demais funis", count: projects.filter(p => p.type === "plus").length, icon: Layers },
  ];
  return <WorkspaceFrame title="Projetos" demo={demo} accountEmail={accountEmail}>
    <header className="ct-page-heading"><div><h1>Projetos</h1><p>{demo ? "Quizzes, páginas e referências da CT4 Educação." : "Funis da CT4 Educação em modo de consulta."}</p></div>
      <Link className="ct-action-link" href="/dashboard">Abrir meus funis</Link></header>
    <div className="ct-metrics">{stats.map(({ label, count, icon: Icon }) => <div className="ct-metric" key={label}>
      <div><span>{label}</span><Icon size={17} /></div><strong>{count}</strong>
    </div>)}</div>
    <section id="biblioteca" className="ct-panel">
      <header className="ct-section-heading"><div><h2>Biblioteca de projetos</h2><p role="status">{visibleProjects.length} de {projects.length} projetos</p></div>
        <label className="ct-search"><Search size={15}/><input ref={projectSearch} value={query} onChange={e => setQuery(e.target.value)} aria-label="Buscar projeto" placeholder="Buscar projeto" /></label></header>
      <div className="ct-filters"><div className="ct-segments">{projectTabs.map(t =>
        <button key={t.id} aria-pressed={activeTab === t.id} onClick={() => { setActiveTab(t.id); setActiveFilter([]); }}>{activeTab === t.id && <ActiveTab group="projects-tabs" />}<span>{t.id === "plus" ? (demo ? "Outros" : "Demais funis") : t.label}</span></button>
      )}</div><WorkspaceMultiSelect label={demo ? "Produtos" : "Nichos"} emptyLabel="Todos" values={activeFilter} onChange={setActiveFilter}
        options={filters.map(value => ({ value, label: value }))} /></div>
      <div className="ct-projects" data-editor-actions={visibleProjects.some(project => Boolean(project.editorHref)) || undefined}>
        <div className="ct-project-row ct-project-head" aria-hidden="true"><span>Projeto</span><span>{demo ? "Produto" : "Nicho"}</span><span>Status</span><span>Atualização</span><span/></div>
        {visibleProjects.map(p => <div key={p.id}><div className="ct-project-entry"><button type="button" className="ct-project-row" aria-expanded={openProject === p.id} aria-controls={`project-detail-${p.id}`} onClick={() => setOpenProject(openProject === p.id ? null : p.id)}>
          <span className="ct-project-name"><span className="ct-project-icon">{p.type === "quiz" ? <GitBranch size={17}/> : p.type === "pages" ? <PanelsTopLeft size={17}/> : <Layers size={17}/>}</span>
            <span><strong>{p.name}</strong><small>{p.kind}</small></span></span>
          <span className="ct-project-product">{p.product}</span><span><WorkspaceStatus status={p.status} /></span><span className="ct-project-date">{p.updated}</span><ChevronDown size={15}/></button>
          {p.editorHref && <Link href={p.editorHref} className="ct-project-editor" aria-label={`Abrir editor de ${p.name}`}>Editar</Link>}
          </div>
          <div id={`project-detail-${p.id}`} className="ct-project-disclosure" data-expanded={openProject === p.id} inert={openProject !== p.id}><div><p className="ct-project-detail">{p.preview} · {p.metric} · {p.updated}{p.reportHref && <> · <Link href={p.reportHref} className="text-ct-blue underline">Ver relatório</Link></>}</p></div></div></div>)}
        {!visibleProjects.length && <div className="ct-empty">
          <p>Nenhum projeto corresponde aos filtros.</p>
          {(normalizedQuery || activeFilter.length > 0) && <button type="button"
            className="mt-2 min-h-11 text-ct-blue underline" onClick={() => {
              setQuery("");
              setActiveFilter([]);
              projectSearch.current?.focus();
            }}>Limpar filtros</button>}
        </div>}
      </div>
    </section>
    <HeroPrompt key={accountId} accountId={accountId} avatarUrl={avatarUrl} />
  </WorkspaceFrame>;
}
