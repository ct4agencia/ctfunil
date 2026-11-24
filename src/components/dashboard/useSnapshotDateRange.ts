"use client";

import { useSearchParams } from "next/navigation";
import type { DateRange } from "@/components/ui/WorkspaceDateRange";
import { parseCivilRange } from "@/lib/quiz/periodo";

export function useSnapshotDateRange(days: string[], prefix: string, boundedStart = false) {
  const params = useSearchParams();
  const fromKey = `${prefix}De`;
  const toKey = `${prefix}Ate`;
  const selected = parseCivilRange(params.get(fromKey), params.get(toKey));
  const first = boundedStart ? days[0] : undefined;
  const last = days.at(-1);
  const beforeCapture = Boolean(selected && first && selected.to < first);
  const outsideCapture = beforeCapture || Boolean(selected && last && selected.from > last);
  const partialCapture = Boolean(selected && last && !outsideCapture &&
    (selected.to > last || first && selected.from < first));
  const range = selected && last && !outsideCapture
    ? { from: first && selected.from < first ? first : selected.from, to: selected.to > last ? last : selected.to }
    : { from: "", to: "" };

  function changeRange(next: DateRange) {
    const url = new URL(window.location.href);
    if (next.from && next.to) {
      url.searchParams.set(fromKey, next.from);
      url.searchParams.set(toKey, next.to);
    } else {
      url.searchParams.delete(fromKey);
      url.searchParams.delete(toKey);
    }
    window.history.replaceState(null, "", url);
  }
  return { range, changeRange, outsideCapture, beforeCapture, partialCapture };
}
