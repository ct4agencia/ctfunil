import "server-only";

import { createLayersFunnel, DEFAULT_CREATION } from "@/lib/quiz/creation";
import type { InleadStep, Layer } from "@/lib/quiz/layers/types";
import templates from "./workspace-preview-vsl-drafts.json";
import images from "./workspace-preview-vsl-images.json";
import nativeTemplates from "./workspace-preview-native-drafts.json";
import quizTemplates from "./workspace-preview-quiz-drafts.json";
import legacyTemplates from "./workspace-preview-legacy-drafts.json";
import typebotTemplate from "./workspace-preview-typebot-draft.json";
import { TB_DEFAULT_THEME, type TbFunnel } from "./quiz/typebot/types";

const TYPEBOT_SLUG = "cdb-type01";

const layersTemplates = [...nativeTemplates, ...quizTemplates, ...legacyTemplates];

function escapeHtml(text: string) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function previewVslHeading(text: string) {
  if (text === "Apostila Gratuita") {
    return 'Apostila <span style="color:#0668f1!important">Gratuita</span>';
  }
  if (text === "Sua apostila será enviada em alguns minutos...") {
    return 'Sua apostila será enviada em <br><span style="color:#007bff!important">alguns minutos...</span>';
  }
  if (text === "Se você assistir aos primeiros 30 segundos desse vídeo,") {
    return 'Se você assistir aos primeiros <br>30 segundos desse vídeo,';
  }
  return text;
}

export function hasPreviewVslDraft(slug: string) {
  return templates.some(row => row.slug === slug);
}

export function hasPreviewFunnelDraft(slug: string) {
  return slug === TYPEBOT_SLUG || hasPreviewVslDraft(slug) || layersTemplates.some(row => row.slug === slug);
}

export function getPreviewFunnelDraft(slug: string, name: string) {
  if (slug === TYPEBOT_SLUG) {
    const draft = createLayersFunnel({ ...DEFAULT_CREATION, name }, slug);
    const typebot = { ...typebotTemplate, theme: { ...TB_DEFAULT_THEME, ...typebotTemplate.theme } } as TbFunnel;
    return { ...draft, steps: [], settings: { ...draft.settings, engine: "typebot" as const, typebot } };
  }
  const native = layersTemplates.find(row => row.slug === slug);
  if (native) return { ...createLayersFunnel({ ...DEFAULT_CREATION, name }, slug), steps: native.steps as unknown as ReturnType<typeof createLayersFunnel>["steps"] };

  return getPreviewVslDraft(slug, name);
}

function getPreviewVslDraft(slug: string, name: string) {
  const source = templates.find(row => row.slug === slug);
  if (!source) return null;

  const imageById = new Map(images.filter(image => image.slug === slug).map(image => [image.id, image.src]));
  const steps = source.steps.map((stage): InleadStep => {
    const layers = stage.layers.map((item): Layer => {
      const id = item.id;
      const timing = { revealAt: item.revealAt, revealClock: item.revealClock };
      if (item.type === "embed") return { id, type: "embed", content: { id } };
      if (item.type === "image") return {
        id,
        type: "image",
        design: id === "97ca1aeb" ? { glow: true, flutua: true } : undefined,
        content: { id, ...timing, image: { type: "image", src: imageById.get(id) ?? "" } },
      };
      if (item.type === "clear") return { id, type: "clear", content: { id, clear: "h-[1rem]" } };
      if (item.type === "text") {
        const text = escapeHtml("text" in item ? item.text ?? "" : "");
        if (id === "c02-tit" || id === "vsl-tit") {
          return {
            id,
            type: "text",
            design: {
              align: "center",
              fontFamily: "Arial",
              fontSize: id === "c02-tit" ? 28 : 24,
              fontWeight: 700,
              lineHeight: 1.18,
              textColor: text.startsWith("Se você assistir aos primeiros") ? "#190953" : "#0b1035",
            },
            content: {
              id,
              ...timing,
              text: id === "c02-tit"
                ? `<h1 class="ct-vsl-cover-heading">${previewVslHeading(text)}</h1>`
                : `<h1>${previewVslHeading(text)}</h1>`,
            },
          };
        }
        return { id, type: "text", content: { id, ...timing, text } };
      }

      const content = {
        id,
        label: escapeHtml(item.label ?? ""),
        waitText: escapeHtml(item.waitText ?? ""),
        ...timing,
        countdown: item.countdown,
        destination: "destination" in item ? item.destination : undefined,
      };
      return { id, type: "button", content };
    });
    return { id: stage.id, title: stage.title || "Etapa", layers };
  });

  const draft = createLayersFunnel({ ...DEFAULT_CREATION, name }, slug);
  draft.steps = steps as unknown as typeof draft.steps;
  return draft;
}
