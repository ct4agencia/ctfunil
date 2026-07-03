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
      method: "POST", headers: h, body: JSON.stringify(body), next: { revalidate: 120 },
    });
    if (!r.ok) return null;
    return (await r.json()) as VturbStats;
  } catch {
    return null;
  }
}
