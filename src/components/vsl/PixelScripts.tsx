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
/**
 * Acha cada <script> de um trecho colado no painel.
 *
 * Regex e não parser de verdade porque isto roda no SERVIDOR, onde não existe
 * DOM, e trazer um parser de HTML para ler três tags seria peso desproporcional.
 * O conteúdo aqui é sempre um punhado de tags de pixel copiadas de UTMify,
 * Meta ou Hotmart — não é HTML arbitrário da internet.
 */
const RE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;

/** `src="x" async` → { src: "x", async: "" } */
function lerAtributos(bruto: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bruto))) attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? "";
  return attrs;
}

/**
 * Os <script> do campo, como elementos React — executam porque nascem no HTML,
 * em vez de serem inseridos depois por innerHTML (que o navegador ignora).
 */
function scriptsDoPainel(html?: string) {
  if (!html) return null;
  const saida: React.ReactElement[] = [];
  let m: RegExpExecArray | null;
  RE_SCRIPT.lastIndex = 0;
  while ((m = RE_SCRIPT.exec(html))) {
    const a = lerAtributos(m[1] || "");
    const corpo = m[2] || "";
    const chave = `ps-${saida.length}-${a.src || a.id || saida.length}`;
    saida.push(
      a.src
        ? <script key={chave} src={a.src} async={"async" in a} defer={"defer" in a} id={a.id} />
        : <script key={chave} id={a.id} dangerouslySetInnerHTML={{ __html: corpo }} />,
    );
  }
  return saida.length ? saida : null;
}

/** O mesmo trecho SEM os <script> — o resto ainda precisa do RawScripts. */
function semScripts(html?: string) {
  if (!html) return undefined;
  const resto = html.replace(RE_SCRIPT, "").trim();
  return resto || undefined;
}

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

  // Origem do Storage (só o host, nunca a chave) — usada no preconnect abaixo.
  // `URL` lança em valor malformado, e um preconnect a menos não pode derrubar
  // a página de um funil pago.
  let supabaseHost = "";
  try {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (u) supabaseHost = new URL(u).origin;
  } catch { /* env ausente ou inválida: segue sem preconnect */ }

  /**
   * AGENDADOR — define `__ct4defer(fn)`, que roda `fn` no PRIMEIRO de:
   *   1. a tela pintar o conteúdo principal (LCP) + 1 quadro de folga;
   *   2. o lead tocar, rolar ou digitar (já viu a página, a banda está livre);
   *   3. 3 s (teto, para quem fica parado com a aba aberta).
   *
   * POR QUE (medido em produção no cdb-01 — Pixel 7, 4G lento, CPU 4x):
   *   FCP 1.892 ms · LCP 9.860 ms · 4.808 ms de CPU travada antes do LCP.
   *   A imagem do hero terminava de baixar em 4.654 ms e só pintava em
   *   9.860 ms — cinco segundos pronta na memória, esperando a thread. As duas
   *   maiores travadas (1.270 ms e 1.297 ms) eram do fbevents.js, e UTMify +
   *   Hotmart entravam em ~1.500 ms disputando banda com a imagem.
   *
   * NENHUM EVENTO SE PERDE: o que é adiado é só o DOWNLOAD dos scripts. Os
   * stubs (`fbq('init')` + `fbq('track','PageView')`, `gtag('config')`,
   * `dataLayer`, `hot('account')`) continuam rodando no milissegundo zero e
   * enfileiram normalmente — a fila sai assim que o script chega. Mesmo
   * contrato de antes; a diferença é que a fila espera a página pintar.
   *
   * `once:true` em cada listener mais a trava `feito`: a fila roda UMA vez só.
   *
   * POR QUE NÃO `next/script strategy="lazyOnload"` (a opção nativa)
   * Fonte: node_modules/next/dist/docs/01-app/03-api-reference/02-components/
   * script.md:188 — Next 16.2.7, a versão instalada aqui: "injected into the
   * HTML client-side during browser idle time and will load after all
   * resources on the page have been fetched".
   *
   * Duas lacunas para este caso:
   *  1. `lazyOnload` espera TODOS os recursos da página + idle. Num funil em 4G
   *     ruim, o lead que toca no botão do hero aos 3 s ainda não teria o pixel
   *     carregado. `__ct4defer` dispara na PRIMEIRA INTERAÇÃO — exatamente
   *     quem se quer atribuir. As outras estratégias também não servem:
   *     `beforeInteractive` carrega antes da hidratação (é o defeito que
   *     estamos consertando), `afterInteractive` é o default e carrega cedo
   *     demais, e `worker` é experimental — pela mesma doc (scripts.md:128),
   *     "does not yet work with the App Router".
   *  2. Ela adia o DOWNLOAD, não substitui o stub. Quem garante que o
   *     `fbq('track','PageView')` existe desde o milissegundo zero é o script
   *     inline do SSR abaixo, que continua igual — `next/script` não resolve
   *     essa metade.
   */
  const AGENDADOR = `(function(){if(window.__ct4defer)return;var fila=[],feito=false,t=0,obs=null;
var evs=['pointerdown','touchstart','keydown','wheel','scroll'];
function limpar(){for(var i=0;i<evs.length;i++){try{removeEventListener(evs[i],go,{capture:true})}catch(e){}}if(t)clearTimeout(t);if(obs){try{obs.disconnect()}catch(e){}}}
function go(){if(feito)return;feito=true;limpar();for(var i=0;i<fila.length;i++){try{fila[i]()}catch(e){}}fila=[]}
for(var i=0;i<evs.length;i++){try{addEventListener(evs[i],go,{capture:true,passive:true,once:true})}catch(e){addEventListener(evs[i],go,true)}}
t=setTimeout(go,3000);
try{obs=new PerformanceObserver(function(){if('requestAnimationFrame'in window){requestAnimationFrame(function(){setTimeout(go,120)})}else{setTimeout(go,120)}});
obs.observe({type:'largest-contentful-paint',buffered:true})}catch(e){}
window.__ct4defer=function(fn){feito?fn():fila.push(fn)}})();`;
  // Funil sem pixel nenhum não precisa carregar o agendador. Ele TEM que vir
  // antes de qualquer `__ct4defer(...)`, por isso é o primeiro do array — e o
  // array é renderizado antes dos <script> do JSX lá embaixo.
  const temTracking = !!(utmifyPixelId || p.utmify_google_pixel_id || p.facebook_pixel_id || p.google_analytics_id || hotmartAccountId);
  if (temTracking) inline.push(AGENDADOR);

  // UTMify (Pixel + persistência de UTMs → entrega na Meta via CAPI) — PRIMEIRO,
  // pra carregar o quanto antes, exatamente como no <head> da inlead.
  if (utmifyPixelId) {
    // `window.pixelId` fica definido JÁ — é o que o pixel.js lê ao subir. Só o
    // download espera o paint: ele entrava em ~1.474 ms e roubava banda da
    // imagem do hero, que estava baixando de 1.022 ms a 4.654 ms.
    inline.push(
      `window.pixelId="${utmifyPixelId}";__ct4defer(function(){var s=document.createElement("script");s.async=1;s.defer=1;s.src="https://cdn.utmify.com.br/scripts/pixel/pixel.js";document.head.appendChild(s)});`,
    );
  }

  // UTMify Google Pixel
  if (p.utmify_google_pixel_id) {
    inline.push(
      `window.googlePixelId="${p.utmify_google_pixel_id}";__ct4defer(function(){var g=document.createElement("script");g.async=1;g.defer=1;g.src="https://cdn.utmify.com.br/scripts/pixel/pixel-google.js";document.head.appendChild(g)});`,
    );
  }

  // Meta Pixel (fbq) — só se houver ID numérico configurado.
  //
  // O stub inline enfileira init+PageView no 1º milissegundo e NÃO mudou: o
  // evento existe desde o começo, seja qual for o momento do download.
  //
  // O gatilho do fbevents.js era `DOMContentLoaded + 2x rAF`. Parecia
  // pós-paint, mas não era: medido no cdb-01, DOMContentLoaded caiu em
  // 1.789 ms e o LCP só em 9.860 ms, então o script (845 kB) baixava em
  // 5.352 ms e executava DUAS tarefas longas — 1.270 ms e 1.297 ms — bem no
  // meio da janela em que o navegador tentava pintar a imagem do hero. Ela
  // ficou 5 s pronta na memória esperando a thread.
  //
  // `__ct4defer` amarra no evento certo: o paint de verdade (ou o 1º toque,
  // ou 3 s). Quem sai antes disso sem tocar em nada é bounce — e o PageView
  // desse caso já era perdido de qualquer jeito, porque 845 kB não chegam a
  // tempo em 4G ruim.
  if (p.facebook_pixel_id) {
    inline.push(
      `!function(f,b,e,n){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[]}(window,document,'script');fbq('init','${p.facebook_pixel_id}');fbq('track','PageView');__ct4defer(function(){if(window.__fbLoaded)return;window.__fbLoaded=1;var t=document.createElement('script');t.async=!0;t.src='https://connect.facebook.net/en_US/fbevents.js';document.head.appendChild(t)});`,
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
  // Stub + `hot("account")` imediatos (a fila `hot.q` guarda a chamada); só o
  // insertBefore do launcher.js espera o paint. Entrava em 1.504 ms, no meio
  // do download da imagem do hero.
  if (hotmartAccountId) {
    inline.push(
      `(function(l,c){l["HotmartLauncherObject"]=c;l[c]=l[c]||function(){(l[c].q=l[c].q||[]).push(arguments)};l[c].l=1*new Date()})(window,"hot");hot("account","${hotmartAccountId}");__ct4defer(function(){var h=document.createElement("script");h.async=1;h.src="//launcher.hotmart.com/launcher.js";var e=document.getElementsByTagName("script")[0];e&&e.parentNode?e.parentNode.insertBefore(h,e):document.head.appendChild(h)});`,
    );
  }

  return (
    <>
      {/* abre conexão cedo com os CDNs que pesam. NÃO preconecta o facebook: o
          Meta pixel é deferido pra depois do paint, então preconectar cedo só
          rouba conexão no momento crítico do render (4G). */}
      {/* O preconnect do cdn.utmify.com.br SAIU: agora que o pixel é deferido,
          abrir TLS cedo pra ele só rouba conexão no momento crítico — o mesmo
          motivo que já valia pro Facebook. */}
      <link rel="preconnect" href="https://scripts.converteai.net" crossOrigin="" />
      <link rel="preconnect" href="https://cdn.converteai.net" crossOrigin="" />
      {/* preconnect (não só dns): abre TLS cedo pro CDN das imagens do hero (LCP) */}
      <link rel="preconnect" href="https://media.inlead.cloud" />
      {/* O hero dos funis novos vem do Storage do Supabase — foi de onde a
          imagem LCP do cdb-01 saiu (1.022 ms -> 4.654 ms). Sem este preconnect,
          DNS+TLS desse host só começam quando o preload dispara. */}
      {supabaseHost ? <link rel="preconnect" href={supabaseHost} crossOrigin="" /> : null}
      {inline.map((code, i) => (
        <script key={i} dangerouslySetInnerHTML={{ __html: code }} />
      ))}
      {/* utms/latest.js e gtag também entram pelo agendador. Como <script src>
          no HTML, o navegador os enfileirava junto com a imagem do hero — e
          `defer`/`async` adiam a EXECUÇÃO, não o download, que é justamente o
          que disputava a banda. Criados via JS, só baixam depois do paint. */}
      {utmifyPixelId && (
        <script
          dangerouslySetInnerHTML={{
            __html: `__ct4defer(function(){var u=document.createElement("script");u.src="https://cdn.utmify.com.br/scripts/utms/latest.js";u.async=1;u.setAttribute("data-utmify-prevent-subids","");document.head.appendChild(u)});`,
          }}
        />
      )}
      {p.google_analytics_id && (
        <script
          dangerouslySetInnerHTML={{
            __html: `__ct4defer(function(){var a=document.createElement("script");a.async=1;a.src="https://www.googletagmanager.com/gtag/js?id=${p.google_analytics_id}";document.head.appendChild(a)});`,
          }}
        />
      )}
      {/* SCRIPTS LIVRES DO PAINEL — emitidos no SERVIDOR.
          Antes iam todos pelo `RawScripts`, que injeta via `useEffect`: roda
          depois da hidratação, e o `pixel.js` da UTMify colado ali nunca
          engatava — o evento do checkout não marcava e não havia sinal de erro.
          O campo prometia funcionar e não funcionava.
          Agora cada <script> do campo vira elemento React, então vem no HTML
          original e executa na hora, igual aos pixels conhecidos.
          O que não for <script> (uma <noscript> de pixel, por exemplo) continua
          pelo RawScripts, que sabe inserir HTML arbitrário. */}
      {scriptsDoPainel(p.head_script)}
      {scriptsDoPainel(p.body_script)}
      {scriptsDoPainel(p.footer_script)}
      <RawScripts
        head={semScripts(p.head_script)}
        body={semScripts(p.body_script)}
        footer={semScripts(p.footer_script)}
      />
    </>
  );
}
