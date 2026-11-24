import { DomUtils } from "htmlparser2";
import type { Element } from "domhandler";

export function isHiddenImportElement(element: Element): boolean {
  const attributes = element.attribs;
  return Object.hasOwn(attributes, "hidden") ||
    (element.name === "sc-if" && /^\s*(?:false|\{\{\s*false\s*\}\})\s*$/i.test(attributes["hint-placeholder-val"] ?? ""));
}

export function importControlLabel(element: Element, resolve = (value: string) => value): string {
  const imageLabels = DomUtils.findAll(node => node.name === "img", element.children)
    .map(image => image.attribs.alt ?? "").join(" ");
  for (const value of [element.attribs["aria-label"], DomUtils.textContent(element), imageLabels, element.attribs.title]) {
    const label = resolve(value ?? "").trim().replace(/\s+/g, " ").slice(0, 140);
    if (label) return label;
  }
  return "";
}
