"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { common, createLowlight } from "lowlight";
import Markdown from "react-markdown";

const highlighter = createLowlight(common);
type SyntaxNode = ReturnType<typeof highlighter.highlight>["children"][number];
type CodePart = { text: string; classes: string };

function codeLines(text: string, language: string): CodePart[][] {
  const grammar = language.toLowerCase();
  if (!highlighter.registered(grammar) || text.length > 12_000) {
    return text.split(/\r?\n/).map(line => [{ text: line, classes: "" }]);
  }

  const lines: CodePart[][] = [[]];
  function append(node: SyntaxNode, classes = "") {
    if (node.type === "element") {
      const ownClasses = node.properties.className;
      const nestedClasses = Array.isArray(ownClasses) ? classes + " " + ownClasses.join(" ") : classes;
      node.children.forEach(child => append(child, nestedClasses));
    }
    if (node.type !== "text") return;
    node.value.split(/\r?\n/).forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part, classes });
    });
  }
  highlighter.highlight(grammar, text).children.forEach(node => append(node));
  return lines;
}

function CodeSnippet({ language, text }: { language: string; text: string }) {
  const [feedback, setFeedback] = useState<"copied" | "error" | null>(null);
  const lines = useMemo(() => codeLines(text, language), [text, language]);
  return <figure className="ct-chat-code">
    <figcaption><span>{language}</span><button type="button" onClick={async () => {
      try {
        await navigator.clipboard.writeText(text);
        setFeedback("copied");
      } catch {
        setFeedback("error");
      }
    }}>
      {feedback === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {feedback === "copied" ? "Copiado" : "Copiar código"}
    </button></figcaption>
    <pre tabIndex={0} aria-label={`Bloco de código ${language}`}><code>{lines.map((line, index) =>
      <span key={index}><i aria-hidden="true">{index + 1}</i>{line.length === 0 ? " " : line.map((part, partIndex) =>
        <span key={partIndex} className={part.classes || undefined}>{part.text}</span>
      )}</span>
    )}</code></pre>
    {feedback === "copied" && <span role="status" className="sr-only">Código copiado.</span>}
    {feedback === "error" && <span role="alert">Não foi possível copiar o código.</span>}
  </figure>;
}

const proseElements = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "ol", "ul", "li", "em", "strong", "blockquote", "code", "pre", "hr", "a", "br"];

export default function AssistantResponse({ text }: { text: string }) {
  return <div className="ct-chat-response">
    <Markdown skipHtml allowedElements={proseElements} unwrapDisallowed components={{
      pre: ({ node, children }) => {
        const code = node?.children[0];
        if (code?.type !== "element" || code.tagName !== "code") return <pre>{children}</pre>;
        const classes = code.properties.className;
        const language = Array.isArray(classes) ? classes.find(value => typeof value === "string" && value.startsWith("language-")) : undefined;
        const content = code.children.map(child => child.type === "text" ? child.value : "").join("").replace(/\n$/, "");
        return <CodeSnippet language={typeof language === "string" ? language.slice("language-".length) : "Código"} text={content} />;
      },
      h1: ({ children }) => <h3>{children}</h3>,
      h2: ({ children }) => <h3>{children}</h3>,
      h3: ({ children }) => <h4>{children}</h4>,
      a: ({ href, children }) => href?.startsWith("https://")
        ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
        : <>{children}</>,
    }}>{text}</Markdown>
  </div>;
}
