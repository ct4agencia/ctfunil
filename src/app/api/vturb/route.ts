import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { vturbListPlayers, vturbSessionStats, type VturbPlayer } from "@/lib/vturb";

/**
 * Métricas VTurb por VSL (aba VSL do /analytics). Admin only.
 * - Detecta automaticamente o player VTurb de cada funil (UUID no embed da VSL).
 * - `?players=id1,id2` adiciona players escolhidos manualmente pelo usuário.
 * - `?from=YYYY-MM-DD&to=YYYY-MM-DD` filtra o período (default: últimos 30 dias).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!user || (adminEmail && user.email?.toLowerCase() !== adminEmail)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.VTURB_API_TOKEN) {
    return NextResponse.json({ error: "no_token", message: "VTURB_API_TOKEN não configurado" }, { status: 200 });
  }

  const params = new URL(request.url).searchParams;
  const extra = (params.get("players") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const range = { from: params.get("from") || undefined, to: params.get("to") || undefined };

  // 1) players da conta + funis (paralelo)
  const sb = createAdminClient();
  const [players, { data: funnels }] = await Promise.all([
    vturbListPlayers(),
    sb.from("funnels").select("slug,name,settings,steps"),
  ]);
  if (!players) return NextResponse.json({ error: "vturb_unreachable" }, { status: 502 });

  // 2) player ↔ funil: o ID do player aparece no embed
  //    (scripts.converteai.net/.../players/<id>/... — id hex de 24 chars, estilo Mongo).
  const UUID_RE = /players\/([0-9a-f]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
  const byPlayer = new Map<string, { slug: string; name: string }[]>();
  for (const f of funnels ?? []) {
    const blob = JSON.stringify(f.settings ?? {}) + JSON.stringify(f.steps ?? []);
    const seen = new Set<string>();
    for (const m of blob.matchAll(UUID_RE)) {
      const id = m[1].toLowerCase();
      if (seen.has(id)) continue;
      seen.add(id);
      const arr = byPlayer.get(id) ?? [];
      arr.push({ slug: f.slug as string, name: f.name as string });
      byPlayer.set(id, arr);
    }
  }

  // 3) stats dos players vinculados a funis + os escolhidos pelo usuário
  const wanted = players.filter((p) => byPlayer.has(p.id.toLowerCase()) || extra.includes(p.id));
  const stats = await Promise.all(wanted.map(async (p: VturbPlayer) => {
    const s = await vturbSessionStats(p, range);
    const funis = byPlayer.get(p.id.toLowerCase()) ?? [];
    return {
      playerId: p.id, playerName: p.name, duration: p.duration, pitchTime: p.pitch_time,
      funnels: funis, // [{slug,name}] — de qual funil a VSL é
      stats: s && {
        views: s.total_viewed, plays: s.total_started, playRate: s.play_rate,
        engagement: s.engagement_rate, pitchAudience: s.total_over_pitch ?? 0,
        pitchRetention: s.over_pitch_rate ?? 0, clicks: s.total_clicked,
        conversions: s.total_conversions, convRate: s.overall_conversion_rate,
        amountBrl: s.total_amount_brl ?? 0,
      },
    };
  }));

  // 4) lista completa (pro seletor manual do usuário)
  const allPlayers = players
    .map((p) => ({ id: p.id, name: p.name, linked: byPlayer.has(p.id.toLowerCase()) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ vsls: stats.filter((x) => x.stats), allPlayers });
}
