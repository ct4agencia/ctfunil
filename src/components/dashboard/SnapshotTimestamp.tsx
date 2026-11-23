const snapshotTimeZone = "America/Sao_Paulo";
const format = new Intl.DateTimeFormat("pt-BR", {
  timeZone: snapshotTimeZone,
  dateStyle: "short",
  timeStyle: "short",
});

export default function SnapshotTimestamp({ capturedAt, timeZone = snapshotTimeZone }: { capturedAt: string; timeZone?: string }) {
  const instant = new Date(capturedAt);
  if (!Number.isFinite(instant.getTime())) return null;
  const formatter = timeZone === snapshotTimeZone ? format : new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
  });
  return <time dateTime={instant.toISOString()}>{formatter.format(instant)}</time>;
}
