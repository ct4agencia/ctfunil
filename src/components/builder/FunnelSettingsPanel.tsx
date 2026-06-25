"use client";

import { useState } from "react";
import type { Funnel, FunnelPixels, FunnelSettings, FunnelWebhook } from "@/lib/quiz/types";

/* ── Smart Install: detecta scripts colados e mapeia pros campos ── */
type DetTarget = "utmify_fb" | "utmify_google" | "hotmart" | "ga" | "gtm" | "fb_pixel" | "site_verify" | "head_raw" | "info";
type Detected = { label: string; where: string; value: string; target: DetTarget };

function detectScripts(text: string): Detected[] {
  const out: Detected[] = [];
  const seen = new Set<string>();
  const push = (d: Detected) => { const k = d.target + d.value; if (!seen.has(k)) { seen.add(k); out.push(d); } };
  let m: RegExpMatchArray | null;
  if ((m = text.match(/window\.pixelId\s*=\s*["']([a-fA-F0-9]{20,})["']/))) push({ label: "Pixel UTMify (Facebook)", where: "→ UTMify Pixel ID", value: m[1], target: "utmify_fb" });
  if ((m = text.match(/window\.googlePixelId\s*=\s*["']([a-fA-F0-9]{20,})["']/))) push({ label: "Pixel UTMify (Google)", where: "→ UTMify Google Pixel ID", value: m[1], target: "utmify_google" });
  if ((m = text.match(/hot\(\s*['"]account['"]\s*,\s*['"]([0-9a-fA-F-]{8,})['"]\s*\)/))) push({ label: "Hotmart Launcher", where: "→ Hotmart Account ID", value: m[1], target: "hotmart" });
  if ((m = text.match(/gtag\/js\?id=(G-[A-Z0-9]+)/)) || (m = text.match(/['"](G-[A-Z0-9]+)['"]/))) push({ label: "Google Analytics (GA4)", where: "→ Google Analytics ID", value: m[1], target: "ga" });
  if ((m = text.match(/(GTM-[A-Z0-9]+)/))) push({ label: "Google Tag Manager", where: "→ Google Tag Manager ID", value: m[1], target: "gtm" });
  if ((m = text.match(/fbq\(\s*['"]init['"]\s*,\s*['"]([0-9]{6,})['"]/))) push({ label: "Facebook Pixel (Meta)", where: "→ Facebook Pixel ID", value: m[1], target: "fb_pixel" });
  if ((m = text.match(/google-site-verification["']?[^>]*content=["']([^"']+)["']/)) || (m = text.match(/content=["']([^"']+)["'][^>]*google-site-verification/))) push({ label: "Google Site Verification", where: "→ Google Site Verification", value: m[1], target: "site_verify" });
  if (/utms\/latest\.js/.test(text)) push({ label: "UTMs UTMify (persistência)", where: "automático — vem com o pixel UTMify", value: "latest.js", target: "info" });
  const actionable = out.filter((d) => d.target !== "info");
  if (actionable.length === 0 && text.trim().length > 0) push({ label: "Script não reconhecido", where: "→ Script — Head (cru)", value: "(script completo)", target: "head_raw" });
  return out;
}

const inputCls = "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500";
const labelCls = "mb-1 block text-xs font-semibold text-neutral-600";
const taCls = inputCls + " font-mono text-xs";

type Tab = "geral" | "pixels" | "seo" | "webhooks";

export default function FunnelSettingsPanel({
  funnel, onPatch, onClose,
}: { funnel: Funnel; onPatch: (patch: Partial<Funnel>) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("geral");
  const pixels = funnel.settings?.pixels ?? {};
  const setPixel = (k: keyof FunnelPixels, v: string) =>
    onPatch({ settings: { ...funnel.settings, pixels: { ...pixels, [k]: v || undefined } } });
  const seo = funnel.settings?.seo ?? {};
  const setSeo = (k: keyof NonNullable<FunnelSettings["seo"]>, v: string) =>
    onPatch({ settings: { ...funnel.settings, seo: { ...seo, [k]: v || undefined } } });
  // suave (ao digitar): permite traço inclusive no fim, pra dar pra escrever "cdb-h"
  const slugSoft = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9-]+/g, "-");
  // completo (ao sair do campo): colapsa traços e tira do início/fim
  const slugify = (s: string) =>
    slugSoft(s).replace(/-+/g, "-").replace(/^-+|-+$/g, "");

  // Smart Install
  const [pasteText, setPasteText] = useState("");
  const [detected, setDetected] = useState<Detected[] | null>(null);
  const [detSel, setDetSel] = useState<boolean[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [installMsg, setInstallMsg] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  async function resolveMetaPixel(utmifyId: string): Promise<string | null> {
    if (!/^[a-fA-F0-9]{20,}$/.test(utmifyId)) return null;
    setResolving(true);
    try {
      const res = await fetch("/api/resolve-meta-pixel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ utmifyPixelId: utmifyId }) });
      const data = await res.json();
      const meta: string | undefined = data?.metaPixelIds?.[0];
      if (meta) { setPixel("facebook_pixel_id", meta); return meta; }
      return null;
    } catch { return null; } finally { setResolving(false); }
  }

  async function applyDetected() {
    if (!detected) return;
    let n = 0;
    let utmifyToResolve: string | null = null;
    const nextPixels: FunnelPixels = { ...pixels };
    let nextUtmify = funnel.utmifyPixelId;
    let nextHotmart = funnel.hotmartAccountId;
    detected.forEach((d, i) => {
      if (!detSel[i] || d.target === "info") return;
      n++;
      switch (d.target) {
        case "utmify_fb": nextUtmify = d.value; utmifyToResolve = d.value; break;
        case "utmify_google": nextPixels.utmify_google_pixel_id = d.value; break;
        case "hotmart": nextHotmart = d.value; break;
        case "ga": nextPixels.google_analytics_id = d.value; break;
        case "gtm": nextPixels.gtm_id = d.value; break;
        case "fb_pixel": nextPixels.facebook_pixel_id = d.value; break;
        case "site_verify": nextPixels.google_site_verification = d.value; break;
        case "head_raw": nextPixels.head_script = ((pixels.head_script || "") + "\n" + pasteText).trim(); break;
      }
    });
    onPatch({ settings: { ...funnel.settings, pixels: nextPixels }, utmifyPixelId: nextUtmify, hotmartAccountId: nextHotmart });
    setDetected(null);
    setPasteText("");
    if (utmifyToResolve) {
      setInstallMsg(`${n} item(ns) preenchido(s). Buscando o Pixel da Meta na UTMify…`);
      const meta = await resolveMetaPixel(utmifyToResolve);
      setInstallMsg(meta ? `✓ ${n} item(ns) + Pixel da Meta resolvido: ${meta}. Lembre de Salvar.` : `${n} item(ns) preenchido(s). Não resolvi o número da Meta (confira na UTMify). Salve mesmo assim.`);
    } else {
      setInstallMsg(`${n} item(ns) preenchido(s). Lembre de Salvar.`);
    }
  }

  // Webhooks
  const webhooks = funnel.webhooks ?? [];
  const patchWh = (i: number, patch: Partial<FunnelWebhook>) => onPatch({ webhooks: webhooks.map((w, k) => (k === i ? { ...w, ...patch } : w)) });
  const addWh = () => onPatch({ webhooks: [...webhooks, { id: `wh-${Math.random().toString(36).slice(2, 8)}`, name: "", api_url: "", method: "POST", content_type: "formData", trigger_event: "lead_capture", enabled: true }] });
  const delWh = (i: number) => onPatch({ webhooks: webhooks.filter((_, k) => k !== i) });

  const tabs: { key: Tab; label: string }[] = [
    { key: "geral", label: "Geral" },
    { key: "pixels", label: "⚡ Pixel / Scripts" },
    { key: "seo", label: "SEO & Favicon" },
    { key: "webhooks", label: "Webhooks" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-6 w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <h2 className="text-base font-bold">⚙ Configurações · {funnel.name}</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm font-semibold text-neutral-500 hover:bg-neutral-100">Fechar ✕</button>
        </header>
        <div className="flex gap-1 border-b border-neutral-200 px-4">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold transition ${tab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-neutral-500 hover:text-neutral-800"}`}>{t.label}</button>
          ))}
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {tab === "geral" && (
            <div className="max-w-lg space-y-4">
              <label className="block">
                <span className={labelCls}>Nome do funil (interno / aparece no painel e no webhook)</span>
                <input className={inputCls} placeholder="CDB 👛 [Bolsas] — SRC 01" value={funnel.name} onChange={(e) => onPatch({ name: e.target.value })} />
              </label>
              <label className="block">
                <span className={labelCls}>Slug (endereço do funil)</span>
                <input className={inputCls} placeholder="cdb-h" value={funnel.slug}
                  onChange={(e) => onPatch({ slug: slugSoft(e.target.value) })}
                  onBlur={(e) => onPatch({ slug: slugify(e.target.value) || "funil" })} />
                <span className="mt-1 block text-[11px] text-neutral-400">
                  URL: <b>{funnel.domain ? `${funnel.domain}/${funnel.slug || "slug"}` : `/q/${funnel.slug || "slug"}`}</b>. Pode usar traço (ex: <b>cdb-h</b>). Ao salvar com slug novo, o funil é <b>renomeado</b> (métricas migram junto).
                </span>
              </label>
              <label className="block">
                <span className={labelCls}>Domínio próprio — toma a RAIZ ⚠️</span>
                <input className={inputCls} placeholder="(vazio = servir só por slug)" value={funnel.domain ?? ""}
                  onChange={(e) => onPatch({ domain: e.target.value || undefined })}
                  onBlur={(e) => onPatch({ domain: e.target.value ? e.target.value.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") || undefined : undefined })} />
                <span className="mt-1 block text-[11px] text-neutral-400">
                  <b>Deixe VAZIO</b> para servir o funil só pelo slug (ex: <b>viverdebolsas.com.br/{funnel.slug || "slug"}</b>) — o domínio é cadastrado na Vercel e a raiz não aponta pra ninguém.
                  {" "}Preencha <b>só</b> se quiser que ESTE funil tome a <b>raiz</b> do domínio (<b>{funnel.domain || "ex: viverdebolsas.com.br"}</b>) — aí o pixel dele dispara também na raiz, e só 1 funil pode tomá-la.
                </span>
              </label>
              <label className="block">
                <span className={labelCls}>Link de checkout (Hotmart/Kiwify…)</span>
                <input className={inputCls} placeholder="https://pay.hotmart.com/..." value={funnel.checkoutUrl ?? ""} onChange={(e) => onPatch({ checkoutUrl: e.target.value || undefined })} />
              </label>
              <label className="block">
                <span className={labelCls}>Hotmart Product ID (opcional)</span>
                <input className={inputCls} value={funnel.hotmartProductId ?? ""} onChange={(e) => onPatch({ hotmartProductId: e.target.value || undefined })} />
                <span className="mt-1 block text-[11px] text-neutral-400">Vazio = extraído do link de checkout. Vai no payload do webhook (campo <b>produto</b>).</span>
              </label>
              <label className="block">
                <span className={labelCls}>Rodapé / Copyright (aparece na lâmina final)</span>
                <input className={inputCls} placeholder="Copyright Clube das Bolsas® — Todos os direitos reservados."
                  value={funnel.settings?.footer ?? ""} onChange={(e) => onPatch({ settings: { ...funnel.settings, footer: e.target.value || undefined } })} />
              </label>
            </div>
          )}

          {tab === "pixels" && (
            <div className="max-w-lg space-y-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-neutral-800">⚡ Colar e implementar</p>
                <p className="mb-2 text-xs text-neutral-500">Cole os scripts do gestor (UTMify, Hotmart, Google, Meta…). O app detecta cada um e mostra onde vai.</p>
                <textarea className={taCls} rows={4} placeholder="Cole aqui os <script>...</script>" value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
                <div className="mt-2 flex items-center gap-3">
                  <button type="button" onClick={() => { setDetected(detectScripts(pasteText)); setDetSel(detectScripts(pasteText).map((d) => d.target !== "info")); setInstallMsg(null); }} disabled={!pasteText.trim()}
                    className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-40">Detectar e implementar</button>
                  {installMsg && <span className="text-xs text-emerald-600">{installMsg}</span>}
                </div>
              </div>

              {detected && (
                <div className="rounded-xl border border-neutral-300 bg-white p-4">
                  <p className="mb-2 text-sm font-semibold text-neutral-800">Detectado — confirme o que implementar:</p>
                  {detected.length === 0 ? <p className="text-sm text-neutral-500">Nada reconhecido. Confira o que colou.</p> : (
                    <div className="space-y-1">
                      {detected.map((d, i) => (
                        <label key={i} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${d.target === "info" ? "bg-neutral-50" : "bg-blue-50"}`}>
                          <input type="checkbox" disabled={d.target === "info"} checked={d.target === "info" ? true : detSel[i] ?? false} onChange={(e) => setDetSel((s) => s.map((v, idx) => (idx === i ? e.target.checked : v)))} />
                          <span className="font-medium text-neutral-700">{d.label}</span>
                          <span className="text-xs text-neutral-400">{d.where}</span>
                          {d.target !== "info" && d.target !== "head_raw" && <code className="ml-auto truncate text-xs text-neutral-500">{d.value}</code>}
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={applyDetected} disabled={detected.filter((d) => d.target !== "info").length === 0} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40">Implementar selecionados</button>
                    <button type="button" onClick={() => setDetected(null)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">Cancelar</button>
                  </div>
                </div>
              )}

              <button type="button" onClick={() => setShowAdvanced((s) => !s)} className="text-sm font-medium text-blue-600 hover:underline">
                {showAdvanced ? "▾ Ocultar campos individuais" : "▸ Campos individuais (avançado)"}
              </button>
              {showAdvanced && (
                <div className="space-y-4 border-t border-neutral-200 pt-4">
                  <label className="block"><span className={labelCls}>UTMify Pixel ID (Facebook)</span>
                    <div className="flex gap-2">
                      <input className={inputCls} value={funnel.utmifyPixelId ?? ""} onChange={(e) => onPatch({ utmifyPixelId: e.target.value || undefined })} />
                      <button type="button" onClick={async () => { const meta = await resolveMetaPixel((funnel.utmifyPixelId ?? "").trim()); setInstallMsg(meta ? `✓ Pixel da Meta: ${meta}. Salve.` : "Não resolvi o número da Meta."); }} disabled={resolving || !(funnel.utmifyPixelId ?? "").trim()} className="shrink-0 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50">{resolving ? "Buscando…" : "Resolver Meta"}</button>
                    </div>
                  </label>
                  <label className="block"><span className={labelCls}>Facebook Pixel ID (numérico)</span><input className={inputCls} value={pixels.facebook_pixel_id ?? ""} onChange={(e) => setPixel("facebook_pixel_id", e.target.value)} /></label>
                  <label className="block"><span className={labelCls}>UTMify Google Pixel ID</span><input className={inputCls} value={pixels.utmify_google_pixel_id ?? ""} onChange={(e) => setPixel("utmify_google_pixel_id", e.target.value)} /></label>
                  <label className="block"><span className={labelCls}>Hotmart Account ID (launcher UTMify)</span><input className={inputCls} value={funnel.hotmartAccountId ?? ""} onChange={(e) => onPatch({ hotmartAccountId: e.target.value || undefined })} /></label>
                  <label className="block"><span className={labelCls}>Google Analytics ID</span><input className={inputCls} placeholder="G-XXXXXXXXXX" value={pixels.google_analytics_id ?? ""} onChange={(e) => setPixel("google_analytics_id", e.target.value)} /></label>
                  <label className="block"><span className={labelCls}>Google Tag Manager ID</span><input className={inputCls} placeholder="GTM-XXXXXXX" value={pixels.gtm_id ?? ""} onChange={(e) => setPixel("gtm_id", e.target.value)} /></label>
                  <label className="block"><span className={labelCls}>Script — Head</span><textarea className={taCls} rows={3} value={pixels.head_script ?? ""} onChange={(e) => setPixel("head_script", e.target.value)} /></label>
                  <label className="block"><span className={labelCls}>Script — Body</span><textarea className={taCls} rows={3} value={pixels.body_script ?? ""} onChange={(e) => setPixel("body_script", e.target.value)} /></label>
                </div>
              )}
            </div>
          )}

          {tab === "seo" && (
            <div className="max-w-lg space-y-4">
              <label className="block">
                <span className={labelCls}>Título do site (aba do navegador / Google)</span>
                <input className={inputCls} placeholder={funnel.name} value={seo.title ?? ""} onChange={(e) => setSeo("title", e.target.value)} />
              </label>
              <label className="block">
                <span className={labelCls}>Descrição (meta description)</span>
                <textarea className={inputCls} rows={2} value={seo.description ?? ""} onChange={(e) => setSeo("description", e.target.value)} />
              </label>
              <label className="block">
                <span className={labelCls}>Favicon (URL — ícone da aba)</span>
                <input className={inputCls} placeholder="https://…/favicon.png" value={seo.favicon ?? ""} onChange={(e) => setSeo("favicon", e.target.value)} />
                {seo.favicon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={seo.favicon} alt="" className="mt-2 h-8 w-8 rounded border border-neutral-200 object-contain" />
                ) : null}
              </label>
              <label className="block">
                <span className={labelCls}>Imagem de compartilhamento (OG — preview no WhatsApp/links)</span>
                <input className={inputCls} placeholder="https://…/og.jpg" value={seo.ogImage ?? ""} onChange={(e) => setSeo("ogImage", e.target.value)} />
              </label>
            </div>
          )}

          {tab === "webhooks" && (
            <div className="space-y-3">
              <p className="text-xs text-neutral-500">Dispara no formato inlead (campos <b>nome</b>, <b>telefone</b>, <b>{"{componente}"}: clicked</b>) — casa com os mapeamentos do Datacrazy.</p>
              {webhooks.map((w, i) => (
                <div key={w.id} className="space-y-2 rounded-xl border border-neutral-200 p-3">
                  <div className="flex items-center gap-2">
                    <input className={inputCls + " flex-1"} placeholder="Nome (ex: Datacrazy - Captura)" value={w.name ?? ""} onChange={(e) => patchWh(i, { name: e.target.value })} />
                    <label className="flex items-center gap-1 text-xs font-semibold text-neutral-600"><input type="checkbox" checked={w.enabled} onChange={(e) => patchWh(i, { enabled: e.target.checked })} className="accent-blue-600" /> Ativo</label>
                    <button onClick={() => delWh(i)} className="text-sm text-red-500">✕</button>
                  </div>
                  <input className={inputCls} placeholder="https://webhook.datacrazy.io/..." value={w.api_url} onChange={(e) => patchWh(i, { api_url: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <select className={inputCls} value={w.method} onChange={(e) => patchWh(i, { method: e.target.value as FunnelWebhook["method"] })}><option value="POST">POST</option><option value="GET">GET</option></select>
                    <select className={inputCls} value={w.content_type} onChange={(e) => patchWh(i, { content_type: e.target.value as FunnelWebhook["content_type"] })}><option value="formData">form-urlencoded</option><option value="json">JSON</option></select>
                    <select className={inputCls} value={w.trigger_event} onChange={(e) => patchWh(i, { trigger_event: e.target.value as FunnelWebhook["trigger_event"] })}><option value="lead_capture">Captura de lead</option><option value="click_component">Click em componente</option></select>
                    <input className={inputCls} placeholder="component_id" value={w.component_id ?? ""} onChange={(e) => patchWh(i, { component_id: e.target.value || undefined })} />
                  </div>
                  <input className={inputCls} placeholder="Token (Bearer, opcional)" value={w.token ?? ""} onChange={(e) => patchWh(i, { token: e.target.value || undefined })} />
                </div>
              ))}
              <button onClick={addWh} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white">+ Webhook</button>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          <span className="mr-auto text-xs text-neutral-400">As alterações entram ao clicar em <b>💾 Salvar</b> no construtor.</span>
          <button onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Concluir</button>
        </footer>
      </div>
    </div>
  );
}
