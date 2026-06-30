import { NextResponse } from "next/server";
import { createClient as createSbClient } from "@supabase/supabase-js";

/**
 * Endpoint ULTRA-leve de "visitante" (connect rate). É chamado por um beacon
 * inline no <head> da página do funil ANTES do app JS carregar — então o
 * visitante é registrado já no carregamento, sem esperar a hidratação (~1s+).
 * Isso fecha o gap de connect rate: o lead que clica no anúncio e sai durante
 * o render agora conta como visitante (igual o inlead).
 *
 * Idempotente: usa ignoreDuplicates, então NUNCA reseta o max_step_reached de
 * uma sessão que já existe (reload / visitante recorrente).
 */
const URL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const runtime = "nodejs";

type Body = {
  slug?: string;
  session_id?: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  src?: string | null;
  ctwa_clid?: string | null;
  source_id?: string | null;
};

export async function POST(req: Request) {
  try {
    if (!URL_ENV || !(SERVICE || ANON)) return NextResponse.json({ ok: false }, { status: 200 });
    const b = (await req.json().catch(() => null)) as Body | null;
    if (!b || !b.slug || !b.session_id) return NextResponse.json({ ok: false }, { status: 200 });

    const sb = createSbClient(URL_ENV, SERVICE || ANON, { auth: { persistSession: false } });
    await sb.from("funnel_sessions").upsert(
      {
        session_id: b.session_id,
        funnel_slug: b.slug,
        max_step_reached: 0,
        utm_source: b.utm_source ?? null,
        utm_medium: b.utm_medium ?? null,
        utm_campaign: b.utm_campaign ?? null,
        utm_content: b.utm_content ?? null,
        utm_term: b.utm_term ?? null,
        src: b.src ?? null,
        ctwa_clid: b.ctwa_clid ?? null,
        source_id: b.source_id ?? null,
      },
      // só INSERE se a sessão ainda não existir — nunca sobrescreve/reseta o progresso
      { onConflict: "session_id", ignoreDuplicates: true },
    );
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
