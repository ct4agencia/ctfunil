"use client";

import { useState } from "react";
import { Copy, Eye, EyeOff, WalletCards } from "lucide-react";
import RollingNumber from "@/components/ui/RollingNumber";
import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";
import type { GlobalAnalytics } from "@/lib/quiz/metrics";

export type AdAccount = { id: string; name: string; creatives: string[] };
export const UNVERIFIED_AD_ACCOUNT = "unverified";

export default function AdAccountCard({ accounts, account, filter, creatives, total, unverifiedBySource, onChange }: {
  accounts: AdAccount[];
  account?: AdAccount;
  filter: string;
  creatives: GlobalAnalytics["creatives"];
  total: number;
  unverifiedBySource: readonly [string, number][];
  onChange: (id: string) => void;
}) {
  const [hidden, setHidden] = useState(false);
  const [message, setMessage] = useState("");
  const unverified = unverifiedBySource.reduce((sum, [, count]) => sum + count, 0);
  const coverage = unverifiedBySource.map(([source, count]) => `${source} ${count.toLocaleString("pt-BR")}`);
  const metrics = [
    ["Criativos", creatives.length],
    ["Sessões", creatives.reduce((sum, item) => sum + item.clicks, 0)],
    ["Leads", creatives.reduce((sum, item) => sum + item.leads, 0)],
  ] as const;

  async function copyAccountId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setMessage("Identificador copiado.");
    } catch {
      setMessage("Não foi possível copiar o identificador.");
    }
  }

  return <section aria-labelledby="ad-account-heading" className="space-y-4 rounded-2xl border border-ct-line bg-ct-surface p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="ad-account-heading" className="flex items-center gap-2 text-sm font-bold text-ct-ink">
        <WalletCards size={18} aria-hidden="true" /> Contas de anúncio
      </h2>
      <div className="flex flex-wrap gap-2">
        <WorkspaceSelect searchable expandFromTrigger label="Conta de anúncio" value={filter} onChange={id => {
          if (id === filter) return;
          setMessage("");
          onChange(id);
        }}
          options={[
            { value: "", label: "Todas as origens" },
            ...accounts.map(item => ({ value: item.id, label: item.name })),
            ...(unverified > 0 ? [{ value: UNVERIFIED_AD_ACCOUNT, label: "Sem conta confirmada" }] : []),
          ]} />
        <button type="button" className="ct-icon-button" aria-label={hidden ? "Mostrar métricas" : "Ocultar métricas"}
          aria-controls="ad-account-metrics"
          onClick={() => setHidden(value => !value)}>{hidden ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</button>
        {account && <button type="button" className="ct-icon-button" aria-label="Copiar identificador da conta" onClick={() => void copyAccountId(account.id)}>
          <Copy size={16} aria-hidden="true" />
        </button>}
      </div>
    </div>
    <dl id="ad-account-metrics" className="grid grid-cols-3 gap-2">
      {metrics.map(([label, value]) => <div key={label} className="min-w-0 rounded-xl bg-ct-raised p-2.5">
        <dt className="text-xs text-ct-dim">{label}</dt>
        <dd className="mt-1 break-words text-base font-semibold tabular-nums text-ct-ink"><RollingNumber value={value} hidden={hidden} /></dd>
      </div>)}
    </dl>
    <div className="space-y-1 text-xs text-ct-dim">
      <p>{total - unverified} de {total} criativos têm conta confirmada na captura.</p>
      {unverified > 0 && <p>Sem conta confirmada por origem · {coverage.join(" · ")}</p>}
    </div>
    <p role="status" className="sr-only">{message}</p>
  </section>;
}
