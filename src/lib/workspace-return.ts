const trustedOrigin = "https://ctfunil.invalid";

export function workspaceReturnPath(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\x00-\x1f]/.test(value)) return "/dashboard";
  const target = new URL(value, trustedOrigin);
  const allowed = /^(?:\/dashboard(?:\/[a-z0-9_-]+)?|\/analytics|\/ctfunil|\/builder\/[a-z0-9_-]+|\/importar\/[a-z0-9_-]+|\/lab\/[a-z0-9_-]+)$/i.test(target.pathname);
  return target.origin === trustedOrigin && allowed ? target.pathname + target.search + (target.pathname === "/ctfunil" && target.hash === "#assistente" ? target.hash : "") : "/dashboard";
}
