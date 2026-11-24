"use client";

import WorkspaceCheckbox from "@/components/ui/WorkspaceCheckbox";

import WorkspaceMultiSelect from "@/components/ui/WorkspaceMultiSelect";
import WorkspaceDateRange, { analyticsDateKey, calendarSeriesDays, type DateRange } from "@/components/ui/WorkspaceDateRange";
import Bars from "./Bars";
import ResponseFilters from "./ResponseFilters";
import SnapshotRangeCoverage from "./SnapshotRangeCoverage";
import { useSnapshotDateRange } from "./useSnapshotDateRange";
import SnapshotQuizView, { type QuizSnapshot } from "./SnapshotQuizView";
import SnapshotLeadsView, { type LeadsDaily } from "./SnapshotLeadsView";
import SnapshotSalesView, { type SalesSnapshot } from "./SnapshotSalesView";
import SnapshotVslView, { type VslSnapshot } from "./SnapshotVslView";
import SnapshotDiagnosisView, { type DiagnosisSnapshot } from "./SnapshotDiagnosisView";
import SnapshotTimestamp from "./SnapshotTimestamp";
import Pagination from "@/components/ui/Pagination";
import ActiveTab from "@/components/ui/ActiveTab";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import { useRouter, useSearchParams } from "next/navigation";
import { filterAttribution, type AttributionDaily } from "@/lib/analytics-attribution";
import type { GlobalAnalytics } from "@/lib/quiz/metrics";
import ContainerScroll from "@/components/ui/ContainerScroll";
import VslDetail from "@/components/dashboard/VslDetail";
import { House, Scale, CircleDollarSign, Stethoscope, CircleHelp, Palette, Play, TrendingUp, Settings, Users, Construction, GripVertical, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";
import VslCompare from "@/components/dashboard/VslCompare";
import AdAccountCard, { type AdAccount, UNVERIFIED_AD_ACCOUNT } from "./AdAccountCard";

const operationColumns = [
  ["name", "Funil"], ["visitantes", "Sessões"], ["respostas", "Respostas"],
  ["leads", "Leads"], ["taxaConclusao", "Conclusão"], ["score", "Score"],
] as const;
const OPERATION_PAGE_SIZE = 12;
const OPERATION_ROW_HEIGHT = 48;
const OPERATION_VIEWPORT_HEIGHT = 512;
const OPERATION_OVERSCAN = 4;
const operationWidths = { name: 250, visitantes: 115, respostas: 122, leads: 100, taxaConclusao: 125, score: 100 };
type OperationSort = (typeof operationColumns)[number][0];

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-ct-line bg-ct-surface p-4">
      <p className="text-[13px] font-medium text-ct-dim">{label}</p>
      <p className="mt-2 text-[24px] font-bold leading-none tracking-tight text-ct-ink">{value}</p>
      {sub ? <p className="mt-1.5 text-xs text-ct-dim">{sub}</p> : null}
    </div>
  );
}

function DailyChart({ data }: { data: GlobalAnalytics["overview"]["daily"] }) {
  const max = Math.max(1, ...data.map((d) => d.sessoes));
  const number = new Intl.NumberFormat("pt-BR");
  return (
    <ul className="flex h-40 items-stretch gap-1 px-1 sm:gap-3" aria-label="Sessões por dia no período selecionado">
      {data.map(day => (
        <li key={day.day} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div className="flex w-full min-h-0 flex-1 items-end" aria-hidden="true">
            <div className="w-full rounded-t-md bg-ct-action" style={{ height: `${day.sessoes / max * 100}%`, minHeight: day.sessoes ? 4 : 0 }} title={number.format(day.sessoes)} />
          </div>
          <span className="text-[10px] text-ct-dim">{day.day}<span className="sr-only"> · {number.format(day.sessoes)} sessões</span></span>
        </li>
      ))}
    </ul>
  );
}

function ComingSoon({ title, desc, source }: { title: string; desc: string; source: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ct-line-strong bg-ct-surface p-8 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-ct-raised"><Construction size={20} aria-hidden="true"/></div>
      <h3 className="text-base font-bold text-ct-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-ct-dim">{desc}</p>
      <p className="mx-auto mt-3 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Fonte de dados: {source}</p>
    </div>
  );
}

const TABS = [
  { key: "geral", label: "Visão Geral", icon: House },
  { key: "comparar", label: "Comparar", icon: Scale },
  { key: "vendas", label: "Vendas", icon: CircleDollarSign },
  { key: "diagnostico", label: "Diagnóstico", icon: Stethoscope },
  { key: "quiz", label: "Quiz", icon: CircleHelp },
  { key: "criativos", label: "Criativos", icon: Palette },
  { key: "vsl", label: "VSL", icon: Play },
  { key: "trafego", label: "Tráfego", icon: TrendingUp },
  { key: "operacao", label: "Operação", icon: Settings },
  { key: "leads", label: "Leads", icon: Users },
] as const;
type TabKey = (typeof TABS)[number]["key"];
const isTab = (v: string | null): v is TabKey => !!v && TABS.some((t) => t.key === v);
export default function GlobalAnalyticsView({ data, preview = false, accountEmail, snapshotAt, attributionCapturedAt, attributionDaily, adAccounts, vslSnapshot, salesSnapshot, quizSnapshot, diagnosisSnapshot, leadsDaily, editableSlugs }: { data: GlobalAnalytics; preview?: boolean; accountEmail?: string; snapshotAt?: string; attributionCapturedAt?: string; attributionDaily?: AttributionDaily; adAccounts?: AdAccount[]; vslSnapshot?: VslSnapshot; salesSnapshot?: SalesSnapshot; quizSnapshot?: QuizSnapshot; diagnosisSnapshot?: DiagnosisSnapshot; leadsDaily?: LeadsDaily; editableSlugs?: string[] }) {
  const router = useRouter();
  const [operationQuery, setOperationQuery] = useState("");
  const operationSearch = useRef<HTMLInputElement>(null);
  const [operationPage, setOperationPage] = useState(1);
  const [continuous, setContinuous] = useState(false);
  const [operationWindow, setOperationWindow] = useState(0);
  const operationRegion = useRef<HTMLDivElement>(null);
  const attachOperationRegion = useCallback((region: HTMLDivElement | null) => {
    operationRegion.current = region;
    if (region) setOperationWindow(0);
  }, []);

  function resetOperationScroll() {
    setOperationWindow(0);
    if (operationRegion.current) operationRegion.current.scrollTop = 0;
  }
  const [columns, setColumns] = useState<ReadonlyArray<(typeof operationColumns)[number]>>(operationColumns);
  const [widths, setWidths] = useState(operationWidths);
  const [adjustedColumn, setAdjustedColumn] = useState<OperationSort>("name");
  const adjustedIndex = columns.findIndex(([key]) => key === adjustedColumn);

  const gesture = useRef<{ key: OperationSort; x: number; width: number; mode: "move" | "resize" } | null>(null);
  const [dropColumn, setDropColumn] = useState<string | null>(null);

  function placeOperationColumn(key: OperationSort, target: string) {
    setColumns(previous => {
      const from = previous.findIndex(([column]) => column === key);
      const to = previous.findIndex(([column]) => column === target);
      if (from === to || from < 0 || to < 0) return previous;
      const next = [...previous];
      next.splice(to, 0, ...next.splice(from, 1));
      return next;
    });
  }

  function moveOperationColumn(direction: -1 | 1) {
    const target = columns[adjustedIndex + direction];
    if (target) placeOperationColumn(adjustedColumn, target[0]);
  }

  function startColumnGesture(event: PointerEvent<HTMLSpanElement>, key: OperationSort, mode: "move" | "resize") {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { key, mode, x: event.clientX, width: widths[key] };
  }

  function columnAtPointer(event: PointerEvent<HTMLSpanElement>) {
    return document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("th[data-operation-column]")?.dataset.operationColumn;
  }

  function updateColumnGesture(event: PointerEvent<HTMLSpanElement>) {
    const drag = gesture.current;
    if (!drag || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    if (drag.mode === "move") {
      setDropColumn(columnAtPointer(event) ?? null);
      return;
    }
    const min = drag.key === "name" ? 150 : 100;
    const width = Math.max(min, Math.min(420, Math.round(drag.width + event.clientX - drag.x)));
    setWidths(previous => ({ ...previous, [drag.key]: width }));
  }

  function endColumnGesture(event: PointerEvent<HTMLSpanElement>) {
    const drag = gesture.current;
    if (!drag || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const destination = columnAtPointer(event);
    if (drag.mode === "move" && destination) placeOperationColumn(drag.key, destination);
    gesture.current = null;
    setDropColumn(null);
  }

  function columnHandleEvents(key: OperationSort, mode: "move" | "resize") {
    return {
      onPointerDown: (event: PointerEvent<HTMLSpanElement>) => startColumnGesture(event, key, mode),
      onPointerMove: updateColumnGesture,
      onPointerUp: endColumnGesture,
      onLostPointerCapture: () => { gesture.current = null; setDropColumn(null); },
    };
  }

  const [operationSort, setOperationSort] = useState<{ key: OperationSort; ascending: boolean }>({ key: "visitantes", ascending: false });
  const referenceDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" })
    .format(new Date(snapshotAt || Date.now()));
  const chartDates = data.overview.daily
    .map(item => ({ item, day: analyticsDateKey(item.day, referenceDay) }))
    .filter(({ day }) => Boolean(day))
    .sort((left, right) => left.day.localeCompare(right.day));
  const chartDays = chartDates.map(({ day }) => day);
  const {
    range: chartRange, changeRange: setChartRange,
    outsideCapture: chartOutsideCapture, beforeCapture: chartBeforeCapture, partialCapture: chartPartialCapture,
  } = useSnapshotDateRange(chartDays, "sessoes", true);
  const chartData = chartDates.filter(({ day }) =>
    (!chartRange.from || day >= chartRange.from) && (!chartRange.to || day <= chartRange.to)
  ).map(({ item }) => item);
  const operationRows = useMemo(() => {
    const query = operationQuery.trim().toLocaleLowerCase("pt-BR");
    const { key, ascending } = operationSort;
    return data.operacao.filter(row => `${row.name} ${row.slug}`.toLocaleLowerCase("pt-BR").includes(query)).sort((a, b) => {
      const order = key === "name" ? a.name.localeCompare(b.name, "pt-BR") : a[key] - b[key];
      return (ascending ? order : -order) || a.slug.localeCompare(b.slug);
    });
  }, [data.operacao, operationQuery, operationSort]);
  const operationTotalPages = Math.max(1, Math.ceil(operationRows.length / OPERATION_PAGE_SIZE));
  const currentOperationPage = Math.min(operationPage, operationTotalPages);
  const operationStart = (currentOperationPage - 1) * OPERATION_PAGE_SIZE;
  const pageRows = operationRows.slice(operationStart, operationStart + OPERATION_PAGE_SIZE);

  const visibleStart = continuous ? Math.max(0, operationWindow - OPERATION_OVERSCAN) : operationStart;
  const visibleEnd = continuous
    ? Math.min(operationRows.length, operationWindow + Math.ceil(OPERATION_VIEWPORT_HEIGHT / OPERATION_ROW_HEIGHT) + OPERATION_OVERSCAN + 1)
    : operationStart + pageRows.length;
  const renderedRows = continuous ? operationRows.slice(visibleStart, visibleEnd) : pageRows;
  const selectionRows = continuous ? operationRows : pageRows;

  function searchOperation(query: string) {
    resetOperationScroll();
    setOperationQuery(query);
    setOperationPage(1);
  }

  function clearOperationSearch() {
    searchOperation("");
    operationSearch.current?.focus();
  }

  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab = isTab(tabParam) ? tabParam : "geral";
  function setTab(next: TabKey) {
    if (next === tab) return;
    if (next === "operacao" || tab === "operacao") resetOperationScroll();
    const url = new URL(window.location.href);
    if (next === "geral") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.pushState(null, "", url);
  }
  const o = data.overview;
  const topFunnel = data.operacao[0]?.slug;
  // preview do funil em destaque só carrega no clique (iframe pesado na 1ª dobra)
  const [showPreview, setShowPreview] = useState(false);
  const comparisonSlugs = useMemo(() => new Set(data.operacao.map(row => row.slug)), [data.operacao]);
  const cmp = useMemo(() => [...new Set(searchParams.getAll("comparar"))].filter(slug => comparisonSlugs.has(slug)),
    [searchParams, comparisonSlugs]);

  function setCmp(next: string[]) {
    const url = new URL(window.location.href);
    url.searchParams.delete("comparar");
    for (const slug of next) url.searchParams.append("comparar", slug);
    window.history.replaceState(null, "", url);
  }

  const reportComparisonQuery = new URLSearchParams(cmp.map(slug => ["comparar", slug]));

  const selectedForComparison = useMemo(() => new Set(cmp), [cmp]);
  const selectedOnPage = useMemo(() => selectionRows.filter(row => selectedForComparison.has(row.slug)).length,
    [selectionRows, selectedForComparison]);
  const entirePageSelected = selectionRows.length > 0 && selectedOnPage === selectionRows.length;

  function toggleComparisonRow(slug: string) {
    setCmp(selectedForComparison.has(slug) ? cmp.filter(item => item !== slug) : [...cmp, slug]);
  }

  function toggleComparisonPage() {
    const pageSlugs = new Set(selectionRows.map(row => row.slug));
    setCmp(entirePageSelected
      ? cmp.filter(slug => !pageSlugs.has(slug))
      : [...new Set([...cmp, ...pageSlugs])]);
  }
  const cmpRows = useMemo(() => {
    const rows = new Map(data.operacao.map(row => [row.slug, row]));
    return cmp.flatMap(slug => {
      const row = rows.get(slug);
      return row ? [row] : [];
    });
  }, [cmp, data.operacao]);
  // seleção de criativos e de VSLs pra comparação
  const [cmpCreat, setCmpCreat] = useState<string[]>([]);
  const toggleCreat = (c: string) => setCmpCreat((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  // ordenação + filtro por funil dos criativos (comináveis: 1 slug + conversão desc)
  const [creatSort, setCreatSort] = useState<"leads" | "clicks" | "conv" | "slug">("leads");
  const [creatFunnel, setCreatFunnel] = useState<string>("");
  const [accountFilter, setAccountFilter] = useState("");
  const attributionDays = useMemo(() => attributionDaily
    ? calendarSeriesDays([...attributionDaily.sources, ...attributionDaily.campaigns, ...attributionDaily.creatives],
      attributionDaily.capturedAt, attributionDaily.timeZone)
    : [], [attributionDaily]);
  const responseFunnels = useMemo(() => Array.from(new Map([
    ...(quizSnapshot?.quiz ?? []), ...(diagnosisSnapshot?.questions ?? []),
  ].map(row => [row.slug, row.name])).entries())
    .sort((left, right) => left[1].localeCompare(right[1], "pt-BR"))
    .map(([value, name]) => ({ value, label: `${name} (/${value})` })), [quizSnapshot, diagnosisSnapshot]);
  const responseSnapshot = tab === "diagnostico" ? diagnosisSnapshot : quizSnapshot;
  const responseDays = useMemo(() => calendarSeriesDays(
    responseSnapshot?.daily ?? [], responseSnapshot?.captured_at ?? "", "America/Sao_Paulo",
  ), [responseSnapshot]);
  const {
    range: attributionRange, changeRange: setAttributionRange,
    outsideCapture: attributionOutsideCapture, partialCapture: attributionPartialCapture,
  } = useSnapshotDateRange(attributionDays, "atr");
  const { from: attributionFrom, to: attributionTo } = attributionRange;
  const { traffic, creatives: periodCreatives } = useMemo(
    () => filterAttribution(data, attributionDaily, { from: attributionFrom, to: attributionTo }),
    [data, attributionDaily, attributionFrom, attributionTo],
  );

  function changeAttributionRange(range: DateRange) {
    setAttributionRange(range);
    setCreatFunnel("");
    setCmpCreat([]);
  }

  const account = adAccounts?.find(item => item.id === accountFilter);
  const verifiedCreatives = useMemo(() => new Set(adAccounts?.flatMap(item => item.creatives)), [adAccounts]);
  const unverifiedBySource = useMemo(() => {
    const counts = new Map<string, number>();
    for (const creative of data.creatives) {
      if (verifiedCreatives.has(creative.content)) continue;
      const source = creative.source?.trim().toLowerCase();
      const label = source === "fb" || source === "facebook" ? "Facebook"
        : source === "google" ? "Google"
        : creative.source?.trim() || "Origem não informada";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [data.creatives, verifiedCreatives]);
  const accountCreatives = useMemo(() => {
    if (accountFilter === UNVERIFIED_AD_ACCOUNT) {
      return periodCreatives.filter(creative => !verifiedCreatives.has(creative.content));
    }
    if (!account) return periodCreatives;
    const included = new Set(account.creatives);
    return periodCreatives.filter(creative => included.has(creative.content));
  }, [account, accountFilter, periodCreatives, verifiedCreatives]);
  const creatSlugs = useMemo(() => Array.from(new Set(accountCreatives.flatMap((c) => c.funnels))).sort(), [accountCreatives]);
  const creatList = useMemo(() => {
    const base = creatFunnel ? accountCreatives.filter((c) => c.funnels.includes(creatFunnel)) : accountCreatives;
    const arr = [...base];
    if (creatSort === "clicks") arr.sort((a, b) => b.clicks - a.clicks);
    else if (creatSort === "conv") arr.sort((a, b) => b.conv - a.conv || b.leads - a.leads);
    else if (creatSort === "slug") arr.sort((a, b) => (a.funnels[0] ?? "").localeCompare(b.funnels[0] ?? ""));
    else arr.sort((a, b) => b.leads - a.leads || b.clicks - a.clicks);
    return arr;
  }, [accountCreatives, creatFunnel, creatSort]);
  // métricas VTurb (aba VSL) — carrega ao abrir a aba; players extras selecionáveis
  interface VtRow { playerId: string; playerName: string; funnels: { slug: string; name: string }[]; stats: { views: number; plays: number; playRate: number; engagement: number; pitchAudience: number; pitchRetention: number; clicks: number; conversions: number; convRate: number; amountBrl: number } }
  interface VtData { vsls: VtRow[]; allPlayers: { id: string; name: string; linked: boolean }[] }
  const [vturb, setVturb] = useState<VtData | "idle" | "loading" | "error" | "no_token">("idle");
  const [detailPlayer, setDetailPlayer] = useState<string | null>(null);
  const playerDetail = useRef<HTMLElement>(null);
  const playerDetailTrigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (detailPlayer) playerDetail.current?.focus();
  }, [detailPlayer]);

  function closePlayerDetail() {
    setDetailPlayer(null);
    playerDetailTrigger.current?.focus();
  }

  function togglePlayerDetail(id: string, trigger: HTMLButtonElement | null) {
    if (detailPlayer === id) {
      closePlayerDetail();
      return;
    }
    playerDetailTrigger.current = trigger;
    setDetailPlayer(id);
  }

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [cmpPlayers, setCmpPlayers] = useState<string[]>([]);
  const [extraPlayers, setExtraPlayers] = useState<string[]>([]);
  const loadVturb = (extras: string[]) => {
    setVturb("loading");
    fetch(`/api/vturb${extras.length ? `?players=${encodeURIComponent(extras.join(","))}` : ""}`)
      .then((r) => r.json())
      .then((d) => setVturb(d?.error === "no_token" ? "no_token" : d?.vsls ? (d as VtData) : "error"))
      .catch(() => setVturb("error"));
  };
  useEffect(() => {
    if (vslSnapshot || tab !== "vsl" || vturb !== "idle") return;
    let cancelled = false;
    const extras = extraPlayers;
    async function run() {
      try {
        const r = await fetch(`/api/vturb${extras.length ? `?players=${encodeURIComponent(extras.join(","))}` : ""}`);
        const d = await r.json();
        if (cancelled) return;
        setVturb(d?.error === "no_token" ? "no_token" : d?.vsls ? (d as VtData) : "error");
      } catch {
        if (!cancelled) setVturb("error");
      }
    }
    run();
    return () => { cancelled = true; };
  }, [tab, vturb, extraPlayers, vslSnapshot]);
  const [cmpVsl, setCmpVsl] = useState<string[]>([]);
  const toggleVsl = (slug: string) => setCmpVsl((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));
  // "VSL" por funil: quem chegou na lâmina de VSL (conclusão) e a taxa de chegada
  const vsls = useMemo(() => data.operacao.filter((r) => r.visitantes > 0).map((r) => ({
    slug: r.slug, name: r.name, visitantes: r.visitantes, chegaram: r.conclusoes,
    pct: r.visitantes ? Math.round((r.conclusoes / r.visitantes) * 1000) / 10 : 0, leads: r.leads,
  })), [data.operacao]);

  return (
    <WorkspaceFrame title="Analytics" activeTab={tab} accountEmail={accountEmail} demo={preview && !snapshotAt}>
      {snapshotAt && <p className="mb-4 text-sm text-ct-dim">Dados reais em modo de consulta.</p>}
      <div className="ct-controls min-w-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => router.back()} title="Voltar" aria-label="Voltar"
                className="grid h-9 w-9 place-items-center rounded-lg border border-ct-line bg-ct-surface text-base font-bold text-ct-dim hover:bg-ct-raised">←</button>
              <div>
                <h1 className="text-[26px] font-bold tracking-tight">Analytics</h1>
                <p className="text-sm text-ct-dim">Visão consolidada de todos os funis</p>
              </div>
            </div>
            <Link href="/dashboard" className="rounded-lg border border-ct-line bg-ct-surface px-3 py-2 text-xs font-semibold text-ct-dim hover:bg-ct-raised">▦ Dashboard</Link>
          </div>

          {/* abas */}
          <div className="ct-segments mt-4" aria-label="Seções de Analytics">
            {TABS.map((t) => (
              <button type="button" key={t.key} aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
                {tab === t.key && <ActiveTab group="analytics-tabs" />}
                <span className="inline-flex items-center gap-1.5"><t.icon size={15} aria-hidden="true" />{t.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-5">
            {snapshotAt && (tab === "geral" || tab === "comparar" || tab === "operacao") && (
              <p className="mb-4 text-xs text-ct-dim">Dados capturados em <SnapshotTimestamp capturedAt={snapshotAt} />.</p>
            )}
            {attributionCapturedAt && (tab === "trafego" || tab === "criativos") && <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ct-dim">
              Atribuição capturada em <SnapshotTimestamp capturedAt={attributionCapturedAt} />.
              </p>
              {attributionDays.length > 0 && <WorkspaceDateRange allowEarlierDates days={attributionDays} value={attributionRange}
                onChange={changeAttributionRange} label="Período das sessões" />}
            </div>}
            {(tab === "trafego" || tab === "criativos") && <SnapshotRangeCoverage
              outsideCapture={attributionOutsideCapture} partialCapture={attributionPartialCapture}
              onReset={() => changeAttributionRange({ from: "", to: "" })} />}
            {tab === "geral" && (
              <div className="space-y-5">
                {topFunnel ? (
                  <ContainerScroll titleComponent={
                    <div className="pb-4">
                      <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Funil em destaque</p>
                      <h2 className="mt-1 text-3xl font-black tracking-tight text-ct-ink">{data.operacao[0].name}</h2>
                      <p className="mt-1 text-sm text-ct-dim">{data.operacao[0].visitantes} sessões · {data.operacao[0].taxaConclusao}% conclusão</p>
                    </div>
                  }>
                    {showPreview ? (
                      <iframe src={`/q/${topFunnel}?preview=1`} title="preview" loading="lazy" className="h-full w-full" />
                    ) : (
                      <button onClick={() => setShowPreview(true)} className="grid h-full w-full place-items-center bg-neutral-900 text-white">
                        <span className="flex flex-col items-center gap-2">
                          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10 text-2xl">▶</span>
                          <span className="text-sm font-semibold">Ver preview do funil</span>
                          <span className="text-xs text-white/50">carrega só quando você clicar (página mais rápida)</span>
                        </span>
                      </button>
                    )}
                  </ContainerScroll>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Card label="Funis" value={String(o.totalFunis)} sub="ativos" />
                  <Card label="Sessões" value={String(o.totalSessoes)} sub="visitantes" />
                  <Card label="Respostas" value={String(o.totalRespostas)} sub="iniciaram" />
                  <Card label="Leads" value={String(o.totalLeads)} sub="contatos" />
                  <Card label="Conclusões" value={`${o.taxaConclusao}%`} sub={`${o.totalConclusoes} concluíram`} />
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                  <section className="rounded-2xl border border-ct-line bg-ct-surface p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-ct-ink">Sessões por dia</h2>
                        {!chartOutsideCapture && <p role="status" className="mt-1 text-xs text-ct-dim">
                          {chartData.reduce((total, day) => total + day.sessoes, 0).toLocaleString("pt-BR")} sessões no período selecionado
                        </p>}
                      </div>
                      <WorkspaceDateRange days={chartDays} value={chartRange} onChange={setChartRange} />
                    </div>
                    <div className="mt-4">
                      <SnapshotRangeCoverage outsideCapture={chartOutsideCapture} beforeCapture={chartBeforeCapture} partialCapture={chartPartialCapture}
                        onReset={() => setChartRange({ from: "", to: "" })} />
                      {!chartOutsideCapture && (chartData.length ? <DailyChart data={chartData} /> : <p role="status" className="text-sm text-ct-dim">Sem sessões no período selecionado.</p>)}
                    </div>
                  </section>
                  <section className="rounded-2xl border border-ct-line bg-ct-surface p-5">
                    <h2 className="mb-3 text-sm font-semibold text-ct-ink">Sessões por funil</h2>
                    <Bars rows={o.porFunil.map((p) => ({ label: p.name, value: p.sessoes, pct: p.pct }))} />
                  </section>
                </div>
              </div>
            )}

            {tab === "comparar" && (
              <div className="space-y-4">
                <section className="rounded-2xl border border-ct-line bg-ct-surface p-5">
                  <h2 id="analytics-comparison-title" className="mb-2 text-sm font-bold text-ct-ink">Compare o desempenho dos funis</h2>
                  <p className="mb-3 text-xs text-ct-dim">Selecione pelo menos dois funis. O melhor valor de cada métrica aparece em destaque.</p>
                  <WorkspaceMultiSelect label="Funis para comparar" values={cmp} onChange={setCmp}
                    options={data.operacao.map(row => ({ value: row.slug, label: row.name, detail: `/${row.slug}` }))} />
                </section>
                {cmpRows.length >= 2 ? (
                  <section className="overflow-hidden rounded-2xl border border-ct-line bg-ct-surface">
                    <div className="ct-comparison-scroll overflow-x-auto" role="region" aria-label="Resultados da comparação" tabIndex={0}>
                      <table className="ct-comparison-table w-full text-sm" aria-labelledby="analytics-comparison-title">
                        <thead className="bg-ct-raised text-left text-xs font-semibold uppercase tracking-wide text-ct-dim">
                          <tr>
                            <th scope="col" className="px-4 py-3">Métrica</th>
                            {cmpRows.map((r) => <th scope="col" key={r.slug} className="max-w-[180px] truncate px-3 py-3" title={r.name}><Link className="text-ct-blue focus-visible:outline-ct-action" href={`/dashboard/${encodeURIComponent(r.slug)}?${reportComparisonQuery}`}>{r.name}</Link><div className="font-normal normal-case text-ct-dim">/{r.slug}</div></th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {([
                            ["Visitantes", (r: typeof cmpRows[number]) => r.visitantes, (v: number) => v.toLocaleString("pt-BR")],
                            ["Respostas (volume)", (r: typeof cmpRows[number]) => r.respostas, (v: number) => v.toLocaleString("pt-BR")],
                            ["% que respondem (respostas ÷ visitantes)", (r: typeof cmpRows[number]) => (r.visitantes ? Math.round((r.respostas / r.visitantes) * 1000) / 10 : null), (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`],
                            ["Leads (volume)", (r: typeof cmpRows[number]) => r.leads, (v: number) => v.toLocaleString("pt-BR")],
                            ["% que viram lead (leads ÷ visitantes)", (r: typeof cmpRows[number]) => (r.visitantes ? Math.round((r.leads / r.visitantes) * 1000) / 10 : null), (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`],
                            ["Chegadas à última etapa", (r: typeof cmpRows[number]) => r.conclusoes, (v: number) => v.toLocaleString("pt-BR")],
                            ["Taxa de conclusão", (r: typeof cmpRows[number]) => r.visitantes ? r.taxaConclusao : null, (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`],
                            ["Score", (r: typeof cmpRows[number]) => r.score, (v: number) => v.toLocaleString("pt-BR")],
                          ] as const).map(([label, get, fmt]) => {
                            const vals = cmpRows.map((r) => get(r));
                            const best = Math.max(0, ...vals.filter((value): value is number => value !== null));
                            const leaders = best > 0 ? vals.filter(value => value === best).length : 0;
                            return (
                              <tr key={label} className="border-t border-ct-line">
                                <th scope="row" className="px-4 py-2.5 text-left font-medium text-ct-dim">{label}</th>
                                {vals.map((v, i) => (
                                  <td key={cmpRows[i].slug} className={`px-3 py-2.5 font-bold ${v === best && leaders > 0 ? "text-green-600" : "text-ct-ink"}`}>
                                    {v === null ? <span className="font-normal text-ct-dim">Sem sessões</span> : fmt(v)}
                                    {v === best && leaders > 0 && <span className="ml-1 text-[10px] font-normal">{leaders > 1 ? "empate" : "melhor"}</span>}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="border-t border-ct-line px-4 py-3 text-[11px] text-ct-dim">Destaque para o melhor resultado de cada linha.</p>
                  </section>
                ) : (
                  <div className="rounded-2xl border border-dashed border-ct-line-strong bg-ct-surface p-8 text-center text-sm text-ct-dim">Selecione pelo menos 2 funis pra ver a comparação lado a lado.</div>
                )}
              </div>
            )}

            {tab === "quiz" && quizSnapshot && <ResponseFilters funnels={responseFunnels} days={responseDays}>
              {(funnel, range) => <SnapshotQuizView data={quizSnapshot} funnel={funnel} reportRange={range} />}
            </ResponseFilters>}
            {tab === "quiz" && !quizSnapshot && (
              <div className="space-y-4">
                {data.quiz.length ? data.quiz.map((q) => (
                  <section key={q.question} className="rounded-2xl border border-ct-line bg-ct-surface p-5">
                    <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-ct-ink">{q.question}</h3><span className="text-xs text-ct-dim">{q.total} respostas</span></div>
                    <Bars rows={q.options.map((opt) => ({ label: opt.label, value: opt.value, pct: opt.pct }))} color="#8b5cf6" />
                  </section>
                )) : <ComingSoon title="Sem respostas ainda" desc="Quando o público responder os quizzes, a distribuição de cada pergunta aparece aqui." source="quiz_answers" />}
              </div>
            )}

            {tab === "trafego" && !attributionOutsideCapture && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <p className="text-xs text-ct-dim lg:col-span-2" role="status">{traffic.total.toLocaleString("pt-BR")} sessões com origem rastreada</p>
                <section className="rounded-2xl border border-ct-line bg-ct-surface p-5"><h2 className="mb-3 text-sm font-semibold text-ct-ink">Origens (utm_source)</h2><Bars rows={traffic.sources.map((s) => ({ label: s.name, value: s.value, pct: s.pct }))} /></section>
                <section className="rounded-2xl border border-ct-line bg-ct-surface p-5"><h2 className="mb-3 text-sm font-semibold text-ct-ink">Campanhas (utm_campaign)</h2><Bars rows={traffic.campaigns.map((c) => ({ label: c.name, value: c.value, pct: c.pct }))} color="#ec4899" /></section>
              </div>
            )}

            {tab === "operacao" && (
              <section className="overflow-hidden rounded-2xl border border-ct-line bg-ct-surface">
                <header className="ct-section-heading">
                  <div><h2 id="operation-heading">Desempenho por funil</h2><p role="status">{!continuous && operationRows.length ? `${operationStart + 1}–${operationStart + pageRows.length} de ` : ""}{operationRows.length} funis encontrados</p></div>
                  <label className="ct-search"><input ref={operationSearch} aria-label="Buscar funil na operação" placeholder="Buscar funil" value={operationQuery}
                    onChange={event => searchOperation(event.target.value)} /></label>
                </header>
                {cmp.length > 0 && <div className="flex flex-wrap items-center gap-3 border-y border-ct-line px-4 py-2 text-xs">
                  <span role="status">{cmp.length} {cmp.length === 1 ? "funil selecionado" : "funis selecionados"}</span>
                  <button type="button" disabled={cmp.length < 2} onClick={() => setTab("comparar")}
                    className="rounded-lg bg-ct-action px-3 py-2 font-semibold text-white disabled:opacity-50">Comparar selecionados</button>
                  <button type="button" className="text-ct-blue underline" onClick={() => setCmp([])}>Limpar seleção</button>
                </div>}
                <label className="flex min-h-11 items-center gap-2 border-b border-ct-line px-4 text-sm">
                  <WorkspaceCheckbox checked={continuous} onChange={event => {
                    resetOperationScroll();
                    setContinuous(event.target.checked);
                  }} />
                  Rolagem contínua
                </label>
                <details className="ct-filter-disclosure border-b border-ct-line px-4 py-2">
                  <summary className="min-h-8 cursor-pointer py-1 text-sm font-semibold">Ajustar colunas</summary>
                  <div className="flex flex-wrap items-center gap-3 py-2 text-sm">
                    <WorkspaceSelect label="Coluna para ajustar" value={adjustedColumn}
                      options={columns.map(([value, label]) => ({ value, label }))}
                      onChange={value => {
                        const column = columns.find(([key]) => key === value);
                        if (column) setAdjustedColumn(column[0]);
                      }} />
                    <span role="status" className="text-ct-dim">Posição {adjustedIndex + 1} de {columns.length}</span>
                    <button type="button" disabled={adjustedIndex === 0} onClick={() => moveOperationColumn(-1)}
                      className="min-h-11 rounded-lg border border-ct-line px-2 disabled:opacity-50">Mover à esquerda</button>
                    <button type="button" disabled={adjustedIndex === columns.length - 1} onClick={() => moveOperationColumn(1)}
                      className="min-h-11 rounded-lg border border-ct-line px-2 disabled:opacity-50">Mover à direita</button>
                    <label className="flex min-h-11 flex-wrap items-center gap-2">
                      Largura <input type="range" min={adjustedColumn === "name" ? 150 : 100} max={420} step={1} value={widths[adjustedColumn]}
                        onChange={event => setWidths({ ...widths, [adjustedColumn]: Number(event.target.value) })} />
                      <span>{widths[adjustedColumn]} px</span>
                    </label>
                    <button type="button" className="min-h-11 text-ct-blue underline" onClick={() => { setColumns(operationColumns); setWidths(operationWidths); }}>Restaurar colunas</button>
                  </div>
                </details>
                <div ref={attachOperationRegion} role="region" aria-label="Rolagem da tabela de operação" tabIndex={0}
                  className="overflow-auto focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ct-blue"
                  style={{ maxHeight: OPERATION_VIEWPORT_HEIGHT, overflowAnchor: "none" }}
                  onScroll={event => {
                    if (continuous) setOperationWindow(Math.floor(event.currentTarget.scrollTop / OPERATION_ROW_HEIGHT));
                  }}>
                <table className="w-full table-fixed text-sm" aria-labelledby="operation-heading"
                  aria-rowcount={continuous && operationRows.length ? operationRows.length + 1 : undefined}
                  style={{ minWidth: 108 + columns.reduce((total, [key]) => total + widths[key], 0) }}>
                  <colgroup>
                    <col style={{ width: 44 }} />
                    {columns.map(([key]) => <col key={key} style={{ width: widths[key] }} />)}
                    <col style={{ width: 64 }} />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-ct-raised text-left text-xs font-semibold uppercase tracking-wide text-ct-dim">
                    <tr aria-rowindex={continuous && operationRows.length ? 1 : undefined}><th scope="col" className="px-3 py-3">
                      <WorkspaceCheckbox aria-label={continuous ? "Selecionar todos os funis filtrados" : "Selecionar funis desta página"}
                        disabled={!selectionRows.length} checked={entirePageSelected} onChange={toggleComparisonPage}
                        mixed={selectedOnPage > 0 && !entirePageSelected} />
                    </th>{columns.map(([key, label]) => {
                      const active = operationSort.key === key;
                      const SortIcon = active ? (operationSort.ascending ? ArrowUp : ArrowDown) : ArrowUpDown;
                      return <th key={key} scope="col" data-operation-column={key} data-drop-target={dropColumn === key}
                        aria-sort={active ? (operationSort.ascending ? "ascending" : "descending") : undefined}
                        className="relative px-3 py-3 data-[drop-target=true]:bg-ct-selected">
                        <span aria-hidden="true" title={`Arrastar coluna ${label}`} data-column-handle="move"
                          className="absolute inset-y-0 left-0 grid w-3 touch-none cursor-grab place-items-center opacity-60 hover:opacity-100"
                          {...columnHandleEvents(key, "move")}><GripVertical size={11} /></span>
                        <button type="button" className="inline-flex items-center gap-1 whitespace-nowrap" onClick={() => {
                          setOperationSort(previous => ({ key, ascending: previous.key === key ? !previous.ascending : key === "name" }));
                          setOperationPage(1);
                          resetOperationScroll();
                        }}>{label}<SortIcon size={13} aria-hidden="true" /></button>
                        <span aria-hidden="true" title={`Redimensionar coluna ${label}`} data-column-handle="resize"
                          className="absolute inset-y-0 right-0 w-3 touch-none cursor-col-resize border-e border-ct-line hover:border-ct-blue"
                          {...columnHandleEvents(key, "resize")} />
                      </th>;
                    })}<th scope="col"><span className="sr-only">Ações</span></th></tr>
                  </thead>
                  <tbody>
                    {continuous && visibleStart > 0 && <tr aria-hidden="true"><td colSpan={8} style={{ height: visibleStart * OPERATION_ROW_HEIGHT }} /></tr>}
                    {renderedRows.length ? renderedRows.map((r, index) => (
                      <tr key={r.slug} className="border-t border-ct-line data-[selected=true]:bg-ct-selected"
                        data-selected={selectedForComparison.has(r.slug)}
                        aria-rowindex={continuous ? visibleStart + index + 2 : undefined}
                        style={continuous ? { height: OPERATION_ROW_HEIGHT } : undefined}>
                        <td className="px-3 py-3"><WorkspaceCheckbox
                          aria-label={`Selecionar ${r.name} para comparar`} checked={selectedForComparison.has(r.slug)}
                          onChange={() => toggleComparisonRow(r.slug)} /></td>
                        {columns.map(([key]) => {
                          if (key === "name") return <th key={key} scope="row" className={`px-4 py-2 text-left font-semibold text-ct-ink ${continuous ? "truncate" : "break-words"}`} title={continuous ? r.name : undefined}>{r.name}</th>;
                          if (key === "score") return <td key={key} className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.score >= 70 ? "bg-green-100 text-green-700" : r.score >= 40 ? "bg-amber-100 text-amber-700" : "bg-ct-raised text-ct-dim"}`}>{r.score}</span></td>;
                          if (key === "taxaConclusao") return <td key={key} className="px-3 py-3 font-semibold text-ct-ink">{r[key]}%</td>;
                          return <td key={key} className="px-3 py-3 text-ct-dim">{r[key]}</td>;
                        })}
                        <td className="px-3 py-3 text-right"><Link href={`/dashboard/${encodeURIComponent(r.slug)}${reportComparisonQuery.size ? `?${reportComparisonQuery}` : ""}`} aria-label={`Ver relatório de ${r.name}`} className="text-xs font-semibold text-ct-blue hover:underline">Ver →</Link></td>
                      </tr>
                    )) : <tr><td colSpan={8} className="px-4 py-8 text-center text-ct-dim">{operationQuery.trim() ? "Nenhum funil corresponde à busca." : "Nenhum funil ainda."}{operationQuery.trim() && <button type="button" onClick={clearOperationSearch} className="mx-auto mt-2 block text-ct-blue underline">Limpar busca</button>}</td></tr>}
                    {continuous && visibleEnd < operationRows.length && <tr aria-hidden="true"><td colSpan={8} style={{ height: (operationRows.length - visibleEnd) * OPERATION_ROW_HEIGHT }} /></tr>}
                  </tbody>
                </table>
                </div>
                {!continuous && operationTotalPages > 1 && <div className="p-4">
                  <Pagination current={currentOperationPage} total={operationTotalPages} onChange={setOperationPage} />
                </div>}
              </section>
            )}

            {tab === "leads" && (snapshotAt ? (
              <SnapshotLeadsView rows={data.operacao} total={data.leads.total} daily={leadsDaily} editableSlugs={editableSlugs} />
            ) : (
              <section className="overflow-hidden rounded-2xl border border-ct-line bg-ct-surface">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ct-line px-4 py-3">
                  <h2 className="text-sm font-semibold text-ct-ink">Leads recentes <span className="ml-1 text-xs font-normal text-ct-dim">({data.leads.total} no total)</span></h2>
                  <Link href="/api/export-leads" className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700">⬇ Exportar CSV (todos)</Link>
                </div>
                {data.leads.recent.length ? (
                  <div className="ct-comparison-scroll overflow-x-auto" role="region" aria-label="Tabela de leads recentes" tabIndex={0}>
                  <table className="w-full text-sm">
                    <thead className="bg-ct-raised text-left text-xs font-semibold uppercase tracking-wide text-ct-dim"><tr><th className="px-4 py-3">Nome</th><th className="px-3 py-3">WhatsApp</th><th className="px-3 py-3">Funil</th><th className="px-3 py-3">Quando</th></tr></thead>
                    <tbody>
                      {data.leads.recent.map((l, i) => (
                        <tr key={i} className="border-t border-ct-line">
                          <td className="px-4 py-3 font-semibold text-ct-ink">{l.name}</td>
                          <td className="px-3 py-3 text-ct-dim">{l.phone}</td>
                          <td className="px-3 py-3 text-ct-dim">{l.funnel}</td>
                          <td className="px-3 py-3 text-ct-dim">{l.when ? new Date(l.when).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                ) : <div className="p-6"><ComingSoon title="Sem leads capturados" desc="Os leads da lâmina de captura aparecem aqui (e disparam os webhooks configurados). Requer a migração 0010 aplicada." source="funnel_leads" /></div>}
              </section>
            ))}

            {tab === "vendas" && salesSnapshot && <SnapshotSalesView data={salesSnapshot} />}
            {tab === "vendas" && !salesSnapshot && <ComingSoon title="Vendas" desc={snapshotAt ? "A cópia atual não contém transações de venda. As métricas de receita, ticket médio e conversão de checkout dependem de uma fonte de pedidos integrada." : "Receita, ticket médio e conversão de checkout. Integra com Hotmart/UTMify via webhook de venda."} source="webhook de venda / UTMify (próxima etapa)" />}
            {tab === "diagnostico" && diagnosisSnapshot && <ResponseFilters funnels={responseFunnels} days={responseDays}>
              {(funnel, range) => <SnapshotDiagnosisView data={diagnosisSnapshot} funnel={funnel} reportRange={range} />}
            </ResponseFilters>}
            {tab === "diagnostico" && !diagnosisSnapshot && <ComingSoon title="Diagnóstico" desc="Perfil agregado dos respondentes (dores, objeções, segmentos) cruzando respostas do quiz com conversão." source="quiz_answers × funnel_leads (próxima etapa)" />}
            {tab === "criativos" && !attributionOutsideCapture && (data.creatives.length ? (
              <div className="space-y-4">
                {adAccounts?.length ? <AdAccountCard accounts={adAccounts} account={account} filter={accountFilter} creatives={accountCreatives}
                  total={data.creatives.length} unverifiedBySource={unverifiedBySource}
                  onChange={id => { setAccountFilter(id); setCreatFunnel(""); setCmpCreat([]); }} /> : null}
                {cmpCreat.length >= 2 ? (() => {
                  // ranking: conversão (desempate: leads) → melhor e pior explícitos
                  const sel = accountCreatives.filter((x) => cmpCreat.includes(x.content));
                  const ranked = [...sel].sort((a, b) => b.conv - a.conv || b.leads - a.leads);
                  const bestKey = ranked[0]?.content, worstKey = ranked[ranked.length - 1]?.content;
                  const bestConv = Math.max(...sel.map((x) => x.conv)), worstConv = Math.min(...sel.map((x) => x.conv));
                  const bestLeads = Math.max(...sel.map((x) => x.leads)), worstLeads = Math.min(...sel.map((x) => x.leads));
                  return (
                    <section className="rounded-2xl border border-ct-line bg-ct-raised p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-ct-ink">⚖️ Comparação de criativos ({cmpCreat.length})</h2>
                        <button onClick={() => setCmpCreat([])} className="text-xs font-semibold text-ct-dim hover:text-ct-ink">limpar</button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {ranked.map((c) => {
                          const isBest = c.content === bestKey && bestKey !== worstKey;
                          const isWorst = c.content === worstKey && bestKey !== worstKey;
                          return (
                            <div key={c.content} className={`relative rounded-xl border-2 bg-ct-surface p-4 ${isBest ? "border-green-400" : isWorst ? "border-red-300" : "border-ct-line"}`}>
                              {isBest ? <span className="absolute -top-2.5 left-3 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">▲ Melhor</span> : null}
                              {isWorst ? <span className="absolute -top-2.5 left-3 rounded-full bg-red-400 px-2 py-0.5 text-[10px] font-bold uppercase text-white">▼ Pior</span> : null}
                              <p className="truncate pt-1 text-xs font-bold text-ct-ink" title={c.content}>{c.content}</p>
                              <p className="mt-0.5 truncate text-[11px] text-ct-dim" title={c.funnels.map((s) => `/${s}`).join(", ")}>{c.funnels.length ? c.funnels.map((s) => `/${s}`).join(", ") : "—"}</p>
                              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                <div><p className="text-[10px] uppercase text-ct-dim">Cliques</p><p className="text-lg font-bold text-ct-ink">{c.clicks}</p></div>
                                <div><p className="text-[10px] uppercase text-ct-dim">Leads</p><p className={`text-lg font-bold ${c.leads === bestLeads && bestLeads > 0 ? "text-green-600" : c.leads === worstLeads && bestLeads !== worstLeads ? "text-red-500" : "text-ct-ink"}`}>{c.leads}</p></div>
                                <div><p className="text-[10px] uppercase text-ct-dim">Conv.</p><p className={`text-lg font-bold ${c.conv === bestConv && bestConv > 0 ? "text-green-600" : c.conv === worstConv && bestConv !== worstConv ? "text-red-500" : "text-ct-ink"}`}>{c.conv}%</p></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-[11px] text-ct-dim">▲/▼ pelo ranking de <strong>conversão</strong> (desempate: leads). Verde = melhor da métrica · vermelho = pior.</p>
                    </section>
                  );
                })() : null}
                <section className="rounded-2xl border border-ct-line bg-ct-surface p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 id="creative-results-heading" className="text-sm font-bold text-ct-ink">Criativos / anúncios</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* filtro por funil + ordenação — combináveis (ex.: 1 slug + conversão desc) */}
                      <WorkspaceSelect searchable label="Filtrar por funil" value={creatFunnel} onChange={setCreatFunnel} options={[{value:'',label:'Todos os funis'},...creatSlugs.map(value=>({value,label:`/${value}`}))]}/>
                      <WorkspaceSelect label="Ordenar por" value={creatSort} onChange={value=>setCreatSort(value as typeof creatSort)} options={[["leads","Mais leads"],["clicks","Mais cliques"],["conv","Maior conversão"],["slug","A–Z por slug"]].map(([value,label])=>({value,label}))}/>
                      <span className="text-xs text-ct-dim">{creatList.length} de {accountCreatives.length} · ✓ 2+ pra comparar</span>
                    </div>
                  </div>
                  <div className="ct-comparison-scroll overflow-x-auto" role="region" aria-labelledby="creative-results-heading" tabIndex={0}>
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-ct-dim">
                        <tr><th scope="col" className="w-8 px-2 py-2"><span className="sr-only">Selecionar para comparar</span></th><th className="px-3 py-2 font-semibold">Criativo</th><th className="px-3 py-2 font-semibold">Funil</th><th className="px-3 py-2 font-semibold">Origem</th><th className="px-3 py-2 font-semibold">Campanha</th><th className="px-3 py-2 text-right font-semibold">Cliques</th><th className="px-3 py-2 text-right font-semibold">Leads</th><th className="px-3 py-2 text-right font-semibold">Conversão</th></tr>
                      </thead>
                      <tbody>
                        {creatList.map((c) => (
                          <tr key={c.content} className={`border-t border-ct-line ${cmpCreat.includes(c.content) ? "bg-ct-raised" : ""}`}>
                            <td className="px-2 py-2.5"><WorkspaceCheckbox checked={cmpCreat.includes(c.content)} onChange={() => toggleCreat(c.content)} aria-label={`Comparar ${c.content}`} /></td>
                            <td className="max-w-[240px] truncate px-3 py-2.5 font-medium text-ct-ink" title={c.content}>{c.content}</td>
                            <td className="max-w-[180px] truncate px-3 py-2.5 font-mono text-xs text-ct-dim" title={c.funnels.map((s) => `/${s}`).join(", ")}>{c.funnels.length ? c.funnels.map((s) => `/${s}`).join(", ") : "—"}</td>
                            <td className="px-3 py-2.5 text-ct-dim">{c.source || "—"}</td>
                            <td className="max-w-[180px] truncate px-3 py-2.5 text-ct-dim" title={c.campaign}>{c.campaign || "—"}</td>
                            <td className="px-3 py-2.5 text-right text-ct-dim">{c.clicks}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-ct-ink">{c.leads}</td>
                            <td className="px-3 py-2.5 text-right"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.conv >= 10 ? "bg-green-50 text-green-600" : c.conv > 0 ? "bg-amber-50 text-amber-600" : "bg-ct-raised text-ct-dim"}`}>{c.conv}%</span></td>
                          </tr>
                        ))}
                        {!creatList.length ? <tr><td colSpan={8} className="px-4 py-8 text-center text-ct-dim">Nenhum criativo neste recorte.</td></tr> : null}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-[11px] text-ct-dim">Cliques = sessões · Leads = capturas · Conversão = leads ÷ cliques · Funil = /slug onde o criativo rodou (mais tráfego primeiro). Gasto/CPL/ROAS entram ao ligar a UTMify (próxima etapa).</p>
                </section>
              </div>
            ) : <ComingSoon title="Criativos" desc="Ainda sem dados de criativo. Rode tráfego com utm_content nos anúncios pra preencher esta tabela." source="funnel_sessions × funnel_leads" />)}
            {tab === "vsl" && vslSnapshot && <SnapshotVslView data={vslSnapshot} />}
            {tab === "vsl" && !vslSnapshot && (vsls.length ? (
              <div className="space-y-4">
                {/* ── Métricas do PLAYER (VTurb Analytics API) ── */}
                <section className="rounded-2xl border border-ct-line bg-ct-surface p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-ct-ink">▶️ Métricas do vídeo (VTurb) <span className="ml-1 text-xs font-normal text-ct-dim">últimos 30 dias</span></h2>
                    <div className="flex items-center gap-2">
                      {typeof vturb === "object" && vturb.allPlayers.some((p) => !p.linked) ? (
                        <div className="relative">
                          <button onClick={() => { setPickerOpen((o) => !o); setPickerQuery(""); }}
                            className="rounded-lg border border-ct-line bg-ct-surface px-2.5 py-1.5 text-xs font-semibold text-ct-dim hover:bg-ct-raised">
                            + adicionar player da conta… ▾
                          </button>
                          {pickerOpen ? (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
                              <div className="absolute right-0 z-50 mt-1 w-[340px] rounded-xl border border-ct-line bg-ct-surface shadow-xl">
                                <div className="border-b border-ct-line p-2">
                                  <input autoFocus value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)}
                                    placeholder="Buscar VSL pelo nome…"
                                    className="w-full rounded-lg border border-ct-line px-3 py-1.5 text-xs outline-none focus:border-blue-500" />
                                </div>
                                <div className="max-h-72 overflow-auto p-1">
                                  {(() => {
                                    // agrupado por prefixo do nome (a API do VTurb não expõe as pastas)
                                    const q = pickerQuery.trim().toLowerCase();
                                    const avail = vturb.allPlayers.filter((p) => !p.linked && !extraPlayers.includes(p.id) && (!q || p.name.toLowerCase().includes(q)));
                                    if (!avail.length) return <p className="px-3 py-4 text-center text-xs text-ct-dim">Nenhuma VSL bate com &quot;{pickerQuery}&quot;.</p>;
                                    const groups = new Map<string, typeof avail>();
                                    for (const p of avail) {
                                      const g = (p.name.split(/\s[-–|]\s|\s-\s?|-\s/)[0] || p.name).trim().toUpperCase().slice(0, 28) || "OUTROS";
                                      if (!groups.has(g)) groups.set(g, []);
                                      groups.get(g)!.push(p);
                                    }
                                    return [...groups.entries()]
                                      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
                                      .map(([g, ps]) => (
                                        <div key={g}>
                                          <p className="sticky top-0 bg-ct-surface px-2 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-wide text-ct-dim">{g} ({ps.length})</p>
                                          {ps.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((p) => (
                                            <button key={p.id}
                                              onClick={() => { const next = [...extraPlayers, p.id]; setExtraPlayers(next); loadVturb(next); setPickerOpen(false); }}
                                              className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs text-ct-ink hover:bg-blue-50" title={p.name}>
                                              {p.name}
                                            </button>
                                          ))}
                                        </div>
                                      ));
                                  })()}
                                </div>
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                      <button onClick={() => loadVturb(extraPlayers)} className="rounded-lg border border-ct-line bg-ct-surface px-2.5 py-1.5 text-xs font-semibold text-ct-dim hover:bg-ct-raised">↻ Atualizar</button>
                    </div>
                  </div>
                  {vturb === "loading" || vturb === "idle" ? (
                    <div className="space-y-2 animate-pulse">{[0, 1].map((i) => <div key={i} className="h-10 rounded-lg bg-ct-raised" />)}</div>
                  ) : vturb === "no_token" ? (
                    <p className="py-4 text-center text-sm text-ct-dim">Token do VTurb não configurado no servidor (VTURB_API_TOKEN).</p>
                  ) : vturb === "error" ? (
                    <p className="py-4 text-center text-sm text-red-500">Não consegui falar com a API do VTurb agora. Tenta o ↻ em instantes.</p>
                  ) : vturb.vsls.length ? (
                    <div className="ct-comparison-scroll overflow-x-auto" role="region" aria-label="Tabela de players VTurb" tabIndex={0}>
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs text-ct-dim">
                          <tr><th className="w-8 px-2 py-2" title="Marque 2+ pra comparar">⚖️</th><th className="px-3 py-2 font-semibold">VSL / Player</th><th className="px-3 py-2 font-semibold">Funil</th><th className="px-3 py-2 text-right font-semibold">Views</th><th className="px-3 py-2 text-right font-semibold">Plays</th><th className="px-3 py-2 text-right font-semibold">Play Rate</th><th className="px-3 py-2 text-right font-semibold">Engajamento</th><th className="px-3 py-2 text-right font-semibold">Aud. Pitch</th><th className="px-3 py-2 text-right font-semibold">Ret. Pitch</th><th className="px-3 py-2 text-right font-semibold">Cliques</th><th className="px-3 py-2 text-right font-semibold">Conv.</th></tr>
                        </thead>
                        <tbody>
                          {vturb.vsls.map((v) => (
                            <tr key={v.playerId} onClick={event => togglePlayerDetail(v.playerId, event.currentTarget.querySelector("button"))}
                              className={`cursor-pointer border-t border-ct-line transition hover:bg-ct-raised ${detailPlayer === v.playerId ? "bg-ct-raised" : ""}`}>
                              <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                                <WorkspaceCheckbox checked={cmpPlayers.includes(v.playerId)} aria-label={`Comparar ${v.playerName}`}
                                  onChange={(e) => setCmpPlayers((prev) => e.target.checked ? [...prev, v.playerId] : prev.filter((id) => id !== v.playerId))} />
                              </td>
                              <th scope="row" className="max-w-[220px] px-3 py-2.5 text-left font-medium">
                                <button type="button" className="block w-full truncate text-left text-ct-blue hover:underline"
                                  title={v.playerName} aria-expanded={detailPlayer === v.playerId} aria-controls="vturb-player-detail"
                                  onClick={event => {
                                    event.stopPropagation();
                                    togglePlayerDetail(v.playerId, event.currentTarget);
                                  }}>
                                  {v.playerName}
                                </button>
                              </th>
                              <td className="max-w-[160px] truncate px-3 py-2.5 font-mono text-xs text-ct-dim" title={v.funnels.map((f) => `/${f.slug}`).join(", ")}>{v.funnels.length ? v.funnels.map((f) => `/${f.slug}`).join(", ") : "— (manual)"}</td>
                              <td className="px-3 py-2.5 text-right text-ct-dim">{v.stats.views.toLocaleString("pt-BR")}</td>
                              <td className="px-3 py-2.5 text-right text-ct-dim">{v.stats.plays.toLocaleString("pt-BR")}</td>
                              <td className="px-3 py-2.5 text-right font-semibold text-ct-ink">{v.stats.playRate}%</td>
                              <td className="px-3 py-2.5 text-right font-semibold text-ct-ink">{v.stats.engagement}%</td>
                              <td className="px-3 py-2.5 text-right text-ct-dim">{v.stats.pitchAudience.toLocaleString("pt-BR")}</td>
                              <td className="px-3 py-2.5 text-right font-semibold text-ct-ink">{v.stats.pitchRetention}%</td>
                              <td className="px-3 py-2.5 text-right text-ct-dim">{v.stats.clicks.toLocaleString("pt-BR")}</td>
                              <td className="px-3 py-2.5 text-right"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${v.stats.convRate > 0 ? "bg-green-50 text-green-600" : "bg-ct-raised text-ct-dim"}`}>{v.stats.conversions} · {v.stats.convRate}%</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="py-4 text-center text-sm text-ct-dim">Nenhum player VTurb detectado nos embeds das VSLs. Usa o seletor acima pra adicionar um player da conta.</p>
                  )}
                  {typeof vturb === "object" && cmpPlayers.length >= 2 ? (
                    <VslCompare rows={vturb.vsls.filter((v) => cmpPlayers.includes(v.playerId)).map((v) => ({ playerId: v.playerId, playerName: v.playerName, stats: v.stats }))} />
                  ) : null}
                  <section id="vturb-player-detail" aria-label="Detalhe do player VTurb" tabIndex={-1}
                    ref={playerDetail} hidden={!detailPlayer} className="scroll-mt-20">
                    {detailPlayer && <VslDetail playerId={detailPlayer} onClose={closePlayerDetail} />}
                  </section>
                  <p className="mt-3 text-[11px] text-ct-dim">Fonte: VTurb Analytics API (players detectados automaticamente no embed de cada funil). Play Rate = plays ÷ views · Ret. Pitch = % que passa do pitch. Selecione um player para ver a retenção minuto a minuto e as segmentações.</p>
                </section>
                {cmpVsl.length >= 2 ? (
                  <section className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-ct-ink">⚖️ Comparação de VSLs ({cmpVsl.length})</h2>
                      <button onClick={() => setCmpVsl([])} className="text-xs font-semibold text-ct-dim hover:text-ct-ink">limpar</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {vsls.filter((v) => cmpVsl.includes(v.slug)).map((v) => {
                        const sel = vsls.filter((x) => cmpVsl.includes(x.slug));
                        const bestPct = Math.max(...sel.map((x) => x.pct));
                        return (
                          <div key={v.slug} className="rounded-xl border border-ct-line bg-ct-surface p-4">
                            <p className="truncate text-xs font-bold text-ct-ink" title={v.name}>{v.name}</p>
                            <p className="mt-0.5 text-[11px] text-ct-dim">/{v.slug}</p>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                              <div><p className="text-[10px] uppercase text-ct-dim">Visitantes</p><p className="text-lg font-bold text-ct-ink">{v.visitantes}</p></div>
                              <div><p className="text-[10px] uppercase text-ct-dim">Na VSL</p><p className="text-lg font-bold text-ct-ink">{v.chegaram}</p></div>
                              <div><p className="text-[10px] uppercase text-ct-dim">% chegada</p><p className={`text-lg font-bold ${v.pct === bestPct && bestPct > 0 ? "text-green-600" : "text-ct-ink"}`}>{v.pct}%</p></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
                <section className="rounded-2xl border border-ct-line bg-ct-surface p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-ct-ink">VSL por funil</h2>
                    <span className="text-xs text-ct-dim">✓ marque 2+ pra comparar</span>
                  </div>
                  <div className="ct-comparison-scroll overflow-x-auto" role="region" aria-label="Tabela de VSL por funil" tabIndex={0}>
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-ct-dim">
                        <tr><th className="w-8 px-2 py-2"></th><th className="px-3 py-2 font-semibold">Funil</th><th className="px-3 py-2 text-right font-semibold">Visitantes</th><th className="px-3 py-2 text-right font-semibold">Chegaram na VSL</th><th className="px-3 py-2 text-right font-semibold">% de chegada</th><th className="px-3 py-2 text-right font-semibold">Leads</th><th className="px-3 py-2 text-right"></th></tr>
                      </thead>
                      <tbody>
                        {vsls.map((v) => (
                          <tr key={v.slug} className={`border-t border-ct-line ${cmpVsl.includes(v.slug) ? "bg-blue-50/50" : ""}`}>
                            <td className="px-2 py-2.5"><WorkspaceCheckbox checked={cmpVsl.includes(v.slug)} onChange={() => toggleVsl(v.slug)} aria-label={`Comparar ${v.name}`} /></td>
                            <td className="max-w-[260px] px-3 py-2.5"><p className="truncate font-medium text-ct-ink" title={v.name}>{v.name}</p><p className="text-[11px] text-ct-dim">/{v.slug}</p></td>
                            <td className="px-3 py-2.5 text-right text-ct-dim">{v.visitantes}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-ct-ink">{v.chegaram}</td>
                            <td className="px-3 py-2.5 text-right"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${v.pct >= 20 ? "bg-green-50 text-green-600" : v.pct > 0 ? "bg-amber-50 text-amber-600" : "bg-ct-raised text-ct-dim"}`}>{v.pct}%</span></td>
                            <td className="px-3 py-2.5 text-right text-ct-dim">{v.leads}</td>
                            <td className="px-3 py-2.5 text-right"><button onClick={() => router.push(`/dashboard/${v.slug}`)} className="text-xs font-semibold text-blue-600 hover:underline">Ver →</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-[11px] text-ct-dim">Chegaram na VSL = sessões que alcançaram a lâmina de VSL (conclusão do funil), medidas pelo nosso tracking. As métricas do PLAYER (play rate, engajamento, pitch) estão na seção VTurb acima.</p>
                </section>
              </div>
            ) : <ComingSoon title="VSL" desc="Sem funis com tráfego ainda. Assim que houver sessões, as métricas de chegada na VSL aparecem aqui." source="funnel_sessions (max_step ≥ lâmina VSL)" />)}
          </div>
        </div>
      </div>
    </WorkspaceFrame>
  );
}
