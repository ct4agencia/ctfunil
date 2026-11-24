import type { ProjectAttachment } from "./project-attachment";

export const ASSISTANT_SETTINGS_PATH = "/ctfunil/configuracoes?tab=assistente";
export const geminiModelPattern = /^gemini-[a-z0-9.-]{1,80}$/i;
export const geminiKeyPattern = /^[a-z0-9_-]{20,200}$/i;
export const assistantConversationStorageKey = "ctfunil-assistant-conversations-v1";
const sessionKey = "ctfunil-gemini-key";

// Attachments stay in the current document across client-side navigation.
export const assistantAttachments = new Map<number, { attachment: ProjectAttachment; selectedPage: string }>();

export type ImportMode = "design" | "blocks";

export function readWorkspaceSettings(): { model: string; models: string[]; key: string; importMode: ImportMode } {
  try {
    let models: unknown;
    try { models = JSON.parse(localStorage.getItem("ctfunil-gemini-models") ?? "[]"); } catch {}
    return {
      model: localStorage.getItem("ctfunil-gemini-model") ?? "",
      models: Array.isArray(models) ? [...new Set(models.filter((model): model is string => typeof model === "string" && geminiModelPattern.test(model)))] : [],
      key: sessionStorage.getItem(sessionKey) ?? "",
      importMode: localStorage.getItem("ctfunil-import-mode") === "blocks" ? "blocks" : "design",
    };
  } catch {
    return { model: "", models: [], key: "", importMode: "design" };
  }
}

export function saveAssistantSettings(model: string, key: string, models: string[]) {
  localStorage.setItem("ctfunil-gemini-model", model);
  localStorage.setItem("ctfunil-gemini-models", JSON.stringify(models));
  if (key) sessionStorage.setItem(sessionKey, key);
  else sessionStorage.removeItem(sessionKey);
}

export function saveImportMode(mode: ImportMode) {
  localStorage.setItem("ctfunil-import-mode", mode);
}

export function clearAssistantSession() {
  assistantAttachments.clear();
  try {
    sessionStorage.removeItem(sessionKey);
    sessionStorage.removeItem(assistantConversationStorageKey);
  } catch {}
}
