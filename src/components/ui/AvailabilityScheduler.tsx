"use client";

import WorkspaceCheckbox from "./WorkspaceCheckbox";

import { useEffect, useRef, useState } from "react";
import { Copy, Plus, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Popover } from "radix-ui";
import type { AvailabilityDay, WeekAvailability } from "@/lib/quiz/types";
import { WorkspaceSelect } from "./WorkspaceSelect";
import "./availability-scheduler.css";

const days = [
  ["mon", "Segunda-feira"], ["tue", "Terça-feira"], ["wed", "Quarta-feira"],
  ["thu", "Quinta-feira"], ["fri", "Sexta-feira"], ["sat", "Sábado"], ["sun", "Domingo"],
] as const;
const times = Array.from({ length: 49 }, (_, index) => {
  const label = `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`;
  return { value: label, label };
});

function DayCopy({ day, label, onCopy }: {
  day: AvailabilityDay;
  label: string;
  onCopy: (targets: AvailabilityDay[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<AvailabilityDay[]>([]);
  const trigger = useRef<HTMLButtonElement>(null);
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  useEffect(() => setDialog(trigger.current?.closest("dialog") ?? null), []);
  const otherDays = days.filter(([key]) => key !== day);

  const allSelected = targets.length === otherDays.length;
  const partiallySelected = targets.length > 0 && !allSelected;

  return <Popover.Root open={open} onOpenChange={next => { setOpen(next); setTargets([]); }}>
    <Popover.Trigger ref={trigger} type="button" className="ct-icon-button" aria-label={`Copiar horários de ${label}`}><Copy size={16} /></Popover.Trigger>
    <Popover.Portal container={dialog ?? undefined}>
    <Popover.Content className="ct-availability-copy" align="end" sideOffset={6} aria-label={`Copiar horários de ${label}`}>
      <fieldset>
        <legend className="font-semibold">Copiar para</legend>
        <label>
          <WorkspaceCheckbox checked={allSelected} mixed={partiallySelected}
            onChange={event => setTargets(event.target.checked ? otherDays.map(([key]) => key) : [])} />
          Todos os outros dias
        </label>
        {otherDays.map(([key, name]) => <label key={key}>
          <WorkspaceCheckbox checked={targets.includes(key)}
            onChange={event => setTargets(event.target.checked ? [...targets, key] : targets.filter(target => target !== key))} /> {name}
        </label>)}
      </fieldset>
      <button type="button" className="ct-primary rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" disabled={!targets.length} onClick={() => { onCopy(targets); setOpen(false); }}>Aplicar</button>
    </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}

export default function AvailabilityScheduler({ value, onChange }: {
  value: WeekAvailability;
  onChange: (value: WeekAvailability) => void;
}) {
  const reduced = useReducedMotion();
  const [announcement, setAnnouncement] = useState("");
  const rangeMotion = reduced ? { opacity: 0 } : { opacity: 0, y: -5, filter: "blur(3px)" };

  return <section aria-label="Horários de atendimento" className="ct-availability">
    <p className="text-sm text-ct-dim">Registre os horários de atendimento da equipe no rascunho. Esta configuração é informativa.</p>
    <span className="sr-only" role="status">{announcement}</span>
    {days.map(([day, label]) => {
      const current = value[day];
      const patch = (next: WeekAvailability[AvailabilityDay]) => onChange({ ...value, [day]: next });
      const freeSlots = times.slice(0, -1).flatMap(({ value: start }, index) =>
        current.ranges.every(range => range.end <= start || range.start >= times[index + 1].value) ? [index] : []);
      const lastEnd = current.ranges.at(-1)?.end ?? "09:00";
      const startSlot = freeSlots.find(index => times[index].value >= lastEnd) ?? freeSlots[0] ?? -1;
      return <div className="ct-availability-day" key={day}>
        <div className="ct-availability-day-head">
          <button type="button" role="switch" className="ct-availability-switch" aria-label={label} aria-checked={current.enabled}
            onClick={() => patch({ enabled: !current.enabled, ranges: current.ranges.length ? current.ranges : [{ id: day, start: "09:00", end: "17:00" }] })}>
            <span aria-hidden="true" />{label}
          </button>
          {current.enabled ? <DayCopy day={day} label={label} onCopy={targets => {
            const next = { ...value };
            for (const target of targets) next[target] = { enabled: true, ranges: current.ranges.map(range => ({ ...range })) };
            onChange(next);
            setAnnouncement(`Horários de ${label} copiados para ${targets.length} ${targets.length === 1 ? "dia" : "dias"}.`);
          }} /> : <span className="text-xs text-ct-dim">Indisponível</span>}
        </div>
        <AnimatePresence initial={false}>
          {current.enabled && <motion.div className="ct-availability-ranges" initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }} exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}>
            <AnimatePresence initial={false}>
              {current.ranges.map((range, index) => {
                const min = current.ranges[index - 1]?.end ?? "00:00";
                const max = current.ranges[index + 1]?.start ?? "24:00";
                const edit = (field: "start" | "end", time: string) => patch({
                  ...current, ranges: current.ranges.map(item => item.id === range.id ? { ...item, [field]: time } : item),
                });
                return <motion.div key={range.id} layout={reduced ? false : "position"} className="ct-availability-range"
                  initial={rangeMotion} animate={{ opacity: 1, y: 0, filter: "none" }} exit={rangeMotion} transition={{ duration: .18 }}>
                  <WorkspaceSelect label={`Início do intervalo ${index + 1} de ${label}`} value={range.start} onChange={time => edit("start", time)}
                    options={times.filter(({ value: time }) => time >= min && time < range.end)} />
                  <span aria-hidden="true">–</span>
                  <WorkspaceSelect label={`Fim do intervalo ${index + 1} de ${label}`} value={range.end} onChange={time => edit("end", time)}
                    options={times.filter(({ value: time }) => time > range.start && time <= max)} />
                  <button type="button" className="ct-icon-button" disabled={current.ranges.length === 1}
                    aria-label={`Remover intervalo ${index + 1} de ${label}`}
                    onClick={event => {
                      event.currentTarget.closest(".ct-availability-day")?.querySelector<HTMLButtonElement>(".ct-availability-switch")?.focus();
                      patch({ ...current, ranges: current.ranges.filter(item => item.id !== range.id) });
                    }}><X size={16} /></button>
                </motion.div>;
              })}
            </AnimatePresence>
            <button className="ct-availability-add" type="button" disabled={startSlot < 0}
              aria-label={`Adicionar intervalo de ${label}`}
              onClick={() => {
                const range = { id: crypto.randomUUID(), start: times[startSlot].value, end: times[startSlot + 1].value };
                const ranges = [...current.ranges, range].sort((a, b) => a.start.localeCompare(b.start));
                patch({ ...current, ranges });
              }}><Plus size={16} aria-hidden="true" /> Adicionar intervalo</button>
          </motion.div>}
        </AnimatePresence>
      </div>;
    })}
  </section>;
}
