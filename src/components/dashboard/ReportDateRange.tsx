"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import WorkspaceDateRange, { type DateRange } from "@/components/ui/WorkspaceDateRange";

export default function ReportDateRange({ days, range }: { days: string[]; range: DateRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return <WorkspaceDateRange days={days} value={range} allowEarlierDates label="Intervalo do relatório"
    placeholder="Escolher intervalo do relatório" onChange={({ from, to }) => {
      const params = new URLSearchParams(searchParams);
      params.delete("p");
      params.delete("d");
      if (from && to) {
        params.set("from", from);
        params.set("to", to);
      } else {
        params.delete("from");
        params.delete("to");
      }
      const query = params.size ? `?${params}` : "";
      router.push(pathname + query, { scroll: false });
    }} />;
}
