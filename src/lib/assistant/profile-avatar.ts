import "server-only";

export function profileAvatar(value: unknown): string | undefined {
  const url = typeof value === "string" ? URL.parse(value) : null;
  if (url?.protocol === "https:" && !url.username && !url.password) return url.href;
}
