import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { isReadOnlyWorkspace } from "@/lib/workspace-preview";
import { normalizeUpbf1Settings, UPBF1_ROULETTE_DEFAULTS, UPBF1_ROULETTE_KEY, validUpbf1Seconds, type Upbf1RouletteSettings, type Upbf1SettingsStatus } from "@/lib/upbf1-roleta-config";

/**
 * Configuração da roleta do /upbf1 no servidor. Só código de servidor importa
 * este arquivo, porque ele usa o cliente com service_role.
 *
 * A tabela `ctfunil_settings` guarda configurações do painel em chave e valor.
 * Ela tem RLS ligado e nenhuma política: só o service_role lê e grava.
 */
const TABLE = "ctfunil_settings";
export const UPBF1_SETTINGS_TAG = "ctfunil-settings-upbf1-roleta";

const whatsappMessage = "Sônia, tirei o GUIA COMPLETO + 80% OFF 🔥 e quero desbloquear o meu presente!!!";

/** Link do botão do popup. Só aceita HTTPS sem usuário e senha na URL. */
export function getUpbf1RedirectUrl() {
  const input = process.env.UPBF1_REDIRECT_URL || "https://app.goredirect.com.br/fd61/bf-01";
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password) return;
    if ((url.hostname === "wa.me" || url.hostname === "api.whatsapp.com") && !url.searchParams.has("text")) {
      url.searchParams.set("text", whatsappMessage);
    }
    return url.href;
  } catch {}
}

type SettingsError = Error & { code?: string };

function isMissingTable(error: unknown) {
  const code = (error as SettingsError | null)?.code;
  return code === "PGRST205" || code === "42P01";
}

async function fetchSettings(): Promise<Upbf1RouletteSettings> {
  const { data, error } = await createAdminClient().from(TABLE).select("value")
    .eq("key", UPBF1_ROULETTE_KEY).abortSignal(AbortSignal.timeout(2500)).maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return normalizeUpbf1Settings(data?.value);
}

// A roleta recebe o tráfego da campanha: guarda a leitura por até 60 s, e o
// salvamento no painel derruba o cache na hora (updateTag na server action).
// Uma falha lança e não fica guardada.
const cachedSettings = unstable_cache(fetchSettings, [TABLE, UPBF1_ROULETTE_KEY], { revalidate: 60, tags: [UPBF1_SETTINGS_TAG] });

/** Leitura da página pública. Em qualquer falha, a roleta segue sem redirecionar sozinha. */
export async function readUpbf1RouletteSettings(): Promise<Upbf1RouletteSettings> {
  if (isReadOnlyWorkspace()) return UPBF1_ROULETTE_DEFAULTS;
  try {
    return await cachedSettings();
  } catch {
    return UPBF1_ROULETTE_DEFAULTS;
  }
}

/** Leitura do painel: sem cache e com o motivo quando não dá para ler. */
export async function readUpbf1RouletteState(): Promise<{ settings: Upbf1RouletteSettings; status: Upbf1SettingsStatus }> {
  if (isReadOnlyWorkspace()) return { settings: UPBF1_ROULETTE_DEFAULTS, status: "readonly" };
  try {
    return { settings: await fetchSettings(), status: "ok" };
  } catch (error) {
    return { settings: UPBF1_ROULETTE_DEFAULTS, status: isMissingTable(error) ? "missing" : "error" };
  }
}

export async function saveUpbf1RouletteSettings(input: Upbf1RouletteSettings, updatedBy?: string):
  Promise<{ ok: true; settings: Upbf1RouletteSettings } | { ok: false; error: string }> {
  if (isReadOnlyWorkspace()) return { ok: false, error: "O preview está em modo de consulta: a configuração não pode ser alterada aqui." };
  if (typeof input.autoRedirect !== "boolean" || !validUpbf1Seconds(input.seconds)) {
    return { ok: false, error: "Informe um número inteiro de 1 a 60 segundos." };
  }
  const settings = { autoRedirect: input.autoRedirect, seconds: input.seconds };
  try {
    const { error } = await createAdminClient().from(TABLE).upsert({
      key: UPBF1_ROULETTE_KEY, value: settings, updated_at: new Date().toISOString(), updated_by: updatedBy ?? null,
    }, { onConflict: "key" }).abortSignal(AbortSignal.timeout(5000));
    if (error) {
      return { ok: false, error: isMissingTable(error) ? "A tabela de configurações ainda não existe no banco." : "Não foi possível salvar a configuração." };
    }
    return { ok: true, settings };
  } catch {
    return { ok: false, error: "Não foi possível salvar a configuração." };
  }
}
