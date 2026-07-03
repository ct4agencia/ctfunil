import "server-only";

/**
 * Client da Analytics API do VTurb (https://vturb.gitbook.io/analytics-api/pt).
 * Base: https://analytics.vturb.net · headers X-Api-Token / X-Api-Version: v1.
 * Server-only: o token NUNCA vai pro browser.
 */

const BASE = "https://analytics.vturb.net";

function headers(): Record<string, string> | null {
  const token = process.env.VTURB_API_TOKEN;
  if (!token) return null;
  return { "X-Api-Token": token, "X-Api-Version": "v1", "Content-Type": "application/json" };
}

export interface VturbPlayer {
  id: string;
  name: string;
  pitch_time: number;
  duration: number;
  created_at?: string;
}

export interface VturbStats {
  total_viewed: number;
  total_viewed_device_uniq?: number;
  total_started: number;
  total_started_device_uniq?: number;
  total_finished?: number;
  engagement_rate: number;
  total_clicked: number;
  total_over_pitch?: number;
  over_pitch_rate?: number;
  total_conversions: number;
  overall_conversion_rate: number;
  total_amount_brl?: number;
  play_rate: number;
}

export async function vturbListPlayers(): Promise<VturbPlayer[] | null> {
  const h = headers();
  if (!h) return null;
  try {
    const r = await fetch(`${BASE}/players/list`, { headers: h, next: { revalidate: 300 } });
    if (!r.ok) return null;
    return (await r.json()) as VturbPlayer[];
  } catch {
    return null;
  }
}

/** Corpo comum dos POSTs de analytics (a API exige datetime completo + duração). */
function statsBody(player: VturbPlayer, range?: { from?: string; to?: string }) {
  const dt = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
  return {
    player_id: player.id,
    start_date: range?.from ? `${range.from} 00:00:00` : dt(new Date(Date.now() - 30 * 86400 * 1000)),
    end_date: range?.to ? `${range.to} 23:59:59` : dt(new Date()),
    video_duration: player.duration || 300,
    pitch_time: player.pitch_time || 0,
    timezone: "America/Sao_Paulo",
  };
}

export interface VturbEngagementBucket {
  total_users: number;
  timed: number; // segundo do vídeo (buckets de 5s) em que o usuário PAROU
}

/** Histograma de saída (curva de retenção = soma acumulada reversa). */
export async function vturbUserEngagement(
  player: VturbPlayer,
  range?: { from?: string; to?: string },
): Promise<VturbEngagementBucket[] | null> {
  const h = headers();
  if (!h) return null;
  try {
    // no-store: POST com revalidate fazia o Next reaproveitar cache entre
    // períodos diferentes — a tabela de minutagem não mudava com o filtro.
    const r = await fetch(`${BASE}/times/user_engagement`, {
      method: "POST", headers: h, body: JSON.stringify(statsBody(player, range)),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { grouped_timed?: VturbEngagementBucket[] };
    return j.grouped_timed ?? null;
  } catch {
    return null;
  }
}

export interface VturbFieldStats {
  grouped_field: string;
  query_key?: string; // presente em traffic_origin (utm_content, utm_source…)
  total_viewed: number;
  total_started: number;
  total_clicked: number;
  engagement_rate: number | string;
  play_rate: number | string;
  over_pitch_rate?: number | string;
  total_over_pitch?: number;
  total_conversions: number;
  overall_conversion_rate: number | string;
  total_amount_brl?: number;
}

/** Métricas quebradas por campo (country, device_type, os, browser, utm_*). */
export async function vturbStatsByField(
  player: VturbPlayer,
  field: string,
  range?: { from?: string; to?: string },
): Promise<VturbFieldStats[] | null> {
  const h = headers();
  if (!h) return null;
  try {
    const r = await fetch(`${BASE}/sessions/stats_by_field`, {
      method: "POST", headers: h,
      body: JSON.stringify({ ...statsBody(player, range), field }),
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as VturbFieldStats[];
  } catch {
    return null;
  }
}

/** Origem do tráfego (agrupado pelo utm mais relevante, com query_key). */
export async function vturbTrafficOrigin(
  player: VturbPlayer,
  range?: { from?: string; to?: string },
): Promise<VturbFieldStats[] | null> {
  const h = headers();
  if (!h) return null;
  try {
    const r = await fetch(`${BASE}/traffic_origin/stats`, {
      method: "POST", headers: h, body: JSON.stringify(statsBody(player, range)),
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as VturbFieldStats[];
  } catch {
    return null;
  }
}

export async function vturbSessionStats(
  player: VturbPlayer,
  range?: { from?: string; to?: string },
): Promise<VturbStats | null> {
  const h = headers();
  if (!h) return null;
  try {
    // API exige datetime COMPLETO ("YYYY-MM-DD HH:MM:SS")
    const dt = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
    const body = {
      player_id: player.id,
      // default: últimos 30 dias
      start_date: range?.from ? `${range.from} 00:00:00` : dt(new Date(Date.now() - 30 * 86400 * 1000)),
      end_date: range?.to ? `${range.to} 23:59:59` : dt(new Date()),
      video_duration: player.duration || 300,
      pitch_time: player.pitch_time || 0,
      timezone: "America/Sao_Paulo",
    };
    const r = await fetch(`${BASE}/sessions/stats`, {
      method: "POST", headers: h, body: JSON.stringify(body), cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as VturbStats;
  } catch {
    return null;
  }
}
