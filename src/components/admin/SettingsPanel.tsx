"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateVsl } from "@/app/admin/actions";
import { slugify, normalizeDomain } from "@/lib/text";
import type { Vsl, VslSettings, Webhook } from "@/lib/types";
import WebhooksManager from "@/components/admin/WebhooksManager";
import ImageField from "@/components/admin/ImageField";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500";
const labelCls = "mb-1 block text-sm font-medium text-slate-700";
const taCls = inputCls + " font-mono text-xs";

// ── Smart Install: detecta scripts colados e mapeia pros campos ──
type DetTarget =
  | "utmify_fb"
  | "utmify_google"
  | "hotmart"
  | "ga"
  | "gtm"
  | "fb_pixel"
  | "site_verify"
  | "head_raw"
  | "info";

type Detected = {
  label: string;
  where: string;
  value: string;
  target: DetTarget;
};

function detectScripts(text: string): Detected[] {
  const out: Detected[] = [];
  const seen = new Set<string>();
  const push = (d: Detected) => {
    const k = d.target + d.value;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(d);
    }
  };
  let m: RegExpMatchArray | null;

  if ((m = text.match(/window\.pixelId\s*=\s*["']([a-fA-F0-9]{20,})["']/)))
    push({ label: "Pixel UTMify (Facebook)", where: "→ UTMify Pixel ID", value: m[1], target: "utmify_fb" });
  if ((m = text.match(/window\.googlePixelId\s*=\s*["']([a-fA-F0-9]{20,})["']/)))
    push({ label: "Pixel UTMify (Google)", where: "→ UTMify Google Pixel ID", value: m[1], target: "utmify_google" });
  if ((m = text.match(/hot\(\s*['"]account['"]\s*,\s*['"]([0-9a-fA-F-]{8,})['"]\s*\)/)))
    push({ label: "Hotmart Launcher", where: "→ Hotmart Account ID", value: m[1], target: "hotmart" });
  if ((m = text.match(/gtag\/js\?id=(G-[A-Z0-9]+)/)) || (m = text.match(/['"](G-[A-Z0-9]+)['"]/)))
    push({ label: "Google Analytics (GA4)", where: "→ Google Analytics ID", value: m[1], target: "ga" });
  if ((m = text.match(/(GTM-[A-Z0-9]+)/)))
    push({ label: "Google Tag Manager", where: "→ Google Tag Manager ID", value: m[1], target: "gtm" });
  if ((m = text.match(/fbq\(\s*['"]init['"]\s*,\s*['"]([0-9]{6,})['"]/)))
    push({ label: "Facebook Pixel (Meta)", where: "→ Facebook Pixel ID", value: m[1], target: "fb_pixel" });
  if ((m = text.match(/google-site-verification["']?[^>]*content=["']([^"']+)["']/)) ||
      (m = text.match(/content=["']([^"']+)["'][^>]*google-site-verification/)))
    push({ label: "Google Site Verification", where: "→ Google Site Verification", value: m[1], target: "site_verify" });
  if (/utms\/latest\.js/.test(text))
    push({ label: "UTMs UTMify (persistência)", where: "automático — vem com o pixel UTMify", value: "latest.js", target: "info" });

  const actionable = out.filter((d) => d.target !== "info");
  if (actionable.length === 0 && text.trim().length > 0)
    push({ label: "Script não reconhecido", where: "→ Script — Head (cru)", value: "(script completo)", target: "head_raw" });

  return out;
}

type Tab = "geral" | "pixels" | "seo" | "webhooks";

function SaveBar({
  pending,
  saved,
  onSave,
}: {
  pending: boolean;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        onClick={onSave}
        disabled={pending}
        className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {pending ? "Salvando..." : "Salvar"}
      </button>
      {saved && <span className="text-sm text-emerald-600">Salvo.</span>}
    </div>
  );
}

export default function SettingsPanel({
  vsl,
  webhooks,
}: {
  vsl: Vsl;
  webhooks: Webhook[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("geral");

  // ── estado Geral ──
  const [geral, setGeral] = useState({
    name: vsl.name,
    slug: vsl.slug,
    domain: vsl.domain,
    niche: vsl.niche,
    status: vsl.status,
  });

  // ── estado settings (pixels + seo) ──
  const [settings, setSettings] = useState<VslSettings>(vsl.settings ?? {});
  const [utmifyPixel, setUtmifyPixel] = useState(vsl.utmify_pixel_id ?? "");
  const [hotmartAccount, setHotmartAccount] = useState(
    vsl.hotmart_account_id ?? "",
  );

  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Smart Install
  const [pasteText, setPasteText] = useState("");
  const [detected, setDetected] = useState<Detected[] | null>(null);
  const [detSel, setDetSel] = useState<boolean[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [installMsg, setInstallMsg] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  function setPixel(k: keyof NonNullable<VslSettings["pixels"]>, v: string) {
    setSettings((s) => ({ ...s, pixels: { ...s.pixels, [k]: v || undefined } }));
    setSaved(false);
  }

  function runDetect() {
    const det = detectScripts(pasteText);
    setDetected(det);
    setDetSel(det.map((d) => d.target !== "info"));
    setInstallMsg(null);
  }

  /**
   * Resolve o Pixel da Meta (numérico) a partir do Pixel ID do UTMify e
   * preenche o campo Facebook Pixel ID sozinho — sem o usuário copiar nada.
   */
  async function resolveMetaPixel(utmifyId: string): Promise<string | null> {
    if (!/^[a-fA-F0-9]{20,}$/.test(utmifyId)) return null;
    setResolving(true);
    try {
      const res = await fetch("/api/resolve-meta-pixel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utmifyPixelId: utmifyId }),
      });
      const data = await res.json();
      const meta: string | undefined = data?.metaPixelIds?.[0];
      if (meta) {
        setPixel("facebook_pixel_id", meta);
        return meta;
      }
      return null;
    } catch {
      return null;
    } finally {
      setResolving(false);
    }
  }

  async function applyDetected() {
    if (!detected) return;
    let n = 0;
    let utmifyToResolve: string | null = null;
    detected.forEach((d, i) => {
      if (!detSel[i] || d.target === "info") return;
      n++;
      switch (d.target) {
        case "utmify_fb": setUtmifyPixel(d.value); utmifyToResolve = d.value; break;
        case "utmify_google": setPixel("utmify_google_pixel_id", d.value); break;
        case "hotmart": setHotmartAccount(d.value); break;
        case "ga": setPixel("google_analytics_id", d.value); break;
        case "gtm": setPixel("gtm_id", d.value); break;
        case "fb_pixel": setPixel("facebook_pixel_id", d.value); break;
        case "site_verify": setPixel("google_site_verification", d.value); break;
        case "head_raw":
          setPixel("head_script", ((settings.pixels?.head_script || "") + "\n" + pasteText).trim());
          break;
      }
    });
    setDetected(null);
    setPasteText("");
    if (utmifyToResolve) {
      setInstallMsg(`${n} item(ns) preenchido(s). Buscando o Pixel da Meta na UTMify...`);
      const meta = await resolveMetaPixel(utmifyToResolve);
      setInstallMsg(
        meta
          ? `✓ ${n} item(ns) + Pixel da Meta resolvido automaticamente: ${meta}. Clique em Salvar.`
          : `${n} item(ns) preenchido(s). Não consegui resolver o número da Meta (confira a config na UTMify). Clique em Salvar.`,
      );
    } else {
      setInstallMsg(`${n} item(ns) preenchido(s). Clique em Salvar pra confirmar.`);
    }
  }
  function setSeo(k: keyof NonNullable<VslSettings["seo"]>, v: string) {
    setSettings((s) => ({ ...s, seo: { ...s.seo, [k]: v || undefined } }));
    setSaved(false);
  }

  function saveGeral() {
    setError(null);
    startTransition(async () => {
      const res = await updateVsl(vsl.id, {
        name: geral.name,
        slug: geral.slug,
        domain: geral.domain,
        niche: geral.niche,
        status: geral.status,
      });
      if (res?.error) setError(res.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  function saveSettings(extra: Partial<Vsl> = {}) {
    setError(null);
    startTransition(async () => {
      const res = await updateVsl(vsl.id, { settings, ...extra });
      if (res?.error) setError(res.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "geral", label: "Geral" },
    { key: "pixels", label: "Pixel / Scripts" },
    { key: "seo", label: "SEO & Favicon" },
    { key: "webhooks", label: "Webhooks" },
  ];

  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      {/* Sidebar */}
      <aside className="sm:w-48 sm:shrink-0">
        <nav className="flex gap-1 overflow-x-auto sm:flex-col">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setSaved(false);
                setError(null);
              }}
              className={
                "whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition " +
                (tab === t.key
                  ? "bg-sky-50 text-sky-700"
                  : "text-slate-600 hover:bg-slate-100")
              }
            >
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Conteúdo */}
      <div className="flex-1">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {tab === "geral" && (
          <div className="max-w-xl space-y-4">
            <label className="block">
              <span className={labelCls}>Título / Nome</span>
              <input
                className={inputCls}
                value={geral.name}
                onChange={(e) => {
                  setGeral((g) => ({ ...g, name: e.target.value }));
                  setSaved(false);
                }}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Slug</span>
              <input
                className={inputCls}
                value={geral.slug}
                onChange={(e) => {
                  setGeral((g) => ({ ...g, slug: slugify(e.target.value) }));
                  setSaved(false);
                }}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Domínio próprio</span>
              <input
                className={inputCls}
                placeholder="meudominio.com.br"
                value={geral.domain ?? ""}
                onChange={(e) => {
                  setGeral((g) => ({ ...g, domain: e.target.value || null }));
                  setSaved(false);
                }}
                onBlur={(e) =>
                  setGeral((g) => ({
                    ...g,
                    domain: e.target.value ? normalizeDomain(e.target.value) : null,
                  }))
                }
              />
              <span className="mt-1 block text-xs text-slate-400">
                A página fica em <strong>domínio/slug</strong> (ex:{" "}
                {(geral.domain || "seudominio.com.br")}/{geral.slug || "slug"}).
                Pode repetir o mesmo domínio em vários testes (slug diferente).
                No deploy, aponte o DNS pro Vercel.
              </span>
            </label>
            <label className="block">
              <span className={labelCls}>Nicho</span>
              <input
                className={inputCls}
                value={geral.niche ?? ""}
                onChange={(e) => {
                  setGeral((g) => ({ ...g, niche: e.target.value || null }));
                  setSaved(false);
                }}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Status</span>
              <select
                className={inputCls}
                value={geral.status}
                onChange={(e) => {
                  setGeral((g) => ({
                    ...g,
                    status: e.target.value as Vsl["status"],
                  }));
                  setSaved(false);
                }}
              >
                <option value="draft">Rascunho (não público)</option>
                <option value="published">Publicada</option>
              </select>
            </label>
            <SaveBar pending={pending} saved={saved} onSave={saveGeral} />
          </div>
        )}

        {tab === "pixels" && (
          <div className="max-w-xl space-y-4">
            {/* Smart Install — colar e implementar */}
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-sm font-semibold text-slate-800">
                ⚡ Colar e implementar
              </p>
              <p className="mb-2 text-xs text-slate-500">
                Cole os scripts que o gestor mandar (UTMify, Hotmart, Google,
                Meta…). O app detecta o que é cada um e mostra onde vai.
              </p>
              <textarea
                className={taCls}
                rows={4}
                placeholder="Cole aqui os <script>...</script>"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={runDetect}
                  disabled={!pasteText.trim()}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
                >
                  Detectar e implementar
                </button>
                {installMsg && (
                  <span className="text-xs text-emerald-600">{installMsg}</span>
                )}
              </div>
            </div>

            {/* Painel de confirmação */}
            {detected && (
              <div className="rounded-xl border border-slate-300 bg-white p-4">
                <p className="mb-2 text-sm font-semibold text-slate-800">
                  Detectado — confirme o que implementar:
                </p>
                {detected.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nada reconhecido. Confira o que você colou.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {detected.map((d, i) => (
                      <label
                        key={i}
                        className={
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm " +
                          (d.target === "info" ? "bg-slate-50" : "bg-sky-50")
                        }
                      >
                        <input
                          type="checkbox"
                          disabled={d.target === "info"}
                          checked={d.target === "info" ? true : detSel[i] ?? false}
                          onChange={(e) =>
                            setDetSel((s) =>
                              s.map((v, idx) => (idx === i ? e.target.checked : v)),
                            )
                          }
                        />
                        <span className="font-medium text-slate-700">{d.label}</span>
                        <span className="text-xs text-slate-400">{d.where}</span>
                        {d.target !== "info" && d.target !== "head_raw" && (
                          <code className="ml-auto truncate text-xs text-slate-500">
                            {d.value}
                          </code>
                        )}
                      </label>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={applyDetected}
                    disabled={
                      detected.filter((d) => d.target !== "info").length === 0
                    }
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
                  >
                    Implementar selecionados
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetected(null)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Campos individuais (avançado) */}
            <button
              type="button"
              onClick={() => setShowAdvanced((s) => !s)}
              className="text-sm font-medium text-sky-600 hover:underline"
            >
              {showAdvanced
                ? "▾ Ocultar campos individuais"
                : "▸ Campos individuais (avançado)"}
            </button>

            {showAdvanced && (
              <div className="space-y-4 border-t border-slate-200 pt-4">
                <label className="block">
                  <span className={labelCls}>Google Analytics ID</span>
                  <input className={inputCls} placeholder="G-XXXXXXXXXX" value={settings.pixels?.google_analytics_id ?? ""} onChange={(e) => setPixel("google_analytics_id", e.target.value)} />
                </label>
                <label className="block">
                  <span className={labelCls}>Google Tag Manager ID</span>
                  <input className={inputCls} placeholder="GTM-XXXXXXX" value={settings.pixels?.gtm_id ?? ""} onChange={(e) => setPixel("gtm_id", e.target.value)} />
                </label>
                <label className="block">
                  <span className={labelCls}>Google Site Verification</span>
                  <input className={inputCls} value={settings.pixels?.google_site_verification ?? ""} onChange={(e) => setPixel("google_site_verification", e.target.value)} />
                </label>
                <label className="block">
                  <span className={labelCls}>Facebook Pixel ID</span>
                  <input className={inputCls} value={settings.pixels?.facebook_pixel_id ?? ""} onChange={(e) => setPixel("facebook_pixel_id", e.target.value)} />
                  <span className="mt-1 block text-xs text-slate-400">
                    Preenchido automaticamente a partir do UTMify Pixel ID. É o pixel numérico que o Meta Pixel Helper detecta.
                  </span>
                </label>
                <label className="block">
                  <span className={labelCls}>UTMify Pixel ID (Facebook)</span>
                  <div className="flex gap-2">
                    <input className={inputCls} value={utmifyPixel} onChange={(e) => { setUtmifyPixel(e.target.value); setSaved(false); }} />
                    <button
                      type="button"
                      onClick={async () => {
                        const meta = await resolveMetaPixel(utmifyPixel.trim());
                        setInstallMsg(
                          meta
                            ? `✓ Pixel da Meta resolvido: ${meta}. Clique em Salvar.`
                            : "Não consegui resolver o número da Meta (confira a config na UTMify).",
                        );
                      }}
                      disabled={resolving || !utmifyPixel.trim()}
                      className="shrink-0 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                    >
                      {resolving ? "Buscando..." : "Resolver Meta"}
                    </button>
                  </div>
                </label>
                <label className="block">
                  <span className={labelCls}>UTMify Google Pixel ID</span>
                  <input className={inputCls} value={settings.pixels?.utmify_google_pixel_id ?? ""} onChange={(e) => setPixel("utmify_google_pixel_id", e.target.value)} />
                </label>
                <label className="block">
                  <span className={labelCls}>Hotmart Account ID (launcher UTMify)</span>
                  <input className={inputCls} value={hotmartAccount} onChange={(e) => { setHotmartAccount(e.target.value); setSaved(false); }} />
                </label>
                <label className="block">
                  <span className={labelCls}>Script — Head</span>
                  <textarea className={taCls} rows={4} value={settings.pixels?.head_script ?? ""} onChange={(e) => setPixel("head_script", e.target.value)} />
                </label>
                <label className="block">
                  <span className={labelCls}>Script — Body</span>
                  <textarea className={taCls} rows={3} value={settings.pixels?.body_script ?? ""} onChange={(e) => setPixel("body_script", e.target.value)} />
                </label>
                <label className="block">
                  <span className={labelCls}>Script — Footer</span>
                  <textarea className={taCls} rows={3} value={settings.pixels?.footer_script ?? ""} onChange={(e) => setPixel("footer_script", e.target.value)} />
                </label>
              </div>
            )}

            <SaveBar
              pending={pending}
              saved={saved}
              onSave={() =>
                saveSettings({
                  utmify_pixel_id: utmifyPixel || null,
                  hotmart_account_id: hotmartAccount || null,
                })
              }
            />
          </div>
        )}

        {tab === "seo" && (
          <div className="max-w-xl space-y-4">
            <label className="block">
              <span className={labelCls}>Título do site</span>
              <input
                className={inputCls}
                value={settings.seo?.title ?? ""}
                onChange={(e) => setSeo("title", e.target.value)}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Descrição</span>
              <textarea
                className={inputCls}
                rows={3}
                value={settings.seo?.description ?? ""}
                onChange={(e) => setSeo("description", e.target.value)}
              />
            </label>
            <ImageField
              label="Favicon (ícone da aba/página)"
              hint="Anexe a logo (ideal quadrada, ex: 512×512). Vira o ícone da aba do navegador."
              value={settings.seo?.favicon_url || null}
              onChange={(v) => setSeo("favicon_url", v || "")}
            />
            <ImageField
              label="Imagem principal / OG (preview de link)"
              hint="Imagem que aparece ao compartilhar o link (WhatsApp, etc)."
              value={settings.seo?.og_image_url || null}
              onChange={(v) => setSeo("og_image_url", v || "")}
            />
            <SaveBar
              pending={pending}
              saved={saved}
              onSave={() => saveSettings()}
            />
          </div>
        )}

        {tab === "webhooks" && (
          <WebhooksManager vslId={vsl.id} webhooks={webhooks} />
        )}
      </div>
    </div>
  );
}
