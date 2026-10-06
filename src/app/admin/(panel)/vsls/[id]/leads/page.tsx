import { createClient } from "@/lib/supabase/server";
import LeadsToolbar from "@/components/admin/LeadsToolbar";
import type { Lead } from "@/lib/types";

type Funnel = {
  views: number;
  plays: number;
  cta_clicks: number;
  leads: number;
  cta_sem_captura: number;
  compras: number;
};

function pct(n: number, base: number) {
  if (!base) return "—";
  return `${Math.round((n / base) * 100)}%`;
}

export default async function LeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { from = "", to = "" } = await searchParams;
  const supabase = await createClient();

  let leadsQuery = supabase
    .from("leads")
    .select("*")
    .eq("vsl_id", id)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (from) leadsQuery = leadsQuery.gte("created_at", `${from}T00:00:00`);
  if (to) leadsQuery = leadsQuery.lte("created_at", `${to}T23:59:59.999`);

  const [{ data: funnelData }, { data: leadsData }] = await Promise.all([
    supabase.rpc("vsl_funnel", { p_vsl_id: id }),
    leadsQuery,
  ]);

  const f = (funnelData ?? {
    views: 0,
    plays: 0,
    cta_clicks: 0,
    leads: 0,
    cta_sem_captura: 0,
    compras: 0,
  }) as Funnel;
  const leads = (leadsData ?? []) as Lead[];

  const cards = [
    { label: "Visualizações únicas", value: f.views, sub: "≈ VTurb (aproximado)", approx: true },
    { label: "Plays únicos", value: f.plays, sub: "Play rate " + pct(f.plays, f.views), approx: true },
    { label: "Clicaram no CTA", value: f.cta_clicks, sub: pct(f.cta_clicks, f.views) + " das visualizações", approx: false },
    { label: "Preencheram captura", value: f.leads, sub: pct(f.leads, f.views) + " das visualizações", approx: false },
    { label: "CTA sem captura", value: f.cta_sem_captura, sub: "clicaram e não preencheram", approx: false },
    { label: "Compras", value: f.compras, sub: "pagas (via webhook Hotmart)", approx: false },
  ];

  const cols: { key: keyof Lead; label: string }[] = [
    { key: "created_at", label: "Data" },
    { key: "name", label: "Nome" },
    { key: "phone", label: "Telefone" },
    { key: "utm_source", label: "utm_source" },
    { key: "utm_campaign", label: "utm_campaign" },
    { key: "ctwa_clid", label: "ctwa_clid" },
    { key: "platform", label: "platform" },
  ];

  return (
    <div className="space-y-6">
      {/* Funil */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Funil</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <p className="text-2xl font-bold text-slate-900">{c.value}</p>
              <p className="flex items-center gap-1 text-xs font-medium text-slate-600">
                {c.label}
                {c.approx && (
                  <span className="rounded bg-amber-100 px-1 text-[9px] font-semibold text-amber-700">
                    ~aprox
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">{c.sub}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          <strong>Visualizações e Plays</strong> são aproximados (medidos aqui; a
          fonte oficial do vídeo é o <strong>VTurb</strong>).{" "}
          <strong>CTA, Captura e Compras</strong> são exatos (o VTurb não enxerga
          isso). &quot;Compras&quot; depende do webhook Hotmart → vendas.
        </p>
      </div>

      {/* Lista de leads */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Leads capturados ({leads.length})
        </h2>
        <div className="mb-3">
          <LeadsToolbar leads={leads} from={from} to={to} />
        </div>
        {leads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            Nenhum lead capturado ainda. Aparecem aqui quando alguém preenche o
            bloco/popup de captura.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  {cols.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-4 py-3 font-medium">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-slate-100 last:border-0">
                    {cols.map((c) => {
                      let val = lead[c.key] as string | null;
                      if (c.key === "created_at" && val) {
                        val = new Date(val).toLocaleString("pt-BR");
                      }
                      return (
                        <td
                          key={c.key}
                          className="whitespace-nowrap px-4 py-3 text-slate-700"
                        >
                          {val ?? "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
