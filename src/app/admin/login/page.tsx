"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Check, Mail } from "lucide-react";
import { AccessOrb, ThemeButton } from "@/components/workspace/WorkspaceFrame";
import { WakeGlyph } from "@/components/workspace/WakeGlyph";
import { workspaceReturnPath } from "@/lib/workspace-return";
import { signInToWorkspace } from "@/app/auth/actions";
import { AccessPasswordField } from "@/components/workspace/AccessPasswordField";
import { StatefulButton } from "@/components/referencias/beui/motion/button/stateful";
import { AccessLink } from "@/components/workspace/AccessLink";

const subscribeHydration = () => () => {};
const onClient = () => true;
const onServer = () => false;
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function LoginPage() {
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const ready = useSyncExternalStore(subscribeHydration, onClient, onServer);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const validEmail = isValidEmail(email);
  const emailError = (submitted || (emailTouched && !!email.trim())) && !validEmail
    ? (email.trim() ? "Informe um e-mail válido." : "Informe seu e-mail.") : "";
  const passwordError = submitted && !password ? "Informe sua senha." : "";

  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) emailInput.current?.focus({ preventScroll: true });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    // Password managers can fill the native inputs without a React change event.
    const enteredEmail = emailInput.current?.value.trim() ?? "";
    const enteredPassword = passwordInput.current?.value ?? "";
    setEmail(enteredEmail);
    setPassword(enteredPassword);
    setSubmitted(true);
    setError("");
    if (!isValidEmail(enteredEmail) || !enteredPassword) {
      (isValidEmail(enteredEmail) ? passwordInput : emailInput).current?.focus();
      return;
    }
    setLoading(true);
    try {
      const result = await signInToWorkspace(enteredEmail, enteredPassword);
      if (result !== "success") {
        if (result === "rate_limited") setError("Muitas tentativas. Aguarde e tente novamente.");
        else if (result === "invalid_credentials") setError("E-mail ou senha inválidos.");
        else if (result === "restricted") setError("Esta conta não tem acesso ao painel do CTFunil.");
        else setError("Não foi possível entrar agora. Tente novamente.");
        setLoading(false);
        return;
      }
      window.location.replace(workspaceReturnPath(new URLSearchParams(window.location.search).get("next")));
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <main className="ct-workspace ct-access">
      <div className="ct-access-wake" aria-hidden="true"><WakeGlyph cellSize={14} /></div>
      <ThemeButton />
      <form method="post" className="ct-access-form ct-login" onSubmit={handleSubmit} noValidate aria-busy={loading} aria-labelledby="login-title">
        <AccessOrb />
        <h1 id="login-title" aria-label="CTFunil">ct<span className="ct-login-reveal">funil</span></h1>
        <p className="ct-login-intro">Entre para acessar seus funis.</p>

        <label htmlFor="login-email">E-mail</label>
        <div className="ct-login-field">
          <Mail className="ct-login-symbol" aria-hidden="true" />
          <input ref={emailInput} id="login-email" name="email" autoComplete="username" type="email" required
            placeholder="voce@email.com" value={email}
            onChange={event => { setEmail(event.target.value); setError(""); }}
            onBlur={() => setEmailTouched(true)} aria-invalid={!!emailError} aria-describedby="login-email-help" />
          {validEmail && (emailTouched || submitted) && <Check className="ct-login-check" aria-hidden="true" />}
        </div>
        <p className="ct-login-help" id="login-email-help" aria-live="polite">{emailError}</p>

        <AccessPasswordField label="Senha" ref={passwordInput} id="login-password" name="password" autoComplete="current-password"
          required placeholder="Sua senha" value={password}
          onChange={event => { setPassword(event.target.value); setError(""); }}
          aria-invalid={!!passwordError} aria-describedby="login-password-help" />
        <p className="ct-login-help" id="login-password-help" aria-live="polite">{passwordError}</p>
        {error && <p role="alert" className="ct-login-error">{error}</p>}
        <StatefulButton type="submit" className="ct-action-link" disabled={!ready}
          state={loading ? "loading" : error ? "error" : "idle"}
          aria-label={loading ? "Entrando…" : error ? "Tentar novamente" : "Entrar"}
          loadingText="Entrando…" errorText="Tentar novamente">
          Entrar
        </StatefulButton>
        <AccessLink href="/auth/recover" className="mt-4 inline-block text-sm ct-access-link">Esqueci minha senha</AccessLink>
      </form>
    </main>
  );
}
