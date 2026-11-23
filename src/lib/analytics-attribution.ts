import type { DateRange } from "@/components/ui/WorkspaceDateRange";
import type { GlobalAnalytics } from "@/lib/quiz/metrics";

type DailyCount = { day: string; name: string; value: number };
type DailyCreative = { day: string; content: string; slug: string; clicks: number; leads: number };

export type AttributionDaily = {
  capturedAt: string;
  timeZone: string;
  sources: DailyCount[];
  campaigns: DailyCount[];
  creatives: DailyCreative[];
};

function percentage(value: number, total: number) {
  return total ? Math.round(value / total * 1000) / 10 : 0;
}

export function filterAttribution(data: GlobalAnalytics, daily: AttributionDaily | undefined, range: DateRange) {
  if (!daily || (!range.from && !range.to)) return { traffic: data.traffic, creatives: data.creatives };
  const includes = (day: string) => (!range.from || day >= range.from) && (!range.to || day <= range.to);

  function aggregate(rows: DailyCount[]) {
    const values = new Map<string, number>();
    for (const { day, name, value } of rows) {
      if (includes(day)) values.set(name, (values.get(name) ?? 0) + value);
    }
    return [...values].sort((a, b) => b[1] - a[1]);
  }

  const sources = aggregate(daily.sources);
  const total = sources.reduce((sum, [, value]) => sum + value, 0);
  const format = ([name, value]: [string, number]) => ({ name, value, pct: percentage(value, total) });
  const traffic = { total, sources: sources.map(format), campaigns: aggregate(daily.campaigns).map(format) };

  const counts = new Map<string, { clicks: number; leads: number; funnels: Map<string, number> }>();
  for (const { day, content, slug, clicks, leads } of daily.creatives) {
    if (!includes(day)) continue;
    const entry = counts.get(content) ?? { clicks: 0, leads: 0, funnels: new Map<string, number>() };
    entry.clicks += clicks;
    entry.leads += leads;
    if (slug) entry.funnels.set(slug, (entry.funnels.get(slug) ?? 0) + clicks + leads);
    counts.set(content, entry);
  }
  const creatives = data.creatives.flatMap(creative => {
    const entry = counts.get(creative.content);
    if (!entry) return [];
    const { clicks, leads } = entry;
    const funnels = [...entry.funnels].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([slug]) => slug);
    return [{ ...creative, clicks, leads, conv: percentage(leads, clicks), funnels }];
  });
  return { traffic, creatives };
}
