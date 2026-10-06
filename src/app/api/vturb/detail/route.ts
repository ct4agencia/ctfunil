import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  vturbListPlayers,
  vturbUserEngagement,
  vturbStatsByField,
  vturbTrafficOrigin,
  type VturbFieldStats,
} from "@/lib/vturb";

/**
 * Detalhe de um player VTurb (REQ-5/6/7 da spec): curva de retenção,
 * tabela minuto a minuto (%RET/%QUEDA) e segmentações — réplica do painel VTurb.
 * `?player=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD`
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!user || (!adminEmail || user.email?.toLowerCase() !== adminEmail)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.VTURB_API_TOKEN) {
    return NextResponse.json({ error: "no_token" }, { status: 200 });
  }

  const params = new URL(request.url).searchParams;
  const playerId = params.get("player") || "";
  const range = { from: params.get("from") || undefined, to: params.get("to") || undefined };
  if (!playerId) return NextResponse.json({ error: "missing player" }, { status: 400 });

  const players = await vturbListPlayers();
  const player = players?.find((p) => p.id === playerId);
  if (!player) return NextResponse.json({ error: "player_not_found" }, { status: 404 });

  // lite=1 (comparação de VSLs): só a curva — pula as 5 chamadas de segmentação
  const lite = params.get("lite") === "1";
  const [engagement, country, device, os, browser, traffic] = await Promise.all([
    vturbUserEngagement(player, range),
    lite ? null : vturbStatsByField(player, "country", range),
    lite ? null : vturbStatsByField(player, "device_type", range),
    lite ? null : vturbStatsByField(player, "os", range),
    lite ? null : vturbStatsByField(player, "browser", range),
    lite ? null : vturbTrafficOrigin(player, range),
  ]);

  // ── Curva de retenção: grouped_timed é histograma de SAÍDA (bucket 5s onde o
  //    usuário parou). Retenção em T = % de usuários que passaram de T.
  const buckets = engagement ?? [];
  const total = buckets.reduce((s, b) => s + b.total_users, 0);
  const maxT = Math.max(player.duration || 0, ...buckets.map((b) => b.timed));
  const curve: { t: number; pct: number }[] = [];
  if (total > 0) {
    // ordena por tempo e acumula de trás pra frente
    const sorted = [...buckets].sort((a, b) => a.timed - b.timed);
    let remaining = total;
    let i = 0;
    for (let t = 0; t <= maxT; t += 5) {
      while (i < sorted.length && sorted[i].timed < t) {
        remaining -= sorted[i].total_users;
        i++;
      }
      curve.push({ t, pct: Math.round((remaining / total) * 1000) / 10 });
    }
  }

  // ── Tabela minuto a minuto (replica a planilha "vsl vturb": TEMPO | %RET | %QUEDA)
  const mm = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const minutes: { label: string; ret: number; drop: number }[] = [];
  let prevRet = 100;
  for (let start = 0; start < maxT; start += 60) {
    const pt = curve.find((c) => c.t >= start) ?? curve[curve.length - 1];
    const ret = pt ? pt.pct : 0;
    minutes.push({
      label: `${mm(start)} a ${mm(Math.min(start + 60, Math.max(maxT, 60)))}`,
      ret,
      drop: Math.round((prevRet - ret) * 10) / 10,
    });
    prevRet = ret;
  }

  const seg = (rows: VturbFieldStats[] | null) =>
    (rows ?? [])
      .map((r) => ({
        label: r.grouped_field || "(vazio)",
        key: r.query_key,
        views: r.total_viewed ?? 0,
        plays: r.total_started ?? 0,
        playRate: Number(r.play_rate ?? 0),
        engagement: Number(r.engagement_rate ?? 0),
        pitchRate: Number(r.over_pitch_rate ?? 0),
        clicks: r.total_clicked ?? 0,
        conversions: r.total_conversions ?? 0,
        amountBrl: r.total_amount_brl ?? 0,
      }))
      .sort((a, b) => b.views - a.views);

  return NextResponse.json({
    player: {
      id: player.id,
      name: player.name,
      duration: player.duration,
      pitchTime: player.pitch_time,
    },
    totalUsers: total,
    curve,
    minutes,
    segments: {
      paises: seg(country),
      dispositivos: seg(device),
      so: seg(os),
      navegadores: seg(browser),
    },
    traffic: seg(traffic),
  });
}
