import { workspaceReturnPath } from "./workspace-return";

const storageKey = "ctfunil:recovery-destination";
const lifetime = 60 * 60 * 1000;

export function rememberRecoveryDestination(value: string | null) {
  try {
    const path = workspaceReturnPath(value);
    if (path === "/dashboard") window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, JSON.stringify({ path, expires: Date.now() + lifetime }));
  } catch {
    // Storage can be unavailable in a restricted browser context.
  }
}

export function readRecoveryDestination(): string | undefined {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
    if (typeof saved?.expires !== "number" || saved.expires <= Date.now() || typeof saved.path !== "string") return;
    return workspaceReturnPath(saved.path);
  } catch {
    return undefined;
  }
}
