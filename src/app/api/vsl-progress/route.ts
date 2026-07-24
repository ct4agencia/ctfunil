import { NextResponse } from "next/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { vturbListPlayers } from "@/lib/vturb";

const URL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Marcos de retenção da VSL gravados na sessão (10%,20%…100%) + "pitch" (passou
// do pitch_time do player). SÓ GRAVA NO BANCO — não dispara 2º webhook (evita
// re-entrada do lead no fluxo da Datacrazy / duplicação). A % vai pro webhook de
// captura (vsl_watch_pct) e fica no nosso analytics; update na Datacrazy só via
// endpoint de atualizar-campo-por-telefone (quando tivermos o token da API).
const PCT_MILESTONES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

type Body = {
  session_id?: string;
  funnel_slug?: string;
  player_id?: string;
  t?: number; // segundos assistidos (máximo)
  d?: number; // duração do vídeo em segundos
};

export async function POST(request: Request) {
  let body: Body;
  try {
    // sendBeacon manda Blob application/json → request.json() cobre os dois casos
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { session_id, funnel_slug, player_id } = body;
  const t = Number(body.t);
  const d = Number(body.d);
  if (!session_id || !funnel_slug || !player_id || !Number.isFinite(t) || !(d > 0) || t <= 0) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (!SERVICE) return NextResponse.json({ ok: true }); // sem service_role não há o que fazer

  const sb = createSbClient(URL_ENV, SERVICE, { auth: { persistSession: false } });

  // EDGE-2: só aumenta; sessão inexistente é ignorada (nunca cria sessão via beacon)
  const { data: sess } = await sb
    .from("funnel_sessions")
    .select("vsl_watch_pct, vsl_milestones")
    .eq("session_id", session_id)
    .eq("funnel_slug", funnel_slug)
    .maybeSingle();
  if (!sess) return NextResponse.json({ ok: true });

  const pct = Math.min(100, Math.round((t / d) * 100));
  const prevPct = Number(sess.vsl_watch_pct ?? 0);
  const newPct = Math.max(prevPct, pct);
  const fired: string[] = Array.isArray(sess.vsl_milestones)
    ? (sess.vsl_milestones as unknown[]).map(String)
    : [];

  // pitch real do player (cache de 5 min em vturbListPlayers)
  let passedPitch = fired.includes("pitch");
  if (!passedPitch) {
    const players = await vturbListPlayers();
    const p = players?.find((x) => x.id === player_id);
    if (p && p.pitch_time > 0 && t >= p.pitch_time) passedPitch = true;
  }

  const due = PCT_MILESTONES.filter((m) => newPct >= m).map(String);
  if (passedPitch) due.push("pitch");
  const fresh = due.filter((m) => !fired.includes(m));

  if (newPct > prevPct || fresh.length) {
    await sb
      .from("funnel_sessions")
      .update({
        vsl_watch_pct: newPct,
        vsl_player_id: player_id,
        // marcos legíveis: "10%","20%"… e "Pitch" quando passa do pitch_time
        vsl_milestones: [...fired, ...fresh],
        last_seen_at: new Date().toISOString(),
      })
      .eq("session_id", session_id);
  }

  // NÃO dispara webhook aqui (evita re-entrada do lead no fluxo da Datacrazy).
  // A retenção fica no banco (vsl_watch_pct/vsl_milestones) → aparece no nosso
  // analytics; push pra Datacrazy só via update-de-campo-por-telefone no futuro.
  return NextResponse.json({ ok: true });
}
