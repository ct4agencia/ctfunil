import { NextResponse } from "next/server";
import { workspaceLiveReader } from "@/lib/quiz/workspace-live-read";
import { isReadOnlyWorkspace } from "@/lib/workspace-preview";
import { requireAdmin } from "@/lib/quiz/admin-guard";
import { createAdminClient } from "@/lib/supabase/server";
import { funnelMetrics, type MetricsIssue } from "@/lib/quiz/metrics";
// Mesmo módulo de colunas do CSV: é o que faz a tela e a planilha baterem.
import { colunasDoFunil, gruposDeColunas, incluirColunasHistoricas, incluirSessoesComRespostas } from "@/lib/quiz/colunas";

type QueryPage<Row> = {
  data: Row[] | null;
  count: number | null;
  error: { code: string; message: string } | null;
};

async function readBatches<Row>(
  read: (offset: number, size: number, count: boolean) => PromiseLike<QueryPage<Row>>,
  limit: number,
): Promise<QueryPage<Row>> {
  const first = await read(0, Math.min(limit, 1000), true);
  if (first.error || !first.data || first.count === null) return first;

  const data = first.data;
  const target = Math.min(first.count, limit);
  while (data.length < target) {
    const page = await read(data.length, Math.min(target - data.length, 1000), false);
    if (page.error) return { data, count: first.count, error: page.error };
    if (!page.data?.length) break;
    data.push(...page.data);
  }
  return { data, count: first.count, error: null };
}

/**
 * Análise por funil (sub-abas Respostas / Resultados / Performance, estilo inlead).
 * Admin only. Junta funnelMetrics (Performance) + quiz_answers (Resultados por
 * pergunta) + respostas por lead (sessão → respostas + nome/telefone).
 */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const live = workspaceLiveReader(request.headers.get("host"), admin.supabase);
  if (isReadOnlyWorkspace() && !live) {
    return NextResponse.json({ error: "Consulte os indicadores no relatório do funil no preview." }, {
      status: 403, headers: { "Cache-Control": "no-store" },
    });
  }
  const params = new URL(request.url).searchParams;
  const slug = params.get("slug") || "";
  if (!/^[a-z0-9_-]{1,120}$/.test(slug)) return NextResponse.json({ error: "Funil inválido." }, { status: 400 });
  // Filtro de datas (ISO, por created_at). Vazio = tudo.
  const from = params.get("from") || undefined;
  const to = params.get("to") || undefined;
  if ([from, to].some(value => value && !Number.isFinite(Date.parse(value)))) {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  }
  const range = { from, to };

  // PERF: tudo paralelizável roda junto — antes eram ~9 round trips EM SÉRIE
  // (funnelMetrics atual → funnelMetrics anterior → answers → leads → sessions).
  const sb = live ?? createAdminClient();

  // Resultados: por pergunta → opções com contagem/%
  // `step_id` entra para casar a resposta com a COLUNA certa. A sub-aba
  // Resultados continua agrupando por `question` (o texto), mas a tabela de
  // Respostas junta por lâmina — assim renomear a pergunta não órfã a coluna.
  const through = to ?? new Date().toISOString();
  const answersQuery = (offset: number, size: number, count: boolean) => {
    const query = sb.from("quiz_answers")
      .select("session_id,step_id,question,answer,created_at", count ? { count: "exact" } : undefined)
      .eq("funnel_slug", slug).lte("created_at", through).order("id");
    return (from ? query.gte("created_at", from) : query).range(offset, offset + size - 1).abortSignal(request.signal);
  };

  // Estrutura do funil → as MESMAS colunas que o CSV usa.
  const funilRes = await sb.from("funnels").select("name,steps,settings").eq("slug", slug).maybeSingle();
  if (live && (funilRes.error || !funilRes.data)) {
    return NextResponse.json({ error: "Não foi possível consultar o funil publicado." }, {
      status: funilRes.error ? 502 : 404, headers: { "Cache-Control": "private, no-store" },
    });
  }
  const source = live && funilRes.data ? { client: live, funnel: funilRes.data } : undefined;

  // Respostas: por lead (sessão → respostas + dados do lead capturado)
  const leadsQuery = (offset: number, size: number, count: boolean) => {
    const query = sb.from("funnel_leads")
      .select("session_id,name,phone,created_at,utm_source,utm_medium,utm_campaign,utm_content,utm_term,src,fbclid,ctwa_clid,source_id,viewport,screen,platform,user_agent", count ? { count: "exact" } : undefined)
      .eq("funnel_slug", slug).lte("created_at", through).order("created_at", { ascending: false }).order("id", { ascending: false });
    return (from ? query.gte("created_at", from) : query).range(offset, offset + size - 1).abortSignal(request.signal);
  };

  // Tracking da SESSÃO (fallback): a campanha/origem é capturada na sessão; se o
  // lead foi salvo sem utm, puxamos da sessão pra aparecer também nas Respostas.
  // `created_at` e `max_step_reached` entram porque a LINHA da tabela passou a
  // ser a SESSÃO (igual ao inlead e ao CSV): a data vem daqui, e o "clicked" dos
  // botões é derivado do progresso — mesma regra que o CSV já usava.
  const sessionsQuery = (offset: number, size: number, count: boolean) => {
    const query = sb.from("funnel_sessions")
      .select("session_id,created_at,max_step_reached,utm_source,utm_medium,utm_campaign,utm_content,utm_term,src,ctwa_clid,source_id", count ? { count: "exact" } : undefined)
      .eq("funnel_slug", slug).lte("created_at", through).order("created_at", { ascending: false }).order("id", { ascending: false });
    return (from ? query.gte("created_at", from) : query).range(offset, offset + size - 1).abortSignal(request.signal);
  };

  // Período anterior (deltas): mesma duração imediatamente antes do início.
  const prevRange = from
    ? (() => {
        const fromMs = new Date(from).getTime();
        const toMs = to ? new Date(to).getTime() : Date.now();
        const len = Math.max(1, toMs - fromMs);
        return { from: new Date(fromMs - len).toISOString(), to: new Date(fromMs).toISOString() };
      })()
    : null;

  const [performance, prev, ansRes, leadsRes, sessRes] = await Promise.all([
    funnelMetrics(slug, range, source),
    prevRange ? funnelMetrics(slug, prevRange, source) : Promise.resolve(null),
    readBatches(answersQuery, 50000),
    readBatches(leadsQuery, 5000),
    readBatches(sessionsQuery, 20000),
  ]);
  const { data: answers } = ansRes, { data: leads } = leadsRes, { data: sessRows } = sessRes;

  // O supabase-js não lança em erro do PostgREST — sem ler `error`, uma falha de
  // banco virava tabela vazia, indistinguível de "funil sem tráfego".
  const erros: MetricsIssue[] = [];
  const anota = (e: { code?: string; message: string } | null, oque: string, campos: string[]) => {
    if (e) erros.push({ code: e.code === "42703" ? "coluna_ausente" : "db_error", msg: oque, campos, detalhe: `${e.code ?? ""} ${e.message}`.trim() });
  };
  anota(ansRes.error, "Não consegui ler as respostas do quiz.", ["resultados", "questions", "respostas"]);
  anota(leadsRes.error, "Não consegui ler os leads.", ["respostas"]);
  anota(sessRes.error, "Não consegui ler o rastreamento das sessões.", ["respostas"]);
  for (const [result, label, campos] of [
    [sessRes, "sessões", ["respostas"]],
    [leadsRes, "leads", ["respostas"]],
    [ansRes, "respostas", ["respostas", "resultados"]],
  ] as const) {
    if (result.count === null || !result.data || result.count <= result.data.length) continue;
    erros.push({
      code: "amostra_truncada",
      msg: `Exibindo ${result.data.length.toLocaleString("pt-BR")} de ${result.count.toLocaleString("pt-BR")} ${label}. Selecione um período menor para consultar os demais registros.`,
      campos: [...campos],
    });
  }

  let deltas: Record<string, number> | null = null;
  if (prev) {
    const pct = (cur: number, prv: number) => (prv > 0 ? Math.round(((cur - prv) / prv) * 1000) / 10 : cur > 0 ? 100 : 0);
    deltas = {
      visitantes: pct(performance.visitantes, prev.visitantes),
      respostas: pct(performance.respostas, prev.respostas),
      leads: pct(performance.leads, prev.leads),
      conclusoes: pct(performance.conclusoes, prev.conclusoes),
      score: pct(performance.score, prev.score),
      taxaConclusao: pct(performance.taxaConclusao, prev.taxaConclusao),
      taxaInteracao: pct(performance.taxaInteracao, prev.taxaInteracao),
      taxaRejeicao: pct(performance.taxaRejeicao, prev.taxaRejeicao),
      mediaEtapas: pct(performance.mediaEtapas, prev.mediaEtapas),
      tempoMedioSeg: pct(performance.tempoMedioSeg, prev.tempoMedioSeg),
    };
  }
  const qMap = new Map<string, Map<string, number>>();
  const qOrder: string[] = [];
  const bySession = new Map<string, Record<string, string>>();
  const qSessions = new Map<string, Set<string>>(); // pergunta → sessões distintas (retenção real)
  for (const a of answers ?? []) {
    const q = (a.question as string)?.trim() || "—";
    const ans = (a.answer as string)?.trim() || "—";
    const sid = String(a.session_id ?? "");
    if (!qMap.has(q)) { qMap.set(q, new Map()); qOrder.push(q); }
    const am = qMap.get(q)!;
    am.set(ans, (am.get(ans) ?? 0) + 1);
    if (sid) {
      if (!bySession.has(sid)) bySession.set(sid, {}); bySession.get(sid)![q] = ans;
      if (!qSessions.has(q)) qSessions.set(q, new Set()); qSessions.get(q)!.add(sid);
    }
  }
  const resultados = qOrder.map((question) => {
    const am = qMap.get(question)!;
    const total = Array.from(am.values()).reduce((a, b) => a + b, 0);
    return {
      question, total,
      options: Array.from(am.entries())
        .map(([label, value]) => ({ label, value, pct: total ? Math.round((value / total) * 1000) / 10 : 0 }))
        .sort((a, b) => b.value - a.value),
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leadBy = new Map((leads ?? []).map((l: any) => [String(l.session_id ?? ""), l]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessBy = new Map((sessRows ?? []).map((s: any) => [String(s.session_id ?? ""), s]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trackOf = (l: any, sid: string) => {
    const s = sessBy.get(sid) || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pick = (k: string) => (l?.[k] || (s as any)?.[k] || "");
    return {
      utm_source: pick("utm_source"), utm_medium: pick("utm_medium"), utm_campaign: pick("utm_campaign"),
      utm_content: pick("utm_content"), utm_term: pick("utm_term"), src: pick("src"), fbclid: l?.fbclid || "",
      ctwa_clid: pick("ctwa_clid"), source_id: pick("source_id"), viewport: l?.viewport || "", screen: l?.screen || "",
      platform: l?.platform || "", user_agent: l?.user_agent || "",
    };
  };
  // ── COLUNAS: as mesmas do CSV (lib/quiz/colunas.ts) ───────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentCols = colunasDoFunil(((funilRes?.data?.steps as any[]) ?? []), funilRes.data?.settings);
  const typebot = funilRes.data?.settings?.engine === "typebot";
  const cols = typebot ? incluirColunasHistoricas(currentCols, answers ?? []) : currentCols;
  const sessions = sessRows ?? [];
  const responseSessions = typebot ? incluirSessoesComRespostas(sessions, answers ?? []) : sessions;
  const grupos = gruposDeColunas(cols);

  // resposta por sessão+lâmina — a junção é por step_id, NUNCA pelo texto da
  // pergunta (renomear a pergunta não pode órfãr a coluna)
  const ansByStep = new Map<string, Map<string, string>>();
  for (const a of answers ?? []) {
    const sid = String(a.session_id ?? "");
    const st = String((a as { step_id?: string }).step_id ?? "");
    if (!sid || !st) continue;
    if (!ansByStep.has(sid)) ansByStep.set(sid, new Map());
    ansByStep.get(sid)!.set(st, String(a.answer ?? "").trim());
  }

  /**
   * A LINHA é a SESSÃO, como no inlead (prints 20: linhas 12, 15 e 27 têm
   * "clicked" e nenhuma resposta) e como o CSV já fazia. Antes a tela só
   * mostrava quem respondeu algo, então lead de funil só-VSL sumia da lista.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const respostas = (responseSessions as any[]).map((s) => {
    const sid = String(s.session_id ?? "");
    const l = leadBy.get(sid);
    const max = Number(s.max_step_reached ?? 0);
    const porStep = ansByStep.get(sid);
    const cells: Record<string, string> = {};
    for (const c of cols) {
      if (c.kind === "options") cells[c.key] = (c.layerId ? porStep?.get(c.layerId) : undefined) ?? porStep?.get(c.stepId) ?? "";
      // mesma regra do CSV: botão "clicado" = a sessão passou daquela lâmina
      else if (c.kind === "button") cells[c.key] = max > c.stepIdx ? "clicked" : "";
      // lâmina sem interação: registra só se a sessão chegou a vê-la
      else if (c.kind === "passou") cells[c.key] = max >= c.stepIdx ? "visto" : "";
      else {
        const n = (c.fieldName || "").toLowerCase();
        cells[c.key] = c.layerId && porStep?.has(c.layerId) ? (porStep.get(c.layerId) ?? "") : /tel|phone|whats/.test(n) ? ((l?.phone as string) ?? "")
          : /nome|name/.test(n) ? ((l?.name as string) ?? "")
            : "";
      }
    }
    return {
      // mesmo `code` do CSV, pra conferir linha a linha entre tela e planilha
      code: sid.replace(/::.*$/, "").replace(/^s-/, "").slice(0, 12),
      session: sid.slice(0, 8),
      when: (s.created_at as string) || null,
      name: (l?.name as string) || null,
      phone: (l?.phone as string) || null,
      temResposta: !!porStep?.size,
      virouLead: !!l,
      fromAnswer: s.fromAnswer === true,
      cells,
      // compat: a tela antiga lia `answers` por texto de pergunta
      answers: bySession.get(sid) ?? {},
      track: trackOf(l, sid),
    };
  });

  // % de conclusão por etapa = SESSÕES distintas que responderam a etapa ÷ sessões
  // da 1ª etapa (1ª = 100%). Conta sessões, não linhas — multi-seleção / re-resposta
  // não inflam mais o número (era o bug do "100→50→100").
  const baseSess = qOrder[0] ? (qSessions.get(qOrder[0])?.size ?? 0) : 0;
  const questionStats = qOrder.map((question) => {
    const reached = qSessions.get(question)?.size ?? 0;
    return { question, total: reached, pct: baseSess ? Math.min(100, Math.round((reached / baseSess) * 100)) : 0 };
  });

  // HTTP 200 de propósito mesmo degradado: o cliente (LayersBuilder.tsx:757) não
  // checa `r.ok`, então um 5xx cairia no .catch() e apagaria a tela inteira em
  // vez de mostrar o aviso. A flag vai no corpo.
  return NextResponse.json({
    performance, deltas, resultados, questions: qOrder, questionStats, respostas,
    // colunas/grupos = o cabeçalho de 2 linhas do inlead (lâmina em cima, bloco
    // embaixo com a chave). São as MESMAS colunas do CSV.
    cols, grupos,
    totais: {
      sessoes: respostas.length,
      semVisita: respostas.length - sessions.length,
      comResposta: respostas.filter((r) => r.temResposta).length,
      leads: respostas.filter((r) => r.virouLead).length,
    },
    degraded: performance.degraded || erros.length > 0,
    issues: [...performance.issues, ...erros],
  }, { headers: { "Cache-Control": "private, no-store" } });
}
