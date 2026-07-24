"use client";

import { createClient } from "@/lib/supabase/client";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export type TrackingParams = Record<string, string>;

/**
 * Dispara um evento padrão do pixel (Meta/UTMify): Lead, InitiateCheckout, etc.
 * O UTMify (window.pixelId) e o Facebook Pixel capturam via fbq e mandam pro
 * Meta (incl. CAPI server-side). Se o pixel ainda não carregou, fbq enfileira.
 */
export function fireMetaEvent(
  name: string,
  params?: Record<string, unknown>,
): void {
  try {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", name, params || {});
    }
  } catch {
    // nunca quebra a página
  }
}

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_id", // ID do anúncio no Meta (atribuição por anúncio na Datacrazy)
  "fbclid",
  "src",
  "xcod",
  "ctwa_clid", // Click-to-WhatsApp click id (injetado pelo Datacrazy na URL)
  "source_id", // source id da campanha Meta
];

/** Lê um cookie pelo nome. */
function getCookie(name: string): string {
  try {
    const m = document.cookie.match(
      new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"),
    );
    return m ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
}

/** Lê UTMs/click-ids da URL atual + cookies do Meta (_fbp/_fbc). */
export function collectTrackingParams(): TrackingParams {
  try {
    const url = new URL(window.location.href);
    const out: TrackingParams = {};
    UTM_KEYS.forEach((k) => {
      const v = url.searchParams.get(k);
      if (v) out[k] = v;
    });
    // Cookies do Meta Pixel (definidos pelo Pixel/UTMify no browser)
    const fbp = getCookie("_fbp");
    const fbc = getCookie("_fbc");
    if (fbp) out.fbp = fbp;
    if (fbc) out.fbc = fbc;
    return out;
  } catch {
    return {};
  }
}

/** session_id persistente por navegador (localStorage). */
export function getSessionId(): string {
  try {
    const KEY = "vsl_session_id";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = "s-" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "s-anon";
  }
}

/** Coleta dados do dispositivo/navegador pro tracking do lead. */
export function collectDevice() {
  try {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screen: `${window.screen.width}x${window.screen.height}`,
      platform: nav.userAgentData?.platform || navigator.platform || "",
      user_agent: navigator.userAgent,
    };
  } catch {
    return { viewport: "", screen: "", platform: "", user_agent: "" };
  }
}

/** Envia o lead capturado pro servidor (grava + dispara webhooks). */
export async function submitLead(payload: {
  vslId: string;
  name: string;
  phone: string;
  componentId?: string;
}): Promise<boolean> {
  try {
    const body = {
      ...payload,
      ...collectDevice(),
      tracking: collectTrackingParams(),
      session_id: getSessionId(),
    };
    const res = await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Envia o lead capturado por um FUNIL de quiz (grava + dispara webhooks do funil). */
export async function submitFunnelLead(payload: {
  funnelSlug: string;
  name: string;
  phone: string;
  componentId?: string;
}): Promise<boolean> {
  try {
    const body = {
      ...payload,
      ...collectDevice(),
      tracking: collectTrackingParams(),
      session_id: getSessionId(),
    };
    const res = await fetch("/api/funnel-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Registra a VISITA na página (1x por sessão) pro funil de analytics. */
export async function trackView(vslId: string): Promise<void> {
  try {
    const key = `viewed_${vslId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    const supabase = createClient();
    await supabase.from("vsl_events").insert({
      vsl_id: vslId,
      session_id: getSessionId(),
      event_type: "view",
    });
  } catch {
    // tracking nunca quebra a página
  }
}

/** Grava um evento da VSL em vsl_events (anon insert permitido por RLS). */
export async function trackVsl(
  vslId: string,
  eventType: "play" | "heartbeat" | "ended" | "cta_click",
  data: { currentTime?: number; duration?: number } = {},
): Promise<void> {
  try {
    const supabase = createClient();
    const duration = data.duration ?? 0;
    const watch =
      duration > 0 ? Math.round(((data.currentTime ?? 0) / duration) * 100) : null;
    await supabase.from("vsl_events").insert({
      vsl_id: vslId,
      session_id: getSessionId(),
      event_type: eventType,
      player_time: data.currentTime ?? null,
      duration: duration || null,
      watch_percent: watch,
    });
  } catch {
    // tracking nunca quebra a página
  }
}
