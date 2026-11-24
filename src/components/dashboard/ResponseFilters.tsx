"use client";

import { useSearchParams } from "next/navigation";
import WorkspaceDateRange, { type DateRange } from "@/components/ui/WorkspaceDateRange";
import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";
import SnapshotRangeCoverage from "./SnapshotRangeCoverage";
import { useSnapshotDateRange } from "./useSnapshotDateRange";

export default function ResponseFilters({ funnels, days, children }: {
  funnels: { value: string; label: string }[];
  days: string[];
  children: (funnel: string, range: DateRange) => React.ReactNode;
}) {
  const params = useSearchParams();
  const selected = params.get("respFunil") ?? "";
  const funnel = funnels.some(option => option.value === selected) ? selected : "";
  const { range, changeRange, outsideCapture, partialCapture } = useSnapshotDateRange(days, "resp");

  function updateFunnel(value: string) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("respFunil", value);
    else url.searchParams.delete("respFunil");
    window.history.replaceState(null, "", url);
  }

  return <>
    <div className="ct-panel mb-4 flex flex-wrap items-start gap-3 p-4">
      <WorkspaceSelect searchable label="Funil das respostas" value={funnel}
        onChange={updateFunnel}
        options={[{ value: "", label: "Todos os funis" }, ...funnels]} />
      {days.length > 0 && <WorkspaceDateRange allowEarlierDates days={days} value={range} label="Período das respostas"
        onChange={changeRange} />}
    </div>
    <SnapshotRangeCoverage outsideCapture={outsideCapture} partialCapture={partialCapture}
      onReset={() => changeRange({ from: "", to: "" })} />
    {!outsideCapture && children(funnel, range)}
  </>;
}
