"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type PageState = "checking" | "ready" | "invalid" | "success";

export default function UpdatePasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const [pageState, setPageState] = useState<PageState>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const recoveryTokenPresent = hash.has("access_token") || hash.has("token_hash");

    function markInvalid(message: string) {
      if (!active) return;
      setPageState("invalid");
      setError(message);
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        setPageState("ready");
        setError(null);
      }
    });

    if (hash.has("error") || hash.has("error_code")) {
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
    setError(null);

    if (password.length < 8) {
      setError("Use uma senha com pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError("Não foi possível atualizar a senha. Solicite um novo link e tente novamente.");
      return;
    }

    setPassword("");
    setConfirmation("");
    setPageState("success");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-10">
      <section className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <h1 className="mb-1 text-2xl font-bold text-white">CTFUNNEL</h1>
        <p className="mb-6 text-sm text-slate-400">Defina uma nova senha</p>

        {pageState === "checking" && (
          <p role="status" className="text-sm text-slate-300">Validando link de recuperação…</p>
        )}

        {pageState === "invalid" && (
          <div className="space-y-4">
            <p role="alert" className="text-sm text-red-400">{error}</p>
            <Link href="/admin/login" className="inline-block text-sm font-medium text-sky-400 hover:text-sky-300">
              Voltar ao login
            </Link>
          </div>
        )}

        {pageState === "success" && (
          <div className="space-y-4">
            <p role="status" className="text-sm text-emerald-400">Senha atualizada com sucesso.</p>
            <Link href="/admin/login" className="inline-block text-sm font-medium text-sky-400 hover:text-sky-300">
              Ir para o painel
            </Link>
          </div>
        )}

        {pageState === "ready" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-slate-300">
                Nova senha
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-slate-300">
                Confirme a nova senha
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-sky-500"
              />
            </div>

            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-sky-600 px-3 py-2 font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Salvando…" : "Salvar nova senha"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
