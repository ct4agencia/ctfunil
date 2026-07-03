import { NextResponse } from "next/server";
import { leadGeo } from "@/lib/quiz/geo";

/**
 * Geo do lead via headers da Vercel — consumido pelo CLIENT (FunnelRenderer).
 * Existe pra tirar o leadGeo() da renderização da página: com ele no server a
 * página era force-dynamic (sem cache de borda); agora a página é ISR e o
 * {estado} chega por este fetch minúsculo.
 */
export async function GET() {
  const geo = await leadGeo();
  return NextResponse.json(geo, { headers: { "Cache-Control": "private, no-store" } });
}
