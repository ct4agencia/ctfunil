"use client";

import { useRef, useState, type FormEvent } from "react";
import { Brand, ThemeButton } from "@/components/workspace/WorkspaceFrame";
import { WakeGlyph } from "@/components/workspace/WakeGlyph";
import { createClient } from "@/lib/supabase/client";
import { OTPInput } from "@/components/referencias/beui/motion/otp-input";
import { verifyWorkspaceRecoveryCode } from "@/app/auth/actions";
import { rememberRecoveryDestination } from "@/lib/recovery-destination";
import { StatefulButton } from "@/components/referencias/beui/motion/button/stateful";
import { AccessLink } from "@/components/workspace/AccessLink";

import "@/components/workspace/access-form.css";

const codeLabels = {
  progress: "{entered} de {total} dígitos preenchidos.",
  entered: "{digit}. {progress}",
  maskedDigit: "Dígito",
  deleted: "Apagado. {progress}",
  position: "{slot}, dígito {position} de {total}.",
  filled: "Preenchido",
  empty: "Vazio",
  verified: "Verificado",
};

export default function RecoverPasswordPage() {
  const emailInput = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [emailError, setEmailError] = useState("");
  const [error, setError] = useState("");

  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<"idle" | "checking" | "error" | "success">("idle");
  const [codeError, setCodeError] = useState("");

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== 6 || codeState === "checking" || codeState === "success") return;
    setCodeState("checking");
    try {
      const result = await verifyWorkspaceRecoveryCode(recoveryEmail, code);
      if (result === "success") {
        setCodeState("success");
        return;
      }
      setCodeError(result === "rate_limited" ? "Muitas tentativas. Aguarde e tente novamente."
        : result === "unavailable" ? "Não foi possível verificar agora. Tente novamente."
        : "O código está incorreto ou expirou. Confira o e-mail mais recente.");
    } catch {
      setCodeError("Falha de conexão. Tente novamente.");
    }
    setCodeState("error");
  }

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state !== "idle") return;
    const input = emailInput.current;
    if (!input) return;
    const email = input.value.trim();
    setError("");
    if (!email || input.validity.typeMismatch) {
      setEmailError(email ? "Informe um e-mail válido." : "Informe seu e-mail.");
      input.focus();
      return;
    }
    setEmailError("");
    setState("sending");

    try {
      const { error: recoveryError } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: new URL("/auth/update-password", window.location.origin).href,
      });
      if (!recoveryError || recoveryError.code === "user_not_found") {
        rememberRecoveryDestination(new URLSearchParams(window.location.search).get("next"));
        setRecoveryEmail(email);
        setState("sent");
        return;
      }
      setError(recoveryError.status === 429
        ? "Muitas solicitações. Aguarde e tente novamente."
        : "Não foi possível solicitar o link. Tente novamente.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    }
    setState("idle");
  }

  return (
    <main className="ct-workspace ct-access">
      <div className="ct-access-wake" aria-hidden="true"><WakeGlyph cellSize={14} /></div>
      <ThemeButton />
      <section className="ct-access-form ct-login" aria-labelledby="recovery-title">
        <Brand />
        <h1 id="recovery-title" className="text-xl font-semibold">Recuperar senha</h1>
        {state === "sent" ? (
          <div className="mb-4 space-y-4">
            <p role="status" className="text-sm text-ct-dim">
              Se o e-mail estiver cadastrado, você receberá as instruções. Abra o link de recuperação neste mesmo navegador.
            </p>
            <details className="ct-disclosure">
              <summary className="cursor-pointer text-sm font-medium text-ct-blue">Recebi um código</summary>
              <form onSubmit={verifyCode} className="mt-3 flex flex-col items-start gap-3" aria-busy={codeState === "checking"}>
                <OTPInput label="Código de recuperação" labels={codeLabels} value={code}
                  disabled={codeState === "checking" || codeState === "success"}
                  status={codeState === "checking" ? "idle" : codeState}
                  errorMessage={codeError} successMessage="Código verificado."
                  onChange={value => { setCode(value); setCodeState("idle"); }} />
                {codeState === "success" ? (
                  <AccessLink href="/auth/update-password" className="ct-action-link">Definir nova senha</AccessLink>
                ) : (
                  <StatefulButton className="ct-action-link disabled:opacity-50" type="submit"
                    disabled={code.length !== 6}
                    state={codeState === "checking" ? "loading" : codeState === "error" ? "error" : "idle"}
                    aria-label={codeState === "checking" ? "Verificando…" : "Verificar código"}
                    loadingText="Verificando…" errorText="Verificar código">
                    Verificar código
                  </StatefulButton>
                )}
              </form>
            </details>
          </div>
        ) : (
          <form method="post" onSubmit={requestLink} noValidate className="mb-4 space-y-4" aria-busy={state === "sending"}>
            <p className="text-sm text-ct-dim">Informe o e-mail que você usa para entrar no CTFunil.</p>
            <div>
              <label htmlFor="recovery-email">E-mail</label>
              <input ref={emailInput} id="recovery-email" name="email" type="email" autoComplete="email" required
                aria-invalid={!!emailError} aria-describedby="recovery-email-help"
                onChange={() => { setEmailError(""); setError(""); }} />
              <p id="recovery-email-help" className="ct-login-help" aria-live="polite">{emailError}</p>
            </div>
            {error && <p role="alert" className="ct-login-error">{error}</p>}
            <StatefulButton type="submit" className="ct-action-link disabled:opacity-50"
              state={state === "sending" ? "loading" : error ? "error" : "idle"}
              aria-label={state === "sending" ? "Solicitando…" : "Solicitar link"}
              loadingText="Solicitando…" errorText="Solicitar link">
              Solicitar link
            </StatefulButton>
          </form>
        )}
        <AccessLink href="/admin/login" className="text-sm font-medium ct-access-link">Voltar ao login</AccessLink>
      </section>
    </main>
  );
}
