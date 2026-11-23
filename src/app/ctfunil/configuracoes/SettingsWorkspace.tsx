"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ThemeButton, WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import { geminiKeyPattern, geminiModelPattern, readWorkspaceSettings, saveAssistantSettings, saveImportMode, type ImportMode } from "@/lib/assistant/workspace-settings";

const tabs = [
  ["geral", "Geral"],
  ["assistente", "Assistente"],
  ["importacao", "Importação"],
] as const;
type Section = typeof tabs[number][0];

export default function SettingsWorkspace({ section }: { section: Section }) {
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [mode, setMode] = useState<ImportMode>("design");
  const [status, setStatus] = useState<{ model: string; configured: boolean }>();
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = readWorkspaceSettings();
    setModel(saved.model);
    setKey(saved.key);
    setMode(saved.importMode);
    const controller = new AbortController();
    fetch("/api/assistant", { cache: "no-store", signal: controller.signal })
      .then(response => { if (!response.ok) throw Error(); return response.json(); })
      .then(setStatus)
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");
    try {
      if (section === "assistente") {
        const chosen = model.trim();
        const secret = key.trim();
        if (chosen && !geminiModelPattern.test(chosen)) { setError("Informe um identificador de modelo Gemini válido."); return; }
        if (secret && !geminiKeyPattern.test(secret)) { setError("Confira o formato da chave do Gemini."); return; }
        saveAssistantSettings(chosen, secret);
        setKey(secret);
        setModel(chosen);
      }
      if (section === "importacao") saveImportMode(mode);
      setNotice("Configurações salvas neste navegador.");
    } catch {
      setError("O navegador não permitiu salvar as configurações.");
    }
  }

  return <WorkspaceFrame title="Configurações" activeTab={section}>
    <header className="ct-page-heading"><div><h1>Configurações</h1><p>Preferências do workspace, do assistente e do editor.</p></div></header>
    <nav className="mb-5 flex flex-wrap gap-2" aria-label="Seções de configurações">
      {tabs.map(([id, label]) => <Link className={section === id ? "ct-action-link" : "rounded-lg px-3 py-2 text-sm text-ct-blue underline"}
        aria-current={section === id ? "page" : undefined} key={id} href={`/ctfunil/configuracoes?tab=${id}`}>{label}</Link>)}
    </nav>
    {section === "geral" ? <section className="ct-panel flex flex-wrap items-center justify-between gap-4 p-5">
      <div><h2 className="text-lg font-semibold">Aparência</h2><p className="text-sm text-ct-dim">Escolha o tema do workspace neste navegador.</p></div>
      <ThemeButton />
    </section> : <form key={section} onSubmit={submit} className="ct-panel max-w-2xl space-y-5 p-5 sm:p-6">
      {section === "assistente" ? <>
        <div><h2 className="text-lg font-semibold">Assistente de criação</h2>
          <p className="mt-1 text-sm text-ct-dim">Provedor Google Gemini. {loadError ? "Não foi possível consultar o servidor." : status ? status.configured ? "Chave do servidor disponível." : "Chave do servidor ausente." : "Consultando servidor…"}</p>
        </div>
        <label className="block text-sm font-semibold">Modelo Gemini
          <input className="mt-2 block w-full rounded-lg border border-ct-line bg-ct-raised p-3" value={model} onChange={event => setModel(event.target.value)} placeholder={status?.model || "Modelo do servidor"} maxLength={87} />
        </label>
        <label className="block text-sm font-semibold">Chave Gemini da sessão
          <input type="password" autoComplete="off" className="mt-2 block w-full rounded-lg border border-ct-line bg-ct-raised p-3" value={key} onChange={event => setKey(event.target.value)} maxLength={200} aria-describedby="ct-gemini-key-help" />
        </label>
        <p id="ct-gemini-key-help" className="text-sm text-ct-dim">A chave vale para esta aba. Deixe em branco para usar a chave do servidor e remova o conteúdo do campo para esquecer a chave da sessão.</p>
        <Link href="/ctfunil#assistente" className="text-sm text-ct-blue underline">Abrir assistente</Link>
      </> : <>
        <fieldset className="space-y-3"><legend className="mb-2 text-lg font-semibold">Modo padrão para ZIP e HTML</legend>
          <label className="flex items-start gap-2 text-sm"><input type="radio" name="import-mode" checked={mode === "design"} onChange={() => setMode("design")} /> <span><strong>Preservar design</strong><span className="block text-ct-dim">Mantém a composição HTML, estilos e imagens do arquivo em um bloco editável de HTML.</span></span></label>
          <label className="flex items-start gap-2 text-sm"><input type="radio" name="import-mode" checked={mode === "blocks"} onChange={() => setMode("blocks")} /> <span><strong>Converter em blocos</strong><span className="block text-ct-dim">Separa textos, imagens, campos e botões em controles do editor.</span></span></label>
        </fieldset>
        <Link href="/ctfunil#anexar-referencia" className="text-sm text-ct-blue underline">Anexar arquivo</Link>
      </>}
      <div><button className="ct-action-link" type="submit">Salvar configurações</button></div>
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {error && <p role="alert" className="text-sm text-ct-dim">{error}</p>}
    </form>}
  </WorkspaceFrame>;
}
