export default function RollingNumber({ value, suffix = "", hidden = false }: { value: number; suffix?: string; hidden?: boolean }) {
  const formatted = hidden ? "••••" : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
  return <span className="ct-rolling-number">
    <span className="sr-only">{hidden ? "Valor oculto" : formatted + suffix}</span>
    <span className="ct-rolling-value" data-masked={hidden || undefined} aria-hidden="true">
      {Array.from(formatted, (character, index) => /^[0-9•]$/.test(character)
        ? <span className="ct-rolling-slot" key={formatted.length - index}><span key={character}>{character}</span></span>
        : <span key={formatted.length - index}>{character}</span>
      )}{hidden ? "" : suffix}
    </span>
  </span>;
}
