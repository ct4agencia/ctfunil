import { isRealDataPreview } from "@/lib/workspace-preview";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import SoniaLab from "./SoniaLab";

export const metadata = { title: "Sorteio da Sônia — rascunho local", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string; mode?: string }> }) {
  const host = (await headers()).get("host") || "";
  if (!isRealDataPreview(host) && (process.env.NODE_ENV !== "development" || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host))) notFound();
  const { view, mode } = await searchParams;
  return <SoniaLab view={view === "builder" ? "builder" : view === "selection" ? "selection" : "flow"} realRedirect={mode === "redirect"} />;
}
