import { parseDocument, DomUtils } from "htmlparser2";
import { isTag, type AnyNode, Element, Text } from "domhandler";
import { createLayersFunnel, DEFAULT_CREATION } from "@/lib/quiz/creation";
import type { Funnel } from "@/lib/quiz/types";
import type { InleadStep, Layer } from "@/lib/quiz/layers/types";
import type { ProjectAttachment, ProjectPage } from "./project-attachment";

import { importControlLabel, isHiddenImportElement } from "./import-markup";

const blocked = new Set(["script", "iframe", "frame", "frameset", "object", "embed", "applet", "meta", "base", "template", "noscript", "link", "foreignobject", "animate", "set", "animatecolor", "animatetransform", "sc-for"]);
const resources = new Set(["src", "srcset", "href", "xlink:href", "action", "formaction", "poster", "background", "srcdoc", "ping"]);

function localPath(value: string, from: string) {
  try {
    const url = new URL(value, "https://importacao.invalid/" + from);
    if (url.origin === "https://importacao.invalid") return decodeURIComponent(url.pathname.slice(1));
  } catch {}
  return "";
}

const imageData = /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i;
const fontData = /^data:font\/woff2?;base64,[a-z0-9+/=]+$/i;

function localAsset(value: string, from: string, assets: ProjectAttachment["assets"]) {
  const path = localPath(value, from);
  return Object.hasOwn(assets, path) ? assets[path] : "";
}

function imageUrl(value: string, from: string, assets: ProjectAttachment["assets"]) {
  const candidate = /^data:/i.test(value) ? value : localAsset(value, from, assets);
  return imageData.test(candidate) ? candidate : "";
}

function imageCandidates(value: string, from: string, assets: ProjectAttachment["assets"]) {
  const candidates: string[] = [];
  const urlToken = /[\t\n\f\r ,]*([^\t\n\f\r ]+)/gy;
  const descriptorToken = /([^,]*)(?:,|$)/y;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlToken.exec(value))) {
    const original = urlMatch[1];
    const url = imageUrl(original.replace(/,+$/, ""), from, assets);
    let descriptor = "";
    if (!original.endsWith(",")) {
      descriptorToken.lastIndex = urlToken.lastIndex;
      descriptor = descriptorToken.exec(value)?.[1].trim() ?? "";
      urlToken.lastIndex = descriptorToken.lastIndex;
    }
    if (url && (!descriptor || /^(?:[1-9]\d*w|(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?x)$/i.test(descriptor))) {
      candidates.push(descriptor ? `${url} ${descriptor}` : url);
    }
  }
  return candidates.join(", ");
}

function cssText(css: string, from: string, assets: ProjectAttachment["assets"]) {
  return css.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi, (_match, double, single, bare) => {
    const value = String(double ?? single ?? bare).trim();
    const candidate = /^data:/i.test(value) ? value : localAsset(value, from, assets);
    return `url("${imageData.test(candidate) || fontData.test(candidate) ? candidate : ""}")`;
  }).replace(/<\/style/gi, "<\\/style");
}

function stylesheetText(css: string, from: string, project: ProjectAttachment, parents: string[], budget: { remaining: number }): string {
  if (parents.length > 8) return "";
  const prelude = /^(?:\s|\/\*[\s\S]*?\*\/|@charset\s+["'][^"']*["']\s*;)*/i;
  const directive = /^@import\s+(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^()"'\s]+))\s*\)|"([^"]*)"|'([^']*)')\s*([^;{}]*);/i;
  const sheets = project.styles ?? {};
  let rest = css;
  let imported = "";
  while (rest) {
    const start = rest.match(prelude)?.[0].length ?? 0;
    const match = directive.exec(rest.slice(start));
    if (!match) break;
    rest = rest.slice(start + match[0].length);
    const path = localPath(match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? "", from);
    if (!Object.hasOwn(sheets, path) || parents.includes(path) || budget.remaining <= 0) continue;
    budget.remaining--;
    const condition = match[6].trim();
    if (/^(?:layer\b|supports\s*\()/i.test(condition)) continue;
    const nested = stylesheetText(sheets[path], path, project, [...parents, path], budget);
    if (nested) imported += condition ? `@media ${condition} {\n${nested}\n}\n` : `${nested}\n`;
  }
  return imported + cssText(rest.replace(/^\s*@charset\s+["'][^"']*["']\s*;/i, ""), from, project.assets);
}

function cleanNode(
  node: AnyNode,
  from: string,
  assets: ProjectAttachment["assets"],
  links: Map<Element, string>,
  approvedStyles: Set<Element>,
  visible = true,
) {
  if (!isTag(node)) {
    if (node.type !== "text") DomUtils.removeElement(node);
    return;
  }
  if (approvedStyles.has(node)) return;
  const tag = node.name.toLowerCase();
  if (blocked.has(tag) || tag === "style" || tag === "sc-if" && isHiddenImportElement(node)) {
    DomUtils.removeElement(node);
    return;
  }
  visible = visible && !isHiddenImportElement(node);
  const href = node.attribs.href?.trim();
  if (visible && tag === "a" && href && !href.startsWith("#")) links.set(node, href);
  const pictureSource = tag === "source" && node.parent?.type === "tag" && node.parent.name.toLowerCase() === "picture";
  for (const [key, value] of Object.entries(node.attribs)) {
    if (key === "style") node.attribs[key] = cssText(value, from, assets);
    else if (key === "src" && tag === "img") {
      const url = imageUrl(value, from, assets);
      if (url) node.attribs[key] = url;
      else delete node.attribs[key];
    } else if (key === "srcset" && (tag === "img" || pictureSource)) {
      const candidates = imageCandidates(value, from, assets);
      if (candidates) node.attribs[key] = candidates;
      else delete node.attribs[key];
    } else if (key.startsWith("on") || resources.has(key) || key === "autofocus" || key === "target" || key === "download") {
      delete node.attribs[key];
    }
  }
  [...node.children].forEach(child => cleanNode(child, from, assets, links, approvedStyles, visible));
}

function renderPage(page: ProjectPage, project: ProjectAttachment, destinations: Map<string, string>, id: string): Layer[] {
  const doc = parseDocument(page.html);
  const tags = (name: string) => DomUtils.findAll(node => node.name.toLowerCase() === name, doc.children);
  const body = tags("body")[0];
  const root = tags("html")[0];
  const fragment = root ?? doc;
  const isStylesheet = (node: Element) => node.name === "style" ||
    node.name === "link" && Boolean(node.attribs.rel?.toLowerCase().split(/\s+/).includes("stylesheet"));
  const bodyStyles = new Set(body
    ? DomUtils.findAll(isStylesheet, body.children)
    : fragment.children.flatMap(node => isTag(node) && node.name !== "head"
      ? DomUtils.findAll(isStylesheet, node.children)
      : []));
  const approvedStyles = new Set<Element>();
  const importBudget = { remaining: 24 };
  const styles = DomUtils.findAll(isStylesheet, doc.children)
    .map(node => {
      const path = node.name === "style" ? page.path : localPath(node.attribs.href ?? "", page.path);
      const css = node.name === "style" ? DomUtils.textContent(node)
        : project.styles && Object.hasOwn(project.styles, path) ? project.styles[path] : "";
      if (!css && node.name === "link") return "";
      const media = node.attribs.media?.trim();
      const content = stylesheetText(css, path, project, node.name === "style" ? [] : [path], importBudget);
      const text = new Text(content);
      const style = new Element("style", media ? { media } : {}, [text]);
      text.parent = style;
      if (bodyStyles.has(node)) {
        DomUtils.replaceElement(node, style);
        approvedStyles.add(style);
        return "";
      }
      return DomUtils.getOuterHTML(style);
    }).join("");
  const importedRoot = Object.fromEntries(Object.entries(root?.attribs ?? {})
    .filter(([name]) => /^(?:class|id|lang|dir|style|data-[a-z0-9_-]+)$/.test(name))
    .map(([name, value]) => [name, name === "style" ? cssText(value, page.path, project.assets) : value]));
  const anchors = new Map<Element, string>();
  if (body) cleanNode(body, page.path, project.assets, anchors, approvedStyles);
  if (!body) {
    for (const node of [...fragment.children]) {
      if (!isTag(node) || node.name !== "head") cleanNode(node, page.path, project.assets, anchors, approvedStyles);
    }
  }
  const content = fragment.children.filter(node => node.type !== "directive" && (!isTag(node) || node.name !== "head"));
  const links = new Map<string, string>();
  for (const [link, href] of anchors) {
    const destination = destinations.get(localPath(href, page.path));
    if (!destination || links.has(destination)) continue;

    const label = importControlLabel(link);
    if (label) links.set(destination, label);
  }
  const artboard = tags("main")[0];
  const width = Number(artboard?.attribs.style?.match(/(?:^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)px\s*(?:;|$)/i)?.[1]);
  const fit = artboard && width >= 240 && width <= 1920;
  if (fit) artboard.attribs["data-ctfunil-fixed-artboard"] = "";
  const fitStyle = fit ? `<style>
    [data-ctfunil-fixed-artboard] { max-width: 100vw; }
    @supports (zoom: calc(100vw / 1px)) {
      [data-ctfunil-fixed-artboard] { max-width: none; zoom: min(1, calc(100vw / ${width}px)); }
    }
  </style>` : "";
  const css = styles + fitStyle;
  const html = body ? DomUtils.getOuterHTML(body) : DomUtils.getOuterHTML(content);
  const layer: Layer = { id: `${id}-design`, type: "html", title: "Design importado", design: { padding: 0, borderWidth: 0 },
    content: { html: css + html, height: 844, importedDesign: true, importedRoot, runScripts: false } };
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
