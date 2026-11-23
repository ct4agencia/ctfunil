"use client";

import { StatefulButton } from "@/components/referencias/beui/motion/button/stateful";
import { AccessLink } from "@/components/workspace/AccessLink";
import { AccessPasswordField } from "@/components/workspace/AccessPasswordField";
import { Brand, ThemeButton } from "@/components/workspace/WorkspaceFrame";
import { WakeGlyph } from "@/components/workspace/WakeGlyph";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { readRecoveryDestination, rememberRecoveryDestination } from "@/lib/recovery-destination";
import { createClient } from "@/lib/supabase/client";

type PageState = "checking" | "ready" | "invalid" | "success";

function passwordStrength(value: string) {
  if (value.length < 8) return 1;
  const variety = [/[a-z]/i.test(value), /\d/.test(value), /[^\p{L}\p{N}\s]/u.test(value)].filter(Boolean).length;
  return Math.min(4, (value.length >= 12 ? 2 : 1) + variety);
}

const strengthLabels = ["Fraca", "Razoável", "Boa", "Forte"];

export default function UpdatePasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const [recoveryDestination, setRecoveryDestination] = useState<string>();
  const [pageState, setPageState] = useState<PageState>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmationTouched, setConfirmationTouched] = useState(false);
  const passwordError = passwordTouched && password.length < 8 ? "Use uma senha com pelo menos 8 caracteres." : "";
  const confirmationError = confirmationTouched && password !== confirmation ? "As senhas não coincidem." : "";
  const strength = passwordStrength(password);

  useEffect(() => {
    let active = true;
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const recoveryTokenPresent = query.has("code") || hash.has("access_token") || hash.has("token_hash");

    if (recoveryTokenPresent) setRecoveryDestination(readRecoveryDestination());

    function markInvalid(message: string) {
      if (!active) return;
      setPageState("invalid");
      setError(message);
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setRecoveryDestination(readRecoveryDestination());
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        setPageState("ready");
        setError(null);
      }
    });

    if (hash.has("error") || hash.has("error_code") || query.has("error") || query.has("error_code")) {
      markInvalid("Este link expirou ou já foi usado. Solicite um novo email de recuperação.");
    } else {
      const checkSession = async () => {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (!active) return;

        if (sessionData.session) {
          setPageState("ready");
          setError(null);
          return;
        }

        if (sessionError) {
          markInvalid("Não foi possível validar o link. Solicite um novo email de recuperação.");
          return;
        }

        if (recoveryTokenPresent && retries < 5) {
          retries += 1;
          timer = setTimeout(checkSession, 500);
          return;
        }

        markInvalid("Abra esta página pelo link mais recente enviado ao seu email.");
      };

      void checkSession();
    }

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || pageState !== "ready") return;
    setError(null);
    setPasswordTouched(true);
    setConfirmationTouched(true);

    if (password.length < 8) {
      event.currentTarget.querySelector<HTMLInputElement>("#new-password")?.focus();
      return;
    }
    if (password !== confirmation) {
      event.currentTarget.querySelector<HTMLInputElement>("#confirm-password")?.focus();
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("Não foi possível atualizar a senha. Solicite um novo link e tente novamente.");
        return;
      }
      setPassword("");
      setConfirmation("");
      rememberRecoveryDestination(null);
      setPageState("success");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="ct-workspace ct-access">
      <div className="ct-access-wake" aria-hidden="true"><WakeGlyph cellSize={14}/></div><ThemeButton/>
      <section className="ct-access-form ct-login" aria-labelledby="update-password-title">
        <Brand/><h1 id="update-password-title">Defina uma nova senha</h1>

        {pageState === "checking" && (
          <p role="status" className="text-sm text-ct-dim">Validando link de recuperação…</p>
        )}

        {pageState === "invalid" && (
          <div className="space-y-4">
            <p role="alert" className="ct-login-error">{error}</p>
            <AccessLink href="/auth/recover" fallbackDestination={recoveryDestination} className="inline-block text-sm font-medium ct-access-link">
              Solicitar novo link
            </AccessLink>
          </div>
        )}

        {pageState === "success" && (
          <div className="space-y-4">
            <p role="status" className="text-sm text-ct-success">Senha atualizada com sucesso.</p>
            <AccessLink href="/admin/login" fallbackDestination={recoveryDestination} className="inline-block text-sm font-medium ct-access-link">
              Ir para o painel
            </AccessLink>
          </div>
        )}

        {pageState === "ready" && (
          <form method="post" onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={saving}>
            <p className="text-sm text-ct-dim">Use pelo menos 8 caracteres.</p>
            <div>
              <AccessPasswordField label="Nova senha" id="new-password" autoComplete="new-password"
                minLength={8} required value={password} aria-invalid={!!passwordError}
                aria-describedby={password ? "new-password-help new-password-strength" : "new-password-help"}
                onBlur={() => setPasswordTouched(true)}
                onChange={event => { setPassword(event.target.value); setError(null); }} />
              <p className="ct-login-help" id="new-password-help" aria-live="polite">{passwordError}</p>
              {password && <div id="new-password-strength" className="mt-2 space-y-1 text-xs text-ct-dim">
                <div className="grid grid-cols-4 gap-1" aria-hidden="true">
                  {strengthLabels.map((label, index) => <span key={label} className={`h-1 rounded-full ${index < strength ? "bg-ct-blue" : "bg-ct-line-strong"}`} />)}
                </div>
                <span role="status">Força da senha: {strengthLabels[strength - 1]}</span>
              </div>}
            </div>
            <div>
              <AccessPasswordField label="Confirme a nova senha" id="confirm-password" autoComplete="new-password"
                minLength={8} required value={confirmation} aria-invalid={!!confirmationError} aria-describedby="confirm-password-help"
                onBlur={() => setConfirmationTouched(true)}
                onChange={event => { setConfirmation(event.target.value); setError(null); }} />
              <p className="ct-login-help" id="confirm-password-help" aria-live="polite">{confirmationError}</p>
            </div>
            {error && <p id="update-password-error" role="alert" className="ct-login-error">{error}</p>}

            <StatefulButton
              type="submit"
              state={saving ? "loading" : error ? "error" : "idle"}
              aria-label={saving ? "Salvando…" : "Salvar nova senha"}
              loadingText="Salvando…"
              errorText="Salvar nova senha"
              aria-describedby={error ? "update-password-error" : undefined}
              className="ct-action-link disabled:opacity-50"
            >
              Salvar nova senha
            </StatefulButton>
          </form>
        )}
      </section>
    </main>
  );
}
