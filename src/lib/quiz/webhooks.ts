import type { FunnelWebhook } from "@/lib/quiz/types";

/**
 * Disparo de webhook no MESMO formato do inlead (Datacrazy mapeia os campos).
 * Extraído de api/funnel-lead pra ser compartilhado com api/vsl-progress.
 * Best-effort: falha de webhook NUNCA propaga (não pode quebrar captura/tracking).
 */
export async function fireWebhook(wh: FunnelWebhook, payload: Record<string, unknown>) {
  try {
    const headers: Record<string, string> = {};
    if (wh.token) headers["Authorization"] = `Bearer ${wh.token}`;

    if (wh.method === "GET") {
      const url = new URL(wh.api_url);
      Object.entries(payload).forEach(([k, v]) => url.searchParams.set(k, String(v ?? "")));
      await fetch(url.toString(), { method: "GET", headers });
      return;
    }
    if (wh.content_type === "json") {
      headers["Content-Type"] = "application/json";
      await fetch(wh.api_url, { method: "POST", headers, body: JSON.stringify(payload) });
    } else {
      const params = new URLSearchParams();
      Object.entries(payload).forEach(([k, v]) => params.append(k, String(v ?? "")));
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      await fetch(wh.api_url, { method: "POST", headers, body: params });
    }
  } catch {
    /* best-effort */
  }
}

/** Telefone p/ webhook (Datacrazy): +55 + número limpo (E.164). */
export function phoneToIntl(phone: string | null | undefined): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits ? "+55" + digits.replace(/^55/, "") : "";
}

/** Data/hora pt-BR (America/Sao_Paulo) no formato que o Datacrazy já recebe. */
export function dataHoraBr(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo",
  }).format(new Date());
}
