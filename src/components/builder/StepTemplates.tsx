"use client";

import { useRef } from "react";
import { LayoutGrid, X } from "lucide-react";
import type { Layer, LayerType } from "@/lib/quiz/layers/types";

type TemplateBlock = { type: LayerType; content?: Partial<Layer["content"]>; answers?: string[] };
export type StepTemplate = { title: string; blocks: TemplateBlock[] };

const heading = (title: string): TemplateBlock => ({ type: "text", content: { text: `<h2 class="ql-align-center"><strong>${title}</strong></h2>` } });
const button: TemplateBlock = { type: "button" };
const options: TemplateBlock = { type: "options" };
const nameField: TemplateBlock = { type: "field", content: { type: "text", name: "nome", title: "Seu nome", placeholder: "Nome", mask: "" } };
const emailField: TemplateBlock = { type: "field", content: { type: "email", name: "email", title: "Seu e-mail", placeholder: "voce@email.com", mask: "" } };

const templates: StepTemplate[] = [
  { title: "Página inicial", blocks: [heading("Vamos começar?"), button] },
  { title: "Quiz em lista", blocks: [heading("Qual opção combina com você?"), options] },
  { title: "Formulário", blocks: [heading("Preencha seus dados"), nameField, emailField, button] },
  { title: "Captura simples", blocks: [heading("Qual é o seu WhatsApp?"), { type: "field" }, button] },
  { title: "Quiz em colunas", blocks: [heading("Escolha uma opção"), { type: "options", content: { cols: "grid-cols-2" } }] },
  { title: "Múltipla escolha", blocks: [heading("Quais opções combinam com você?"), { type: "options", content: { multiple: true } }] },
  { title: "Escala de like", blocks: [heading("Quanto você gostou?"), { type: "options", content: { cols: "grid-cols-5" }, answers: ["1", "2", "3", "4", "5"] }] },
  { title: "Gráfico", blocks: [heading("Veja o seu resultado"), { type: "graphics" }, button] },
  { title: "Progresso", blocks: [{ type: "loading", content: { type: "advance" } }] },
  { title: "Pré-checkout", blocks: [heading("Confira sua escolha"), { type: "card", content: { text: "<p>Descreva aqui o que está incluído na oferta.</p>" } }, { type: "button", content: { label: "Ir para o pagamento" } }] },
];

function TemplateThumbnail({ blocks }: { blocks: TemplateBlock[] }) {
  return <span className="ct-template-thumb" aria-hidden="true"><span className="ct-template-sheet">
    {blocks.map((block, index) => block.type === "options"
      ? <span key={index} className="ct-template-options" style={{ gridTemplateColumns: `repeat(${block.answers?.length ?? (block.content?.cols === "grid-cols-2" ? 2 : 1)},1fr)` }}>
          {Array.from({ length: block.answers?.length ?? 2 }, (_, option) => <i key={option} data-multiple={!!block.content?.multiple} />)}
        </span>
      : <i key={index} data-block={block.type} />)}
  </span></span>;
}

export function StepTemplatePicker({ onSelect }: { onSelect: (template: StepTemplate) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button className="ct-step-control" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}><LayoutGrid size={15} />Modelos</button>
    <dialog ref={dialog} className="ct-template-dialog" aria-label="Modelos de etapa" onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="ct-template-body">
        <header><h2>Modelos de etapa</h2><button type="button" aria-label="Fechar modelos" onClick={() => dialog.current?.close()}><X size={18} /></button></header>
        <div className="ct-template-grid">{templates.map(template =>
          <button key={template.title} onClick={() => { dialog.current?.close(); onSelect(template); }}>
            <TemplateThumbnail blocks={template.blocks} />
            <span>{template.title}</span>
          </button>
        )}</div>
      </div>
    </dialog>
  </>;
}
