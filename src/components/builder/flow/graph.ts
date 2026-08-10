/**
 * Grafo do funil — lógica PURA da aba Fluxo (sem React, sem DOM).
 *
 * Fica separada porque é onde moram as decisões que precisam bater com o
 * runtime: quais blocos realmente navegam, para onde vão, e quais lâminas o
 * visitante enxerga. Um mapa que discorda do runtime é pior que mapa nenhum.
 *
 * Quatro coisas que o fluxo antigo desenhava errado, todas conferidas no
 * runtime (components/quiz/layers/blocks.tsx e LayersRunner.tsx):
 *
 *  1. `options` com `multiple: true` IGNORA o destino das opções — quem navega é
 *     o botão "Continuar", com `navigate("next")` fixo (blocks.tsx:443). O mapa
 *     desenhava N setas mentirosas.
 *  2. `carousel` NÃO navega (blocks.tsx:293-340). Quem faltava de verdade era
 *     `slider` (blocks.tsx:633) e `roulette` (LayersRunner.tsx:186), ambos com
 *     "next" fixo.
 *  3. O runtime PULA lâminas desativadas antes de indexar (LayersRunner.tsx:37),
 *     mas o mapa usava `steps[i+1]` cru — em funil com lâmina off, apontava para
 *     a lâmina errada.
 *  4. Bloco com `design.hidden` não roda (blocks.tsx:714) e não pode virar saída.
 */

import type { InleadStep } from "@/lib/quiz/layers/types";

/** Geometria do nó. Uma fonte só: o cálculo do path e a posição da bolinha
 *  precisam concordar, senão a linha sai de um lugar e o ponto fica em outro. */
export const FLOW = {
  W: 264,        // largura do nó
  HEAD: 40,      // altura do cabeçalho (título)
  ROW: 28,       // altura de cada linha de saída
  PADB: 34,      // rodapé: onde mora a bolinha "→ próxima lâmina"
  GAPX: 120,     // espaço horizontal entre colunas
  GAPY: 28,      // espaço vertical entre nós da mesma coluna
} as const;

export interface FlowExit {
  /** chave estável: `${layerId}:${optId ?? "_"}` */
  key: string;
  layerId: string;
  optId: string | null;
  icon: string;
  label: string;
  /** id da lâmina destino, "next", URL, ou undefined */
  dest?: string;
  /**
   * false = o runtime IGNORA o `destination` deste bloco (vai sempre para a
   * próxima). Sem isso o construtor oferece um seletor que grava dado morto.
   */
  editable: boolean;
}

export interface FlowNode {
  id: string;
  idx: number;          // índice entre as lâminas ATIVAS
  title: string;
  disabled: boolean;
  exits: FlowExit[];
  /** destino da bolinha padrão: `nextStep` se houver, senão a próxima visível */
  proxima?: string;
  /** posição travada pelo arrasto no mapa; sem ela o nó entra no layout automático */
  fixado?: { x: number; y: number };
}

export type EdgeKind = "seq" | "jump" | "back" | "extern";

export interface FlowEdge {
  id: string;
  from: string;
  to: string | null;      // null = link externo (não aterrissa em lâmina)
  kind: EdgeKind;
  /** y da saída dentro do nó de origem (0 = topo do nó) */
  fromY: number;
  label?: string;
}

const strip = (h?: unknown): string =>
  String(h ?? "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Saídas REAIS de uma lâmina — o que o runtime de fato faz, não o que os dados
 * sugerem. `editable: false` marca as saídas que existem mas não são
 * configuráveis (o runtime ignora o destino).
 */
export function flowExits(s: InleadStep): FlowExit[] {
  const out: FlowExit[] = [];
  for (const l of ((s.layers || []) as any[])) {
    if (l?.design?.hidden) continue;                       // achado 4
    const id = String(l.id ?? "");
    const c = l.content || {};

    if (l.type === "button") {
      out.push({ key: `${id}:_`, layerId: id, optId: null, icon: "🔘", label: strip(c.label) || "Botão", dest: c.destination, editable: true });
    } else if (l.type === "options") {
      if (c.multiple) {
        // achado 1: múltipla escolha navega pelo "Continuar", destino fixo
        out.push({
          key: `${id}:_m`, layerId: id, optId: null, icon: "☑️",
          label: `Continuar · múltipla (${(c.options || []).length} opções)`,
          dest: "next", editable: false,
        });
      } else {
        for (const o of ((c.options || []) as any[])) {
          out.push({ key: `${id}:${o.id}`, layerId: id, optId: String(o.id), icon: "☑️", label: strip(o.label) || "Opção", dest: o.destination, editable: true });
        }
      }
    } else if (l.type === "loading" && c.type !== "none") {
      // achado 2: loading navega sozinho quando tem tipo — e é configurável
      out.push({ key: `${id}:_`, layerId: id, optId: null, icon: "⏳", label: `após ${Number(c.seconds) || 4}s`, dest: c.destination, editable: true });
    } else if (l.type === "slider") {
      out.push({ key: `${id}:_`, layerId: id, optId: null, icon: "🎚️", label: "ao soltar", dest: "next", editable: false });
    } else if (l.type === "roulette") {
      out.push({ key: `${id}:_`, layerId: id, optId: null, icon: "🎡", label: "após girar", dest: "next", editable: false });
    }
    // carousel/field/text/image não navegam (achado 2)
  }
  return out;
}

/** Altura total do nó, dado o número de saídas. */
export const nodeH = (nExits: number) => FLOW.HEAD + nExits * FLOW.ROW + FLOW.PADB;
/** y do centro da saída `k` dentro do nó. */
export const rowY = (k: number) => FLOW.HEAD + k * FLOW.ROW + FLOW.ROW / 2;
/** y do centro da bolinha padrão (rodapé do nó). */
export const defaultDotY = (nExits: number) => FLOW.HEAD + nExits * FLOW.ROW + FLOW.PADB / 2;

/**
 * Próxima lâmina que o visitante REALMENTE vê. Espelha LayersRunner.tsx:37, que
 * filtra as desativadas antes de indexar (achado 3).
 */
export function nextVisibleId(steps: InleadStep[], i: number): string | undefined {
  for (let k = i + 1; k < steps.length; k++) if (!steps[k].disabled) return steps[k].id;
  return undefined;
}

/** Monta os nós na ordem do funil. */
export function buildNodes(steps: InleadStep[]): FlowNode[] {
  return steps.map((s, i) => {
    // `nextStep` (definido arrastando a bolinha do rodapé) vence a posição —
    // mesma precedência do LayersRunner.navigate.
    const alvo = s.nextStep && steps.some((t) => t.id === s.nextStep) ? s.nextStep : undefined;
    return {
      id: s.id,
      idx: i,
      title: strip(s.title) || `Lâmina ${i + 1}`,
      disabled: !!s.disabled,
      exits: flowExits(s),
      proxima: alvo ?? nextVisibleId(steps, i),
      fixado: s.flowPos,
    };
  });
}

/**
 * Resolve um `destination` para o id de lâmina. Espelha LayersRunner.tsx:64-69:
 * ausente/"next" = próxima visível; URL = sai do funil; id inválido = próxima.
 */
export function resolveDest(steps: InleadStep[], i: number, dest?: string): { to: string | null; extern: boolean } {
  if (!dest || dest === "next") return { to: nextVisibleId(steps, i) ?? null, extern: false };
  if (/^https?:\/\//i.test(dest)) return { to: null, extern: true };
  const existe = steps.some((s) => s.id === dest);
  return { to: existe ? dest : (nextVisibleId(steps, i) ?? null), extern: false };
}

/**
 * Arestas do grafo.
 *
 * Saída cujo destino é a própria "próxima lâmina" NÃO vira aresta: ela cai na
 * bolinha padrão. Sem isso, 6 opções com destino "next" desenhavam 6 curvas
 * idênticas empilhadas, e o mapa virava um borrão.
 */
export function buildEdges(steps: InleadStep[], nodes: FlowNode[]): FlowEdge[] {
  const edges: FlowEdge[] = [];
  const ordem = new Map(nodes.map((n) => [n.id, n.idx]));

  nodes.forEach((n) => {
    // bolinha padrão: sempre presente enquanto houver próxima lâmina
    if (n.proxima) {
      edges.push({ id: `${n.id}:default`, from: n.id, to: n.proxima, kind: "seq", fromY: defaultDotY(n.exits.length) });
    }
    n.exits.forEach((x, k) => {
      const { to, extern } = resolveDest(steps, n.idx, x.dest);
      if (extern) {
        edges.push({ id: `${n.id}:${x.key}`, from: n.id, to: null, kind: "extern", fromY: rowY(k), label: x.label });
        return;
      }
      if (!to || to === n.proxima) return;   // segue o padrão: não duplica a seta
      const volta = (ordem.get(to) ?? 0) <= n.idx;
      edges.push({ id: `${n.id}:${x.key}`, from: n.id, to, kind: volta ? "back" : "jump", fromY: rowY(k), label: x.label });
    });
  });
  return edges;
}

/**
 * Layout HORIZONTAL por camadas (longest-path em DAG).
 *
 * As arestas de RETORNO (uma opção que aponta para lâmina anterior) são
 * detectadas por DFS e excluídas do cálculo de nível — senão o caminho mais
 * longo cresce sem parar e o mapa vira uma tira gigante.
 */
export function layout(nodes: FlowNode[], edges: FlowEdge[], maxCols = 6): {
  pos: Record<string, { x: number; y: number }>;
  canvasW: number;
  canvasH: number;
  /** quantas faixas a serpentina usou (1 = horizontal puro) */
  faixas: number;
} {
  const ids = nodes.map((n) => n.id);
  const adj: Record<string, string[]> = {};
  for (const id of ids) adj[id] = [];
  for (const e of edges) if (e.to && e.kind !== "back") adj[e.from]?.push(e.to);

  // DFS iterativo: aresta para nó CINZA (ainda na pilha) é aresta de retorno
  const cor: Record<string, 0 | 1 | 2> = {};
  for (const id of ids) cor[id] = 0;
  const back = new Set<string>();
  for (const raiz of ids) {
    if (cor[raiz]) continue;
    cor[raiz] = 1;
    const pilha: { id: string; k: number }[] = [{ id: raiz, k: 0 }];
    while (pilha.length) {
      const t = pilha[pilha.length - 1];
      const filhos = adj[t.id] || [];
      if (t.k >= filhos.length) { cor[t.id] = 2; pilha.pop(); continue; }
      const v = filhos[t.k++];
      if (cor[v] === 1) { back.add(`${t.id}->${v}`); continue; }
      if (cor[v] === 0) { cor[v] = 1; pilha.push({ id: v, k: 0 }); }
    }
  }

  // longest-path: converge em no máximo N passadas
  const nivel: Record<string, number> = {};
  for (const id of ids) nivel[id] = 0;
  for (let p = 0; p < ids.length; p++) {
    let mudou = false;
    for (const id of ids) {
      for (const v of adj[id] || []) {
        if (back.has(`${id}->${v}`)) continue;
        if (nivel[v] < nivel[id] + 1) { nivel[v] = nivel[id] + 1; mudou = true; }
      }
    }
    if (!mudou) break;
  }

  // colunas; dentro da coluna, ordem = ordem das etapas (bate com a sidebar)
  const porCol = new Map<number, FlowNode[]>();
  for (const n of nodes) {
    const c = nivel[n.id] ?? 0;
    if (!porCol.has(c)) porCol.set(c, []);
    porCol.get(c)!.push(n);
  }
  /**
   * SERPENTINA: ao chegar em `maxCols` a leitura quebra e desce para a faixa
   * seguinte. Existia porque os funis daqui são quase lineares (no cdb-01, 50
   * de 52 saídas seguem o padrão) e horizontal puro dava ~7.700px de largura
   * num contêiner que só rolava.
   *
   * Hoje o `LayersFlow` tem pan/zoom e passa `maxCols = nodes.length`, o que
   * mantém tudo numa faixa só (o nível máximo é ≤ n-1, então `c / maxCols`
   * nunca chega a 1). A quebra continua aqui para quem quiser um mapa
   * compacto — basta passar um `maxCols` menor.
   */
  const colunas = [...porCol.keys()].sort((a, b) => a - b);
  const pos: Record<string, { x: number; y: number }> = {};
  const alturaDaFaixa = new Map<number, number>();

  // 1ª passada: altura de cada faixa (a mais alta das suas colunas)
  for (const c of colunas) {
    const faixa = Math.floor(c / maxCols);
    const h = porCol.get(c)!.reduce((soma, n) => soma + nodeH(n.exits.length) + FLOW.GAPY, 0);
    alturaDaFaixa.set(faixa, Math.max(alturaDaFaixa.get(faixa) ?? 0, h));
  }
  // deslocamento vertical acumulado de cada faixa
  const topoDaFaixa = new Map<number, number>();
  let acumulado = 40;
  for (const f of [...alturaDaFaixa.keys()].sort((a, b) => a - b)) {
    topoDaFaixa.set(f, acumulado);
    acumulado += (alturaDaFaixa.get(f) ?? 0) + 70;   // respiro entre faixas
  }

  for (const c of colunas) {
    const faixa = Math.floor(c / maxCols);
    const colNaFaixa = c % maxCols;
    let y = topoDaFaixa.get(faixa) ?? 40;
    for (const n of porCol.get(c)!.sort((a, b) => a.idx - b.idx)) {
      pos[n.id] = { x: 40 + colNaFaixa * (FLOW.W + FLOW.GAPX), y };
      y += nodeH(n.exits.length) + FLOW.GAPY;
    }
  }

  // Nó arrastado à mão sobrepõe o cálculo. Fica por último para vencer o
  // layout automático, e o canvas cresce para caber quem foi jogado longe.
  let maxX = 0, maxY = 0;
  for (const n of nodes) {
    if (n.fixado) pos[n.id] = { x: n.fixado.x, y: n.fixado.y };
    const p = pos[n.id];
    if (!p) continue;
    maxX = Math.max(maxX, p.x + FLOW.W);
    maxY = Math.max(maxY, p.y + nodeH(n.exits.length));
  }

  const usadas = Math.min(maxCols, colunas.length) || 1;
  return {
    pos,
    canvasW: Math.max(40 + usadas * (FLOW.W + FLOW.GAPX) + 60, maxX + 120),
    canvasH: Math.max(360, acumulado + 20, maxY + 80),
    faixas: alturaDaFaixa.size || 1,
  };
}

/** Curva da aresta: sai pela DIREITA da origem, entra pela ESQUERDA do destino. */
export function edgePath(x1: number, y1: number, x2: number, y2: number, kind: EdgeKind): string {
  if (kind === "back") {
    // retorno: desce e contorna por baixo, pra não atravessar os nós
    const meio = Math.max(y1, y2) + 70;
    return `M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x1 + 60} ${meio}, ${(x1 + x2) / 2} ${meio} S ${x2 - 60} ${y2}, ${x2} ${y2}`;
  }
  const dx = Math.max(48, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export const EDGE_COLOR: Record<EdgeKind, string> = {
  seq: "#94a3b8",      // segue o padrão
  jump: "#ea580c",     // pulo explícito
  back: "#7c3aed",     // volta pra trás
  extern: "#a3a3a3",   // sai do funil
};
