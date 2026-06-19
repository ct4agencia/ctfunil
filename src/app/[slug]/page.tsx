import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VslView from "@/components/vsl/VslView";
import BlockRenderer from "@/components/vsl/BlockRenderer";
import PixelScripts from "@/components/vsl/PixelScripts";
import type { Vsl } from "@/lib/types";

async function getVsl(slug: string): Promise<Vsl | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vsls")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  return (data as Vsl) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vsl = await getVsl(slug);
  if (!vsl) return { title: "Página não encontrada" };

  const seo = vsl.settings?.seo ?? {};
  const verification = vsl.settings?.pixels?.google_site_verification;
  const title = seo.title || vsl.name;
  const description = seo.description || vsl.niche || undefined;

  return {
    title,
    description,
    icons: seo.favicon_url ? { icon: seo.favicon_url } : undefined,
    openGraph: {
      title,
      description,
      images: seo.og_image_url ? [seo.og_image_url] : undefined,
    },
    verification: verification ? { google: verification } : undefined,
  };
}

export default async function VslPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vsl = await getVsl(slug);
  if (!vsl) notFound();
  const hasBlocks = Array.isArray(vsl.blocks) && vsl.blocks.length > 0;
  return (
    <>
      <PixelScripts
        settings={vsl.settings ?? {}}
        utmifyPixelId={vsl.utmify_pixel_id}
        hotmartAccountId={vsl.hotmart_account_id}
      />
      {hasBlocks ? (
        <BlockRenderer vsl={vsl} blocks={vsl.blocks} />
      ) : (
        <VslView vsl={vsl} />
      )}
    </>
  );
}
