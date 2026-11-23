import type { InleadOption, InleadStep, Layer, LayerAnswer } from "./types";

export const plainLabel = (value?: string) => (value || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

export function selectedAnswer(options: InleadOption[], ids: string[]): LayerAnswer {
  const selected = options.filter(option => ids.includes(option.id));
  return {
    optionIds: selected.map(option => option.id),
    values: selected.map(option => option.value || plainLabel(option.label)),
    labels: selected.map(option => plainLabel(option.label)),
    points: selected.reduce((sum, option) => sum + (Number.isFinite(option.points) ? option.points! : 0), 0),
    destination: selected.length === 1 ? selected[0].destination : undefined,
  };
}

export function matchesDisplay(layer: Layer, answers: Record<string, LayerAnswer>, fields: Record<string, string> = {}): boolean {
  const display = layer.display;
  const groups = display?.groups;
  const rules = display?.rules || [];
  if (!groups?.length && !rules.length) return true;
  const evaluate = (rule: import('./types').DisplayRule) => {
    if (!rule.source) return false;
    const answer = answers[rule.source];
    const points = Object.values(answers).reduce((sum, item) => sum + item.points, 0);
    const values = rule.source === '__total_points__' ? [String(points)] : answer ? [...answer.optionIds, ...answer.values, ...answer.labels] : fields[rule.source] != null ? [fields[rule.source]] : [];
    const populated = values.some(value => value.trim().length > 0);
    switch (rule.operator) {
      case 'answered': return populated;
      case 'empty': return !populated;
      case 'equals': return populated && values.includes(rule.value || '');
      case 'notEquals': return populated && !values.includes(rule.value || '');
      case 'contains': return populated && !!rule.value && values.some(value => value.toLowerCase().includes(rule.value!.toLowerCase()));
      case 'greater': case 'greaterEqual': case 'less': case 'lessEqual': {
        if (!populated || !rule.value?.trim()) return false;
        const target = Number(rule.value.replace(',', '.'));
        if (!Number.isFinite(target)) return false;
        return values.some(value => { if (!value.trim()) return false; const number=Number(value.replace(',', '.')); if (!Number.isFinite(number)) return false; return rule.operator==='greater'?number>target:rule.operator==='greaterEqual'?number>=target:rule.operator==='less'?number<target:number<=target; });
      }
      default: return false;
    }
  };
  if (groups?.length) return groups.some(group => group.length > 0 && group.every(evaluate));
  const results = rules.map(evaluate);
  return display?.match === 'any' ? results.some(Boolean) : results.every(Boolean);
}

export function buttonDestination(layer: Layer): string | undefined {
  const destination = layer.content.destination || (layer.content.type === "next" ? "next" : undefined);
  if (!layer.subId || !layer.content.sendSubId || !/^https?:\/\//i.test(destination || "")) return destination;
  try {
    const url = new URL(destination!);
    url.searchParams.set("subid", layer.subId);
    return url.toString();
  } catch { return destination; }
}

/** Keeps the historical analytics key separate from user-editable names. */
export function componentIdentity(layer: Layer) {
  return { "data-layer-id": layer.id, "data-component-id": layer.webhookKey || layer.id, "data-sub-id": layer.subId || undefined };
}

/** Duplicated stages keep their rules connected to their duplicated questions. */
export function cloneStageWithRules(source: InleadStep, newId: () => string, { keepStageId = false } = {}): InleadStep {
  const stage: InleadStep = JSON.parse(JSON.stringify(source));
  const ids = new Map<string,string>();
  const fresh = (old?: string) => { const id = newId(); if (old) ids.set(old,id); return id; };
  if (!keepStageId) stage.id = fresh(stage.id);
  const optionIdsByQuestion = new Map<string, Set<string>>();
  stage.layers = stage.layers || [];
  for (const layer of stage.layers) {
    const originalId = layer.id;
    layer.id = fresh(layer.id);
    layer.content.id = layer.content.id === originalId ? layer.id : fresh(layer.content.id);
    Object.assign(layer, { step: stage.id });
    if (layer.type === "options") {
      optionIdsByQuestion.set(originalId, new Set(layer.content.options?.map(option => option.id)));
    }
    for (const option of layer.content.options || []) option.id = fresh(option.id);
    for (const item of layer.content.items || []) item.id = fresh(item.id);
  }
  for (const layer of stage.layers) {
    for (const rule of [...(layer.display?.rules || []), ...(layer.display?.groups || []).flat()]) {
      if (rule.value && (rule.operator === "equals" || rule.operator === "notEquals") &&
        optionIdsByQuestion.get(rule.source)?.has(rule.value)) {
        rule.value = ids.get(rule.value) ?? rule.value;
      }
      rule.source = ids.get(rule.source) ?? rule.source;
    }
    if (layer.content.destination === source.id) layer.content.destination = stage.id;
    for (const option of layer.content.options || []) if (option.destination === source.id) option.destination = stage.id;
  }
  if (stage.nextStep === source.id) stage.nextStep = stage.id;
  return stage;
}
