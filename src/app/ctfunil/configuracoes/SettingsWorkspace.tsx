"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ChevronRight, Eye, EyeOff, FileArchive, Sparkles, Zap } from "lucide-react";
import WorkspaceMultiSelect from "@/components/ui/WorkspaceMultiSelect";
import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";
import { recordWorkspaceNotice } from "@/components/workspace/WorkspaceNoticeHistory";
import { settingsSection } from "@/components/workspace/section-links";
import { ThemeButton, WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import Upbf1RouletteCard, { type Upbf1RouletteCardProps } from "./Upbf1RouletteCard";
import { ASSISTANT_SETTINGS_PATH, geminiKeyPattern, geminiModelPattern, readWorkspaceSettings, saveAssistantSettings, saveImportMode, type ImportMode } from "@/lib/assistant/workspace-settings";

const tabs = settingsSection.tabs;
const configurationLinks = [
  { href: ASSISTANT_SETTINGS_PATH, icon: Sparkles, title: "Configuração de API (IA)", description: "Chave, modelos e teste de conexão do Gemini." },
  { href: "/ctfunil/configuracoes?tab=importacao", icon: FileArchive, title: "Importação de ZIP e HTML", description: "Modo padrão de importação para o construtor." },
];
type Section = typeof tabs[number][0];
type AssistantServerStatus = { model: string; modelValid: boolean; hasKey: boolean };

function describeServerStatus(status: AssistantServerStatus | undefined) {
  if (!status) return "Consultando servidor…";
  const keyStatus = status.hasKey ? "Chave do servidor disponível." : "Chave do servidor ausente.";
  return status.modelValid ? keyStatus : `O modelo do servidor é inválido. ${keyStatus}`;
}

function SettingsContent({ section, upbf1 }: { section: Section; upbf1?: Upbf1RouletteCardProps }) {
  const [model, setModel] = useState("");
  const [chatModels, setChatModels] = useState<string[]>([]);
  const [savedChatModels, setSavedChatModels] = useState<string[]>([]);
  const chatModelsChanged = chatModels.length !== savedChatModels.length ||
    chatModels.some((value, index) => value !== savedChatModels[index]);
  const [key, setKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [mode, setMode] = useState<ImportMode>("design");
  const [status, setStatus] = useState<AssistantServerStatus>();
  const [loadError, setLoadError] = useState(false);
  const [statusAttempt, setStatusAttempt] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [listing, setListing] = useState(false);
  const [models, setModels] = useState<{ value: string; label: string }[]>([]);
  const connecting = testing || listing;
  const [sessionExpired, setSessionExpired] = useState(false);
  const connectionRequest = useRef<AbortController>(null);
  const editKeyButton = useRef<HTMLButtonElement>(null);
  const keyInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = readWorkspaceSettings();
    setModel(saved.model);
    setChatModels(saved.models);
    setSavedChatModels(saved.models);
    setKey(saved.key);
    setMode(saved.importMode);
    return () => connectionRequest.current?.abort();
  }, []);

  useEffect(() => {
    if (section !== "assistente") return;
    setLoadError(false);
    const controller = new AbortController();
    fetch("/api/assistant", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (controller.signal.aborted) return;
        setSessionExpired(response.status === 401);
        if (!response.ok) throw Error();
        const data = await response.json();
        if (typeof data?.model !== "string" || typeof data.modelValid !== "boolean" || typeof data.hasKey !== "boolean") {
          throw Error();
        }
        if (!controller.signal.aborted) setStatus(data);
      })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, [section, statusAttempt]);

  function clearFeedback() {
    setNotice("");
    setError("");
  }

  function changeModel(value: string) {
    setModel(value);
    clearFeedback();
  }

  function validatedSettings() {
    const chosen = model.trim();
    const secret = key.trim();
    if (chosen && !geminiModelPattern.test(chosen)) {
      setError("Informe um identificador de modelo Gemini válido.");
      return null;
    }
    if (secret && !geminiKeyPattern.test(secret)) {
      setError("Confira o formato da chave do Gemini.");
      return null;
    }
    return { chosen, secret };
  }

  async function requestProvider(action: "testConnection" | "listModels") {
    if (connectionRequest.current || sessionExpired) return;
    setNotice("");
    setError("");
    const values = action === "testConnection" ? validatedSettings() : { chosen: "", secret: key.trim() };
    if (!values) return;
    if (values.secret && !geminiKeyPattern.test(values.secret)) {
      setError("Confira o formato da chave do Gemini.");
      return;
    }
    const setPending = action === "testConnection" ? setTesting : setListing;
    const controller = new AbortController();
    connectionRequest.current = controller;
    setPending(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [action]: true, model: values.chosen || undefined, key: values.secret || undefined }),
      });
      setSessionExpired(response.status === 401);
      if (response.status === 401) {
        return;
      }
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Não foi possível testar a conexão.");
        return;
      }
      if (action === "listModels") {
        if (!Array.isArray(result?.models)) throw Error();
        setModels(result.models);
        setNotice(result.models.length ? "Escolha um modelo na lista ou informe o identificador no campo." : "A chave não retornou modelos para o chat.");
      } else {
        setNotice(`Conexão verificada. Modelo disponível para o chat: ${result.model}.`);
      }
    } catch {
      if (!controller.signal.aborted) setError("Não foi possível consultar o Gemini. Confira a rede e tente novamente.");
    } finally {
      connectionRequest.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (connecting) return;
    setNotice("");
    setError("");
    try {
      if (section === "assistente") {
        const values = validatedSettings();
        if (!values) return;
        const { chosen, secret } = values;
        saveAssistantSettings(chosen, secret, chatModels);
        setSavedChatModels(chatModels);
        setKeyVisible(false);
        setEditingKey(false);
        setKey(secret);
        setModel(chosen);
      }
      if (section === "importacao") saveImportMode(mode);
      const message = "Configurações salvas neste navegador.";
      setNotice(message);
      recordWorkspaceNotice("Configurações", message);
    } catch {
      const message = "O navegador não permitiu salvar as configurações.";
      setError(message);
      recordWorkspaceNotice("Configurações", message, true);
    }
  }

  return <>
    {section === "geral" ? <div className="grid max-w-[1100px] gap-3">
      <section className="ct-panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div><h2 className="text-lg font-semibold">Aparência</h2><p className="text-sm text-ct-dim">Escolha o tema do workspace neste navegador.</p></div>
        <ThemeButton />
      </section>
      {configurationLinks.map(({ href, icon: Icon, title, description }) => (
        <Link key={href} href={href} className="ct-panel flex items-center gap-3 p-4 hover:border-ct-action/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ct-action motion-safe:transition motion-safe:duration-200 motion-safe:hover:-translate-y-0.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-ct-line bg-ct-raised text-ct-blue">
            <Icon size={17} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-sm font-semibold">{title}</strong>
            <span className="block text-xs text-ct-dim">{description}</span>
          </span>
          <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-ct-dim" />
        </Link>
      ))}
      {upbf1 && <Upbf1RouletteCard {...upbf1} />}
    </div> : <form key={section} onSubmit={submit} className="ct-panel max-w-[1100px] space-y-5 p-5 sm:p-6">
      {section === "assistente" ? <>
        <div><h2 className="text-lg font-semibold">API (IA)</h2>
          <p className="mt-1 text-sm text-ct-dim">Provedor Google Gemini.</p>
          {sessionExpired ? <div className="mt-2 flex flex-wrap items-center gap-2">
            <p role="alert" className="w-full text-sm text-ct-dim">Sua sessão expirou. Entre novamente para consultar o Gemini.</p>
            <Link className="ct-action-link" href={`/admin/login?next=${encodeURIComponent(ASSISTANT_SETTINGS_PATH)}`}
              target="_blank" rel="noopener noreferrer">Entrar novamente (nova aba)</Link>
            <button type="button" className="ct-confirm-cancel min-h-11 rounded-lg px-3 text-sm"
              onClick={() => setStatusAttempt(value => value + 1)}>Verificar sessão</button>
          </div> : loadError ? <div className="mt-2 flex flex-wrap items-center gap-2">
            <p role="alert" className="text-sm text-ct-dim">Não foi possível consultar o servidor.</p>
            <button type="button" className="ct-confirm-cancel min-h-11 rounded-lg px-3 text-sm"
              onClick={() => setStatusAttempt(value => value + 1)}>Consultar novamente</button>
          </div> : <p role="status" className="mt-1 text-sm text-ct-dim">
            {describeServerStatus(status)}
          </p>}
        </div>
        {status?.hasKey && !key && !editingKey ? <div className="space-y-2">
          <h3 className="text-sm font-semibold">Chave Gemini</h3>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ct-line bg-ct-raised p-3">
            <p className="min-w-0 flex-1 text-sm">Usando a chave do servidor</p>
            <button type="button" className="ct-confirm-cancel min-h-11 rounded-lg px-3 text-sm"
              ref={editKeyButton}
              onClick={() => setEditingKey(true)} disabled={connecting}>Usar chave nesta aba</button>
          </div>
        </div> : <>
        <div onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setKeyVisible(false);
        }}>
          <label htmlFor="ct-gemini-key" className="block text-sm font-semibold">Chave Gemini da sessão</label>
          <div className="mt-2 flex items-center gap-2">
            <input ref={keyInput} id="ct-gemini-key" type={keyVisible ? "text" : "password"} autoFocus={editingKey} autoComplete="off" spellCheck={false}
              className="min-w-0 flex-1 rounded-lg border border-ct-line bg-ct-raised p-3"
              value={key} disabled={connecting} onChange={event => { setEditingKey(true); setKey(event.target.value); setModels([]); clearFeedback(); }} maxLength={200} aria-describedby="ct-gemini-key-help" />
            <button type="button" className="ct-icon-button shrink-0 rounded-lg border border-ct-line p-3"
              aria-label={keyVisible ? "Ocultar chave Gemini" : "Mostrar chave Gemini"} aria-pressed={keyVisible}
              onClick={() => setKeyVisible(visible => !visible)}>
              {keyVisible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>
        <p id="ct-gemini-key-help" className="text-sm text-ct-dim">A chave vale para esta aba. Deixe em branco para usar a chave do servidor e limpe o campo e salve para esquecer a chave da sessão.</p>
        {status?.hasKey && editingKey && <button type="button"
          className="ct-confirm-cancel min-h-11 rounded-lg px-3 text-sm" disabled={connecting}
          onClick={() => {
            const savedKey = readWorkspaceSettings().key;
            setKey(savedKey);
            setKeyVisible(false);
            setEditingKey(false);
            setModels([]);
            clearFeedback();
            requestAnimationFrame(() => (editKeyButton.current ?? keyInput.current)?.focus());
          }}>Cancelar troca de chave</button>}
        </>}
        <label className="block text-sm font-semibold">Modelo Gemini
          <input className="mt-2 block w-full rounded-lg border border-ct-line bg-ct-raised p-3" value={model} disabled={connecting} onChange={event => changeModel(event.target.value)} placeholder={status?.model || "Modelo do servidor"} maxLength={87} />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={connecting || sessionExpired} onClick={() => requestProvider("listModels")}
            className="ct-confirm-cancel min-h-11 rounded-lg px-3 text-sm disabled:opacity-50">
            {listing ? "Consultando modelos…" : "Consultar modelos"}
          </button>
          {models.length > 0 && <WorkspaceSelect searchable value={model} options={models} disabled={connecting}
            label="Modelos Gemini disponíveis" onChange={changeModel} />}
        </div>
        {(models.length > 0 || chatModels.length > 0) && <fieldset className="min-w-0 space-y-2 rounded-xl border border-ct-line p-3 sm:p-4">
          <legend className="px-1 text-sm font-semibold">Modelos ativados no Assistente</legend>
          <p className="text-xs leading-relaxed text-ct-dim">Os modelos selecionados aparecem no compositor junto com o modelo padrão.</p>
          <WorkspaceMultiSelect label="Modelos no chat"
            emptyLabel="Somente o modelo padrão" values={chatModels} onChange={values => { setChatModels(values); clearFeedback(); }}
            options={[...models.map(option => ({
              ...option,
              detail: option.label === option.value ? undefined : option.value,
            })), ...chatModels.filter(value => !models.some(option => option.value === value))
              .map(value => ({ value, label: value }))]} />
        </fieldset>}
        <Link href="/ctfunil/assistente" className="text-sm text-ct-blue underline">Abrir assistente</Link>
      </> : <>
        <fieldset className="space-y-3"><legend className="mb-2 text-lg font-semibold">Modo padrão para ZIP e HTML</legend>
          <label className="flex items-start gap-2 text-sm"><input type="radio" name="import-mode" checked={mode === "design"} onChange={() => { setMode("design"); clearFeedback(); }} /> <span><strong>Preservar design</strong><span className="block text-ct-dim">Mantém a composição HTML, estilos e imagens do arquivo em um bloco editável de HTML.</span></span></label>
          <label className="flex items-start gap-2 text-sm"><input type="radio" name="import-mode" checked={mode === "blocks"} onChange={() => { setMode("blocks"); clearFeedback(); }} /> <span><strong>Converter em blocos</strong><span className="block text-ct-dim">Separa textos, imagens, campos e botões em controles do editor.</span></span></label>
        </fieldset>
        <Link href="/ctfunil/assistente#anexar-referencia" className="text-sm text-ct-blue underline">Anexar arquivo</Link>
      </>}
      <div className="flex flex-wrap gap-2">
        <button className="ct-action-link" type="submit" disabled={connecting}>Salvar configurações</button>
        {section === "assistente" && <button type="button" className="ct-confirm-cancel inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm disabled:opacity-50"
          disabled={connecting || sessionExpired} onClick={() => requestProvider("testConnection")}><Zap size={16} aria-hidden="true" />{testing ? "Testando conexão…" : "Testar conexão"}</button>}
      </div>
      {section === "assistente" && chatModelsChanged && <p role="status" className="text-sm text-ct-ink">Salve as configurações para atualizar os modelos disponíveis no chat.</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {error && <p role="alert" className="text-sm text-ct-dim">{error}</p>}
    </form>}
  </>;
}

export default function SettingsWorkspace({ section, accountEmail, upbf1 }: { section: Section; accountEmail?: string; upbf1?: Upbf1RouletteCardProps }) {
  const reduceMotion = useReducedMotion();

  return <WorkspaceFrame title="Configurações" activeTab={section} accountEmail={accountEmail}>
    <header className="ct-page-heading"><div><h1>Configurações</h1><p>Preferências do workspace, do assistente e do editor.</p></div></header>
    <LayoutGroup>
      <nav className="ct-workspace-settings-nav mb-5 flex max-w-[1100px] flex-wrap gap-x-2 border-b border-ct-line" aria-label="Seções de configurações">
        {tabs.map(([id, label]) => <Link
          className={`relative inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ct-blue ${section === id ? "border-ct-blue text-ct-ink" : "border-transparent text-ct-dim hover:text-ct-ink"}`}
          aria-current={section === id ? "page" : undefined} key={id} href={`/ctfunil/configuracoes?tab=${id}`}>
          {label}
          {!reduceMotion && section === id && <motion.span aria-hidden="true" layoutId="settings-active-tab"
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="ct-settings-tab-indicator pointer-events-none absolute inset-x-0 -bottom-0.5 h-0.5 bg-ct-blue" />}
        </Link>)}
      </nav>
    </LayoutGroup>
    <SettingsContent key={section} section={section} upbf1={upbf1} />
  </WorkspaceFrame>;
}
