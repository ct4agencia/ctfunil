export const ASSISTANT_SETTINGS_PATH = "/ctfunil/configuracoes?tab=assistente";
export const geminiModelPattern = /^gemini-[a-z0-9.-]{1,80}$/i;
export const geminiKeyPattern = /^[a-z0-9_-]{20,200}$/i;
export type ImportMode = "design" | "blocks";

export function readWorkspaceSettings(): { model: string; key: string; importMode: ImportMode } {
  try {
    return {
      model: localStorage.getItem("ctfunil-gemini-model") ?? "",
      key: sessionStorage.getItem("ctfunil-gemini-key") ?? "",
      importMode: localStorage.getItem("ctfunil-import-mode") === "blocks" ? "blocks" : "design",
    };
  } catch {
    return { model: "", key: "", importMode: "design" };
  }
}

export function saveAssistantSettings(model: string, key: string) {
  localStorage.setItem("ctfunil-gemini-model", model);
  if (key) sessionStorage.setItem("ctfunil-gemini-key", key);
  else sessionStorage.removeItem("ctfunil-gemini-key");
}

export function saveImportMode(mode: ImportMode) {
  localStorage.setItem("ctfunil-import-mode", mode);
}
