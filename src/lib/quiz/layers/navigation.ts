/** Resolve os destinos usados tanto pelo visitante quanto pelo mapa do editor. */
export function resolveLayerDestination(
  steps: { id: string; nextStep?: string }[],
  index: number,
  destination?: string,
): { to: string | null; extern: boolean } {
  if (/^https?:\/\//i.test(destination ?? "")) return { to: null, extern: true };
  const target = !destination || destination === "next" ? steps[index]?.nextStep : destination;
  if (target && steps.some(step => step.id === target)) return { to: target, extern: false };
  return { to: steps[index + 1]?.id ?? null, extern: false };
}
