/**
 * Beacon de visitante (connect rate). Script inline que roda NO CARREGAMENTO da
 * página — antes do bundle do app (React/funil) — e registra a sessão via
 * navigator.sendBeacon → /api/visit. Assim o visitante conta mesmo se o lead
 * sair durante o render de ~1s+ do funil client-side.
 *
 * Replica EXATAMENTE o getSessionId() (localStorage "vsl_session_id") e o
 * formato sid = `${id}::${slug}` do lib/quiz/track.ts, então a linha criada
 * aqui é a MESMA que o tracking client-side atualiza depois (sem duplicar).
 */
export default function VisitBeacon({ slug }: { slug: string }) {
  const SLUG = JSON.stringify(slug);
  const code = `(function(){try{
var SLUG=${SLUG},KEY="vsl_session_id",id=null;
try{id=localStorage.getItem(KEY)}catch(e){}
if(!id){id="s-"+Math.random().toString(36).slice(2,12)+Date.now().toString(36);try{localStorage.setItem(KEY,id)}catch(e){}}
var sp=new URLSearchParams(location.search),g=function(k){return sp.get(k)||null};
var b=JSON.stringify({slug:SLUG,session_id:id+"::"+SLUG,utm_source:g("utm_source"),utm_medium:g("utm_medium"),utm_campaign:g("utm_campaign"),utm_content:g("utm_content"),utm_term:g("utm_term"),src:g("src"),ctwa_clid:g("ctwa_clid"),source_id:g("source_id")});
var u="/api/visit";
if(navigator.sendBeacon){navigator.sendBeacon(u,new Blob([b],{type:"application/json"}))}
else{fetch(u,{method:"POST",headers:{"Content-Type":"application/json"},body:b,keepalive:true}).catch(function(){})}
}catch(e){}})();`;
  // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
