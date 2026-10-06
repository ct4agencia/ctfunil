import { NextResponse } from "next/server";

/**
 * Resolve o(s) Pixel(s) numérico(s) da Meta a partir do Pixel ID do UTMify.
 *
 * O número da Meta NÃO está no código que o usuário cola (lá só tem o
 * window.pixelId hexadecimal do UTMify). O número fica guardado na conta do
 * UTMify e o pixel.js o busca em runtime via POST /tracking/v1/events.
 * Aqui replicamos essa chamada server-side pra preencher o Facebook Pixel ID
 * sozinho — sem o usuário copiar número nenhum.
 */
export async function POST(req: Request) {
  try {
    const { utmifyPixelId, url } = (await req.json()) as {
      utmifyPixelId?: string;
      url?: string;
    };
    if (!utmifyPixelId || !/^[a-fA-F0-9]{20,}$/.test(utmifyPixelId)) {
      return NextResponse.json(
        { error: "utmifyPixelId inválido" },
        { status: 400 },
      );
    }

    const r = await fetch("https://tracking.utmify.com.br/tracking/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "PageView",
        lead: { pixelId: utmifyPixelId },
        event: {
          pageTitle: "config-resolve",
          sourceUrl: url || "https://config.local/resolve",
        },
      }),
    });

    if (!r.ok) {
      return NextResponse.json(
        { error: `UTMify respondeu ${r.status}` },
        { status: 502 },
      );
    }
    const data = (await r.json()) as {
      lead?: { metaPixelIds?: string[]; tikTokPixelIds?: string[] };
    };

    return NextResponse.json({
      metaPixelIds: data?.lead?.metaPixelIds ?? [],
      tikTokPixelIds: data?.lead?.tikTokPixelIds ?? [],
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
