import { parseDocument, DomUtils } from "htmlparser2";
import { isTag, type AnyNode } from "domhandler";
import { createLayersFunnel, DEFAULT_CREATION } from "@/lib/quiz/creation";
import type { Funnel } from "@/lib/quiz/types";
import type { InleadStep, Layer } from "@/lib/quiz/layers/types";
import type { ProjectAttachment, ProjectPage } from "./project-attachment";

const blocked = new Set(["script", "iframe", "frame", "frameset", "object", "embed", "applet", "meta", "base", "template", "noscript", "link", "foreignobject", "animate", "set", "animatecolor", "animatetransform", "sc-for"]);
const resources = new Set(["src", "srcset", "href", "xlink:href", "action", "formaction", "poster", "background", "srcdoc", "ping"]);

function localPath(value: string, from: string) {
  try {
    const url = new URL(value, "https://importacao.invalid/" + from);
    if (url.origin === "https://importacao.invalid") return decodeURIComponent(url.pathname.slice(1));
  } catch {}
  return "";
}

function imageUrl(value: string, from: string, assets: ProjectAttachment["assets"]) {
  if (/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(value)) return value;
  return Object.hasOwn(assets, localPath(value, from)) ? assets[localPath(value, from)] : "";
}

function cssText(css: string, from: string, assets: ProjectAttachment["assets"]) {
  return css.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi, (_match, double, single, bare) => {
    const value = String(double ?? single ?? bare).trim();
    return `url("${imageUrl(value, from, assets)}")`;
  }).replace(/<\/style/gi, "<\\/style");
}

function cleanNode(node: AnyNode, from: string, assets: ProjectAttachment["assets"]) {
  if (!isTag(node)) {
    if (node.type !== "text") DomUtils.removeElement(node);
    return;
  }
  const tag = node.name.toLowerCase();
  if (blocked.has(tag) || tag === "sc-if" && node.attribs["hint-placeholder-val"]?.includes("false")) {
    DomUtils.removeElement(node);
    return;
  }
  if (tag === "style") {
    const child = node.children[0];
    if (child?.type === "text") child.data = cssText(child.data, from, assets);
    return;
  }
  for (const [key, value] of Object.entries(node.attribs)) {
    if (key === "style") node.attribs[key] = cssText(value, from, assets);
    else if (key === "src" && tag === "img") {
      const url = imageUrl(value, from, assets);
      if (url) node.attribs[key] = url;
      else delete node.attribs[key];
    } else if (key.startsWith("on") || resources.has(key) || key === "autofocus" || key === "target" || key === "download") {
      delete node.attribs[key];
    }
  }
  [...node.children].forEach(child => cleanNode(child, from, assets));
}

function renderPage(page: ProjectPage, project: ProjectAttachment, destinations: Map<string, string>, id: string): Layer[] {
  const doc = parseDocument(page.html);
  const tags = (name: string) => DomUtils.findAll(node => node.name.toLowerCase() === name, doc.children);
  const styles = DomUtils.findAll(node => node.name === "style" || node.name === "link" && node.attribs.rel?.toLowerCase().split(/\s+/).includes("stylesheet"), doc.children)
    .map(node => {
      if (node.name === "style") return cssText(DomUtils.textContent(node), page.path, project.assets);
      const path = localPath(node.attribs.href ?? "", page.path);
      return cssText(project.styles && Object.hasOwn(project.styles, path) ? project.styles[path] : "", path, project.assets);
    }).filter(Boolean);
  const links = new Map<string, string>();
  for (const link of tags("a")) {
    const destination = destinations.get(localPath(link.attribs.href ?? "", page.path));
    const label = DomUtils.textContent(link).trim().replace(/\s+/g, " ").slice(0, 140);
    if (destination && label && !links.has(destination)) links.set(destination, label);
  }
  const body = tags("body")[0];
  const content: AnyNode[] = body?.children ?? doc.children.filter(node => !isTag(node) || node.name !== "head");
  if (body) cleanNode(body, page.path, project.assets);
  else for (const node of [...content]) cleanNode(node, page.path, project.assets);
  const css = styles.map(style => `<style>${style}</style>`).join("");
  const html = body ? DomUtils.getOuterHTML(body) : DomUtils.getOuterHTML(content);
  const layer: Layer = { id: `${id}-design`, type: "html", title: "Design importado", design: { padding: 0, borderWidth: 0 },
    content: { html: css + html, height: 844, importedDesign: true, runScripts: false } };
  return [layer, ...Array.from(links, ([destination, label], index): Layer => ({
    id: `${id}-link-${index + 1}`, type: "button", content: { label, destination, type: "step" },
  }))];
}

export function importProjectDesign(project: ProjectAttachment, pages: ProjectPage[]): { funnel: Funnel; warnings: string[] } {
  if (!pages.length || pages.length > 30) throw Error("Selecione de 1 a 30 páginas HTML.");
  const title = pages[0].title.slice(0, 120) || "Página importada";
  const funnel = createLayersFunnel({ ...DEFAULT_CREATION, name: title }, "importacao-local");
  const destinations = new Map(pages.map((page, index) => [page.path, `etapa-${index + 1}`]));
  let htmlSize = 0;
  funnel.steps = pages.map((page): InleadStep => {
    const id = destinations.get(page.path)!;
    const layers = renderPage(page, project, destinations, id);
    htmlSize += layers[0].content.html?.length ?? 0;
    if (htmlSize > 5_000_000) throw Error("O design é grande demais para um rascunho. Importe menos páginas por vez.");
    return { id, title: page.title, layers };
  }) as unknown as Funnel["steps"];
  return { funnel, warnings: [
    "O rascunho preserva a estrutura HTML, o CSS e as imagens disponíveis no arquivo.",
    "Os scripts, formulários e recursos externos ficam desativados. Links entre páginas importadas aparecem como botões de etapa.",
    ...(pages.some(page => page.dynamic) ? ["Interações do arquivo original precisam ser reconstruídas no editor."] : []),
  ] };
}
