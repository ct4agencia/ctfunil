"use client";

import { WheelPicker } from "@/components/referencias/beui/motion/wheel-picker";
import { useId, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

export type DateRange = { from: string; to: string };

export function calendarSeriesDays(rows: { day: string }[], capturedAt: string, timeZone: string) {
  if (!rows.length) return [];
  const captureDay = new Intl.DateTimeFormat("sv-SE", { timeZone, dateStyle: "short" }).format(new Date(capturedAt));
  return Array.from(new Set([...rows.map(row => row.day), captureDay])).sort();
}

export function analyticsDateKey(label: string, referenceDay: string) {
  const match = /^(\d{2})\/(\d{2})$/.exec(label);
  if (!match) return "";
  const year = Number(referenceDay.slice(0, 4));
  const monthDay = `${match[2]}-${match[1]}`;
  return `${monthDay > referenceDay.slice(5) ? year - 1 : year}-${monthDay}`;
}

export function calendarPresetStart(min: string, max: string, days: number) {
  const start = new Date(`${max}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const key = start.toISOString().slice(0, 10);
  return key < min ? min : key;
}

export default function WorkspaceDateRange({ days, value, onChange, label }: {
  days: string[];
  label?: string;
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const id = useId();
  const [endpoint, setEndpoint] = useState<keyof DateRange>("from");
  const details = useRef<HTMLDetailsElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const summary = useRef<HTMLElement>(null);
  const min = days[0];
  const max = days.at(-1);
  if (!min || !max) return null;

  const from = value.from && value.from >= min && value.from <= max ? value.from : min;
  const to = value.to && value.to >= from && value.to <= max ? value.to : max;
  const week = calendarPresetStart(min, max, 7);
  const threeDays = calendarPresetStart(min, max, 3);
  const format = (day: string) => day.split("-").reverse().join("/");
  const wheelValue = endpoint === "from" ? from : to;
  const wheelOptions = Array.from(new Set([...days, wheelValue]))
    .filter(day => endpoint === "from" ? day <= to : day >= from)
    .sort()
    .map(day => ({ value: day, label: format(day) }));
  const chooseDate = (day: string) => onChange(endpoint === "from" ? { from: day, to } : { from, to: day });
  const choosePreset = (start: string) => onChange({ from: start, to: max });

  return <details ref={details} className="ct-date-range ct-filter-disclosure" onKeyDown={event => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (details.current) details.current.open = false;
    summary.current?.focus();
  }}>
    <summary ref={element => { summary.current = element; }} aria-controls={id}>
      <CalendarDays size={16} aria-hidden="true" />
      <span>{label && <>{label} · </>}{format(from)} até {format(to)}</span>
      <ChevronDown size={14} aria-hidden="true" />
    </summary>
    <div id={id} className="ct-date-panel">
      <div className="ct-date-presets" aria-label="Períodos rápidos">
        <button type="button" onClick={() => choosePreset(week)} aria-pressed={from === week && to === max}>Até 7 dias</button>
        <button type="button" onClick={() => choosePreset(threeDays)} aria-pressed={threeDays !== week && from === threeDays && to === max} disabled={threeDays === week}>Últimos 3 dias</button>
      </div>
      <div className="ct-date-fields">
        <label>Data inicial<input type="date" value={from} min={min} max={to}
          onChange={event => { const next = event.target.value; if (next >= min && next <= to) onChange({ from: next, to }); }} /></label>
        <label>Data final<input type="date" value={to} min={from} max={max}
          onChange={event => { const next = event.target.value; if (next >= from && next <= max) onChange({ from, to: next }); }} /></label>
      </div>
      <div className="ct-date-shortcut">
        <div className="ct-date-presets" role="group" aria-label="Limite do intervalo">
          <button type="button" aria-pressed={endpoint === "from"} onClick={() => setEndpoint("from")}>Escolher início</button>
          <button type="button" aria-pressed={endpoint === "to"} onClick={() => setEndpoint("to")}>Escolher fim</button>
        </div>
        <div className="ct-date-wheel">
          <WheelPicker key={endpoint} aria-label={endpoint === "from" ? "Roda da data inicial" : "Roda da data final"}
            options={wheelOptions} value={wheelValue} onValueChange={chooseDate} visibleCount={3} />
        </div>
        <div className="ct-date-strip-controls">
          <button type="button" className="ct-date-strip-arrow" aria-label="Rolar para datas anteriores"
            onClick={() => strip.current?.scrollBy({ left: -(strip.current.clientWidth * .7) })}>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <div ref={strip} className="ct-date-strip" role="group" aria-label="Datas da série">
            {days.map(day => (
              <button type="button" key={day} aria-label={format(day)}
                aria-pressed={day === (endpoint === "from" ? from : to)}
                disabled={endpoint === "from" ? day > to : day < from}
                onClick={() => chooseDate(day)}>
                {format(day).slice(0, 5)}
              </button>
            ))}
          </div>
          <button type="button" className="ct-date-strip-arrow" aria-label="Rolar para datas posteriores"
            onClick={() => strip.current?.scrollBy({ left: strip.current.clientWidth * .7 })}>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <button type="button" onClick={() => { onChange({ from: "", to: "" }); }}>Restaurar período disponível</button>
    </div>
  </details>;
}
