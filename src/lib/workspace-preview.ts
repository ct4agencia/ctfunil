export function isWorkspacePreview(host: string | null) {
  return process.env.NODE_ENV === "development"
    && !!process.env.CTFUNIL_PREVIEW_HOST
    && host === process.env.CTFUNIL_PREVIEW_HOST
    && !process.env.NEXT_PUBLIC_SUPABASE_URL
    && !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function isVercelWorkspace() {
  return process.env.VERCEL_ENV === "production" ||
    (process.env.VERCEL_ENV === "preview" && Boolean(process.env.VERCEL_URL));
}

export function isReadOnlyWorkspace() {
  return process.env.CTFUNIL_REAL_DATA_PREVIEW === "1" || isVercelWorkspace();
}

export function isProductionWorkspaceHost(host: string | null) {
  return process.env.VERCEL_ENV === "production" &&
    (host === "ctfunil.vercel.app" || (Boolean(host) && host === process.env.VERCEL_URL));
}

export function realDataPreviewHost(host: string | null) {
  if (isVercelWorkspace() && (host === process.env.VERCEL_URL || isProductionWorkspaceHost(host))) return host;
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
