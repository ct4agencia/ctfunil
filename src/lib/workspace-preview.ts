export function isWorkspacePreview(host: string | null) {
  return process.env.NODE_ENV === "development"
    && !!process.env.CTFUNIL_PREVIEW_HOST
    && host === process.env.CTFUNIL_PREVIEW_HOST
    && !process.env.NEXT_PUBLIC_SUPABASE_URL
    && !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** Deploys de preview da Vercel rodam com as variáveis de Preview: continuam em consulta. */
function isVercelPreviewDeployment() {
  return process.env.VERCEL_ENV === "preview" && Boolean(process.env.VERCEL_URL);
}

/**
 * Modo oficial (desde 24/11/2026, pedido do Luca): na produção da Vercel o painel
 * lê e grava no banco. O construtor salva os funis de verdade, e os domínios dos
 * funis (outro deploy do mesmo projeto) exibem o que foi salvo.
 */
function isOfficialWorkspace() {
  return (process.env.VERCEL_ENV === "production" || process.env.CTFUNIL_OFFICIAL_PREVIEW === "1") &&
    process.env.CTFUNIL_REAL_DATA_PREVIEW !== "1";
}

/**
 * Preview privado da VPS em modo oficial: só com `CTFUNIL_OFFICIAL_PREVIEW=1`, a
 * chave administrativa no `.env.local` e o host do Tailscale. Sem isso, o preview
 * continua em consulta. Ligar é decisão do Luca, porque o preview passa a gravar
 * no mesmo banco dos funis publicados.
 */
function isOfficialPreviewHost(host: string | null) {
  return process.env.CTFUNIL_OFFICIAL_PREVIEW === "1" &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    Boolean(process.env.CTFUNIL_PREVIEW_HOST) &&
    host === process.env.CTFUNIL_PREVIEW_HOST;
}

export function isReadOnlyWorkspace() {
  return process.env.CTFUNIL_REAL_DATA_PREVIEW === "1" || isVercelPreviewDeployment();
}

export function isProductionWorkspaceHost(host: string | null) {
  return process.env.VERCEL_ENV === "production" &&
    (host === "ctfunil.vercel.app" || (Boolean(host) && host === process.env.VERCEL_URL));
}

/** Host do painel em modo oficial: telas do redesign com dados ao vivo e gravação no banco. */
export function isOfficialWorkspaceHost(host: string | null) {
  return isOfficialWorkspace() && (isProductionWorkspaceHost(host) || isOfficialPreviewHost(host));
}

/**
 * Host que usa as telas do redesign com dados reais: o preview em consulta e,
 * desde 24/11, o painel oficial em produção. As telas conferem
 * `isOfficialWorkspaceHost` para trocar a captura pelos dados ao vivo.
 */
export function realDataPreviewHost(host: string | null) {
  if (isVercelPreviewDeployment() && host === process.env.VERCEL_URL) return host;
  if (isOfficialWorkspaceHost(host)) return host;
  if (
    process.env.CTFUNIL_REAL_DATA_PREVIEW === "1" &&
    host &&
    host === process.env.CTFUNIL_PREVIEW_HOST &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) return host;
  return null;
}

export function isRealDataPreview(host: string | null) {
  return realDataPreviewHost(host) !== null;
}
