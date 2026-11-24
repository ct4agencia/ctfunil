"use client";
import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";

import { useEffect, useId, useRef, useState } from "react";
import AvailabilityScheduler from "@/components/ui/AvailabilityScheduler";
import ActiveTab from "@/components/ui/ActiveTab";
import { Button } from "@/components/referencias/beui/motion/button/base";
import DeleteConfirmationIcon from "@/components/ui/DeleteConfirmationIcon";
import { Eye, EyeOff, X } from "lucide-react";
import type { Funnel, FunnelPixels, FunnelSettings, FunnelWebhook, WeekAvailability } from "@/lib/quiz/types";

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

type Tab = "geral" | "pixels" | "seo" | "webhooks" | "horarios";

const emptyDay = { enabled: false, ranges: [] };
const emptySchedule: WeekAvailability = {
  mon: emptyDay, tue: emptyDay, wed: emptyDay, thu: emptyDay,
  fri: emptyDay, sat: emptyDay, sun: emptyDay,
};

export default function FunnelSettingsPanel({
  funnel, onPatch, onClose, sourceSlug,
}: { funnel: Funnel; onPatch: (patch: Partial<Funnel>) => void; onClose: () => void; sourceSlug?: string }) {
  const [tab, setTab] = useState<Tab>("geral");
  const [visibleTokens, setVisibleTokens] = useState<Record<string, boolean>>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const panel = dialog.current;
    panel?.showModal();
    return () => panel?.close();
  }, []);
  function closeSettings() {
    dialog.current?.close();
    onClose();
  }

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

  const [published, setPublished] = useState<{ rows?: { id: string; name?: string; host?: string; method?: string; trigger_event?: string; component_id?: string; enabled?: boolean }[]; error?: string; sessionExpired?: boolean }>({});
  const [webhookAttempt, setWebhookAttempt] = useState(0);
  useEffect(() => {
    if (tab !== "webhooks" || !sourceSlug) return;
    const controller = new AbortController();
    setPublished({});
    fetch(`/api/workspace-webhooks?slug=${encodeURIComponent(sourceSlug)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setPublished({ error: "Sua sessão expirou. Entre novamente para consultar os webhooks.", sessionExpired: true });
          return;
        }
        const data = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(data?.webhooks)) {
          throw Error(typeof data?.error === "string" ? data.error : "Não foi possível consultar os webhooks.");
        }
        if (!controller.signal.aborted) setPublished({ rows: data.webhooks });
      })
      .catch(error => { if (!controller.signal.aborted) setPublished({ error: error instanceof TypeError ? "Não foi possível conectar para consultar os webhooks." : error.message }); });
    return () => controller.abort();
  }, [tab, sourceSlug, webhookAttempt]);
  // Webhooks
  const webhooks = funnel.webhooks ?? [];
  const [pendingWebhookDelete, setPendingWebhookDelete] = useState<string | null>(null);
  const webhookDeleteTrigger = useRef<HTMLButtonElement>(null);
  const webhookDeleteCancel = useRef<HTMLButtonElement>(null);
  const addWebhookButton = useRef<HTMLButtonElement>(null);
  const webhookConfirmationId = useId();
  const patchWh = (i: number, patch: Partial<FunnelWebhook>) => onPatch({ webhooks: webhooks.map((w, k) => (k === i ? { ...w, ...patch } : w)) });
  const addWh = () => onPatch({ webhooks: [...webhooks, { id: `wh-${Math.random().toString(36).slice(2, 8)}`, name: "", api_url: "", method: "POST", content_type: "formData", trigger_event: "lead_capture", enabled: true }] });
  function resolveWebhookDelete(id: string, removed: boolean) {
    setPendingWebhookDelete(null);
    if (removed) onPatch({ webhooks: webhooks.filter(webhook => webhook.id !== id) });
    requestAnimationFrame(() => (removed ? addWebhookButton.current : webhookDeleteTrigger.current)?.focus());
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "geral", label: "Geral" },
    { key: "pixels", label: "Pixel e scripts" },
    { key: "seo", label: "SEO e favicon" },
    { key: "webhooks", label: "Webhooks" },
    { key: "horarios", label: "Horários" },
  ];

  return (
    <dialog ref={dialog} aria-labelledby={titleId} className="ct-settings-modal ct-controls"
      onCancel={event => { event.preventDefault(); closeSettings(); }}
      onClick={event => { if (event.target === dialog.current) closeSettings(); }}>
      <div className="ct-settings-surface">
        <header className="ct-settings-header">
          <h2 id={titleId} className="text-base font-bold">Configurações de {funnel.name}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={closeSettings} className="ct-icon-button" aria-label="Fechar configurações"><X size={18} aria-hidden="true" /></Button>
        </header>
        <nav className="ct-segments ct-settings-tabs" aria-label="Seções das configurações">
          {tabs.map(t => <button type="button" key={t.key} onClick={() => { setPendingWebhookDelete(null); setVisibleTokens({}); setTab(t.key); }} aria-pressed={tab === t.key}>
            {tab === t.key && <ActiveTab group="settings-tabs" />}<span>{t.label}</span>
          </button>)}
        </nav>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {tab === "horarios" && <AvailabilityScheduler value={funnel.settings?.availability ?? emptySchedule}
            onChange={availability => onPatch({ settings: { ...funnel.settings, availability } })} />}
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
                <span className={labelCls}>Domínio público do funil</span>
                <input className={inputCls} placeholder="viverdebolsas.com.br" value={funnel.domain ?? ""}
                  onChange={(e) => onPatch({ domain: e.target.value || undefined })}
                  onBlur={(e) => onPatch({ domain: e.target.value ? e.target.value.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") || undefined : undefined })} />
                <span className="mt-1 block text-[11px] text-neutral-400">
                  O funil abre em <b>{funnel.domain || "seudominio.com.br"}/{funnel.slug || "slug"}</b> (usado também no botão <b>Ver ao vivo</b>).
                  {" "}A <b>raiz</b> ({funnel.domain || "seudominio.com.br"}) <b>não aponta pra nenhum funil</b> — cada funil é um slug. Cadastre o domínio na Vercel + DNS.
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
                <span className={labelCls}>Objetivo do funil</span><input className={inputCls} value={funnel.settings?.objective || ''} onChange={e=>onPatch({settings:{...funnel.settings,objective:e.target.value}})}/>
              </label>
              <label className="block"><span className={labelCls}>Tom de comunicação</span><input className={inputCls} value={funnel.settings?.tone || ''} onChange={e=>onPatch({settings:{...funnel.settings,tone:e.target.value}})}/></label>
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
              {sourceSlug && <section className="space-y-2 rounded-xl border border-ct-line p-3" aria-label="Webhooks publicados">
                <h3 className="font-semibold">Webhooks publicados</h3>
                {published.error ? <div className="space-y-2">
                  <p role="alert" className="text-sm text-ct-ink">{published.error}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    {published.sessionExpired && <a className="text-sm text-ct-blue underline"
                      href={`/admin/login?${new URLSearchParams({ next: location.pathname + location.search + location.hash })}`}
                      target="_blank" rel="noopener noreferrer">Entrar novamente em outra aba</a>}
                    <button type="button" onClick={() => setWebhookAttempt(value => value + 1)}
                      className="ct-primary min-h-11 rounded-lg px-3 text-sm font-semibold">
                      {published.sessionExpired ? "Verificar sessão" : "Tentar novamente"}
                    </button>
                  </div>
                </div> : !published.rows?.length && <p role="status" className="text-sm text-ct-dim">
                  {published.rows ? "Nenhum webhook cadastrado neste funil." : "Consultando webhooks…"}
                </p>}
                {published.rows?.map(webhook => <article key={webhook.id} className="rounded-lg bg-ct-raised p-3 text-sm">
                  <strong>{webhook.name || webhook.host || "Webhook"}</strong>
                  <p className="break-words text-ct-dim">{[webhook.host, webhook.method, webhook.trigger_event === "lead_capture" ? "Captura de lead" : webhook.trigger_event === "click_component" ? "Clique em componente" : webhook.trigger_event === "vsl_progress" ? "Progresso da VSL" : "Disparo indisponível", webhook.component_id, webhook.enabled === undefined ? "Estado indisponível" : webhook.enabled ? "Ativo" : "Desativado"].filter(Boolean).join(" · ")}</p>
                </article>)}
                <p className="text-xs text-ct-dim">Consulta da configuração publicada. Endereço completo e token ficam protegidos.</p>
              </section>}
              {sourceSlug && <h3 className="text-sm font-semibold">Webhooks do rascunho</h3>}
              {webhooks.map((w, i) => (
                <div key={w.id} className="space-y-2 rounded-xl border border-neutral-200 p-3" onKeyDown={event => {
                  if (pendingWebhookDelete !== w.id || event.key !== "Escape") return;
                  event.preventDefault();
                  resolveWebhookDelete(w.id, false);
                }}>
                  <div className="flex items-center gap-2">
                    <input className={inputCls + " min-w-0 flex-1"} placeholder="Nome (ex: Datacrazy - Captura)" value={w.name ?? ""} onChange={(e) => patchWh(i, { name: e.target.value })} />
                    <label className="flex items-center gap-1 text-xs font-semibold text-neutral-600"><input type="checkbox" checked={w.enabled} onChange={(e) => patchWh(i, { enabled: e.target.checked })} className="accent-blue-600" /> Ativo</label>
                    <button type="button" aria-label="Remover webhook" aria-expanded={pendingWebhookDelete === w.id}
                      aria-controls={`${webhookConfirmationId}-${i}`} className="ct-step-control shrink-0 text-red-600"
                      onClick={event => {
                        if (pendingWebhookDelete === w.id) {
                          resolveWebhookDelete(w.id, false);
                          return;
                        }
                        webhookDeleteTrigger.current = event.currentTarget;
                        setPendingWebhookDelete(w.id);
                        requestAnimationFrame(() => webhookDeleteCancel.current?.focus());
                      }}>✕</button>
                  </div>
                  <div id={`${webhookConfirmationId}-${i}`}>
                    {pendingWebhookDelete === w.id && <div role="group" aria-label="Confirmar remoção de webhook" className="ct-group-delete-confirmation space-y-2 rounded-lg border border-ct-line p-2">
                      <div className="flex items-center gap-2"><DeleteConfirmationIcon /><p className="text-sm">Remover {w.name?.trim() || "este webhook"}?</p></div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button ref={webhookDeleteCancel} type="button" className="ct-step-control" onClick={() => resolveWebhookDelete(w.id, false)}>Cancelar</button>
                        <button type="button" className="ct-step-control text-red-600" onClick={() => resolveWebhookDelete(w.id, true)}>Confirmar remoção</button>
                      </div>
                    </div>}
                  </div>
                  <input className={inputCls} placeholder="https://webhook.datacrazy.io/..." value={w.api_url} onChange={(e) => patchWh(i, { api_url: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <WorkspaceSelect label="Método" value={w.method} onChange={value=>patchWh(i,{method:value as FunnelWebhook['method']})} options={[{value:'POST',label:'POST'},{value:'GET',label:'GET'}]}/>
                    <WorkspaceSelect label="Formato" value={w.content_type} onChange={value=>patchWh(i,{content_type:value as FunnelWebhook['content_type']})} options={[{value:'formData',label:'form-urlencoded'},{value:'json',label:'JSON'}]}/>
                    <WorkspaceSelect label="Quando enviar" value={w.trigger_event} onChange={value=>patchWh(i,{trigger_event:value as FunnelWebhook['trigger_event']})} options={[{value:'lead_capture',label:'Captura de lead'},{value:'click_component',label:'Clique em componente'}]}/>
                    <input className={inputCls} placeholder="component_id" value={w.component_id ?? ""} onChange={(e) => patchWh(i, { component_id: e.target.value || undefined })} />
                  </div>
                  <label className="ct-settings-token" onBlur={event => {
                    if (!event.currentTarget.contains(event.relatedTarget) && visibleTokens[w.id]) {
                      setVisibleTokens(tokens => ({ ...tokens, [w.id]: false }));
                    }
                  }}><span className="sr-only">Token do webhook</span>
                    <input className={inputCls} type={visibleTokens[w.id] ? "text" : "password"} autoComplete="off" spellCheck={false} placeholder="Token (Bearer, opcional)" value={w.token ?? ""} onChange={e => patchWh(i, { token: e.target.value || undefined })} />
                    <Button type="button" variant="ghost" size="icon" className="ct-icon-button" aria-pressed={!!visibleTokens[w.id]} aria-label={visibleTokens[w.id] ? "Ocultar token" : "Mostrar token"}
                      onClick={() => setVisibleTokens(tokens => ({ ...tokens, [w.id]: !tokens[w.id] }))}>
                      {visibleTokens[w.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </label>
                </div>
              ))}
              <Button ref={addWebhookButton} type="button" variant="secondary" size="sm" onClick={addWh} className="min-h-11 rounded-lg border-ct-line bg-ct-raised text-ct-ink">+ Webhook</Button>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          <span className="mr-auto text-xs text-neutral-400">As alterações entram ao clicar em <b>💾 Salvar</b> no construtor.</span>
          <Button type="button" variant="primary" onClick={closeSettings} className="ct-action-link shrink-0">Concluir</Button>
        </footer>
      </div>
    </dialog>
  );
}
