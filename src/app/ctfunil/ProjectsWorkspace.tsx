"use client";

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
import { ChevronDown, FolderKanban, Layers, PanelsTopLeft, GitBranch, History, Plus, Paperclip, RefreshCw, Search, Send, Settings2, X } from "lucide-react";
import { ActivityPill, WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";
import { buildAssistantRequest, MESSAGE_LIMIT, type AssistantMessage } from "@/lib/assistant/messages";
import { ASSISTANT_SETTINGS_PATH, geminiKeyPattern, geminiModelPattern, readWorkspaceSettings, type ImportMode } from "@/lib/assistant/workspace-settings";
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

type ConversationMessage = AssistantMessage & { streamed?: boolean };

type AssistantConversation = {
  id: number;
  prompt: string;
  messages: ConversationMessage[];
  apiMessages: AssistantMessage[];
  attachment: ProjectAttachment | null;
  selectedPage: string;
};

function conversationTitle(conversation: AssistantConversation) {
  const title = conversation.messages[0]?.text || conversation.prompt || conversation.attachment?.name;
  return title?.trim().split('\n')[0].slice(0, 80) || 'Nova conversa';
}

function HeroPrompt({ avatarUrl }: { avatarUrl?: string }) {
  const [prompt,setPrompt]=useState('');
  const [pendingMessage, setPendingMessage] = useState("");
  const [sendCanceled, setSendCanceled] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [configAttempt, setConfigAttempt] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);
  const conversationsDialog = useRef<HTMLDialogElement>(null);
  const nextConversationId = useRef(1);
  const [conversationId, setConversationId] = useState(0);
  const [otherConversations, setOtherConversations] = useState<AssistantConversation[]>([]);
  const clearDialog = useRef<HTMLDialogElement>(null);
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
  useEffect(() => { setImportMode(readWorkspaceSettings().importMode); }, []);
  const [status,setStatus]=useState<{configured:boolean;model:string;modelValid:boolean}|null>(null);
  const [partialReply, setPartialReply] = useState('');
  const [settings,setSettings]=useState(false),[busy,setBusy]=useState(false);
  const [error, setError] = useState<{ message: string; send?: true } | null>(null);
  const importing = busy && !pendingMessage;
  const sending = busy && Boolean(pendingMessage);
  const attachmentLocked = busy || reading;
  const activityLabel = busy ? (partialReply ? "Recebendo resposta" : pendingMessage ? "Preparando resposta" : "Preparando importação") : "";
  const currentConversation = { id: conversationId, prompt, messages, apiMessages, attachment, selectedPage };
  const hasCurrentConversation = !!(messages.length || prompt.trim() || attachment);
  const conversations = [currentConversation, ...otherConversations];
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
    setError(null);
    setCheckingConfig(true);
    setConfigAttempt(attempt => attempt + 1);
  }

  const requireAssistantSession = useCallback(() => {
    activeRequest.current?.abort();
    setAuthRequired(true);
    setStatus(null);
    setOtherConversations([]);
    setMessages([]);
    setApiMessages([]);
    setCopyState(null);
    setSendCanceled(false);
    setShowLatest(false);
    followThread.current = true;
  }, []);

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
        if (!controller.signal.aborted) {
          setAuthRequired(false);
          const saved = readWorkspaceSettings();
          const customModel = geminiModelPattern.test(saved.model);
          const customKey = geminiKeyPattern.test(saved.key);
          const modelValid = customModel || configuration.modelValid;
          setStatus({
            model: customModel ? saved.model : configuration.model,
            modelValid,
            configured: modelValid && (customKey || configuration.hasKey || configuration.configured),
          });
        }
      } catch {
        if (!controller.signal.aborted) { setStatus(null); setError({ message: 'Não foi possível verificar a configuração.' }); }
      } finally {
        if (!controller.signal.aborted) setCheckingConfig(false);
      }
    }
    void check();
    return () => controller.abort();
  }, [configAttempt, requireAssistantSession]);

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

  function loadConversation(conversation?: AssistantConversation) {
    followThread.current = true;
    setShowLatest(false);
    setMessages(conversation?.messages ?? []);
    setApiMessages(conversation?.apiMessages ?? []);
    setCopyState(null);
    setSendCanceled(false);
    setPrompt(conversation?.prompt ?? '');
    setAttachment(conversation?.attachment ?? null);
    setSelectedPage(conversation?.selectedPage ?? '');
    setError(null);
  }

  function clearConversation() {
    loadConversation();
    clearDialog.current?.close();
    composer.current?.focus();
  }

  function switchConversation(target?: AssistantConversation) {
    if (busy || reading || target?.id === conversationId) return;
    const remaining = otherConversations.filter(item => item.id !== target?.id);
    if (hasCurrentConversation) remaining.unshift(currentConversation);
    setOtherConversations(remaining);
    setConversationId(target?.id ?? nextConversationId.current++);
    loadConversation(target);
    conversationsDialog.current?.close();
    composer.current?.focus();
  }

  const submit = async () => {
    const text = prompt.trim();
    if (!text || attachmentLocked || activeRequest.current || authRequired || !status?.configured || messages.length >= 18) return;
    const selected = attachment?.pages.find(page => page.path === selectedPage)
      || (selectedPage === ALL_PAGES ? attachment?.pages.find(page => /\.html?$/i.test(page.path)) : undefined);
    const sentText = selected && attachment ? `${text.slice(0, 1800)}\n\n${attachmentContext(attachment, selected)}` : text;
    const userMessage = { role: 'user' as const, text: selected ? `${text}\nArquivo: ${selected.path}` : text };
    const next = buildAssistantRequest(apiMessages, sentText);
    const controller = new AbortController();
    activeRequest.current = controller;
    setPendingMessage(userMessage.text);
    setSendCanceled(false);
    setBusy(true);
    setError(null);
    try {
      const saved = readWorkspaceSettings();
      const response = await fetch('/api/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: ASSISTANT_STREAM_TYPE },
        body: JSON.stringify({ messages: next, model: geminiModelPattern.test(saved.model) ? saved.model : undefined, key: geminiKeyPattern.test(saved.key) ? saved.key : undefined }), signal: controller.signal,
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
      setMessages(previous => [...previous, userMessage, { ...reply, streamed }]);
      setPrompt('');
    } catch (error) {
      if (!controller.signal.aborted) setError({ message: error instanceof Error ? error.message : 'Não foi possível enviar.', send: true });
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setPendingMessage('');
        setPartialReply('');
        setBusy(false);
        if (controller.signal.aborted) requestAnimationFrame(() => composer.current?.focus());
      }
    }
  };
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
      window.location.assign(`/importar/${id}`);
    } catch (error) {
      setError({ message: error instanceof Error ? error.message : "Não foi possível preparar a importação." });
      setBusy(false);
    }
  };
  return <div className="ct-assistant-shell">
    <aside className="ct-assistant-rail" aria-label="Conversas do Assistente">
      <button className="ct-action-link" type="button" disabled={attachmentLocked || !hasCurrentConversation || conversations.length >= 20} onClick={() => switchConversation()}><Plus size={16} aria-hidden="true" /> Nova conversa</button>
      <h3>Conversas</h3>
      <ul className="ct-chat-conversation-list">
        {conversations.map(conversation => <li key={conversation.id}>
          <button type="button" className="ct-chat-conversation" aria-current={conversation.id === conversationId ? "true" : undefined}
            disabled={attachmentLocked} onClick={() => switchConversation(conversation)}>{conversationTitle(conversation)}</button>
        </li>)}
      </ul>
    </aside>
    <section id="assistente" className="ct-panel ct-composer scroll-mt-16" aria-labelledby="ctfunil-builder-title">
    <dialog ref={clearDialog} className="ct-confirm ct-delete-modal-confirmation" aria-labelledby="assistant-clear-title" aria-describedby="assistant-clear-summary">
      <div className="flex items-center gap-2">
        <DeleteConfirmationIcon />
        <h2 id="assistant-clear-title" className="font-semibold">Limpar conversa?</h2>
      </div>
      <p id="assistant-clear-summary" className="mt-2 text-sm text-ct-dim">As mensagens, o texto em edição e o anexo atual serão removidos.</p>
      <div className="mt-5 flex justify-end gap-3">
        <Button type="button" variant="secondary" size="sm" className="ct-confirm-cancel" autoFocus onClick={() => clearDialog.current?.close()}>Cancelar</Button>
        <button type="button" className="ct-confirm-delete" onClick={clearConversation}>Limpar conversa</button>
      </div>
    </dialog>
    <dialog ref={conversationsDialog} className="ct-confirm" aria-labelledby="assistant-conversations-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="assistant-conversations-title" className="font-semibold">Conversas desta sessão</h2>
        <button type="button" className="ct-icon-button" aria-label="Fechar conversas" autoFocus onClick={() => conversationsDialog.current?.close()}><X size={16} /></button>
      </div>
      <ul className="ct-chat-conversation-list">
        {conversations.map(conversation => <li key={conversation.id}>
          <button type="button" className="ct-chat-conversation" aria-current={conversation.id === conversationId ? "true" : undefined}
            onClick={() => conversation.id === conversationId ? conversationsDialog.current?.close() : switchConversation(conversation)}>
            <span>{conversationTitle(conversation)}</span>
            {conversation.id === conversationId && <small>Atual</small>}
          </button>
        </li>)}
      </ul>
      <button type="button" className="ct-confirm-cancel mt-3 inline-flex items-center gap-2"
        disabled={!hasCurrentConversation || conversations.length >= 20} onClick={() => switchConversation()}><Plus size={16} aria-hidden="true" />Nova conversa</button>
      {conversations.length >= 20 && <p className="mt-2 text-xs text-ct-dim">Limite de 20 conversas nesta sessão.</p>}
    </dialog>
    <header className="ct-section-heading">
      <div><h2 id="ctfunil-builder-title">Assistente de criação</h2><p>Planeje etapas, textos e fluxos com Gemini.</p></div>
      <div className="ct-chat-top-actions">
        <ChatParticipants avatarUrl={avatarUrl} model={status?.model} providerStatus={configLabel} signedOut={authRequired} />
        {status && !authRequired && <button type="button" className="ct-icon-button" aria-label="Conversas" aria-haspopup="dialog"
          disabled={busy || reading} onClick={() => conversationsDialog.current?.showModal()}><History size={17} aria-hidden="true" /></button>}
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
    <div className="px-4 pt-4"><p className="text-xs text-ct-dim">Converse e analise arquivos de páginas e funis.</p>
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
          {message.role === 'model' && <button type="button" onClick={async () => {
            try {
              await navigator.clipboard.writeText(message.text);
              setCopyState(index);
            } catch {
              setError({ message: 'Não foi possível copiar a resposta.' });
            }
          }}>{copyState === index ? 'Copiado' : 'Copiar resposta'}</button>}
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
        <p role="status">{checkingConfig ? "Verificando sessão…" : "Entre na sua conta para conversar."}</p>
        <p>Após entrar, volte a esta aba para continuar.</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <a className="text-ct-blue underline" href="/admin/login?next=%2Fctfunil%23assistente" target="_blank" rel="noopener noreferrer">Entrar no CTFunil em nova aba</a>
          <button type="button" disabled={checkingConfig} className="text-ct-blue underline disabled:opacity-50" onClick={retryConfig}>Verificar sessão</button>
        </div>
      </div>}
      {!authRequired && !checkingConfig && !status && <button type="button" className="mt-3 text-xs text-ct-blue underline" onClick={retryConfig}>Verificar configuração novamente</button>}
      {!authRequired && !status?.configured&&status&&<p className="mt-3 text-xs text-ct-dim">Configure a API para começar. <Link className="text-ct-blue underline" href={ASSISTANT_SETTINGS_PATH}>Abrir configuração</Link></p>}
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
      <label className="sr-only" htmlFor="assistant-prompt">Mensagem para o assistente</label><textarea ref={composer} id="assistant-prompt" value={prompt} readOnly={!!pendingMessage} aria-describedby="assistant-prompt-help"
        onKeyDown={event => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (messages.length < 18) void submit();
          }
        }} onChange={event=>setPrompt(event.target.value)} maxLength={limit} className="mt-3 min-h-24 w-full resize-none rounded-xl border border-ct-line bg-ct-surface p-3 text-sm text-ct-ink outline-none focus-visible:ring-2 focus-visible:ring-ct-blue" placeholder="Descreva o que você quer criar…"/>
      <p id="assistant-prompt-help" className="mt-1 text-xs text-ct-dim">{prompt.length.toLocaleString("pt-BR")} de {limit.toLocaleString("pt-BR")} caracteres · Ctrl ou ⌘ + Enter para enviar</p>
      <div id="anexar-referencia" className="mt-3 flex scroll-mt-24 flex-wrap items-center justify-between gap-3"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ct-line px-3 py-2 text-xs text-ct-dim hover:text-ct-blue focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ct-action"><Paperclip size={15} aria-hidden="true"/>{reading?'Lendo…':'Anexar ZIP ou HTML'}<input ref={attachmentInput} type="file" accept=".zip,.html,.htm,application/zip,text/html" className="sr-only" disabled={reading||busy} onChange={async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;setReading(true);setError(null);try{const project=await readProjectAttachment(file);setAttachment(project);setSelectedPage(preferredPage(project));if(!prompt.trim())setPrompt('Analise esta página e identifique o que é necessário para recriá-la no CTFunil.');}catch(error){setError({ message: error instanceof Error?error.message:'Não foi possível ler o arquivo.' });}finally{setReading(false);}}}/></label><div className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><VoicePrompt disabled={busy || reading} onTranscript={text => setPrompt(current => [current.trim(), text].filter(Boolean).join(" ").slice(0, attachment ? 1800 : MESSAGE_LIMIT))} /><Button type="button" variant="ghost" size="icon" ripple title="Limpar conversa" aria-label="Limpar conversa" aria-haspopup="dialog" disabled={busy || reading || !(messages.length || prompt.trim() || attachment)} onClick={() => clearDialog.current?.showModal()} className="ct-icon-button rounded-lg border border-ct-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ct-action"><RefreshCw size={16} aria-hidden="true"/></Button><StatefulButton type="button" onClick={submit}
        disabled={reading || importing || !prompt.trim() || authRequired || !status?.configured || messages.length >= 18}
        state={sending ? "loading" : error?.send ? "error" : "idle"}
        aria-label={sending ? "Enviando…" : error?.send ? "Tentar enviar novamente" : "Enviar"}
        aria-describedby={error?.send ? "assistant-error" : undefined}
        loadingText="Enviando…" errorText="Tentar enviar novamente" icon={<Send size={15} aria-hidden="true" />}
        className="rounded-lg bg-ct-action px-4 text-sm font-semibold text-white disabled:opacity-50">
        Enviar
      </StatefulButton>{pendingMessage && <button type="button" onClick={() => { activeRequest.current?.abort(); setSendCanceled(true); }} className="rounded-lg border border-ct-line px-3 py-2 text-xs">Cancelar envio</button>}</div></div>
      {messages.length>=18&&<p className="mt-2 text-xs text-ct-dim">Abra Conversas para começar outra ou limpe esta conversa.</p>}
    </div><div className="flex flex-wrap gap-2 p-4">{quickPrompts.map(item=><button key={item} type="button" disabled={busy} onClick={()=>{setPrompt(item);composer.current?.focus();}} className="rounded-full border border-ct-line bg-ct-surface px-3 py-1.5 text-xs text-ct-dim hover:border-ct-blue hover:text-ct-blue">{item}</button>)}</div>
  </section></div>;
}

export default function ProjectsWorkspace({ snapshot, avatarUrl }: { snapshot?: Project[]; avatarUrl?: string }) {
  const projects = snapshot ?? exampleProjects;
  const demo = !snapshot;
  const filters = demo ? productFilters : [...new Set(projects.map(project => project.product))]
    .sort((left, right) => left.localeCompare(right, "pt-BR"));
  const [activeTab, setActiveTab] = useState<ProjectType>("all");
  const [activeFilter, setActiveFilter] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [openProject, setOpenProject] = useState<string | null>(null);
  const visibleProjects = useMemo(() => projects.filter((p) =>
    (activeTab === "all" || p.type === activeTab) &&
    (!activeFilter.length || activeFilter.some(filter => p.product === filter || p.kind.includes(filter))) &&
    `${p.name} ${p.id}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))
  ), [projects, activeTab, activeFilter, query]);
  const stats = [
    { label: "Projetos", count: projects.length, icon: FolderKanban },
    { label: "Quizzes", count: projects.filter(p => p.type === "quiz").length, icon: GitBranch },
    { label: "Páginas", count: projects.filter(p => p.type === "pages").length, icon: PanelsTopLeft },
    { label: demo ? "Outros módulos" : "Demais funis", count: projects.filter(p => p.type === "plus").length, icon: Layers },
  ];
  return <WorkspaceFrame title="Projetos" demo={demo}>
    <header className="ct-page-heading"><div><h1>Projetos</h1><p>{demo ? "Quizzes, páginas e referências da CT4 Educação." : "Funis da CT4 Educação em modo de consulta."}</p></div>
      <Link className="ct-action-link" href="/dashboard">Abrir meus funis</Link></header>
    <div className="ct-metrics">{stats.map(({ label, count, icon: Icon }) => <div className="ct-metric" key={label}>
      <div><span>{label}</span><Icon size={17} /></div><strong>{count}</strong>
    </div>)}</div>
    <section id="biblioteca" className="ct-panel">
      <header className="ct-section-heading"><div><h2>Biblioteca de projetos</h2><p>{visibleProjects.length} de {projects.length} projetos</p></div>
        <label className="ct-search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} aria-label="Buscar projeto" placeholder="Buscar projeto" /></label></header>
      <div className="ct-filters"><div className="ct-segments">{projectTabs.map(t =>
        <button key={t.id} aria-pressed={activeTab === t.id} onClick={() => { setActiveTab(t.id); setActiveFilter([]); }}>{activeTab === t.id && <ActiveTab group="projects-tabs" />}<span>{t.id === "plus" ? (demo ? "Outros" : "Demais funis") : t.label}</span></button>
      )}</div><WorkspaceMultiSelect label={demo ? "Produtos" : "Nichos"} emptyLabel="Todos" values={activeFilter} onChange={setActiveFilter}
        options={filters.map(value => ({ value, label: value }))} /></div>
      <div className="ct-projects">
        <div className="ct-project-row ct-project-head" aria-hidden="true"><span>Projeto</span><span>{demo ? "Produto" : "Nicho"}</span><span>Status</span><span>Atualização</span><span/></div>
        {visibleProjects.map(p => <div key={p.id}><button type="button" className="ct-project-row" aria-expanded={openProject === p.id} aria-controls={`project-detail-${p.id}`} onClick={() => setOpenProject(openProject === p.id ? null : p.id)}>
          <span className="ct-project-name"><span className="ct-project-icon">{p.type === "quiz" ? <GitBranch size={17}/> : p.type === "pages" ? <PanelsTopLeft size={17}/> : <Layers size={17}/>}</span>
            <span><strong>{p.name}</strong><small>{p.kind}</small></span></span>
          <span className="ct-project-product">{p.product}</span><span><WorkspaceStatus status={p.status} /></span><span className="ct-project-date">{p.updated}</span><ChevronDown size={15}/></button>
          <div id={`project-detail-${p.id}`} className="ct-project-disclosure" data-expanded={openProject === p.id} inert={openProject !== p.id}><div><p className="ct-project-detail">{p.preview} · {p.metric} · {p.updated}{p.editorHref && <> · <Link href={p.editorHref} className="font-semibold text-ct-blue underline">Abrir editor</Link></>}{p.reportHref && <> · <Link href={p.reportHref} className="text-ct-blue underline">Ver relatório</Link></>}</p></div></div></div>)}
        {!visibleProjects.length && <p className="ct-empty">Nenhum projeto corresponde aos filtros.</p>}
      </div>
    </section>
    <HeroPrompt avatarUrl={avatarUrl} />
  </WorkspaceFrame>;
}
