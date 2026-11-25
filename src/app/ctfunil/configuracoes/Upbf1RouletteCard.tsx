"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { recordWorkspaceNotice } from "@/components/workspace/WorkspaceNoticeHistory";
import { UPBF1_SECONDS_MAX, UPBF1_SECONDS_MIN, type Upbf1RouletteSettings, type Upbf1SettingsStatus } from "@/lib/upbf1-roleta-config";
import { saveUpbf1RouletteAction } from "./actions";

export type Upbf1RouletteCardProps = { initial: Upbf1RouletteSettings; status: Upbf1SettingsStatus; destination?: string };

const blocked: Partial<Record<Upbf1SettingsStatus, string>> = {
  readonly: "Em modo de consulta, esta configuração só pode ser vista. A roleta segue sem redirecionar sozinha.",
  missing: "A tabela de configurações ainda não existe no banco. Enquanto isso, a roleta segue sem redirecionar sozinha.",
  error: "Não foi possível ler a configuração agora.",
};

function describe(settings: Upbf1RouletteSettings) {
  return settings.autoRedirect ? `Ligado: ${settings.seconds} s depois que o popup abre.` : "Desligado: só o botão leva ao WhatsApp.";
}

function shortUrl(href: string) {
  try {
    const url = new URL(href);
    return url.host + (url.pathname === "/" ? "" : url.pathname);
  } catch {
    return href;
  }
}

/**
 * Liga e desliga o redirecionamento automático do popup do presente em
 * /upbf1/roleta. Grava no banco pela server action: vale para os visitantes,
 * não só para este navegador, como as demais configurações desta tela.
 */
export default function Upbf1RouletteCard({ initial, status, destination }: Upbf1RouletteCardProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [enabled, setEnabled] = useState(initial.autoRedirect);
  const [seconds, setSeconds] = useState(String(initial.seconds));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const locked = status !== "ok" || !destination;
  const parsed = Number(seconds.trim());
  const secondsValid = /^\d+$/.test(seconds.trim()) && parsed >= UPBF1_SECONDS_MIN && parsed <= UPBF1_SECONDS_MAX;
  const changed = enabled !== saved.autoRedirect || (enabled && (!secondsValid || parsed !== saved.seconds));

  function clearFeedback() {
    setNotice("");
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || locked) return;
    clearFeedback();
    if (enabled && !secondsValid) {
      setError(`Informe um número inteiro de ${UPBF1_SECONDS_MIN} a ${UPBF1_SECONDS_MAX} segundos.`);
      return;
    }
    const next = { autoRedirect: enabled, seconds: secondsValid ? parsed : saved.seconds };
    startTransition(async () => {
      try {
        const result = await saveUpbf1RouletteAction(next);
        if (!result.ok) {
          setError(result.error);
          recordWorkspaceNotice("Roleta do /upbf1", result.error, true);
          return;
        }
        setSaved(result.settings);
        setSeconds(String(result.settings.seconds));
        const message = `Salvo. ${describe(result.settings)} Vale para quem abrir a roleta a partir de agora.`;
        setNotice(message);
        recordWorkspaceNotice("Roleta do /upbf1", message);
      } catch {
        setError("Não foi possível salvar. Confira a conexão e tente novamente.");
      }
    });
  }

  return <form onSubmit={submit} className="ct-panel space-y-4 p-5" aria-labelledby="upbf1-roulette-title">
    <div>
      <h2 id="upbf1-roulette-title" className="text-lg font-semibold">Roleta da Black Friday</h2>
      <p className="mt-1 text-sm text-ct-dim">
        Depois do giro em <code className="text-ct-ink">/upbf1/roleta</code>, o popup do presente pode levar a pessoa sozinha para o WhatsApp da Sônia.
        O popup mostra a contagem, e quem tocar em Fechar fica na página.
      </p>
      {destination ? <p className="mt-1 text-sm text-ct-dim">Destino: <span className="break-all text-ct-ink">{shortUrl(destination)}</span></p> :
        <p className="mt-1 text-sm text-ct-dim">O link do WhatsApp não está configurado: o popup não tem botão e não redireciona.</p>}
    </div>

    {status === "ok" && <p className="text-sm"><strong>Agora:</strong> {describe(saved)}</p>}
    {blocked[status] && <div className="flex flex-wrap items-center gap-2">
      <p role="status" className="text-sm text-ct-dim">{blocked[status]}</p>
      {status === "error" && <button type="button" className="ct-confirm-cancel min-h-11 rounded-lg px-3 text-sm"
        onClick={() => router.refresh()}>Consultar novamente</button>}
    </div>}

    <fieldset disabled={locked || pending} className="space-y-3 disabled:opacity-60">
      <legend className="sr-only">Redirecionamento automático</legend>
      <button type="button" role="switch" aria-checked={enabled}
        className="inline-flex min-h-11 items-center gap-3 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ct-blue"
        onClick={() => { setEnabled(value => !value); clearFeedback(); }}>
        <span aria-hidden="true" className={`flex h-[1.125rem] w-8 shrink-0 items-center rounded-full p-[3px] ${enabled ? "bg-ct-blue" : "bg-ct-line"}`}>
          <span className={`size-3 rounded-full motion-safe:transition-transform motion-safe:duration-200 ${enabled ? "translate-x-3.5 bg-white" : "bg-ct-dim"}`} />
        </span>
        Redirecionar automaticamente
      </button>
      {enabled && <label className="block max-w-xs text-sm font-semibold">Segundos até redirecionar
        <input type="number" inputMode="numeric" min={UPBF1_SECONDS_MIN} max={UPBF1_SECONDS_MAX} step={1} required
          className="mt-2 block w-full rounded-lg border border-ct-line bg-ct-raised p-3"
          value={seconds} onChange={event => { setSeconds(event.target.value); clearFeedback(); }}
          aria-describedby="upbf1-seconds-help" />
        <span id="upbf1-seconds-help" className="mt-1 block text-xs font-normal text-ct-dim">
          De {UPBF1_SECONDS_MIN} a {UPBF1_SECONDS_MAX}. A contagem começa quando o popup abre.
        </span>
      </label>}
    </fieldset>

    <div className="flex flex-wrap items-center gap-3">
      <button className="ct-action-link disabled:opacity-50" type="submit" disabled={locked || pending || !changed}>
        {pending ? "Salvando…" : "Salvar"}
      </button>
      <a className="inline-flex items-center gap-1 text-sm text-ct-blue underline" href="/upbf1/roleta" target="_blank" rel="noopener noreferrer">
        Abrir a roleta <ExternalLink size={14} aria-hidden="true" /><span className="sr-only">(nova aba)</span>
      </a>
    </div>
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {error && <p role="alert" className="text-sm text-ct-dim">{error}</p>}
  </form>;
}
