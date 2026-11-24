export default function SnapshotRangeCoverage({ outsideCapture, partialCapture, beforeCapture = false, onReset }: {
  outsideCapture: boolean; partialCapture: boolean; beforeCapture?: boolean; onReset: () => void;
}) {
  if (outsideCapture) return <div className="space-y-2 px-4 pb-4 text-sm text-ct-dim">
    <p role="status">{beforeCapture ? "O intervalo termina antes da série disponível." : "O intervalo começa após a captura disponível."}</p>
    <button type="button" className="text-ct-blue underline" onClick={onReset}>Restaurar período disponível</button>
  </div>;
  if (partialCapture) return <p role="status" className="px-4 pb-3 text-sm text-ct-dim">
    Parte do intervalo está fora da captura. Os valores incluem apenas os dados disponíveis.
  </p>;
  return null;
}
