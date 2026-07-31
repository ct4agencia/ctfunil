import { NextResponse } from "next/server";
import { createClient as createSbClient } from "@supabase/supabase-js";

/**
 * Grava o AVANÇO DE LÂMINA no servidor (service_role).
 *
 * Por que existe: até aqui o navegador da lead escrevia direto no banco, o que
 * obrigava a manter permissão anônima de UPDATE/SELECT em funnel_sessions — a
 * última superfície de ataque aberta (dava pra forjar progresso de fora). Com a
 * gravação no servidor, o browser não precisa de acesso nenhum ao banco.
 *
 * Ganho de brinde: é chamado por navigator.sendBeacon, que o navegador entrega
 * mesmo com a página sendo descarregada (clique no CTA, troca de aba, fechar).
 * A gravação direta usava fetch comum e morria no unload — foi o que fez o
 * cdb-01 registrar 9 conclusões enquanto o VTurb via bem mais.
 *
 * Idempotente e monotônico: o progresso só sobe (guarda no .lt + trigger no
 * banco) e o step_event é só um append.
 */
const URL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const runtime = "nodejs";

type Body = {
  session_id?: string;
  funnel_slug?: string;
  step_index?: number;
  step_id?: string;
  step_type?: string;
  meta?: Record<string, unknown> | null;
  /** marca a hidratação (o app montou no browser) — só no primeiro evento */
  hydrated?: boolean;
};

export async function POST(req: Request) {
  try {
    if (!URL_ENV || !SERVICE) return NextResponse.json({ ok: false }, { status: 200 });

    // sendBeacon manda Blob application/json → req.json() cobre os dois casos
    const b = (await req.json().catch(() => null)) as Body | null;
    const idx = Number(b?.step_index);
    if (!b?.session_id || !b?.funnel_slug || !Number.isFinite(idx) || idx < 0) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const sb = createSbClient(URL_ENV, SERVICE, { auth: { persistSession: false } });

    // A sessão pode ainda não existir (beacon de visita bloqueado por adblock):
    // cria sem tocar no progresso de quem já existe.
    await sb.from("funnel_sessions").upsert(
      { session_id: b.session_id, funnel_slug: b.funnel_slug },
      { onConflict: "session_id", ignoreDuplicates: true },
    );

    const agora = new Date().toISOString();

    await Promise.allSettled([
      sb.from("step_events").insert({
        session_id: b.session_id,
        funnel_slug: b.funnel_slug,
        step_index: idx,
        step_id: b.step_id ?? null,
        // tipo REAL da lâmina (antes ia a string fixa "layers", o que impedia
        // qualquer relatório por tipo de lâmina)
        step_type: b.step_type ?? null,
        meta: b.meta ?? null,
      }),
      // só sobe; piso 1 pra que a 1ª lâmina também grave last_seen_at
      sb.from("funnel_sessions")
        .update({ max_step_reached: idx, last_seen_at: agora })
        .eq("session_id", b.session_id)
        .lt("max_step_reached", Math.max(idx, 1)),
    ]);

    // hidratação: preserva o PRIMEIRO carimbo (não reescreve a cada visita)
    if (b.hydrated) {
      await sb.from("funnel_sessions")
        .update({ hydrated_at: agora })
        .eq("session_id", b.session_id)
        .is("hydrated_at", null);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
