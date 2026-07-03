import { NextResponse } from "next/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { fireWebhook, phoneToIntl, dataHoraBr } from "@/lib/quiz/webhooks";
import { vturbListPlayers } from "@/lib/vturb";
import type { FunnelWebhook } from "@/lib/quiz/types";

const URL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Marcos de % que disparam webhook (REQ-2). "pitch" é derivado do tempo real
// vs pitch_time do player (VTurb). Dedup via funnel_sessions.vsl_milestones.
const PCT_MILESTONES = [25, 50, 75, 100];

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
        vsl_milestones: [...fired, ...fresh],
        last_seen_at: new Date().toISOString(),
      })
      .eq("session_id", session_id);
  }

  // Webhook vsl_progress: só APÓS captura (EDGE-1: sem telefone não dispara —
  // o marco fica gravado e o webhook de captura leva o vsl_watch_pct atual).
  if (fresh.length) {
    const { data: lead } = await sb
      .from("funnel_leads")
      .select("name, phone")
      .eq("session_id", session_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lead?.phone) {
      const { data: funnel } = await sb
        .from("funnels")
        .select("name, slug, webhooks")
        .eq("slug", funnel_slug)
        .maybeSingle();

      const webhooks = ((funnel?.webhooks ?? []) as FunnelWebhook[]).filter(
        (wh) => wh.enabled && wh.trigger_event === "lead_capture",
      );

      if (webhooks.length) {
        const base = {
          event: "vsl_progress",
          code: session_id,
          nome: lead.name ?? "",
          telefone: phoneToIntl(lead.phone),
          pagina: funnel?.name ?? "",
          slug: funnel?.slug ?? funnel_slug,
          player_id,
          watch_pct: newPct,
          passou_pitch: passedPitch ? "sim" : "nao",
          data: dataHoraBr(),
        };
        await Promise.allSettled(
          fresh.flatMap((marco) => webhooks.map((wh) => fireWebhook(wh, { ...base, marco }))),
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}
