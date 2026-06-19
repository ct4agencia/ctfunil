import type { VslSettings } from "@/lib/types";
import RawScripts from "@/components/vsl/RawScripts";

/**
 * Renderiza os scripts de tracking SERVER-SIDE, pra entrarem no HTML e rodarem
 * JÁ NO CARREGAMENTO da página — igual a inlead faz no <head>. (A versão antiga
 * injetava via useEffect, que roda tarde demais e o pixel.js da UTMify não
 * engatava → não chegava na Meta.)
 *
 * Pixels conhecidos (UTMify Pixel + UTMs, UTMify Google, Meta, GA, GTM, Hotmart)
 * saem como <script> inline no SSR. Os scripts livres (head/body/footer) vão
 * pelo RawScripts (cliente), pois podem conter <script> arbitrário.
 */
export default function PixelScripts({
  settings,
  utmifyPixelId,
  hotmartAccountId,
}: {
  settings: VslSettings;
  utmifyPixelId: string | null;
  hotmartAccountId: string | null;
}) {
  const p = settings?.pixels ?? {};
  const inline: string[] = [];

  // UTMify (Pixel + persistência de UTMs → entrega na Meta via CAPI) — PRIMEIRO,
  // pra carregar o quanto antes, exatamente como no <head> da inlead.
  if (utmifyPixelId) {
    inline.push(
      `window.pixelId="${utmifyPixelId}";var s=document.createElement("script");s.async=1;s.defer=1;s.src="https://cdn.utmify.com.br/scripts/pixel/pixel.js";document.head.appendChild(s);`,
    );
  }

  // UTMify Google Pixel
  if (p.utmify_google_pixel_id) {
    inline.push(
      `window.googlePixelId="${p.utmify_google_pixel_id}";var g=document.createElement("script");g.async=1;g.defer=1;g.src="https://cdn.utmify.com.br/scripts/pixel/pixel-google.js";document.head.appendChild(g);`,
    );
  }

  // Meta Pixel (fbq) — só se houver ID numérico configurado
  if (p.facebook_pixel_id) {
    inline.push(
      `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${p.facebook_pixel_id}');fbq('track','PageView');`,
    );
  }

  // Google Analytics (gtag) — init inline; o loader externo vai no JSX abaixo
  if (p.google_analytics_id) {
    inline.push(
      `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${p.google_analytics_id}');`,
    );
  }

  // Google Tag Manager
  if (p.gtm_id) {
    inline.push(
      `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f)})(window,document,'script','dataLayer','${p.gtm_id}');`,
    );
  }

  // Hotmart Launcher (vinculação UTMify ↔ Hotmart)
  if (hotmartAccountId) {
    inline.push(
      `(function(l,a,u,n,c,h,e,r){l["HotmartLauncherObject"]=c;l[c]=l[c]||function(){(l[c].q=l[c].q||[]).push(arguments)};l[c].l=1*new Date();h=a.createElement(u);e=a.getElementsByTagName(u)[0];h.async=1;h.src=n;e.parentNode.insertBefore(h,e)})(window,document,"script","//launcher.hotmart.com/launcher.js","hot");hot("account","${hotmartAccountId}");`,
    );
  }

  return (
    <>
      {inline.map((code, i) => (
        // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
        <script key={i} dangerouslySetInnerHTML={{ __html: code }} />
      ))}
      {utmifyPixelId && (
        <script
          src="https://cdn.utmify.com.br/scripts/utms/latest.js"
          data-utmify-prevent-subids=""
          defer
        />
      )}
      {p.google_analytics_id && (
        <script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${p.google_analytics_id}`}
        />
      )}
      <RawScripts
        head={p.head_script}
        body={p.body_script}
        footer={p.footer_script}
      />
    </>
  );
}
