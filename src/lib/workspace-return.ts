const trustedOrigin = "https://ctfunil.invalid";

export function workspaceReturnPath(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\x00-\x1f]/.test(value)) return "/dashboard";
  const target = new URL(value, trustedOrigin);
  const allowed = /^(?:\/dashboard(?:\/[a-z0-9_-]+)?|\/analytics|\/ctfunil(?:\/(?:configuracoes|assistente))?|\/builder\/[a-z0-9_-]+|\/importar\/[a-z0-9_-]+|\/lab\/[a-z0-9_-]+)$/i.test(target.pathname);
  if (target.origin !== trustedOrigin || !allowed) return "/dashboard";
  const assistantPath = target.pathname === "/ctfunil" || target.pathname === "/ctfunil/assistente";
  const assistantAnchor = target.hash === "#assistente" || target.hash === "#anexar-referencia";
  return target.pathname + target.search + (assistantPath && assistantAnchor ? target.hash : "");
}
