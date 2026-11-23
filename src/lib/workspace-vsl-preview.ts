import type { InleadStep } from "@/lib/quiz/layers/types";
import type { Funnel } from "@/lib/quiz/types";

const account = "827477fe-fc01-4a51-a859-9c6a01400394";
const players = new Map([
  ["cdbcpit", "6ac59afb89a7c3c050dff2f1"],
  ["cdbcpit2", "6ac98eabbef6ac448cf710a5"],
  ["cdbcpit3", "6ad17eee8bfab0b5d0c2e4fa"],
  ["cdbspit", "6ac597cb70f85db8dfe11be1"],
  ["cdbspit2", "6ac98e611a6142112175a77b"],
  ["cdbspit3", "6ad17ed5d36ea0a0f9ead026"],
  ["sdbcpit4", "6ae55c03223b14491599dcee"],
  ["sdbcpit5", "6ae8958b003cde8b6c064b02"],
  ["sdbcpit6", "6afc306328cb64aefe6008ea"],
  ["sdbspit4", "6ae55bee3ce680b34e9f6ff2"],
  ["sdbspit5", "6ae897b30cd441a7c40ab589"],
  ["sdbspit6", "6afc3071ce292bd10f008115"],
  ["vdmcpit6", "6afc3843491de0e2d095b5c1"],
  ["vdmspit6", "6afc383428cb64aefe600be6"],
]);

const playerOrigin = "https://scripts.converteai.net";

export function getVslIframeUrl(html: string) {
  // Only construct a fresh provider URL. Never run code from the saved embed in the editor.
  const match = /https:\/\/scripts\.converteai\.net\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/players\/([0-9a-f]{24})\/v4\/(?:player\.js|embed\.html)(?![\w./-])/i.exec(html);
  if (match) return `${playerOrigin}/${match[1]}/players/${match[2]}/v4/embed.html`;
}

export function restoreMissingVsl(funnel: Funnel, sourceSlug: string): Funnel {
  const player = players.get(sourceSlug);
  if (!player || funnel.settings?.engine !== "layers") return funnel;
  const url = `${playerOrigin}/${account}/players/${player}/v4/embed.html`;
  let changed = false;
  const steps = (funnel.steps as unknown as InleadStep[]).map(step => {
    const layers = step.layers.map(layer => {
      if (layer.id !== "vsl-player" || layer.type !== "embed") return layer;
      if ([layer.content.embedHtml, layer.content.html, layer.content.text].some(value => typeof value === "string" && value.trim())) return layer;
      changed = true;
      return { ...layer, content: { ...layer.content, embedHtml: `<iframe title="VSL da campanha" src="${url}" allowfullscreen></iframe>` } };
    });
    return layers.some((layer, index) => layer !== step.layers[index]) ? { ...step, layers } : step;
  });
  return changed ? { ...funnel, steps: steps as unknown as Funnel["steps"] } : funnel;
}
