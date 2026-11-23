"use client";

import { StatefulButton } from "@/components/referencias/beui/motion/button/stateful";

import RollingNumber from "@/components/ui/RollingNumber";
import StagePreviewRail from "./StagePreviewRail";
import DeleteConfirmationIcon from "@/components/ui/DeleteConfirmationIcon";
import WorkspaceNoticeHistory, { recordWorkspaceNotice } from "@/components/workspace/WorkspaceNoticeHistory";
import WorkspaceNotice from "@/components/ui/WorkspaceNotice";
import ActiveTab from "@/components/ui/ActiveTab";
import { useContext, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { EditorTop } from "@/components/workspace/WorkspaceFrame";
import { AlignLeft, Bell, Calendar, Check, CircleDot, CircleHelp, Code, Columns2, CreditCard, FileText, Gauge, GitBranch, Hash, Heading, Image as ImageIcon, Layers, ListChecks, ListFilter, LoaderCircle, Mail, Megaphone, MessageSquare, MousePointer2, Pencil, PanelTop, Phone, Play, Ruler, ShieldCheck, SlidersHorizontal, Square, Star, Timer, TrendingUp, TriangleAlert, Volume2, type LucideIcon } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Funnel } from "@/lib/quiz/types";
import type { InleadStep, Layer, LayerType } from "@/lib/quiz/layers/types";
import { SONIA_DEFAULTS, soniaConfigError } from "@/lib/quiz/layers/sonia";
import { cloneStageWithRules } from "@/lib/quiz/layers/component-settings";
import LayersRunner from "@/components/quiz/layers/LayersRunner";
import CanvasErrorBoundary from "@/components/builder/CanvasErrorBoundary";
import FunnelSettingsPanel from "@/components/builder/FunnelSettingsPanel";
import PerformanceView from "@/components/dashboard/PerformanceView";
import FunnelDesignPanel from "./FunnelDesignPanel";
import CatalogFields from './CatalogFields';
import { catalogLayer, NEW_COMPONENTS } from '@/lib/quiz/layers/catalog';
import { ComponentAppearance, ComponentDisplay, StageAppearance } from "./ComponentSettings";
import DevicePreview, { getDevice, DEFAULT_DEVICE, type Zoom } from "@/components/builder/DevicePreview";
import { StepTemplatePicker, type StepTemplate } from "./StepTemplates";
import { Copy, Ellipsis, Eye, FilePlus2, Trash2, X } from "lucide-react";
// Editor dos blocos-hero herdados do motor tipado (raspadinha, pedida, medidor,
// VSL, parabéns). Reusado em vez de duplicado: dois editores do mesmo bloco
// viram dois comportamentos diferentes na primeira mudança.
import StepEditor from "@/components/builder/StepEditor";
import { HtmlField, ImageField, TemaFunilContext, LocalDraftContext } from "@/components/builder/fields";
// Mesma normalização que gera o cabeçalho do CSV — se o construtor tivesse a
// dele, o nome digitado e o nome exportado divergiriam no primeiro acento.
import { normalizarChave } from "@/lib/quiz/colunas";
// Presets de período (Tudo/Hoje/Ontem/7d/30d) e o tratamento de fuso: os mesmos
// que `/dashboard/[slug]` usa. Uma cópia só.
import { PERIODOS, spYmd, dayBounds } from "@/lib/quiz/periodo";
import ColorField from "@/components/ui/ColorField";
import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";
import dynamic from "next/dynamic";
// Mapa do funil: só carrega ao abrir a aba Fluxo (SVG + animação ficam fora do
// chunk de quem só usa o construtor).
const LayersFlow = dynamic(() => import("@/components/builder/flow/LayersFlow"), { ssr: false });
import { saveFunnelAction, publishFunnelAction } from "@/app/builder/[slug]/actions";

function genId() {
  try { return crypto.randomUUID().slice(0, 8); } catch { return `l-${Math.random().toString(36).slice(2, 10)}`; }
}
const strip = (h?: string) => (h || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const BLOCK_META: Record<string, { icon: string; label: string }> = {
  text: { icon: "🔤", label: "Texto" }, image: { icon: "🖼️", label: "Imagem" }, button: { icon: "🔘", label: "Botão" },
  options: { icon: "☑️", label: "Opções" }, field: { icon: "📝", label: "Campo" }, alert: { icon: "⚠️", label: "Alerta" },
  timer: { icon: "⏱️", label: "Timer" }, loading: { icon: "⏳", label: "Loading" }, notification: { icon: "🔔", label: "Notificação" },
  graphics: { icon: "📊", label: "Gráfico" }, clear: { icon: "↕️", label: "Espaço" }, embed: { icon: "▶️", label: "Vídeo/Embed" },
  video: { icon: "▶️", label: "Vídeo" }, roulette: { icon: "🎡", label: "Roleta" }, slider: { icon: "🎚️", label: "Slider" },
  carousel: { icon: "🎠", label: "Carrossel" },
  "sonia-numbers": { icon: "🔢", label: "Sorteio da Sônia" },
};
/** Paleta categorizada (ordem/categorias dos prints do inlead). */
const CATS: { name: string; items: [string, string][] }[] = [
  // (a lista de blocos da lâmina usa `rotuloDoTipo`, logo abaixo, para nomear
  //  cada bloco com o MESMO rótulo do botão que o criou)
  { name: "Formulário", items: [["field", "Campo"], ["email", "E-mail"], ["phone", "Telefone"], ["button", "Botão"], ["number", "Número"], ["textarea", "Textarea"], ["date", "Data"], ["height", "Altura"], ["weight", "Peso"]] },
  { name: "Quiz", items: [["options", "Opções"], ["multi", "Múltipla Escolha"], ["single", "Escolha Única"], ["yesno", "Sim/Não"], ["videoanswer", "Vídeo Resposta"]] },
  // Blocos-hero: ocupam a lâmina inteira. Vêm do motor tipado e nascem com
  // preset pronto — adicionar e já funciona.
  { name: "Jogos (hero)", items: [["sonia-numbers", "Sorteio da Sônia"], ["roulette", "Roleta"], ["scratch", "Raspadinha"], ["slider", "Slider 0–10"], ["measure", "Pedida (régua)"], ["gauge", "Medidor"]] },
  { name: "Conversão (hero)", items: [["vsl", "VSL (vídeo + CTA)"], ["confirm", "Parabéns"]] },
  { name: "Mídia e conteúdo", items: [["text", "Texto"], ["card", "Card"], ["image", "Imagem"], ["video", "Vídeo"], ["audio", "Áudio"]] },
  { name: "Atenção", items: [["alert", "Alerta"], ["notification", "Notificação"], ["timer", "Timer"], ["loading", "Loading"], ["level", "Nível"], ["check", "Check ✓"], ["disclaimer", "Disclaimer"], ["trust", "Garantia e pagamento"], ["ranking", "Ranking"]] },
  { name: "Argumentação", items: [["arguments", "Argumentos"], ["testimonials", "Depoimentos"], ["faq", "FAQ"], ["price", "Preço"], ["checklist", "Checklist"], ["beforeafter", "Antes/Depois"], ["carousel", "Carrossel"]] },
  { name: "Gráficos", items: [["graphics", "Métricas"], ["charts", "Gráficos"]] },
  { name: "Personalização", items: [["clear", "Espaço"], ["html", "HTML/Script"]] },
];
/** Nome legível de um tipo de bloco, tirado da PRÓPRIA paleta — assim o rótulo
 *  na lista de blocos nunca diverge do rótulo do botão que criou o bloco. */
function rotuloDoTipo(t: string): string {
  for (const cat of CATS) for (const [k, label] of cat.items) if (k === t) return label;
  return t;
}
/**
 * Blocos-hero editados pelo StepEditor — o editor único desses blocos.
 *
 * `roulette` entrou aqui depois de viver com editor próprio neste arquivo. O
 * daqui só conhecia título, fatias, prêmio e cores; tudo que a roleta ganhou
 * depois (tipo clássica/interativa, presets de movimento, régua de
 * intensidade, popup de prêmio, som, trava de 24 h) existia apenas no
 * StepEditor. Quem abrisse a roleta pelo construtor layers não enxergava nada
 * disso — dois editores do mesmo bloco, e um ficou para trás, exatamente o que
 * o comentário abaixo já previa.
 */
const HERO_DO_TIPADO = new Set(["scratch", "measure", "gauge", "vsl", "confirm", "roulette", "slider"]);
/** Todo hero editável passa pelo StepEditor. Não há mais lista paralela. */
const HERO_EDITAVEL = HERO_DO_TIPADO;
const ROTULO_HERO: Record<string, string> = {
  scratch: "Raspadinha", measure: "Pedida (régua)", gauge: "Medidor",
  vsl: "VSL", confirm: "Parabéns",
};
const BLOCK_ICONS: Record<string, LucideIcon> = {
  field: AlignLeft, email: Mail, phone: Phone, button: MousePointer2, number: Hash, textarea: FileText, date: Calendar, height: Ruler, weight: Gauge,
  options: ListFilter, multi: ListChecks, single: CircleDot, yesno: GitBranch, videoanswer: Play, text: Heading, image: ImageIcon, video: Play, audio: Volume2,
  card: PanelTop, ranking: TrendingUp, alert: TriangleAlert, notification: Bell, timer: Timer, loading: LoaderCircle, level: SlidersHorizontal, arguments: MessageSquare, testimonials: Star,
  faq: CircleHelp, price: CreditCard, checklist: ListChecks, beforeafter: Columns2, carousel: Layers, graphics: TrendingUp, charts: TrendingUp, html: Code,
  roulette: CircleDot, slider: SlidersHorizontal, measure: Ruler, gauge: Gauge, confirm: Check, check: Check, trust: ShieldCheck, disclaimer: Megaphone, vsl: Play,
  "sonia-numbers": Hash, scratch: Square, clear: AlignLeft,
};
function BlockIcon({ type }: { type: string }) {
  const Icon = BLOCK_ICONS[type] ?? Layers;
  return <Icon aria-hidden="true" size={15} strokeWidth={1.7}/>;
}
/** Tipos que o construtor já adiciona funcionais (o resto é "em breve"). */
const ADDABLE = new Set([...NEW_COMPONENTS,"multi", "single", "yesno", "text", "image", "button", "options", "field", "alert", "timer", "loading", "clear", "check", "disclaimer", "trust", "embed", "email", "phone", "video", "carousel", "roulette", "slider",
  // blocos-hero herdados do motor tipado (todos com preset pronto)
  "scratch", "measure", "gauge", "vsl", "confirm", "sonia-numbers",
  // Estes DOIS o funil já desenhava (blocks.tsx: GraphicsBlock e
  // NotificationBlock) e o construtor ainda dizia "em breve" — funcionalidade
  // pronta e trancada. O `graphics` é o anel de porcentagem que o cdb-01 usa
  // no "94% compatível": dava para ver no funil e não para adicionar num novo.
  "graphics", "notification", "card", "ranking",
  // Escritos a pedido do Luca: régua de níveis, prova social antes→depois com
  // carrossel, e barras de projeção. Diferente dos dois acima, estes NÃO
  // existiam no runtime — foram construídos, não destrancados.
  "level", "beforeafter", "charts"]);

/**
 * Atalhos da paleta que NÃO são tipos de bloco: viram `field` já configurado.
 * Estavam no ADDABLE sem default nem editor, então adicionar "E-mail" criava um
 * bloco de tipo inválido, que caía no "em breve" do painel e não renderizava.
 */
const ATALHO_CAMPO: Record<string, Record<string, unknown>> = {
  email: { name: "email", title: "Seu melhor e-mail", placeholder: "voce@email.com", type: "email", required: true },
  phone: { name: "telefone", title: "Seu WhatsApp (com DDD)", placeholder: "(00) 00000-0000", type: "phone", mask: "phone_br", required: true },
};

function newLayer(type: LayerType): Layer {
  const id = genId();
  const catalog = catalogLayer(type, id);
  if (catalog) return catalog;
  const base = { id, type, content: { id: genId() } } as Layer;
  const atalho = ATALHO_CAMPO[type as string];
  if (atalho) return { id, type: "field", content: { id, ...atalho } } as unknown as Layer;
  switch (type) {
    case "sonia-numbers": return { ...base, content: { id, ...SONIA_DEFAULTS } };
    case "text": return { ...base, content: { id, text: "<p class=\"ql-align-center\">Novo texto</p>" } };
    case "card": return { ...base, design: { basis: 100, variant: "suave", padding: 20 }, content: { id, text: "<p class=\"ql-align-center\">Texto dentro do card. Use a barra de formatação para destacar palavras.</p>" } };
    case "ranking": return { ...base, design: { basis: 100 }, content: { id, posDe: 28, posAte: 48, revealAt: 0, fimEm: 60, pct: 83 } };
    case "alert": return { ...base, design: { style: "danger", padding: 14 }, content: { id, text: "<p class=\"ql-align-center\">Aviso importante</p>" } };
    // Botão novo já nasce com o efeito e a trava LIGADOS: são o padrão certo em
    // praticamente todo funil, e exigir que se ligue à mão os deixa esquecidos.
    // `backgroundColor` fica ausente de propósito — assim o botão herda a Cor
    // do tema em vez de nascer laranja num funil azul.
    case "button": return { ...base, design: { style: "success", basis: 100, effect: "pulse", travar: true, color: "#FFFFFF" }, content: { id, label: "Continuar", type: "next", destination: "next" } };
    case "image": return { ...base, design: { basis: 100 }, content: { id, image: { type: "image", src: "" } } };
    case "options": return { ...base, design: { background: "contrast", icon: "right", iconPosition: "start", border: "border-[2px]" }, content: { id, cols: "grid-cols-1", options: [{ id: genId(), label: "<p>Opção 1</p>", destination: "next" }, { id: genId(), label: "<p>Opção 2</p>", destination: "next" }] } };
    case "field": return { ...base, content: { id, name: "telefone", title: "Seu WhatsApp (com DDD)", placeholder: "(00) 00000-0000", type: "phone", mask: "phone_br", required: true } };
    case "graphics": return { ...base, design: { basis: 100 }, content: { id, cols: "grid-cols-1", order: "default", graphics: [{ id: genId(), type: "chart", style: "#16a34a", percent: "80", legend: "<h2 class=\"ql-align-center\"><strong>Seu resultado</strong></h2>" }] } };
    case "notification": return { ...base, design: { backgroundColor: "#52525b", color: "#ffffff" }, content: { id, text: "<p>🔥 12 pessoas estão vendo isso agora</p>", duration: 6 } };
    // Os três nascem PRONTOS, como os blocos-hero: adicionar e já funciona no
    // preview. Bloco que nasce vazio parece quebrado.
    case "level": return { ...base, design: { basis: 100 }, content: { id,
      title: "<h2 class=\"ql-align-center\"><strong>Seu nível hoje</strong></h2>",
      levels: [{ label: "Iniciante", pct: 25 }, { label: "Intermediário", pct: 60 }, { label: "Avançado", pct: 100 }],
      atual: 1,
      description: "<p class=\"ql-align-center\">Falta pouco para o próximo nível.</p>" } };
    case "beforeafter": return { ...base, design: { basis: 100 }, content: { id,
      pairs: [{ antes: "", depois: "", legenda: "<p>Resultado em 90 dias</p>" }] } };
    case "charts": return { ...base, design: { basis: 100 }, content: { id,
      title: "<h2 class=\"ql-align-center\"><strong>Sua projeção</strong></h2>",
      suffix: "%",
      bars: [{ label: "Hoje", value: 20 }, { label: "30 dias", value: 45 }, { label: "90 dias", value: 85 }] } };
    case "timer": return { ...base, design: { backgroundColor: "#e3eeff", color: "#1c72f1", borderColor: "#c7dcfe", padding: 10 }, content: { id, text: "<p><strong>Oferta acaba em: [time]</strong></p>", time: 300 } };
    case "loading": return { ...base, content: { id, title: "Carregando…", seconds: 4, type: "none", show_title: true, show_percent: true, show_progress: true } };
    case "clear": return { ...base, content: { id, clear: "h-[1rem]" } };
    case "disclaimer": return { ...base, design: { basis: 100 },
      content: { id, text: '<span style="color:#F5C842">[vagas] DAS 50 VAGAS</span> JÁ FORAM GARANTIDAS...', revealAt: 0 } };
    case "check": return { ...base, design: { basis: 64, backgroundColor: "#16A34A", horizontalAlign: "mx-auto" },
      content: { id, text: '<p class="ql-align-center"><strong>Pronto!</strong></p>' } };
    case "trust": return { ...base, design: { basis: 100 },
      content: { id, seloGarantia: true, dias: 7, bandeiras: true, selosConfianca: true,
        formas: "VISA, MASTER, ELO, HIPER, PIX, BOLETO",
        seguranca: "Pagamento processado em ambiente seguro" } };
    case "carousel": return { ...base, design: { basis: 100 }, content: { id, images: [], interval: 2 } };
    case "embed": case "video": return { ...base, content: { id, embedHtml: "" } };
    case "roulette": return { ...base, content: { id, type: "roulette", style: "soft", mode: "always", title: "Gire a roleta e descubra sua condição especial.", subtitle: "Você tem uma chance de liberar um benefício exclusivo agora.", cta: "Girar", initialIndex: 0, winningIndex: 0, winTitle: "🎉 Você ganhou!", winBody: "", winCta: "Continuar →", background: "#0b1f3a", segments: [{ label: "ACESSO GRÁTIS", color: "#008516", value: "" }, { label: "25% OFF", color: "#67c57a", value: "" }, { label: "Não foi dessa vez", color: "#f56161", value: "" }, { label: "15% OFF", color: "#9af4b9", value: "" }, { label: "Tente de novo", color: "#4a4845", value: "" }] } } as unknown as Layer;
    case "slider": return { ...base, content: { id, type: "slider", question: "De 0 a 10, o quanto você quer isso?", help: "Arraste o seletor para responder", min: 0, max: 10, step: 1 } } as unknown as Layer;

    // ── blocos-hero herdados do motor tipado ──────────────────────────────────
    // Todos nascem PRONTOS: adicionar e já funciona no preview, sem configurar
    // nada. Era a diferença que fazia o motor tipado parecer mais completo — os
    // blocos de lá vinham com preset e os daqui vinham vazios.
    // Espelha a raspadinha que RODA em produção (premio-sonia), campo a campo —
    // sem isso o construtor abria metade dos controles vazios e o bloco novo não
    // se parecia com o que já está no ar. `ctaUrl` nasce vazio de propósito: o
    // link de resgate é de cada funil.
    case "scratch": return { ...base, content: {
      id, type: "scratch",
      title: "Raspe e descubra seu prêmio!",
      subtitle: "Escolha um card e use o dedo para raspar.",
      columns: 2, revealPct: 80, oncePerDevice: true,
      coverText: "RASPE AQUI 🔥", coverStyle: "gradient",
      coverColor: "#f7e08a", coverColor2: "#c08c1e", coverTextColor: "#4a1c05", coverTextSize: 50,
      escurecimento: 68, perdedoresOpacidade: 45, confete: true, popupEnabled: false,
      sound: { enabled: true },
      titleShadow: true,
      appearance: { titleColor: "#ffffff" },
      // cores do painel de prêmio (o construtor já edita todas)
      popupBg: "#16a34a", popupText: "#ffffff", popupBtnBg: "#ffffff",
      destaqueBg: "", destaqueText: "#ffffff",
      ctaUrl: "",
      cta: "DESBLOQUEAR PRÊMIO 🎁", winCta: "DESBLOQUEAR PRÊMIO 🎁",
      winTitle: "PARABÉNS!", winBody: "Você ganhou…",
      cards: [
        { label: "50% OFF", weight: 100, color: "#16a34a", popupTitle: "PARABÉNS!", popupBody: "Você ganhou…" },
        { label: "TENTE NOVAMENTE", weight: 0, color: "#919191", popupTitle: "PARABÉNS!", popupBody: "Você ganhou…" },
        { label: "10% OFF", weight: 0, color: "#919191", popupTitle: "PARABÉNS!", popupBody: "Você ganhou…" },
        { label: "BÔNUS EXCLUSIVO", weight: 0, color: "#919191", popupTitle: "PARABÉNS!", popupBody: "Você ganhou…" },
        { label: "FRETE GRÁTIS", weight: 0, color: "#919191", popupTitle: "PARABÉNS!", popupBody: "Você ganhou…" },
        { label: "25% OFF", weight: 0, color: "#919191", popupTitle: "PARABÉNS!", popupBody: "Você ganhou…" },
      ],
    } } as unknown as Layer;

    // "pedida": régua horizontal arrastável (a trena). O efeito de rolagem
    // lateral já vem do MeasureStepView.
    // `suffix` (não `unit`) — é o nome que MeasureStepView lê. `majorEvery`
    // controla de quantos em quantos passos aparece o número na fita.
    case "measure": return { ...base, content: {
      id, type: "measure",
      title: "Arraste para marcar a sua medida",
      subtitle: "Deslize a régua para o lado",
      min: 34, max: 48, step: 1, value: 40,
      majorEvery: 5, suffix: "", units: [], haptic: true,
      cta: "Continuar →",
    } } as unknown as Layer;

    // O rótulo do velocímetro vem da ZONA em que o ponteiro cai — um `label`
    // solto no step nunca aparecia na tela.
    case "gauge": return { ...base, content: {
      id, type: "gauge",
      title: "Seu potencial de resultado",
      subtitle: "Calculado a partir das suas respostas",
      mode: "fixed", value: 82,
      scaleMin: 0, scaleMax: 100, ticks: 5, showValue: true, suffix: "%",
      zones: [
        { label: "BAIXO", color: "#ef4444", upTo: 40 },
        { label: "MÉDIO", color: "#f59e0b", upTo: 70 },
        { label: "ALTO", color: "#16a34a", upTo: 100 },
      ],
      cta: "Ver meu resultado →",
    } } as unknown as Layer;

    case "vsl": return { ...base, content: {
      id, type: "vsl",
      title: "Assista até o final",
      embedHtml: "",
      ctaDelaySec: 0, cta: "QUERO GARANTIR MINHA VAGA",
    } } as unknown as Layer;

    // "parabéns": celebração com confete
    case "confirm": return { ...base, content: {
      id, type: "confirm",
      title: "🎉 Parabéns, {nome}!",
      body: "Você deu o primeiro passo. Continue para ver o que preparamos.",
      cta: "Continuar →",
    } } as unknown as Layer;

    default: return base;
  }
}

function createTemplateStep(template?: StepTemplate): InleadStep {
  const layers = (template?.blocks ?? []).map(({ type, content, answers }) => {
    const layer = newLayer(type);
    Object.assign(layer.content, content);
    if (answers) layer.content.options = answers.map(label => ({ id: genId(), label, destination: "next" }));
    return layer;
  });
  return { id: genId(), title: template?.title ?? "Nova lâmina", layers, options: { show_logo: false, show_progress: false } };
}

/** Editor rico e campo de imagem — ambos compartilhados em builder/fields.tsx. */

const Lbl = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => <label htmlFor={htmlFor} className="mb-1 mt-2 block text-[11px] font-semibold text-neutral-500">{children}</label>;
const inp = "w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs";

/** Tipos de bloco que viram coluna na aba Leads — espelha `lib/quiz/colunas.ts`. */


/**
 * ID/Nome de um bloco ou de uma lâmina: o rótulo que vira chip na aba Leads e
 * cabeçalho no CSV ("options: Faixa_Etaria" em vez de "options: XMMdV8").
 *
 * Grava em `webhookKey`, NUNCA em `id`. O `id` é a chave que liga a resposta já
 * gravada à coluna — trocá-lo orfanaria todo o histórico do funil. É por isso
 * que renomear aqui é sempre seguro.
 *
 * Commit no blur e no Enter, nunca a cada tecla: normalizar durante a digitação
 * trocaria o espaço de "Faixa Etaria" por "_" no instante em que ele é digitado,
 * e o cursor saltaria.
 */
function CampoId({ valor, aoSalvar, automatico, ajuda }: {
  valor?: string;
  aoSalvar: (v: string | undefined) => void;
  automatico: string;
  ajuda: string;
}) {
  const [txt, setTxt] = useState(valor ?? "");
  const commit = () => {
    const limpo = normalizarChave(txt);
    setTxt(limpo);
    // vazio vira undefined: some do JSON e o fallback automático volta a valer
    if (limpo !== (valor ?? "")) aoSalvar(limpo || undefined);
  };
  return (
    <div className="mb-3 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5">
      <Lbl>ID / Nome</Lbl>
      <input
        aria-label="ID / Nome"
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
        placeholder={automatico}
        spellCheck={false}
        className={inp}
      />
      <details className="ct-disclosure mt-1 text-[11px] text-neutral-500"><summary className="cursor-pointer">Sobre o ID</summary><p className="mt-1">{ajuda} Sem um nome, será usado o ID automático <code>{automatico}</code>.</p></details>
    </div>
  );
}

/** Lê/escreve o alinhamento (classe ql-align-*) no HTML do bloco. */
function htmlAlign(html?: string): "left" | "center" | "right" {
  const m = (html || "").match(/ql-align-(center|right)/);
  return (m?.[1] as "center" | "right") || "left";
}
function setHtmlAlign(html: string, align: "left" | "center" | "right"): string {
  if (typeof document === "undefined") return html;
  const div = document.createElement("div");
  div.innerHTML = html || "";
  div.querySelectorAll("p,h1,h2,h3").forEach((el) => {
    el.classList.remove("ql-align-center", "ql-align-right", "ql-align-justify");
    if (align !== "left") el.classList.add(`ql-align-${align}`);
  });
  return div.innerHTML;
}

/** Painel "Aparência" do bloco (alinhamento + largura). */
function Appearance({ layer, onChange }: { layer: Layer; onChange: (l: Layer) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = (layer.design || {}) as any;
  const hasText = typeof layer.content.text === "string";
  const align = d.align || (hasText ? htmlAlign(layer.content.text) : "center");
  const basis = Number(d.basis) || 100;
  const opacity = d.opacity == null ? 100 : Number(d.opacity);
  const setD = (patch: Record<string, unknown>) => onChange({ ...layer, design: { ...(layer.design || {}), ...patch } });
  const valign = d.valign || "middle";
  const pill = (active: boolean) => `flex h-8 flex-1 items-center justify-center rounded-md text-sm ${active ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-400 hover:text-neutral-700"}`;
  const step = (n: number) => setD({ basis: Math.min(200, Math.max(20, n)) });
  return (
    <div className="mt-3 space-y-4 border-t border-neutral-200 pt-3">
      {/* LARGURA — − [slider] + (estilo inlead); até 200% pra ampliar a imagem */}
      <div>
        <Lbl>Largura {basis > 100 ? "(ampliada)" : ""}</Lbl>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Reduzir largura" onClick={() => step(basis - 5)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-neutral-300 text-neutral-500 hover:bg-neutral-50">−</button>
          <input type="range" aria-label="Largura" min={20} max={200} value={basis} onChange={(e) => setD({ basis: Number(e.target.value) })} className="ct-range flex-1" />
          <button type="button" aria-label="Aumentar largura" onClick={() => step(basis + 5)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-neutral-300 text-neutral-500 hover:bg-neutral-50">+</button>
        </div>
        <p className="mt-0.5 text-center text-[11px] font-semibold text-neutral-400"><RollingNumber value={basis} suffix="%" /></p>
      </div>
      {/* ALINHAMENTO — 3 horizontais | 4 verticais (estilo inlead) */}
      <div>
        <Lbl>Alinhamento</Lbl>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-0.5 rounded-lg border border-neutral-200 bg-neutral-100 p-1">
            {([["left", "⬅"], ["center", "↔"], ["right", "➡"]] as const).map(([a, ic]) => (
              <button key={a} onClick={() => setD({ align: a })} title={`Horizontal: ${a}`} className={pill(align === a)}>{ic}</button>
            ))}
          </div>
          <div className="flex flex-1 gap-0.5 rounded-lg border border-neutral-200 bg-neutral-100 p-1">
            {([["top", "⬆"], ["middle", "↕"], ["bottom", "⬇"], ["stretch", "⤢"]] as const).map(([a, ic]) => (
              <button key={a} onClick={() => setD({ valign: a })} title={`Vertical: ${a}`} className={pill(valign === a)}>{ic}</button>
            ))}
          </div>
        </div>
      </div>
      {/* OPACIDADE */}
      <div>
        <Lbl>Opacidade</Lbl>
        <div className="flex items-center gap-2">
          <input type="range" aria-label="Opacidade" min={0} max={100} value={opacity} onChange={(e) => setD({ opacity: Number(e.target.value) === 100 ? undefined : Number(e.target.value) })} className="ct-range flex-1" />
          <span className="w-9 shrink-0 text-right text-[11px] font-semibold text-neutral-400"><RollingNumber value={opacity} suffix="%" /></span>
        </div>
      </div>
      <ComponentAppearance layer={layer} onChange={onChange} />
    </div>
  );
}

/** Linha arrastável (render-prop injeta o "handle" ⠿). */
function SortableItem({ id, children, onMove }: { id: string; children: (handle: React.ReactNode) => React.ReactNode; onMove: (delta: -1 | 1) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} className="ct-sort-handle" aria-label="Reordenar item" title="Reordenar item (Alt + seta)" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
    onKeyDown={event => {
      if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        onMove(event.key === "ArrowUp" ? -1 : 1);
        return;
      }
      listeners?.onKeyDown?.(event);
    }}>⠿</button>;
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>{children(handle)}</div>;
}

/** Aba "Componente": campos de conteúdo por tipo de bloco. */
function LayerFields({ layer, steps, onChange }: { layer: Layer; steps: InleadStep[]; onChange: (l: Layer) => void }) {
  const releaseId = useId();
  const trustId = useId();
  const themeColor = useContext(TemaFunilContext) || "#1d4f88";
  const c = layer.content;
  const setC = (patch: Record<string, unknown>) => onChange({ ...layer, content: { ...c, ...patch } });
  const setD = (patch: Record<string, unknown>) => onChange({ ...layer, design: { ...(layer.design || {}), ...patch } });


  switch (layer.type) {
    case "sonia-numbers":
      return <>
        <p className="text-xs text-neutral-600">Seleção demonstrativa, sem estoque ou reserva real. X pode ser escolhido diretamente; Y fica indisponível após o clique.</p>
        <label className="mt-3 block text-xs">Número X (selecionável)
          <input aria-label="Número X" type="number" min={1} max={60} step={1} className={inp} value={c.numeroX ?? SONIA_DEFAULTS.numeroX} onChange={(e) => setC({ numeroX: Number(e.target.value) })} />
        </label>
        <label className="mt-3 block text-xs">Número Y (indisponível após clique)
          <input aria-label="Número Y" type="number" min={1} max={60} step={1} className={inp} value={c.numeroY ?? SONIA_DEFAULTS.numeroY} onChange={(e) => setC({ numeroY: Number(e.target.value) })} />
        </label>
        {soniaConfigError(c) ? <p role="alert" className="mt-2 text-xs text-red-700">{soniaConfigError(c)}</p> : null}
        <label className="mt-3 block text-xs">Destino após confirmar
          <WorkspaceSelect searchable label="Destino após confirmar" value={/^https?:/.test(c.destination||'')?'__url':(c.destination||'')} onChange={value=>setC({destination:value==='__url'?'https://':value||undefined})} options={[{value:'',label:'Pendente'},{value:'next',label:'Próxima etapa'},...steps.map(step=>({value:step.id,label:step.title||step.id})),{value:'__url',label:'Link externo'}]}/>
        </label>
        {/^https?:/.test(c.destination || "") ? <input aria-label="URL de destino" className={`${inp} mt-2`} value={c.destination} onChange={(e) => setC({ destination: e.target.value })} placeholder="https://…" /> : null}
        <p className="mt-2 text-xs text-neutral-600">No runtime, destino ausente ou inválido bloqueia a confirmação. Preview nunca abre links externos.</p>
      </>;
    case "text":
      return (<><Lbl>Texto</Lbl><HtmlField value={c.text} onChange={(v) => setC({ text: v })} /></>);
    case "alert":
      return (<>
        <Lbl>Estilo</Lbl>
        <WorkspaceSelect label="Estilo" value={layer.design?.style||'danger'} onChange={value=>setD({style:value})} options={[["danger","Destaque"],["success","Sucesso"],["theme","Tema"],["default","Neutro"],["pilula","Pílula"]].map(([value,label])=>({value,label}))}/>
        <Lbl>Texto do alerta</Lbl><HtmlField value={c.text} onChange={(v) => setC({ text: v })} />
      </>);
    case "ranking":
      return <>
        <p className="text-xs text-ct-dim">A prévia exibe a posição simulada. Os tempos acompanham o vídeo na página publicada.</p>
        {([
          ["posDe", "Posição inicial", 1, undefined],
          ["posAte", "Posição final", 1, undefined],
          ["revealAt", "Exibir após (segundos)", 0, undefined],
          ["fimEm", "Encerrar movimento em (segundos)", 1, undefined],
          ["pct", "Percentual exibido", 1, 100],
        ] as const).map(([key, label, min, max]) => (
          <label key={key} className="mb-2 block text-xs font-semibold">
            {label}
            <input type="number" min={min} max={max} value={c[key] ?? ""} className={inp}
              onChange={event => {
                const input = event.currentTarget;
                if (input.validity.valid) setC({ [key]: input.value === "" ? undefined : input.valueAsNumber });
              }} />
          </label>
        ))}
        <label className="mb-2 block text-xs font-semibold">
          Rótulo da posição
          <input value={String(c.rotulo ?? "")} placeholder="VOCÊ" className={inp}
            onChange={event => setC({ rotulo: event.target.value })} />
        </label>
        <label className="mb-2 block text-xs font-semibold">
          Texto do selo
          <input value={String(c.selo ?? "")} placeholder="Você está aqui" className={inp}
            onChange={event => setC({ selo: event.target.value })} />
        </label>
      </>;
    case "trust":
      return (<>
        <p className="mb-2 text-[11px] leading-snug text-neutral-500">
          As provas de confiança da oferta. Cada peça vai para o lugar dela na lâmina:
          o medalhão dentro da garantia, as bandeiras logo abaixo do botão.
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-700">
          <input type="checkbox" checked={c.seloGarantia !== false} onChange={(e) => setC({ seloGarantia: e.target.checked })} className="h-3.5 w-3.5 accent-neutral-900" />
          Medalhão de garantia
        </label>
        {c.seloGarantia !== false ? (<>
          <Lbl htmlFor={`${trustId}-days`}>Dias de garantia</Lbl>
          <input id={`${trustId}-days`} type="number" min={1} value={Number(c.dias) || 7} onChange={(e) => setC({ dias: Number(e.target.value) })} className={inp} />
          <p className="mt-1 text-[11px] text-neutral-500">
            Uma imagem na lâmina substitui o desenho: a 1ª vira o selo, a 2ª as bandeiras.
          </p>
        </>) : null}

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-neutral-700">
          <input type="checkbox" checked={c.bandeiras !== false} onChange={(e) => setC({ bandeiras: e.target.checked })} className="h-3.5 w-3.5 accent-neutral-900" />
          Bandeiras de pagamento
        </label>
        {c.bandeiras !== false ? (<>
          <Lbl htmlFor={`${trustId}-methods`}>Formas aceitas (separe por vírgula)</Lbl>
          <input id={`${trustId}-methods`} value={String(c.formas ?? "")} onChange={(e) => setC({ formas: e.target.value })} className={inp} placeholder="VISA, MASTER, PIX" />
          <Lbl htmlFor={`${trustId}-security`}>Linha de segurança (vazio = sem linha)</Lbl>
          <input id={`${trustId}-security`} value={String(c.seguranca ?? "")} onChange={(e) => setC({ seguranca: e.target.value })} className={inp} />
        </>) : null}

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-neutral-700">
          <input type="checkbox" checked={c.selosConfianca !== false} onChange={(e) => setC({ selosConfianca: e.target.checked })} className="h-3.5 w-3.5 accent-neutral-900" />
          Selos Compra Segura / Satisfação / Privacidade
        </label>
      </>);
    case "disclaimer":
      return (<>
        <Lbl>Texto da faixa</Lbl><HtmlField value={c.text} onChange={(v) => setC({ text: v })} />

          <Lbl>Aparece após (segundos) — 0 = já visível</Lbl>
          <input type="number" min={0} value={Number(c.revealAt) || 0}
            onChange={(e) => setC({ revealAt: Number(e.target.value) })} className={inp} />
          <Lbl>Cor de fundo</Lbl>
          <div className="flex items-center gap-2">
            <ColorField
              value={(layer.design?.backgroundColor as string) || "#000000"}
              onChange={(v) => setD({ backgroundColor: v })}
              className="h-8 w-10" label="Fundo do disclaimer"
            />
            <input
              value={(layer.design?.backgroundColor as string) || ""}
              onChange={(e) => setD({ backgroundColor: e.target.value || undefined })}
              placeholder="rgba(0,0,0,.35) ou gradiente CSS"
              className={`${inp} flex-1`}
            />
            <button
              onClick={() => setD({ backgroundColor: undefined })}
              title="Voltar ao padrão"
              className="shrink-0 text-[11px] font-semibold text-neutral-400 hover:text-neutral-700"
            >↺</button>
          </div>
          <p className="mt-1 text-[11px] text-neutral-400">
            Deixe vazio para usar preto transparente. O campo ao lado aceita <code>rgba()</code> e gradiente.
          </p>

          {/* CONTADOR — o número sobe enquanto o vídeo corre. Escassez parada é
              lida como enfeite; escassez que anda na frente do visitante é lida
              como fila andando. */}
          <div className="mt-3 rounded-lg bg-amber-50 p-2.5 ring-1 ring-amber-200">
            <p className="mb-0.5 text-[11px] font-bold text-amber-900">Número que sobe sozinho</p>
            <p className="mb-2 text-[11px] text-amber-800/80">
              Escreva <code className="rounded bg-amber-200/60 px-1">[vagas]</code> no texto acima. Ele vira o número atual e vai subindo enquanto a pessoa assiste ao vídeo.
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <Lbl>De</Lbl>
                <input type="number" min={0} value={Number(c.vagasDe) || ""} placeholder="32"
                  onChange={(e) => setC({ vagasDe: Number(e.target.value) || undefined })} className={inp} />
              </div>
              <div className="flex-1">
                <Lbl>Até</Lbl>
                <input type="number" min={0} value={Number(c.vagasAte) || ""} placeholder="48"
                  onChange={(e) => setC({ vagasAte: Number(e.target.value) || undefined })} className={inp} />
              </div>
            </div>
            <Lbl>Quando chegar no máximo (segundos)</Lbl>
            <input type="number" min={0} value={Number(c.vagasFimEm) || ""} placeholder="vazio = junto com o botão"
              onChange={(e) => setC({ vagasFimEm: Number(e.target.value) || undefined })} className={inp} />
            <p className="mt-1 text-[11px] text-amber-800/70">
              Vazio: chega no máximo na hora em que o botão de compra aparece. Sem preencher <b>Até</b>, o número fica parado.
            </p>
          </div>
      </>);
    case "check":
      return (<>
        {/* Com ícone o bloco vira MEDALHÃO; vazio, é o selo de confirmação com
            o ✓ se desenhando. Mesmo bloco, dois papéis. */}
        <Lbl>Ícone / emoji (vazio = ✓ animado)</Lbl>
        <input value={String(c.icone || "")} onChange={(e) => setC({ icone: e.target.value })}
          placeholder="ex: 🎁 🔒 ⭐" className={inp} />
        <Lbl>Tamanho (px)</Lbl>
        <input type="number" min={32} max={160} value={Number(layer.design?.basis) || 64}
          onChange={(e) => setD({ basis: Number(e.target.value) })} className={inp} />
        <div className="mt-2 flex items-center gap-2">
          <ColorField value={(layer.design?.backgroundColor as string) || "#16A34A"}
            onChange={(v) => setD({ backgroundColor: v })} className="h-7 w-9" label="Cor do disco" />
          <span className="text-xs text-neutral-600">Cor do disco</span>
        </div>
        <Lbl>Texto abaixo (opcional)</Lbl><HtmlField value={c.text} onChange={(v) => setC({ text: v })} />
      </>);
    case "button":
      return (<>
        <Lbl>Rótulo do botão</Lbl><input value={c.label || ""} onChange={(e) => setC({ label: e.target.value })} className={inp} />
        <Lbl>Ícone / emoji (opcional, antes do texto)</Lbl><input value={c.icon || ""} onChange={(e) => setC({ icon: e.target.value })} placeholder="ex: 👉 🔥 ✅" className={inp} />
        {/* BOTÃO-IMAGEM: o runtime já renderizava isso (blocks.tsx:262) e o
            cdb-01 usa em produção — mas o campo não existia no construtor, só
            dava para ligar editando o JSON na mão. Com imagem, as cores e o
            efeito abaixo deixam de valer: quem manda é o PNG. */}
        <Lbl>Imagem no lugar do botão (opcional)</Lbl>
        <ImageField value={c.imageSrc || ""} onChange={(v) => setC({ imageSrc: v || undefined })} />
        {c.imageSrc ? (
          <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
            Com imagem, o botão vira o PNG clicável — rótulo, cores e contorno abaixo não aparecem.
          </p>
        ) : null}
        <Lbl>Cor do botão</Lbl>
        <div className="flex flex-wrap items-center gap-3">
          {/* <span>, não <label>: o ColorField abre um popover, e a ativação do
              <label> reenviaria o clique ao primeiro controle — o próprio botão
              — fechando o painel na hora. Mesmo mecanismo que roubava o foco no
              campo de texto. */}
          <span className="flex items-center gap-1.5 text-xs text-neutral-600"><ColorField value={layer.design?.backgroundColor || themeColor} onChange={(v) => setD({ backgroundColor: v })} className="h-7 w-9" label="Fundo do botão" /> Fundo</span>
          <span className="flex items-center gap-1.5 text-xs text-neutral-600"><ColorField value={layer.design?.color || "#ffffff"} onChange={(v) => setD({ color: v })} className="h-7 w-9" label="Texto do botão" /> Texto</span>
        </div>
        {/* Duas coisas diferentes que estavam presas na mesma caixa.
            "Vazado" é fundo transparente com a cor na borda; "sem contorno" é
            fundo sólido e borda nenhuma. O teste antigo era `!!borderColor`, que
            marcava a caixa em qualquer botão com borda — inclusive os sólidos —
            e desmarcar apagava o fundo. Agora vazado testa o fundo, que é o que
            de fato o define. O runtime já trata borda ausente como `none`
            (blocks.tsx:337), então nada muda no motor. */}
        <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
          <input type="checkbox" checked={layer.design?.backgroundColor === "transparent"} onChange={(e) => setD({ borderColor: e.target.checked ? (layer.design?.backgroundColor === "transparent" ? layer.design?.borderColor : layer.design?.backgroundColor) || themeColor : undefined, backgroundColor: e.target.checked ? "transparent" : (layer.design?.borderColor || themeColor) })} className="h-3.5 w-3.5 accent-neutral-900" /> Botão vazado (só contorno)
        </label>
        <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
          <input type="checkbox" checked={!layer.design?.borderColor} disabled={layer.design?.backgroundColor === "transparent"}
            onChange={(e) => setD({ borderColor: e.target.checked ? undefined : (layer.design?.backgroundColor || themeColor) })}
            className="h-3.5 w-3.5 accent-neutral-900 disabled:opacity-40" /> Sem contorno
        </label>
        <Lbl>Efeito de animação</Lbl>
        <WorkspaceSelect label="Efeito de animação" value={(layer.design?.effect as string)||'none'} onChange={value=>setD({effect:value})} options={[["none","Nenhum"],["shine","Brilho"],["pulse","Pulsar"],["shine-pulse","Brilho e pulsar"]].map(([value,label])=>({value,label}))}/>
        <Lbl>Ao clicar</Lbl>
        <WorkspaceSelect searchable label="Ao clicar" value={/^https?:/.test(c.destination || '')?'__url':(c.destination||'next')} onChange={value=>setC({destination:value==='__url'?'https://':value})} options={[{value:'next',label:'Próxima etapa'},...steps.map(step=>({value:step.id,label:step.title||step.id})),{value:'__url',label:'Link externo'}]}/>
        {/^https?:/.test(c.destination || "") ? <input value={c.destination} onChange={(e) => setC({ destination: e.target.value })} placeholder="https://pay.hotmart.com/…" className={`${inp} mt-1`} /> : null}
        <div className="mt-3 space-y-1.5 rounded-xl border border-ct-line bg-ct-raised p-3">
          <p className="text-xs font-bold text-neutral-700">Liberação do botão</p>
          <Lbl htmlFor={releaseId}>Atraso do botão em segundos</Lbl>
          <input id={releaseId} type="number" min={0} value={c.revealAt ?? 0} aria-describedby={`${releaseId}-clock`}
            onChange={(e) => setC({ revealAt: Number(e.target.value) })} className={inp} />
          <p id={`${releaseId}-clock`} className="text-xs text-ct-dim">
            {c.revealClock === "video" ? "Na prévia, o atraso acompanha o relógio simulado do vídeo." : "O atraso começa quando a etapa abre."} Use 0 para exibir imediatamente.
          </p>
          {Number(c.revealAt) > 0 ? (<>
            <Lbl htmlFor={`${releaseId}-wait`}>Texto enquanto o botão está bloqueado</Lbl>
            <input id={`${releaseId}-wait`} value={c.waitText || ""} onChange={(e) => setC({ waitText: e.target.value })} placeholder="⏳ Assista o vídeo para liberar o acesso…" className={inp} />
            <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-neutral-600">
              <input type="checkbox" checked={!!c.countdown} onChange={(e) => setC({ countdown: e.target.checked || undefined })} className="h-3.5 w-3.5 accent-neutral-900" /> Mostrar contagem regressiva (mm:ss)
            </label>
          </>) : null}
        </div>
      </>);
    case "image":
      return (<><Lbl>Imagem</Lbl><ImageField value={c.image?.src || ""} onChange={(v) => setC({ image: { ...(c.image || {}), type: "image", src: v } })} />
        <div className="mt-2 space-y-1.5 rounded-lg bg-neutral-50 p-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
            <input type="checkbox" checked={!!layer.design?.redonda} onChange={(e) => setD({ redonda: e.target.checked || undefined })} className="h-3.5 w-3.5 accent-neutral-900" />
            Foto redonda (com anel branco)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
            <input type="checkbox" checked={layer.design?.selo === "verificado"} onChange={(e) => setD({ selo: e.target.checked ? "verificado" : undefined })} className="h-3.5 w-3.5 accent-neutral-900" />
            Selo de verificado ✓
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
            <input type="checkbox" checked={!!layer.design?.flutua} onChange={(e) => setD({ flutua: e.target.checked || undefined })} className="h-3.5 w-3.5 accent-neutral-900" />
            Flutuar (sobe e desce devagar)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
            <input type="checkbox" checked={!!layer.design?.glow} onChange={(e) => setD({ glow: e.target.checked || undefined })} className="h-3.5 w-3.5 accent-neutral-900" />
            Halo azul
          </label>
          <Lbl>Tag no canto (vazio = sem tag)</Lbl>
          <div className="flex items-center gap-2">
            <input value={layer.design?.tag || ""} onChange={(e) => setD({ tag: e.target.value || undefined })} placeholder="GRÁTIS" className={`${inp} flex-1`} />
            <ColorField value={layer.design?.tagCor || "#16a34a"} onChange={(v) => setD({ tagCor: v })} className="h-8 w-9" label="Cor da tag" />
          </div>
          {layer.design?.tag ? <p className="text-[11px] text-neutral-500">A tag pulsa sozinha.</p> : null}
        </div>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <label className="mt-2 flex cursor-pointer items-center justify-between text-xs text-neutral-600"><span>Tela cheia (borda a borda)</span>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <input type="checkbox" checked={!!(layer.design as any)?.fullBleed} onChange={(e) => setD({ fullBleed: e.target.checked || undefined })} className="h-3.5 w-3.5 accent-neutral-900" /></label>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {!(layer.design as any)?.fullBleed ? <><Lbl>Largura (%)</Lbl><input type="number" value={layer.design?.basis ?? 100} onChange={(e) => setD({ basis: Number(e.target.value) })} className={inp} /></> : null}
        <Lbl>Efeito (gradiente/fade com o fundo)</Lbl>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <WorkspaceSelect label="Efeito de fundo" value={((layer.design as any)?.fade as string)||'none'} onChange={value=>setD({fade:value==='none'?undefined:value})} options={[["none","Nenhum"],["top","Fade no topo"],["bottom","Fade na base"],["both","Fade nos dois"]].map(([value,label])=>({value,label}))}/>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(layer.design as any)?.fade ? (
          <div className="mt-1.5 flex items-center gap-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <span className="w-28 shrink-0 text-[11px] text-neutral-500">Intensidade {Number((layer.design as any)?.fadeStrength) || 55}%</span>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <input type="range" aria-label="Intensidade do desvanecimento" min={20} max={90} value={Number((layer.design as any)?.fadeStrength) || 55} onChange={(e) => setD({ fadeStrength: Number(e.target.value) })} className="ct-range flex-1" />
          </div>
        ) : null}</>);
    case "field": case "audio": case "arguments": case "testimonials": case "faq": case "price": case "checklist": case "html":
      return <CatalogFields layer={layer} onChange={onChange}/>;
    case "options":
      return (<>
        <CatalogFields layer={layer} onChange={onChange}/>
        <Lbl>Introdução da pergunta</Lbl><HtmlField value={c.introduction || ""} onChange={value => setC({ introduction: value })} />
        <Lbl>Opções</Lbl>
        <p className="mb-2 text-[11px] text-neutral-500">Use {"{pontos}"} no texto para mostrar a pontuação.</p>
        {/* Cada opção aceita EMOJI ou IMAGEM à esquerda do rótulo. O runtime já
            desenhava as duas (`content.options[].image = {src, type}`) e o
            construtor só editava o texto — dava para ver opção com emoji num
            funil publicado e não dava para pôr num novo. */}
        <div className="space-y-2">
          {(c.options || []).map((o, i) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const img = (o as any).image as { src?: string; type?: string } | undefined;
            const ehImagem = img?.type === "image";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const patch = (p: any) => setC({ options: c.options!.map((x, k) => (k === i ? { ...x, ...p } : x)) });
            return (
              <div key={o.id} className="space-y-1.5 rounded-lg border border-neutral-200 p-2">
                <div className="flex items-center gap-1">
                  <input value={strip(o.label)} onChange={(e) => patch({ label: `<p>${e.target.value}</p>` })} className={`${inp} flex-1`} placeholder="Texto da opção" />
                  <button onClick={() => setC({ options: c.options!.filter((_, k) => k !== i) })} className="px-1 text-red-400">✕</button>
                </div>
                <div className="flex items-center gap-1.5">
                  {(["", "emoji", "image"] as const).map((t) => (
                    <button key={t || "none"} type="button"
                      onClick={() => patch({ image: t ? { type: t, src: t === (img?.type) ? img?.src ?? "" : "" } : undefined })}
                      className={`rounded-md px-2 py-1 text-[11px] font-semibold ${(img?.type ?? "") === t ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-500"}`}>
                      {t === "" ? "só texto" : t === "emoji" ? "emoji" : "imagem"}
                    </button>
                  ))}
                </div>
                {img?.type === "emoji" ? (
                  <input value={img.src || ""} onChange={(e) => patch({ image: { type: "emoji", src: e.target.value } })}
                    className={`${inp} text-center text-lg`} placeholder="🔥" maxLength={4} />
                ) : ehImagem ? (
                  <><ImageField value={img.src || ""} onChange={(v) => patch({ image: { type: "image", src: v } })} /><a className="mt-1 block text-xs text-ct-blue" href="https://www.thiings.co/things" target="_blank" rel="noreferrer">Explorar ícones Thiings ↗</a></>
                ) : null}
                <div className="ct-component-settings"><div className="ct-component-pair">
                  <label>Pontos<input aria-label={`Pontos da resposta ${i + 1}`} type="number" value={o.points ?? 0} onChange={e => patch({ points: Number(e.target.value) })} /></label>
                  <label>Valor da resposta<input aria-label={`Valor da resposta ${i + 1}`} value={o.value || ""} placeholder="Ex.: A" onChange={e => patch({ value: e.target.value || undefined })} /></label>
                </div></div>
                {!c.multiple && (
                  <label className="block text-xs text-neutral-600">
                    Destino de {strip(o.label) || `opção ${i + 1}`}
                    <WorkspaceSelect searchable label={`Destino de ${strip(o.label) || `opção ${i+1}`}`} value={o.destination||'next'} onChange={value=>patch({destination:value})} options={[{value:'next',label:'Próxima etapa'},...steps.map(step=>({value:step.id,label:step.title||step.id})),...(o.destination&&o.destination!=='next'&&!steps.some(step=>step.id===o.destination)?[{value:o.destination,label:o.destination}]:[])]}/>
                  </label>
                )}
              </div>
            );
          })}
          <button onClick={() => setC({ options: [...(c.options || []), { id: genId(), label: "<p>Nova opção</p>", destination: "next" }] })} className="rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-500">+ opção</button>
        </div>
        <div className="mt-4 space-y-2">        <label className="mb-2 block text-xs font-semibold">
          Seleção de respostas
          <WorkspaceSelect label="Seleção de respostas" value={c.multiple ? "multiple" : "single"} onChange={value => setC({ multiple: value === "multiple" })} options={[{value:"single",label:"Uma resposta"},{value:"multiple",label:"Várias respostas e continuar"}]}/>
        </label>
        <label className="mb-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={!!c.required} onChange={e => setC({ required: e.target.checked })} />Seleção obrigatória</label>
        <label className="mb-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={!!c.awaitSubmit} onChange={e => setC({ awaitSubmit: e.target.checked })} />Aguardar botão para continuar</label>
        {c.awaitSubmit && <p className="mb-2 text-[11px] text-neutral-500">Adicione um botão à etapa. O destino da resposta única tem prioridade sobre o botão.</p>}
        </div>
        <details className="ct-disclosure mt-4"><summary className="cursor-pointer text-xs font-semibold text-neutral-500">Configurações de aparência das opções</summary>        <Lbl>Colunas</Lbl>
        <WorkspaceSelect label="Colunas" value={c.cols||'grid-cols-1'} onChange={value=>setC({cols:value})} options={[1,2,3,4].map(value=>({value:`grid-cols-${value}`,label:value===1?'1 (empilhado)':String(value)}))}/>
        <Lbl>Estilo do card</Lbl>
        <WorkspaceSelect label="Estilo do card" value={layer.design?.cardStyle||'lista'} onChange={value=>setD({cardStyle:value==='lista'?undefined:value})} options={[{value:'lista',label:'Lista'},{value:'foto',label:'Foto'}]}/>
        {layer.design?.cardStyle === "foto" ? (
          <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
            Use imagens e duas colunas para o formato de foto.
          </p>
        ) : null}
        <Lbl>Marcador à direita</Lbl>
        <WorkspaceSelect label="Marcador à direita" value={layer.design?.icon||'select'} onChange={value=>setD({icon:value})} options={[{value:'select',label:'Seta'},{value:'check',label:'Círculo de seleção'},{value:'none',label:'Nenhum'}]}/>
        <Lbl>Brilho da opção escolhida</Lbl>
        <WorkspaceSelect label="Brilho da opção escolhida" value={layer.design?.fx||'none'} onChange={value=>setD({fx:value==='none'?undefined:value})} options={[{value:'none',label:'Simples'},{value:'glow',label:'Neon'},{value:'blur',label:'Difuso'}]}/>
        </details>
      </>);
    case "timer":
      return (<><Lbl>Tempo (segundos)</Lbl><input type="number" value={c.time ?? 300} onChange={(e) => setC({ time: Number(e.target.value) })} className={inp} />
        <Lbl>Texto (use [time])</Lbl><HtmlField value={c.text} onChange={(v) => setC({ text: v })} /></>);
    case "loading": {
      // Duas telas no mesmo bloco: a barra de sempre e o diagnóstico (anel +
      // caixas). Os campos de baixo só existem no diagnóstico — mostrá-los na
      // barra ofereceria ajuste que ela ignora.
      const diag = c.style === "diagnostico";
      const caixas: string[] = (c.bars as string[]) || [];
      const icones: string[] = (c.icons as string[]) || [];
      // As duas listas andam juntas (caixa i usa ícone i), então editar e
      // remover mexem nas duas — senão os ícones desalinham do texto.
      const setCaixa = (i: number, texto?: string, icone?: string) => setC({
        bars: texto === undefined ? caixas : caixas.map((x, k) => (k === i ? texto : x)),
        icons: icone === undefined ? icones : Array.from({ length: caixas.length }, (_, k) => (k === i ? icone : icones[k] ?? "")),
      });
      return (<><Lbl>Título</Lbl><input value={c.title || ""} onChange={(e) => setC({ title: e.target.value })} className={inp} />
        <Lbl>Estilo</Lbl>
        <WorkspaceSelect label="Estilo de carregamento" value={diag?'diagnostico':'barra'} onChange={value=>setC({style:value==='diagnostico'?'diagnostico':undefined})} options={[{value:'barra',label:'Barra de progresso'},{value:'diagnostico',label:'Diagnóstico'}]}/>
        <Lbl>Duração (s)</Lbl><input type="number" value={c.seconds ?? 4} onChange={(e) => setC({ seconds: Number(e.target.value) })} className={inp} />
        {/* PEÇAS DO DIAGNÓSTICO — antes eu escolhia por você e o construtor
            mostrava um desenho enquanto o site mostrava outro. Aqui a escolha é
            explícita: qual medalhão, e quais indicadores acompanham. A barra de
            progresso é sempre a mesma (a da referência) e não entra como opção,
            porque duas barras diferentes só criariam divergência de novo. */}
        <Lbl>Medalhão</Lbl>
        <WorkspaceSelect label="Medalhão" value={(c.anel as string)||'novo'} onChange={value=>setC({anel:value})} options={[{value:'novo',label:'Arcos girando'},{value:'antigo',label:'Aros e progresso'}]}/>
        <Lbl>Indicadores</Lbl>
        <div className="space-y-1.5">
          {([["caixas", "Caixas (uma verificação por linha)", true],
             ["pilulas", "Pílulas (fase corrente acesa)", false]] as const).map(([k, label, padrao]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
              <input
                type="checkbox"
                checked={(c[k] as boolean | undefined) ?? padrao}
                onChange={(e) => setC({ [k]: e.target.checked })}
                className="h-3.5 w-3.5 accent-neutral-900"
              /> {label}
            </label>
          ))}
        </div>
        <Lbl>Auto-avançar ao terminar?</Lbl>
        <WorkspaceSelect label="Auto-avançar ao terminar" value={c.type==='none'?'no':'yes'} onChange={value=>setC({type:value==='no'?'none':'advance'})} options={[{value:'no',label:'Não'},{value:'yes',label:'Sim'}]}/>
        {diag ? (<>
          <Lbl>Subtítulo</Lbl>
          <input value={c.description || ""} onChange={(e) => setC({ description: e.target.value })} className={inp} placeholder="Estamos preparando…" />
          <Lbl>Caixas (o que está sendo verificado)</Lbl>
          <div className="space-y-2">
            {caixas.map((texto, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-neutral-200 p-2">
                <input
                  value={icones[i] ?? ""} onChange={(e) => setCaixa(i, undefined, e.target.value)}
                  className="w-11 shrink-0 rounded-md border border-neutral-300 px-2 py-1 text-center text-base"
                  placeholder="🔍" aria-label={`Ícone da caixa ${i + 1}`}
                />
                <input
                  value={texto} onChange={(e) => setCaixa(i, e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
                  placeholder="Analisando suas respostas..."
                />
                <button
                  onClick={() => setC({ bars: caixas.filter((_, k) => k !== i), icons: icones.filter((_, k) => k !== i) })}
                  className="shrink-0 text-red-400" aria-label={`Remover caixa ${i + 1}`}
                >✕</button>
              </div>
            ))}
            <button onClick={() => setC({ bars: [...caixas, "Nova verificação..."], icons: [...icones, "🔍"] })}
              className="rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-500">+ caixa</button>
          </div>
        </>) : null}</>);
    }
    case "level": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ns: any[] = Array.isArray(c.levels) ? c.levels : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setN = (i: number, patch: any) => setC({ levels: ns.map((n, k) => (k === i ? { ...n, ...patch } : n)) });
      return (<>
        <Lbl>Título</Lbl><HtmlField value={c.title} onChange={(v) => setC({ title: v })} />
        <Lbl>Níveis (o marcado é o do visitante)</Lbl>
        <div className="space-y-1.5">
          {ns.map((n, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-lg border border-neutral-200 p-2">
              <input type="radio" name={`nivel-${layer.id}`} checked={Number(c.atual) === i} onChange={() => setC({ atual: i })} className="ct-editor-radio" aria-label={`Nível do visitante: ${n.label || i + 1}`} />
              <input value={n.label || ""} onChange={(e) => setN(i, { label: e.target.value })} className={`${inp} flex-1`} placeholder="Nome do nível" />
              <input type="number" min={0} max={100} value={Number(n.pct) || 0} onChange={(e) => setN(i, { pct: Number(e.target.value) })} className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm" title="% da barra" />
              <button onClick={() => setC({ levels: ns.filter((_, k) => k !== i) })} className="text-red-400">✕</button>
            </div>
          ))}
          <button onClick={() => setC({ levels: [...ns, { label: "Novo nível", pct: 100 }] })} className="rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-500">+ nível</button>
        </div>
        <Lbl>Texto abaixo</Lbl><HtmlField value={c.description} onChange={(v) => setC({ description: v })} />
      </>);
    }

    case "beforeafter": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ps: any[] = Array.isArray(c.pairs) ? c.pairs : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setP = (i: number, patch: any) => setC({ pairs: ps.map((p, k) => (k === i ? { ...p, ...patch } : p)) });
      return (<>
        <Lbl>Provas (cada uma vira um slide)</Lbl>
        <div className="space-y-2">
          {ps.map((p, i) => (
            <div key={i} className="space-y-1.5 rounded-lg border border-neutral-200 p-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-500">Prova {i + 1}</span>
                <button onClick={() => setC({ pairs: ps.filter((_, k) => k !== i) })} className="text-red-400">✕</button>
              </div>
              <Lbl>Antes</Lbl><ImageField value={p.antes || ""} onChange={(v) => setP(i, { antes: v })} />
              <Lbl>Depois</Lbl><ImageField value={p.depois || ""} onChange={(v) => setP(i, { depois: v })} />
              <Lbl>Legenda</Lbl><HtmlField value={p.legenda} onChange={(v) => setP(i, { legenda: v })} rows={1} />
            </div>
          ))}
          <button onClick={() => setC({ pairs: [...ps, { antes: "", depois: "", legenda: "" }] })} className="rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-500">+ prova</button>
        </div>
      </>);
    }

    case "charts": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bs: any[] = Array.isArray(c.bars) ? c.bars : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setB = (i: number, patch: any) => setC({ bars: bs.map((b, k) => (k === i ? { ...b, ...patch } : b)) });
      return (<>
        <Lbl>Título</Lbl><HtmlField value={c.title} onChange={(v) => setC({ title: v })} />
        <Lbl>Sufixo do número (%, kg, R$…)</Lbl>
        <input value={c.suffix || ""} onChange={(e) => setC({ suffix: e.target.value })} className={inp} placeholder="%" />
        <Lbl>Barras (a última fica destacada)</Lbl>
        <div className="space-y-1.5">
          {bs.map((b, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input value={b.label || ""} onChange={(e) => setB(i, { label: e.target.value })} className={`${inp} flex-1`} placeholder="Rótulo" />
              <input type="number" value={Number(b.value) || 0} onChange={(e) => setB(i, { value: Number(e.target.value) })} className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm" />
              <button onClick={() => setC({ bars: bs.filter((_, k) => k !== i) })} className="text-red-400">✕</button>
            </div>
          ))}
          <button onClick={() => setC({ bars: [...bs, { label: "Novo", value: 50 }] })} className="rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-500">+ barra</button>
        </div>
      </>);
    }

    case "card":
      return (<>
        <Lbl>Texto do card</Lbl><HtmlField value={c.text} onChange={(v) => setC({ text: v })} rows={4} />
        <Lbl>Estilo</Lbl>
        <WorkspaceSelect label="Estilo do card" value={layer.design?.variant||'suave'} onChange={value=>setD({variant:value})} options={[["suave","Suave"],["contorno","Contorno"],["escuro","Escuro"],["destaque","Destaque"]].map(([value,label])=>({value,label}))}/>
        <Lbl>Respiro interno (px)</Lbl>
        <input type="number" min={8} max={48} value={Number(layer.design?.padding) || 20}
          onChange={(e) => setD({ padding: Math.min(48, Math.max(8, Number(e.target.value))) })} className={inp} />
        <p className="mt-1 text-[11px] text-neutral-500">
          Cores saem da <b>Cor do tema</b> no Design. Trocar o tema muda o card junto.
        </p>
      </>);

    case "notification":
      return (<>
        <Lbl>Texto da notificação</Lbl><HtmlField value={c.text} onChange={(v) => setC({ text: v })} />
        <Lbl>Sumir depois de (segundos, 0 = fica)</Lbl>
        <input type="number" min={0} value={Number(c.duration) || 0} onChange={(e) => setC({ duration: Number(e.target.value) || undefined })} className={inp} />
        <p className="mt-1 text-[11px] text-neutral-500">Aparece no canto de baixo 1,5 s após a lâmina abrir. Não intercepta clique.</p>
      </>);

    case "graphics": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gs: any[] = Array.isArray(c.graphics) ? c.graphics : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setG = (i: number, patch: any) => setC({ graphics: gs.map((g, k) => (k === i ? { ...g, ...patch } : g)) });
      return (<>
        <Lbl>Anéis de porcentagem</Lbl>
        <div className="space-y-2">
          {gs.map((g, i) => (
            <div key={i} className="space-y-1.5 rounded-lg border border-neutral-200 p-2">
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={100} value={Number(g.percent) || 0}
                  onChange={(e) => setG(i, { percent: String(e.target.value) })}
                  className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm" />
                <span className="text-[11px] text-neutral-500">%</span>
                <ColorField value={g.style || "#16a34a"} onChange={(v) => setG(i, { style: v })} className="h-7 w-9" label="Cor do anel" />
                <button onClick={() => setC({ graphics: gs.filter((_, k) => k !== i) })} className="ml-auto text-red-400">✕</button>
              </div>
              <HtmlField value={g.legend} onChange={(v) => setG(i, { legend: v })} rows={2} />
            </div>
          ))}
          <button onClick={() => setC({ graphics: [...gs, { id: genId(), type: "chart", style: "#16a34a", percent: "80", legend: "" }] })}
            className="rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-500">+ anel</button>
        </div>
      </>);
    }

    case "clear":
      return (<><Lbl>Altura</Lbl>
        <WorkspaceSelect label="Altura" value={c.clear||'h-[1rem]'} onChange={value=>setC({clear:value})} options={['0.5','1','2','3'].map(size=>({value:`h-[${size}rem]`,label:`${size} rem`}))}/></>);
    case "embed": case "video":
      return (<><Lbl>Embed do player (cole o &lt;script&gt;+&lt;iframe&gt; do VTurb)</Lbl>
        <textarea value={c.embedHtml || ""} onChange={(e) => setC({ embedHtml: e.target.value })} rows={5} className={`${inp} font-mono`} /></>);
    case "carousel": {
      const imgs: string[] = (c.images as string[]) || [];
      return (<>
        <Lbl>Passar a cada (segundos)</Lbl>
        <input type="number" min={1} value={Number(c.interval) || 2} onChange={(e) => setC({ interval: Number(e.target.value) })} className={inp} />
        <Lbl>Transição</Lbl>
        <WorkspaceSelect label="Transição" value={layer.design?.transicao||'deslizar'} onChange={value=>setD({transicao:value==='deslizar'?undefined:value})} options={[{value:'deslizar',label:'Deslizar'},{value:'fade',label:'Dissolver'}]}/>
        <Lbl>Fotos do carrossel</Lbl>
        <div className="space-y-2">
          {imgs.map((src, idx) => (
            <div key={idx} className="rounded-md border border-neutral-200 p-2">
              <div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-semibold text-neutral-500">Foto {idx + 1}</span><button onClick={() => setC({ images: imgs.filter((_, k) => k !== idx) })} className="text-red-400">✕</button></div>
              <ImageField value={src} onChange={(v) => setC({ images: imgs.map((x, k) => k === idx ? v : x) })} />
            </div>
          ))}
          <button onClick={() => setC({ images: [...imgs, ""] })} className="rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-500">+ foto</button>
        </div>
      </>);
    }
    default:
      return <p className="mt-2 text-xs text-neutral-500">Bloco “{BLOCK_META[layer.type]?.label || layer.type}” — em breve. O conteúdo é preservado e renderiza no funil.</p>;
  }
}

/** Aba "Exibição": revelação e visibilidade do bloco. */
/**
 * Painel direito: Componente / Aparência / Exibição (estilo inlead).
 *
 * `conteudo` troca só a aba "Componente" — é o que os blocos-hero usam para
 * entrar aqui com o StepEditor deles. Antes eles ficavam FORA deste painel, e
 * eram os únicos blocos sem Aparência e sem Exibição.
 */
function RightPanel({ layer, steps, onChange, conteudo }: { layer: Layer; steps: InleadStep[]; onChange: (l: Layer) => void; conteudo?: React.ReactNode }) {
  const tabs = [["componente", "Componente"], ["aparencia", "Aparência"], ["exibicao", "Exibição"]] as const;
  const [t, setT] = useState<(typeof tabs)[number][0]>("componente");
  const id = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <div>
      <div className="ct-block-tabs">
        <div role="tablist" aria-label="Configurações do componente" className="ct-segments">
          {tabs.map(([key, label], index) => <button type="button" key={key} role="tab" id={`${id}-${key}`}
            ref={element => { tabRefs.current[index] = element; }}
            aria-controls={`${id}-panel`} aria-selected={t === key} tabIndex={t === key ? 0 : -1}
            onClick={() => setT(key)} onKeyDown={event => {
              const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
                : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length
                : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
              if (next === null) return;
              event.preventDefault();
              setT(tabs[next][0]);
              tabRefs.current[next]?.focus();
            }}>
            {t === key && <ActiveTab group={id} />}<span>{label}</span>
          </button>)}
        </div>
      </div>
      <div className="p-3" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${t}`}>
        {t === "componente" ? <>
          <label className="mb-3 block text-xs font-semibold">Nome do componente
            <input aria-label="Nome do componente" value={layer.title || ""} placeholder={rotuloDoTipo(layer.type)} onChange={e => onChange({ ...layer, title: e.target.value || undefined })} className={inp} />
          </label>
          <CampoId valor={layer.webhookKey} aoSalvar={value => onChange({ ...layer, webhookKey: value })} automatico={layer.id} ajuda="Identifica o componente nos dados do funil." />
          {layer.type === "button" && <div className="ct-component-settings mb-3">
            <label>Sub ID<input aria-label="Sub ID" maxLength={120} value={layer.subId || ""} placeholder="Ex.: oferta_principal" onChange={e => onChange({ ...layer, subId: e.target.value || undefined })} /></label>
            <p>Identificação complementar disponível no botão como data-sub-id.</p>
            <label className="ct-component-toggle"><input type="checkbox" checked={!!layer.content.sendSubId} onChange={e => onChange({ ...layer, content: { ...layer.content, sendSubId: e.target.checked } })} />Enviar Sub ID no link externo (subid)</label>
          </div>}
          {conteudo ?? <LayerFields layer={layer} steps={steps} onChange={onChange} />}
        </> : null}
        {t === "aparencia" ? <Appearance layer={layer} onChange={onChange} /> : null}
        {t === "exibicao" ? <ComponentDisplay layer={layer} steps={steps} onChange={onChange} /> : null}
      </div>
    </div>
  );
}

// ───────────────────────── B — DESIGN ─────────────────────────
// ───────────────────────── D — LEADS ─────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// espelha FunnelCol de lib/quiz/colunas.ts (o mesmo módulo que gera o CSV) —
// "passou" é a lâmina sem bloco interativo, que só registra se a lead a viu
interface ColunaFunil { key: string; header: string; kind: "options" | "button" | "field" | "passou"; label: string; stepId: string; stepIdx: number; stepTitle: string; layerId: string; fieldName?: string }
interface GrupoFunil { stepId: string; stepIdx: number; stepTitle: string; span: number }
interface LinhaResposta {
  /** mesmo code do CSV — permite conferir linha a linha entre tela e planilha */
  code: string;
  session: string;
  name: string | null;
  phone: string | null;
  /** data da SESSÃO (a linha é a sessão, como no inlead) */
  when: string | null;
  temResposta: boolean;
  virouLead: boolean;
  /** valor por coluna, chaveado por `col.key` */
  cells: Record<string, string>;
  /** legado: respostas por texto de pergunta */
  answers: Record<string, string>;
  track?: Record<string, string>;
}
interface Analytics {
  performance: any; deltas?: Record<string, number> | null;
  resultados: { question: string; total: number; options: { label: string; value: number; pct: number }[] }[];
  questions: string[];
  questionStats?: { question: string; total: number; pct: number }[];
  respostas: LinhaResposta[];
  cols?: ColunaFunil[];
  grupos?: GrupoFunil[];
  totais?: { sessoes: number; comResposta: number; leads: number };
  degraded?: boolean;
  issues?: { code: string; msg: string; campos: string[]; detalhe?: string }[];
}
/** Colunas de tracking (Onda B) — exibidas na tabela de Respostas, estilo inlead. */
const TRACK_COLS: { key: string; label: string }[] = [
  { key: "utm_source", label: "utm_source" }, { key: "utm_medium", label: "utm_medium" },
  { key: "utm_campaign", label: "utm_campaign" }, { key: "utm_content", label: "utm_content" },
  { key: "utm_term", label: "utm_term" }, { key: "src", label: "src" },
  { key: "fbclid", label: "fbclid" }, { key: "ctwa_clid", label: "ctwa_clid" }, { key: "source_id", label: "source_id" },
  { key: "viewport", label: "viewport" }, { key: "screen", label: "screen" },
  { key: "platform", label: "platform" }, { key: "user_agent", label: "userAgent" },
];

/** Anel de % (estilo inlead) no header de cada etapa. */
function PctRing({ pct }: { pct: number }) {
  const color = pct >= 80 ? "#16a34a" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <span className="relative inline-grid h-7 w-7 shrink-0 place-items-center">
      <svg viewBox="0 0 36 36" className="h-7 w-7 -rotate-90">
        <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle cx="18" cy="18" r="15" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 94.2} 94.2`} />
      </svg>
      <span className="absolute text-[8px] font-bold text-neutral-600">{pct}%</span>
    </span>
  );
}

function Bar({ pct, color = "#3b82f6" }: { pct: number; color?: string }) {
  return <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>;
}

// spYmd / dayBounds / sinceDays / PERIODOS moraram aqui até 10/08/2026, quando
// `/dashboard/[slug]` precisou do MESMO filtro. Duas cópias divergiriam na
// primeira mudança — e uma delas é a que trata fuso, que já deu bug em
// produção ("Hoje" pedindo o dia seguinte depois das 21h). Agora vêm de
// `lib/quiz/periodo.ts`, importado no topo do arquivo.

/** Aba Leads = sub-abas Respostas / Resultados / Performance (estilo inlead).
 *  Exportada pra ser reusada também no FunnelBuilder (motor typed). */
export function LeadsTab({ slug, readOnly = false }: { slug: string; readOnly?: boolean }) {
  const [d, setD] = useState<Analytics | null>(null);
  const [sub, setSub] = useState<"respostas" | "resultados" | "performance">("respostas");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [range, setRange] = useState<{ key: string; from?: string; to?: string }>({ key: "tudo" });
  const [day, setDay] = useState("");
  // Onda A: busca, filtros (etapas/colunas), paginação
  const [search, setSearch] = useState("");
  // TODAS as colunas nascem visíveis; o que o usuário desmarcar fica salvo por
  // funil e volta na próxima visita. Antes só 3 colunas de tracking apareciam
  // por padrão, então parecia que o resto não existia.
  const CHAVE_PREF = `ctf_leads_cols_${slug}`;
  const prefSalva = (): { track?: string[]; etapas?: string[] } => {
    try { return JSON.parse(localStorage.getItem(CHAVE_PREF) || "{}"); } catch { return {}; }
  };
  const [hiddenQ, setHiddenQ] = useState<Set<string>>(() => new Set(prefSalva().etapas ?? []));
  const [showMeta, setShowMeta] = useState(true); // colunas Lead/Telefone/Data
  const [hiddenTrack, setHiddenTrack] = useState<Set<string>>(() => new Set(prefSalva().track ?? []));
  const [openFilter, setOpenFilter] = useState<"etapas" | "colunas" | null>(null);
  // A linha virou a SESSÃO (igual ao inlead), então a contagem sobe bastante.
  // Este filtro deixa voltar à visão antiga sem perder o abandono de vista.
  const [filtroLinha, setFiltroLinha] = useState<"todos" | "resposta" | "lead">("todos");
  const [page, setPage] = useState(0);
  const PER = 50;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    const qs = new URLSearchParams({ slug });
    if (range.from) qs.set("from", range.from);
    if (range.to) qs.set("to", range.to);
    fetch(`/api/funnel-analytics?${qs}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Não foi possível carregar os leads.");
        setD(data);
      })
      .catch(error => { if (!controller.signal.aborted) { setD(null); setLoadError(error.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, range.from, range.to, refresh]);
  /** Grava a escolha de colunas no ato do clique. Fazer isso num useEffect
   *  provocaria render em cascata a cada troca de estado. */
  const salvarPref = (track: Set<string>, etapas: Set<string>) => {
    try { localStorage.setItem(CHAVE_PREF, JSON.stringify({ track: [...track], etapas: [...etapas] })); } catch { /* storage bloqueado */ }
  };
  const alternarEtapa = (stepId: string) => setHiddenQ((s) => {
    const n = new Set(s); if (n.has(stepId)) n.delete(stepId); else n.add(stepId);
    salvarPref(hiddenTrack, n); return n;
  });
  const alternarColuna = (chave: string) => setHiddenTrack((s) => {
    const n = new Set(s); if (n.has(chave)) n.delete(chave); else n.add(chave);
    salvarPref(n, hiddenQ); return n;
  });
  const reset = async () => {
    if (!window.confirm("Tem certeza? Isso apaga TODOS os dados (respostas, sessões e leads) DESTE funil. Extraia o CSV antes!")) return;
    setResetting(true);
    try { await fetch(`/api/reset-funnel-data`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }); } catch { /* noop */ }
    setResetting(false); setRefresh(value => value + 1);
  };
  const p = d?.performance;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200">
        <nav className="flex gap-1">
          {([["respostas", "📋 Respostas"], ["resultados", "📊 Resultados"], ["performance", "📈 Performance"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setSub(k)} className={`px-3 py-2.5 text-sm font-semibold ${sub === k ? "border-b-2 border-neutral-900 text-neutral-900" : "text-neutral-400 hover:text-neutral-700"}`}>{l}</button>
          ))}
        </nav>
        {!readOnly && <div className="flex items-center gap-4 pb-2">
          {/* o export segue o MESMO período do seletor acima — antes exportava
              sempre tudo, e o CSV nunca batia com o que estava na tela */}
          <a
            href={`/api/export-leads?slug=${encodeURIComponent(slug)}`
              + (range.from ? `&from=${encodeURIComponent(range.from)}` : "")
              + (range.to ? `&to=${encodeURIComponent(range.to)}` : "")}
            className="text-xs font-semibold text-neutral-600 hover:text-neutral-900"
            title={range.from ? "Exporta apenas o período selecionado" : "Exporta todas as sessões"}
          >
            ⬇ Exportar leads{range.from ? " (período)" : ""}
          </a>
          <button onClick={reset} disabled={resetting} className="text-xs font-semibold text-red-500 hover:text-red-700">{resetting ? "Limpando…" : "♻ Resetar dados"}</button>
        </div>}
      </div>

      {/* filtro de período (aplica às 3 sub-abas) */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-neutral-400">Período:</span>
        <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1">
          {PERIODOS.map((pr) => (
            <button key={pr.key} onClick={() => { setDay(""); setRange({ key: pr.key, ...pr.make() }); }}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${range.key === pr.key ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-800"}`}>
              {pr.label}
            </button>
          ))}
        </div>
        <label className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${range.key === "dia" ? "border-neutral-900 text-neutral-900" : "border-neutral-200 text-neutral-500"}`}>
          📅 Dia
          <input type="date" value={day} max={spYmd(0)}
            onChange={(e) => { const ymd = e.target.value; setDay(ymd); setRange(ymd ? { key: "dia", ...dayBounds(ymd) } : { key: "tudo" }); }}
            className="bg-transparent text-neutral-800 outline-none" />
        </label>
      </div>

      {loading ? <p className="p-8 text-center text-sm text-neutral-400">Carregando…</p> : !d ? <p role="status" className="p-8 text-center text-sm text-ct-dim">{loadError || "Sem dados."}</p> : (
        <>
          {/* RESPOSTAS — tabela por lead (colunas = etapas com %) + busca + filtros + paginação */}
          {sub === "respostas" ? (() => {
            const cols = d.cols ?? [];
            const grupos = d.grupos ?? [];
            // "Etapas" agora alterna a LÂMINA inteira (é o que a palavra significa
            // no inlead); "Colunas" segue alternando coluna a coluna.
            const colsVis = cols.filter((c) => !hiddenQ.has(c.stepId) && !hiddenTrack.has(`col:${c.key}`));
            const gruposVis = grupos
              .filter((g) => !hiddenQ.has(g.stepId))
              .map((g) => ({ ...g, span: colsVis.filter((c) => c.stepId === g.stepId).length }))
              .filter((g) => g.span > 0);
            // retenção por lâmina: reaproveita o questionStats casando pela ordem
            // das perguntas (o texto continua sendo a chave daquele endpoint)
            const statById = new Map((d.questionStats || []).map((s) => [s.question, s.pct]));
            const pctPorStep = new Map<string, number>();
            {
              const comOpcoes = cols.filter((c) => c.kind === "options");
              comOpcoes.forEach((c, i) => {
                const q = d.questions[i];
                if (q !== undefined) pctPorStep.set(c.stepId, statById.get(q) ?? 0);
              });
            }
            const visTrack = TRACK_COLS.filter((c) => !hiddenTrack.has(c.key));
            const term = search.trim().toLowerCase();
            const rows = d.respostas
              .filter((r) => filtroLinha === "todos" || (filtroLinha === "resposta" ? r.temResposta : r.virouLead))
              .filter((r) => !term || [r.code, r.name, r.phone, ...Object.values(r.cells ?? {})].join(" ").toLowerCase().includes(term));
            const pages = Math.max(1, Math.ceil(rows.length / PER));
            const pg = Math.min(page, pages - 1);
            const slice = rows.slice(pg * PER, pg * PER + PER);
            return (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Pesquisar nome, telefone, resposta…"
                      className="w-64 rounded-lg border border-neutral-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-neutral-400" />
                    <span className="pointer-events-none absolute left-2.5 top-1.5 text-neutral-400">🔎</span>
                  </div>
                  <div className="relative">
                    <button onClick={() => setOpenFilter(openFilter === "etapas" ? null : "etapas")} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">▦ Etapas ▾</button>
                    {openFilter === "etapas" ? (
                      <div className="absolute z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
                        {/* "Etapas" alterna a LÂMINA inteira — é o que a palavra
                            significa no inlead. Antes listava texto de pergunta,
                            que é outro modelo (e some ao renomear a pergunta). */}
                        {grupos.map((g) => (
                          <label key={g.stepId} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-neutral-50">
                            <span className="min-w-0 flex-1 truncate text-neutral-700">{g.stepIdx + 1}. {g.stepTitle}</span>
                            <input type="checkbox" checked={!hiddenQ.has(g.stepId)} onChange={() => alternarEtapa(g.stepId)} className="h-3.5 w-3.5 accent-neutral-900" />
                          </label>
                        ))}
                        {!grupos.length ? <p className="px-2 py-3 text-center text-[11px] text-neutral-400">Este funil ainda não tem blocos de resposta.</p> : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="relative">
                    <button onClick={() => setOpenFilter(openFilter === "colunas" ? null : "colunas")} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">▥ Colunas ▾</button>
                    {openFilter === "colunas" ? (
                      <div className="absolute z-20 mt-1 max-h-72 w-56 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
                        <label className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-neutral-50">
                          <span className="font-semibold text-neutral-700">Lead / Telefone / Data</span>
                          <input type="checkbox" checked={showMeta} onChange={() => setShowMeta((v) => !v)} className="h-3.5 w-3.5 accent-neutral-900" />
                        </label>
                        {cols.length ? (<>
                          <p className="mt-1 px-2 pb-0.5 pt-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400">Blocos</p>
                          {cols.map((c) => (
                            <label key={c.key} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-neutral-50">
                              <span className="min-w-0 flex-1 truncate text-neutral-700" title={c.header}>{c.label} <span className="font-mono text-[10px] text-neutral-400">{c.key}</span></span>
                              <input type="checkbox" checked={!hiddenTrack.has(`col:${c.key}`)} onChange={() => alternarColuna(`col:${c.key}`)} className="h-3.5 w-3.5 accent-neutral-900" />
                            </label>
                          ))}
                        </>) : null}
                        <p className="mt-1 px-2 pb-0.5 pt-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400">Tracking</p>
                        {TRACK_COLS.map((c) => (
                          <label key={c.key} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-neutral-50">
                            <span className="text-neutral-700">{c.label}</span>
                            <input type="checkbox" checked={!hiddenTrack.has(c.key)} onChange={() => alternarColuna(c.key)} className="h-3.5 w-3.5 accent-neutral-900" />
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {/* A linha passou a ser a SESSÃO (igual ao inlead), então a
                      contagem sobe. Sem esses contadores, parece bug. */}
                  <div className="ml-auto flex items-center gap-1">
                    {([["todos", `${d.totais?.sessoes ?? rows.length} sessões`], ["resposta", `${d.totais?.comResposta ?? 0} com resposta`], ["lead", `${d.totais?.leads ?? 0} leads`]] as const).map(([k, label]) => (
                      <button key={k} onClick={() => { setFiltroLinha(k); setPage(0); }}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${filtroLinha === k ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-500 hover:bg-neutral-50"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {slice.length ? (
                  <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
                    <table className="w-full border-separate border-spacing-0 text-xs">
                      {/* DOIS cabeçalhos, como no inlead (print 20):
                          linha 1 = a LÂMINA (+ % de retenção)
                          linha 2 = o BLOCO, com o chip da CHAVE — e esse chip é
                                    literalmente o header da planilha exportada. */}
                      <thead className="text-left text-neutral-500">
                        <tr className="bg-neutral-50">
                          {/* o grupo "Entrada" precisa da MESMA largura somada das
                              3 colunas fixas de baixo (44+116+96=256), senão o
                              cabeçalho desalinha do corpo ao rolar na horizontal */}
                          {showMeta ? <th colSpan={3} className="sticky left-0 z-30 w-[256px] border-b border-r border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-[11px] font-semibold text-neutral-400">– Entrada</th> : null}
                          {gruposVis.map((g) => (
                            <th key={g.stepId} colSpan={g.span} className="whitespace-nowrap border-b border-r border-neutral-200 bg-neutral-50 px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-neutral-400">{g.stepIdx + 1}</span>
                                <span className="font-semibold text-neutral-700">{g.stepTitle.slice(0, 24)}</span>
                                <PctRing pct={pctPorStep.get(g.stepId) ?? 0} />
                              </div>
                            </th>
                          ))}
                          {visTrack.length ? <th colSpan={visTrack.length} className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] font-semibold text-violet-400">Tracking</th> : null}
                        </tr>
                        <tr className="bg-white">
                          {showMeta ? (<>
                            <th className="sticky left-0 z-30 w-[44px] min-w-[44px] border-b border-neutral-200 bg-white px-2 py-2 font-semibold">#</th>
                            <th className="sticky left-[44px] z-30 w-[116px] min-w-[116px] border-b border-neutral-200 bg-white px-3 py-2 font-semibold">[ID] Lead</th>
                            <th className="sticky left-[160px] z-30 w-[96px] min-w-[96px] border-b border-r border-neutral-200 bg-white px-3 py-2 font-semibold">Data</th>
                          </>) : null}
                          {colsVis.map((c) => (
                            <th key={c.key} className="whitespace-nowrap border-b border-neutral-200 px-3 py-2">
                              <span className="flex items-center gap-1.5">
                                <span className="text-neutral-400">{c.kind === "options" ? "☰" : c.kind === "button" ? "▭" : c.kind === "passou" ? "👁" : "📝"}</span>
                                <span className="font-semibold text-neutral-600">{c.label}</span>
                                <span className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[9px] font-normal text-neutral-400" title="chave usada no CSV exportado">{c.key.slice(0, 14)}</span>
                              </span>
                            </th>
                          ))}
                          {visTrack.map((c) => <th key={c.key} className="whitespace-nowrap border-b border-neutral-200 px-3 py-2 font-semibold text-violet-500">{c.label}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {slice.map((r, i) => (
                          <tr key={r.code || i} className="hover:bg-neutral-50">
                            {showMeta ? (<>
                              <td className="sticky left-0 z-10 w-[44px] min-w-[44px] border-b border-neutral-100 bg-white px-2 py-1.5 tabular-nums text-neutral-400">{pg * PER + i + 1}</td>
                              <td className="sticky left-[44px] z-10 w-[116px] min-w-[116px] max-w-[116px] truncate whitespace-nowrap border-b border-neutral-100 bg-white px-3 py-1.5 font-semibold text-neutral-800" title={r.name || r.code}>
                                {r.name || <span className="font-mono text-[11px] font-normal text-blue-600">{r.code}</span>}
                              </td>
                              <td className="sticky left-[160px] z-10 w-[96px] min-w-[96px] whitespace-nowrap border-b border-r border-neutral-100 bg-white px-3 py-1.5 text-neutral-400">{r.when ? new Date(r.when).toLocaleDateString("pt-BR") : "—"}</td>
                            </>) : null}
                            {colsVis.map((c) => {
                              const v = r.cells?.[c.key] ?? "";
                              return (
                                <td key={c.key} className="max-w-[220px] truncate whitespace-nowrap border-b border-neutral-100 px-3 py-1.5 text-neutral-600" title={v || undefined}>
                                  {/* célula vazia é VAZIA (igual ao inlead) — travessão só nos metadados */}
                                  {v === "clicked"
                                    ? <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">clicked</span>
                                    : v === "visto"
                                    ? <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">visto</span>
                                    : v}
                                </td>
                              );
                            })}
                            {visTrack.map((c) => <td key={c.key} className="max-w-[160px] truncate whitespace-nowrap border-b border-neutral-100 px-3 py-1.5 text-neutral-400" title={r.track?.[c.key] || ""}>{r.track?.[c.key] || "—"}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="p-8 text-center text-sm text-neutral-400">{term ? "Nenhuma linha bate com a busca." : filtroLinha !== "todos" ? "Nenhuma linha nesse filtro." : "Nenhuma visita ainda. Passe um lead pelo funil."}</p>}

                {pages > 1 ? (
                  <div className="flex items-center justify-center gap-2 text-xs">
                    <button onClick={() => setPage(Math.max(0, pg - 1))} disabled={pg === 0} className="rounded border border-neutral-200 px-2 py-1 font-semibold disabled:opacity-40">←</button>
                    <span className="text-neutral-500">Página {pg + 1} de {pages}</span>
                    <button onClick={() => setPage(Math.min(pages - 1, pg + 1))} disabled={pg >= pages - 1} className="rounded border border-neutral-200 px-2 py-1 font-semibold disabled:opacity-40">→</button>
                  </div>
                ) : null}
              </div>
            );
          })() : null}

          {/* RESULTADOS — por pergunta, opções com % */}
          {sub === "resultados" ? (
            d.resultados.length ? (
              <div className="space-y-4">
                {d.resultados.map((r) => (
                  <div key={r.question} className="rounded-xl border border-neutral-200 bg-white p-4">
                    <p className="mb-2 text-sm font-bold text-neutral-800">{r.question} <span className="ml-1 text-xs font-normal text-neutral-400">({r.total} respostas)</span></p>
                    <div className="space-y-2">
                      {r.options.map((o, i) => (
                        <div key={i}>
                          <div className="mb-0.5 flex items-center justify-between text-xs"><span className="text-neutral-700">{o.label}</span><span className="font-semibold text-neutral-500">{o.value} · {o.pct}%</span></div>
                          <Bar pct={o.pct} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="p-8 text-center text-sm text-neutral-400">Sem respostas de quiz ainda.</p>
          ) : null}

          {/* PERFORMANCE — tela completa (= antigo "Métricas"): cards c/ deltas, funil, tráfego, campanhas, dispositivos, Sumário */}
          {sub === "performance" && p ? <PerformanceView m={p} deltas={d.deltas} /> : null}
        </>
      )}
    </div>
  );
}

export default function LayersBuilder({ initial, initialStepId, localDraft, initiallyDraft=false }: { initial: Funnel; initialStepId?: string; initiallyDraft?:boolean; localDraft?: {
  save: (funnel: Funnel) => Promise<{ ok: boolean; error?: string }>;
  previewHref: string;
  reportHref?: string;
  dashboardHref?: string;
  sourceSlug?: string;
  stagePreviewHref?: (stepId: string) => string;
  commit?: (funnel:Funnel) => Promise<{ok:boolean;error?:string}>;
} }) {
  const [funnel, setFunnel] = useState<Funnel>(initial);
  const [isDraft,setIsDraft]=useState(initiallyDraft);
  const steps = funnel.steps as unknown as InleadStep[];
  const [selStep, setSelStep] = useState(() => Math.max(0, steps.findIndex(step => step.id === initialStepId)));
  const stageDialog = useRef<HTMLDialogElement>(null);
  const layerDeleteDialog = useRef<HTMLDialogElement>(null);
  const [pendingLayerDelete, setPendingLayerDelete] = useState<{ stageId: string; layerId: string; label: string } | null>(null);
  const [actionStepId, setActionStepId] = useState("");
  const [confirmStageRemoval, setConfirmStageRemoval] = useState(false);
  function cancelStageRemoval() {
    setConfirmStageRemoval(false);
    requestAnimationFrame(() => stageRemoveButton.current?.focus());
  }
  const [stageCopyResult, setStageCopyResult] = useState<"copied" | "error" | null>(null);
  const stageRemoveButton = useRef<HTMLButtonElement>(null);
  const actionIndex = steps.findIndex(s => s.id === actionStepId);
  const [selLayer, setSelLayer] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notices, setNotices] = useState<ReturnType<typeof recordWorkspaceNotice>[]>([]);
  function notify(message: string, error = false) {
    const item = recordWorkspaceNotice("Editor", message, error);
    setNotices(previous => [...previous.filter(notice => notice.message !== message), item].slice(-3));
  }
  const [nonce, setNonce] = useState(0);
  /** Canvas do Construtor: editar blocos (padrão) ou ver a lâmina como o
   *  visitante vê. Estado de UI, nada é gravado. */
  const [compactPanel, setCompactPanel] = useState<"steps" | "blocks" | "canvas" | "properties">("canvas");
  const [blockSearch, setBlockSearch] = useState("");
  const [draggingBlock, setDraggingBlock] = useState(false);
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const query = normalize(blockSearch.trim());
  const categories = CATS.map((category) => ({
    ...category,
    items: category.items.filter(([, label]) => normalize(label).includes(query) || normalize(category.name).includes(query)),
  })).filter((category) => category.items.length > 0);
  const [verResultado, setVerResultado] = useState(false);
  const [tab, setTab] = useState<"construtor" | "fluxo" | "design" | "leads">("construtor");
  const [showSettings, setShowSettings] = useState(false);
  const [device, setDevice] = useState(DEFAULT_DEVICE); // id do aparelho do preview
  const [zoom, setZoom] = useState<Zoom>("fit");        // "fit" = moldura sempre cabe

  const theme = (funnel.settings?.design as { themeColor?: string })?.themeColor || "#ea580c";
  const setSteps = (next: InleadStep[]) => setFunnel((f) => ({ ...f, steps: next as unknown as Funnel["steps"] }));
  const patchStep = (i: number, patch: Partial<InleadStep>) => setSteps(steps.map((s, k) => k === i ? { ...s, ...patch } : s));
  const setLayers = (next: Layer[]) => patchStep(selStep, { layers: next });

  const step = steps[selStep];
  const localPreviewHref = step && localDraft?.stagePreviewHref ? localDraft.stagePreviewHref(step.id) : localDraft?.previewHref;
  async function openLocalPreview() {
    if (!localDraft || !localPreviewHref || saving) return;
    setSaving(true);
    try {
      const result = await localDraft.save(funnel);
      if (result.ok) window.location.assign(localPreviewHref);
      else notify(result.error || "Não foi possível abrir a visualização.", true);
    } finally {
      setSaving(false);
    }
  }

  const layers = step?.layers || [];

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const renamed = funnel.slug !== initial.slug;
    try {
      const result = localDraft ? await localDraft.save(funnel) : await saveFunnelAction(funnel, renamed ? initial.slug : undefined);
      if (!result.ok) {
        notify(result.error ?? "Não foi possível salvar o funil.", true);
        return;
      }
      notify(localDraft ? "Rascunho salvo neste navegador" : "Salvo");
      if (renamed && !localDraft) {
        window.location.href = `/builder/${encodeURIComponent(funnel.slug)}`;
        return;
      }
      setNonce(n => n + 1);
    } catch {
      notify("Não foi possível salvar o funil. Tente novamente.", true);
    } finally {
      setSaving(false);
    }
  };
  const publish=async()=>{
    if(funnel.slug!==initial.slug){notify('Salve o novo endereço antes de publicar.', true);return;}
    setSaving(true);const result=await publishFunnelAction(funnel);setSaving(false);
    if(result.ok){setIsDraft(false);notify('Publicado');}else notify(result.error || 'Não foi possível concluir a ação.', true);
  };
  const commit=async()=>{
    if(!localDraft?.commit)return;setSaving(true);const result=await localDraft.commit(funnel);setSaving(false);if(!result.ok)notify(result.error || 'Não foi possível concluir a ação.', true);
  };

  // ── operações de lâmina ──
  const addStep = (template?: StepTemplate) => {
    insertStepAfter(createTemplateStep(template));
  };
  const delStep = (i: number) => { if (steps.length <= 1) return; const next = steps.filter((_, k) => k !== i); setSteps(next); setSelStep(Math.min(i, next.length - 1)); };

  // ── importar lâmina de outro funil ──
  const [importOpen, setImportOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [importFunnels, setImportFunnels] = useState<any[] | null>(null);
  const [importSel, setImportSel] = useState("");
  const openImport = () => {
    setImportOpen(true);
    if (!importFunnels) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetch("/api/funnels-export").then((r) => r.json()).then((d: any) => { setImportFunnels(d.funnels || []); setImportSel(d.funnels?.[0]?.slug || ""); }).catch(() => setImportFunnels([]));
    }
  };
  // clona uma lâmina com IDs NOVOS em tudo (step, blocos, conteúdo, opções e a
  // referência `step` de cada bloco) — evita qualquer colisão/edição travada.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cloneStepFresh = (srcStep: any) => {
    const s = cloneStageWithRules(srcStep, genId);
    return s;
  };
  // inserir clone após a atual + selecionar (limpa o bloco selecionado pra abrir limpo)
  const insertStepAfter = (s: InleadStep, after = selStep) => {
    const index = Math.min(after + 1, steps.length);
    setSteps([...steps.slice(0, index), s, ...steps.slice(index)]);
    setSelStep(index);
    setSelLayer(null);
    setVerResultado(false);
    setCompactPanel("canvas");
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const importStep = (srcStep: any) => { insertStepAfter(cloneStepFresh(srcStep)); setImportOpen(false); };
  const dupStep = (index: number) => { const s = cloneStepFresh(steps[index]); s.title = `${s.title || "Lâmina"} (cópia)`; insertStepAfter(s, index); };

  // ── operações de bloco ──
  const addPaletteItem = (key: string, beforeId?: string) => {
    if (!step || !ADDABLE.has(key)) return;
    const choice = key === "multi" || key === "single" || key === "yesno";
    const layer = newLayer(choice ? "options" : key === "video" ? "embed" : key as LayerType);
    if (choice) {
      layer.content.multiple = key === "multi";
      if (key === "yesno") {
        layer.content.options = [
          { id: genId(), label: "<p>Sim</p>", destination: "next" },
          { id: genId(), label: "<p>Não</p>", destination: "next" },
        ];
      }
    }
    const index = layers.findIndex((item) => item.id === beforeId);
    const next = [...layers];
    next.splice(index < 0 ? next.length : index, 0, layer);
    setLayers(next);
    setSelLayer(layer.id);
    setVerResultado(false);
    setCompactPanel("properties");
  };
  const delLayer = (id: string) => setLayers(layers.filter((l) => l.id !== id));
  const updateLayer = (id: string, l: Layer) => setLayers(layers.map((x) => x.id === id ? l : x));
  const onSelect = (id: string) => { setSelLayer(id); setCompactPanel("properties"); };
  const onAction = (id: string, action: "copy" | "hide" | "delete") => {
    const i = layers.findIndex((l) => l.id === id); if (i < 0) return;
    if (action === "delete") {
      const dialog = layerDeleteDialog.current;
      if (!dialog || dialog.open) return;
      setPendingLayerDelete({ stageId: step.id, layerId: id, label: layers[i].title || rotuloDoTipo(layers[i].type) });
      dialog.returnValue = "";
      dialog.showModal();
      return;
    }
    if (action === "copy") { const copy = cloneStageWithRules({id:step.id,title:step.title,layers:[layers[i]]},genId,{keepStageId:true}).layers[0]; setLayers([...layers.slice(0, i + 1), copy, ...layers.slice(i + 1)]); setSelLayer(copy.id); return; }
    if (action === "hide") { const l = layers[i]; updateLayer(id, { ...l, design: { ...(l.design || {}), hidden: !l.design?.hidden } }); }
  };
  // arrastar bloco no canvas (⠿) → reordena
  const onReorder = (activeId: string, overId: string) => {
    const from = layers.findIndex((l) => l.id === activeId);
    const to = layers.findIndex((l) => l.id === overId);
    if (from < 0 || to < 0) return;
    setLayers(arrayMove(layers, from, to));
  };

  const sel = layers.find((l) => l.id === selLayer);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const moveStep = (from: number, to: number) => {
    if (from < 0 || to < 0 || to >= steps.length || from === to) return;
    setSteps(arrayMove(steps, from, to));
    setSelStep(to);
    setSelLayer(null);
  };
  const onStepDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    moveStep(steps.findIndex(s => s.id === active.id), steps.findIndex(s => s.id === over.id));
  };
  return (
    // Tema do funil para os campos que geram HTML colorido (a pílula do editor
    // rico). Sem isso ela nascia laranja em funil de qualquer paleta.
    <LocalDraftContext.Provider value={!!localDraft}>
    <TemaFunilContext.Provider value={theme}>
    <div className="ct-workspace ct-editor">
      <EditorTop label={saving ? "Salvando" : localDraft ? "Rascunho local" : isDraft ? "Rascunho" : "Edição de funil"} busy={saving}/>
      <header className="ct-toolbar flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-3">
        <div className="flex min-w-0 max-w-full items-center gap-3">
          <Link href={localDraft?.dashboardHref ?? "/dashboard"} className="rounded-md border border-ct-line px-2 py-1 text-xs font-semibold text-ct-dim hover:bg-ct-raised">← Dashboard</Link>
          <div className="min-w-0 break-words">
            <h1 className="text-sm font-bold">Construtor · {funnel.name}</h1>
            <p className="text-xs text-ct-dim">/{funnel.slug} · {steps.length} lâminas{localDraft ? " · RASCUNHO LOCAL — não publicado" : ""}</p>
          </div>
        </div>
        <nav aria-label="Seções do construtor" className="ct-segments">
          {([["construtor", "Construtor"], ["fluxo", "Fluxo"], ["design", "Design"], ["leads", "Leads"]] as const).map(([k, label]) => (
            <button type="button" key={k} aria-pressed={tab === k} disabled={!!localDraft && !localDraft.sourceSlug && k === "leads"} onClick={() => setTab(k)}>
              {tab === k && <ActiveTab group="builder-tabs" />}<span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
          {notices.length > 0 && <div className="ct-notice-stack" aria-label="Avisos do editor">
            {notices.map(({ id, message, error }) => (
              <WorkspaceNotice key={id} message={message} error={error}
                onDismiss={() => setNotices(previous => previous.filter(item => item.id !== id))} />
            ))}
          </div>}
          <WorkspaceNoticeHistory />
          <button onClick={() => setShowSettings(true)} title="Configurações do funil" aria-label="Configurações do funil" className="rounded-lg border border-ct-line px-2.5 py-2 text-xs font-semibold text-ct-ink hover:bg-ct-raised">⚙</button>
          <StatefulButton type="button" onClick={save} state={saving ? "loading" : "idle"}
            aria-label={saving ? "Salvando…" : "Salvar"} loadingText="Salvando…" size="sm"
            className="ct-primary rounded-lg px-3 text-xs font-bold text-white disabled:opacity-50">
            Salvar
          </StatefulButton>
          {localDraft?.commit&&<button onClick={commit} disabled={saving} className="ct-primary rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Salvar nos meus funis</button>}
          {isDraft&&!localDraft&&<button onClick={publish} disabled={saving} className="ct-primary rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Publicar</button>}
          {localDraft ? <button type="button" onClick={openLocalPreview} disabled={saving}
            className="rounded-lg bg-ct-action px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Visualizar página</button>
            : !isDraft && <a href={funnel.domain ? `https://${funnel.domain}/${funnel.slug}` : `/${funnel.slug}`} target="_blank" rel="noreferrer"
              className="rounded-lg bg-ct-action px-3 py-2 text-xs font-semibold text-white">Visualizar página ↗</a>}
        </div>
      </header>

      {/* Design com preview ao lado: cor, fonte e header mudam a lâmina inteira,
          então ver o resultado enquanto ajusta evita o vai-e-volta entre abas. */}
      {tab === "design" && (
        <div className="ct-controls ct-design-layout grid min-h-0 flex-1 grid-cols-1 bg-neutral-100 lg:grid-cols-[minmax(320px,440px)_1fr]">
          <div className="overflow-y-auto p-4">
            <FunnelDesignPanel funnel={funnel} setFunnel={setFunnel} />
          </div>
          <div className="ct-design-preview border-l border-neutral-200 bg-white">
            <label className="ct-design-stage">
              Etapa da prévia
              <WorkspaceSelect label="Etapa da prévia" value={String(selStep)} onChange={value=>{setSelStep(Number(value));setSelLayer(null);}} options={steps.map((step,index)=>({value:String(index),label:`${index+1}. ${step.title}`}))}/>
            </label>
            <DevicePreview
              deviceId={device}
              onDeviceChange={setDevice}
              zoom={zoom}
              onZoomChange={setZoom}
              onRestart={() => setNonce((n) => n + 1)}
              scrollStyle={{ fontFamily: "'Poppins', system-ui, sans-serif" }}
            >
              <CanvasErrorBoundary resetKey={`design-${selStep}-${nonce}`}>
                <LayersRunner previewWidth={getDevice(device).w} key={`design-${selStep}-${nonce}-${device}`} funnel={funnel} startIndex={selStep} preview />
              </CanvasErrorBoundary>
            </DevicePreview>
          </div>
        </div>
      )}
      {tab === "fluxo" && (
        // `overflow-hidden`: o quadro do fluxo trata a roda do mouse por conta
        // própria (pan/zoom). Sem isto a página rolava atrás dele.
        <div className="ct-controls min-h-0 flex-1 overflow-hidden p-4">
          <LayersFlow
            steps={steps}
            setSteps={setSteps}
            onOpenStep={(i) => { setSelStep(i); setSelLayer(null); setTab("construtor"); }}
            criarLayer={newLayer}
          />
        </div>
      )}
      {tab === "leads" && <div className="ct-controls min-h-0 flex-1 overflow-auto p-4">
        <LeadsTab slug={localDraft?.sourceSlug ?? funnel.slug} readOnly={Boolean(localDraft)} />
        {localDraft?.reportHref && <Link href={localDraft.reportHref} className="mt-4 inline-block text-sm text-ct-blue underline">Ver relatório do funil</Link>}
      </div>}

      {tab === "construtor" && (
      <>
      <dialog ref={layerDeleteDialog} className="ct-template-dialog ct-stage-dialog" aria-labelledby="ct-delete-layer-title"
        onClose={event => {
          const confirmed = event.currentTarget.returnValue === "delete";
          setPendingLayerDelete(null);
          if (!confirmed || pendingLayerDelete?.stageId !== step?.id) return;
          if (pendingLayerDelete) {
            delLayer(pendingLayerDelete.layerId);
            if (selLayer === pendingLayerDelete.layerId) setSelLayer(null);
          }
        }}>
        <form method="dialog" className="ct-step-delete-confirmation space-y-3 p-4">
          <DeleteConfirmationIcon />
          <h2 id="ct-delete-layer-title" className="font-semibold">Excluir bloco?</h2>
          <p className="text-sm text-ct-dim">O bloco “{pendingLayerDelete?.label}” será removido ao salvar.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button autoFocus value="cancel" className="ct-step-control">Cancelar</button>
            <button value="delete" className="ct-step-control text-red-600">Confirmar exclusão</button>
          </div>
        </form>
      </dialog>
      <nav className="ct-compact-nav" aria-label="Painéis do editor">
        {([["steps", "Etapas"], ["blocks", "Blocos"], ["canvas", "Prévia"], ["properties", "Ajustes"]] as const).map(([key, label]) => (
          <button key={key} aria-pressed={compactPanel === key} onClick={() => setCompactPanel(key)}>{label}</button>
        ))}
      </nav>
      <div className="ct-editor-grid">
        {/* 1 · ETAPAS */}
        <aside data-panel="steps" data-visible={compactPanel === "steps"} className="ct-sidebar overflow-y-auto border-r">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ct-dim">Etapas</span>
            <div className="flex items-center gap-1">
              <button disabled={!!localDraft} onClick={openImport} title="Importar lâmina de outro funil" className="rounded border border-ct-line px-1.5 py-0.5 text-xs font-semibold text-ct-dim hover:bg-ct-raised">⬇</button>
            </div>
          </div>
          <DndContext id="ll-steps" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onStepDragEnd}>
            <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {steps.map((s, i) => (
                  <SortableItem key={s.id} id={s.id} onMove={delta => moveStep(i, i + delta)}>{(handle) => (
                    <div aria-current={i === selStep ? "step" : undefined} className={`ct-stage group flex items-center gap-1 rounded-lg px-2 py-2 text-sm ${i === selStep ? "bg-ct-action text-white" : "text-ct-ink hover:bg-ct-raised"}`}>
                      <span className={i === selStep ? "text-white/50" : "text-ct-dim"}>{handle}</span>
                      <button onClick={() => { setSelStep(i); setSelLayer(null); setCompactPanel("canvas"); }} className={`flex min-w-0 flex-1 items-center gap-1.5 text-left ${s.disabled ? "opacity-45" : ""}`}>
                        <span className={`text-[10px] ${i === selStep ? "text-white/60" : "text-ct-dim"}`}>{i + 1}</span>
                        <span className={`min-w-0 flex-1 truncate font-medium ${s.disabled ? "line-through" : ""}`}>{s.title || s.id}</span>
                        {s.disabled ? <span className="shrink-0 rounded bg-neutral-200 px-1 text-[9px] font-bold uppercase text-ct-dim">off</span> : null}
                      </button>
                      <button className="ct-stage-more" aria-label={`Ações da etapa ${i + 1}: ${s.title || s.id}`} aria-haspopup="dialog"
                        onClick={() => { setConfirmStageRemoval(false); setStageCopyResult(null); setActionStepId(s.id); stageDialog.current?.showModal(); }}><Ellipsis size={16} /></button>
                    </div>
                  )}</SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <div className="ct-step-tools">
            <button type="button" className="ct-step-control" onClick={() => addStep()}><FilePlus2 size={15} />Em branco</button>
            <StepTemplatePicker onSelect={addStep} />
          </div>
          <dialog ref={stageDialog} className="ct-template-dialog ct-stage-dialog" aria-label="Ações da etapa"
            onClick={event => { if (event.target === stageDialog.current) stageDialog.current.close(); }}>
            {actionIndex >= 0 && <div className="ct-template-body">
              <header><h2>{steps[actionIndex].title || actionStepId}</h2><button aria-label="Fechar ações" onClick={() => stageDialog.current?.close()}><X size={18}/></button></header>
              <p className="ct-step-id">
                Etapa {actionIndex + 1} de {steps.length} · {steps[actionIndex].layers?.length ?? 0} blocos
              </p>
              <div className="ct-stage-identity">
                <span>ID da etapa <code>{actionStepId}</code></span>
                {!confirmStageRemoval && <button type="button" className="ct-step-control" onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(actionStepId);
                    setStageCopyResult("copied");
                  } catch {
                    setStageCopyResult("error");
                  }
                }}><Copy size={14} aria-hidden="true" />Copiar ID</button>}
              </div>
              {stageCopyResult === "copied" && <p role="status" className="mt-2 text-xs text-ct-dim">ID copiado.</p>}
              {stageCopyResult === "error" && <p role="alert" className="mt-2 text-xs text-ct-dim">Não foi possível copiar. Selecione o ID acima.</p>}
              {!confirmStageRemoval && <>
              <button className="ct-step-control" onClick={() => {
                stageDialog.current?.close(); setSelStep(actionIndex); setSelLayer(null); setVerResultado(true); setNonce(n => n + 1); setCompactPanel("canvas");
              }}><Eye size={16}/>Visualizar etapa</button>
              <div className="ct-stage-action-preview">
                <button type="button" className="ct-step-control" disabled={actionIndex === 0}
                  aria-describedby="ct-stage-move-up-preview" onClick={() => moveStep(actionIndex, actionIndex - 1)}>Mover etapa para cima</button>
                <p id="ct-stage-move-up-preview">{actionIndex === 0 ? "Esta é a primeira etapa."
                  : <>Nova posição {actionIndex}, antes de <strong>{steps[actionIndex - 1].title || steps[actionIndex - 1].id}</strong>.</>}</p>
              </div>
              <div className="ct-stage-action-preview">
                <button type="button" className="ct-step-control" disabled={actionIndex === steps.length - 1}
                  aria-describedby="ct-stage-move-down-preview" onClick={() => moveStep(actionIndex, actionIndex + 1)}>Mover etapa para baixo</button>
                <p id="ct-stage-move-down-preview">{actionIndex === steps.length - 1 ? "Esta é a última etapa."
                  : <>Nova posição {actionIndex + 2}, depois de <strong>{steps[actionIndex + 1].title || steps[actionIndex + 1].id}</strong>.</>}</p>
              </div>
              <div className="ct-stage-action-preview">
                <button type="button" className="ct-step-control" aria-describedby="ct-stage-copy-preview"
                  onClick={() => { stageDialog.current?.close(); dupStep(actionIndex); }}><Copy size={16}/>Duplicar etapa</button>
                <p id="ct-stage-copy-preview">A cópia entra na posição {actionIndex + 2}, logo após esta etapa.</p>
              </div>
              </>}
              <button type="button" className="ct-step-control" ref={stageRemoveButton}
                aria-expanded={confirmStageRemoval} aria-controls="ct-stage-delete-confirmation"
                disabled={steps.length <= 1} onClick={() => {
                  if (confirmStageRemoval) cancelStageRemoval();
                  else setConfirmStageRemoval(true);
                }}><Trash2 size={16}/>Excluir etapa</button>
              <div id="ct-stage-delete-confirmation">
                {confirmStageRemoval && (
                  <div role="group" aria-label="Confirmar exclusão de etapa" className="ct-step-delete-confirmation mt-2 space-y-3" onKeyDown={event => {
                    if (event.key !== "Escape") return;
                    event.preventDefault();
                    cancelStageRemoval();
                  }}>
                    <DeleteConfirmationIcon />
                    <p className="text-sm text-ct-dim">Excluir esta etapa e seus blocos?</p>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" className="ct-step-control" ref={button => button?.focus()}
                        onClick={cancelStageRemoval}>Cancelar</button>
                      <button type="button" className="ct-step-control text-red-600"
                        onClick={() => { stageDialog.current?.close(); delStep(actionIndex); setSelLayer(null); }}>Confirmar exclusão</button>
                    </div>
                  </div>
                )}
              </div>
            </div>}
          </dialog>
        </aside>

        {/* 2 · PALETA categorizada */}
        <aside data-panel="blocks" data-visible={compactPanel === "blocks"} className="ct-sidebar ct-library overflow-y-auto border-r">
          <label className="mb-3 block text-sm font-bold">Blocos
            <input type="search" value={blockSearch} onChange={(event) => setBlockSearch(event.target.value)} placeholder="Buscar bloco" className="mt-2 text-xs font-normal" />
          </label>
          {categories.length === 0 && <p role="status" className="text-xs">Nenhum bloco encontrado.</p>}
          {categories.map((cat) => (
            <div key={cat.name} className="mb-2.5">
              <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-ct-dim">{cat.name}</p>
              <div className="space-y-0.5">
                {cat.items.map(([key, label]) => {
                  const soon = !ADDABLE.has(key);
                  return (
                    <button key={key} onClick={() => addPaletteItem(key)} disabled={soon}
                      draggable={!soon} onDragStart={(event) => {
                        event.dataTransfer.setData("application/x-ctfunil-block", key);
                        event.dataTransfer.effectAllowed = "copy";
                        setDraggingBlock(true);
                      }} onDragEnd={() => setDraggingBlock(false)} title={soon ? "Em breve — ativa sob demanda" : undefined}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${soon ? "cursor-not-allowed text-ct-dim" : "text-ct-ink hover:bg-ct-selected hover:shadow-sm"}`}>
                      <span className={`shrink-0 ${soon ? "opacity-40" : ""}`}><BlockIcon type={key}/></span><span className="min-w-0 flex-1 leading-tight">{label}</span>
                      {soon ? <span className="ml-auto rounded bg-ct-raised px-1 text-[10px] font-medium text-ct-dim">breve</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        {/* 3 · CANVAS (celular, edição inline) — dimensões CSS reais do aparelho */}
        <section data-panel="canvas" data-visible={compactPanel === "canvas"} className="ct-canvas" aria-label="Prévia da etapa"
          data-dragging={draggingBlock}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes("application/x-ctfunil-block")) {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={(event) => {
            const key = event.dataTransfer.getData("application/x-ctfunil-block");
            if (!ADDABLE.has(key)) return;
            event.preventDefault();
            const beforeId = (event.target as Element).closest<HTMLElement>("[data-editor-block]")?.dataset.editorBlock;
            addPaletteItem(key, beforeId);
            setDraggingBlock(false);
          }}>
        <div className="ct-preview-actions" role="group" aria-label="Modo da prévia">
          {([[false, "Editar", Pencil], [true, "Ver resultado", Eye]] as const).map(([value, label, Icon]) => (
            <button type="button" key={String(value)} aria-label={label} aria-pressed={verResultado === value}
              onClick={() => { setVerResultado(value); setSelLayer(null); }}>
              <Icon size={15} aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </div>
        <StagePreviewRail stages={steps} selected={selStep} onSelect={index => {
          setSelStep(index); setSelLayer(null); setNonce(n => n + 1);
        }} />
        <DevicePreview
          deviceId={device}
          onDeviceChange={setDevice}
          zoom={zoom}
          onZoomChange={setZoom}
          // Remonta a lâmina do zero. O canvas do Construtor era o único preview
          // sem isto — e é justamente onde faz falta: depois de girar a roleta,
          // raspar ou ver o loading correr, a lâmina fica no estado final e não
          // havia como rever a animação sem trocar de lâmina e voltar.
          onRestart={() => setNonce((n) => n + 1)}
          onBackdropClick={() => setSelLayer(null)}
          scrollStyle={{ fontFamily: "'Poppins', system-ui, sans-serif" }}
        >
          {/* Duas leituras da mesma lâmina, e as duas são necessárias.
              EDITAR mostra os blocos soltos e arrastáveis — é como se mexe no
              conteúdo. VER mostra o que o visitante vê, incluindo as telas de
              preset (hero, pergunta, captura…), que substituem a pilha inteira
              de blocos e por isso não aparecem no modo de edição. Sem este
              botão, a única forma de conferir o resultado era abrir o site. */}
          {/* Erro numa lâmina fica DENTRO do celular: as etapas, a paleta e o
              painel continuam vivos, e a mensagem aparece na tela em vez de
              só no console. Antes, qualquer erro de render derrubava a página
              inteira e não sobrava pista do que quebrou. */}
          <CanvasErrorBoundary resetKey={`${selStep}-${nonce}`}>
            <LayersRunner previewWidth={getDevice(device).w}
              key={`${selStep}-${nonce}-${device}-${verResultado ? "ver" : "edit"}`}
              funnel={funnel} startIndex={selStep} preview
              editor={verResultado ? undefined : { selectedId: selLayer || undefined, onSelect, onAction, onReorder }}
            />
          </CanvasErrorBoundary>
        </DevicePreview>

        </section>

        {/* 4 · PAINEL direito (Componente/Aparência/Exibição OU Etapa) */}
        <aside data-panel="properties" data-visible={compactPanel === "properties"} className="ct-controls overflow-y-auto border-l border-neutral-200 bg-white">
            <div className="space-y-3 p-4">
              <p className="text-sm font-bold text-neutral-700">Etapa</p>
              {/* LISTA DE BLOCOS — o caminho de edição quando a lâmina tem tela
                  própria. Nessas, o celular desenha a tela pronta (para bater
                  com o site) e não há bloco solto para clicar; sem esta lista,
                  o conteúdo ficaria visível e inalcançável. */}
              {(step?.layers || []).length ? (
                <div className="rounded-xl border border-neutral-200 p-3">
                  <p className="mb-2 text-sm font-bold text-neutral-700">Blocos desta lâmina</p>
                  <div className="space-y-1">
                    {/* Arrastar pelo punho ⠿, igual ao canvas — reaproveita o
                        `SortableItem` e o `onReorder` que já movem blocos lá,
                        então a lista e o preview reordenam pelo mesmo caminho. */}
                    {/* `id` explícito: a página tem outro DndContext (o das
                        etapas, "ll-steps"). Sem id, o dnd-kit gera um por
                        contagem de montagem, os dois podem colidir e o arraste
                        de um vira inerte. */}
                    <DndContext
                      id="ll-blocos" sensors={sensors} collisionDetection={closestCenter}
                      onDragEnd={(e) => {
                        const { active, over } = e;
                        if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
                      }}
                    >
                      <SortableContext items={(step?.layers || []).map((l) => l.id)} strategy={verticalListSortingStrategy}>
                        {(step?.layers || []).map((l) => {
                          const resumo = String(l.content?.label || l.content?.text || l.content?.title || "")
                            .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
                          const ativo = selLayer === l.id;
                          const oculto = !!l.design?.hidden;
                          return (
                            <SortableItem key={l.id} id={l.id} onMove={delta => {
                              const index = layers.findIndex(layer => layer.id === l.id);
                              const target = layers[index + delta];
                              if (target) onReorder(l.id, target.id);
                            }}>
                              {(handle) => (
                                <div
                                  className={`flex items-center gap-1 rounded-lg px-1.5 py-1 transition ${
                                    ativo ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
                                >
                                  {handle}
                                  <button onClick={() => setSelLayer(l.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs">
                                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                      ativo ? "bg-white/20" : "bg-neutral-200 text-neutral-500"}`}>
                                      {l.title || rotuloDoTipo(l.type)}
                                    </span>
                                    <span className={`truncate ${oculto ? "line-through opacity-50" : ""}`}>{resumo || l.id}</span>
                                  </button>
                                  <span className={`flex shrink-0 items-center ${ativo ? "text-white/70" : "text-neutral-400"}`}>
                                    {([
                                      ["⧉", "Duplicar", () => onAction(l.id, "copy")],
                                      [oculto ? "◻" : "◼", oculto ? "Mostrar" : "Ocultar", () => onAction(l.id, "hide")],
                                      ["✕", "Excluir", () => onAction(l.id, "delete")],
                                    ] as [string, string, () => void][]).map(([icone, titulo, acao]) => (
                                      <button
                                        key={titulo} title={titulo} aria-label={`${titulo} ${l.title || rotuloDoTipo(l.type)}`}
                                        onClick={(e) => { e.stopPropagation(); acao(); }}
                                        className={`grid h-5 w-5 place-items-center rounded text-[11px] leading-none transition ${
                                          ativo ? "hover:bg-white/20" : "hover:bg-neutral-200 hover:text-neutral-900"}`}
                                      >{icone}</button>
                                    ))}
                                  </span>
                                </div>
                              )}
                            </SortableItem>
                          );
                        })}
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
              ) : null}
              <label className="flex cursor-pointer items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm">
                <span className="font-semibold text-neutral-700">{step?.disabled ? "Lâmina desativada" : "Lâmina ativa"}</span>
                <input type="checkbox" checked={!step?.disabled} onChange={(e) => patchStep(selStep, { disabled: !e.target.checked })} className="h-4 w-4 accent-green-600" />
              </label>
              {step?.disabled ? <p className="-mt-1 text-[11px] text-amber-600">Esta lâmina é PULADA no funil publicado (continua aqui pra reativar).</p> : null}
              {sel ? <RightPanel key={sel.id} layer={sel} steps={steps} onChange={(nl) => updateLayer(sel.id, nl)} conteudo={HERO_EDITAVEL.has(sel.type) ? <StepEditor step={{...sel.content,type:sel.type} as unknown as import('@/lib/quiz/types').Step} onChange={patch => updateLayer(sel.id,{...sel,content:{...sel.content,...(patch as Record<string, unknown>)}})} /> : undefined} /> : <>
              <div><Lbl>Título</Lbl><input aria-label="Nome da etapa" value={step?.title || ""} onChange={(e) => patchStep(selStep, { title: e.target.value })} className={inp} /></div>

              {/* `key` obrigatório: este painel NÃO remonta ao trocar de lâmina
                  (diferente do RightPanel, que tem key={sel.id}), então sem ele
                  o campo continuaria mostrando o ID da lâmina anterior. */}
              <CampoId
                key={selStep}
                valor={step?.webhookKey}
                aoSalvar={(v) => patchStep(selStep, { webhookKey: v })}
                automatico={step?.id || ""}
                ajuda="Identifica esta etapa nos dados do funil."
              />

              {step && <StageAppearance step={step} onChange={design => patchStep(selStep, { design })} />}
              {/* Imagem de fundo da lâmina (estilo inlead: ajuste + posição + opacidade) */}
              {(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const sd: any = step?.design || {};
                const patchDesign = (p: Record<string, unknown>) => patchStep(selStep, { design: { ...sd, ...p } });
                const src = sd.backgroundImage?.src || "";
                return (
                  <div className="rounded-xl border border-neutral-200 p-3">
                    <Lbl>Imagem de fundo</Lbl>
                    <ImageField value={src} onChange={(v) => patchDesign({ backgroundImage: v ? { type: "image", src: v } : undefined })} />
                    {src ? (
                      <>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <div>
                            <Lbl>Ajuste</Lbl>
                            <WorkspaceSelect label="Ajuste da imagem" value={sd.backgroundSize||'cover'} onChange={value=>patchDesign({backgroundSize:value})} options={[["cover","Tela inteira"],["auto","Original"],["contain","Adequar"],["fill","Esticar"]].map(([value,label])=>({value,label}))}/>
                          </div>
                          <div>
                            <Lbl>Posição</Lbl>
                            <WorkspaceSelect label="Posição da imagem" value={sd.backgroundPosition||'center'} onChange={value=>patchDesign({backgroundPosition:value})} options={[["center","Centro"],["top","Topo"],["bottom","Base"],["left","Esquerda"],["right","Direita"]].map(([value,label])=>({value,label}))}/>
                          </div>
                          <div>
                            <Lbl>Opacidade</Lbl>
                            <WorkspaceSelect label="Opacidade da imagem" value={String(sd.backgroundOpacity??100)} onChange={value=>patchDesign({backgroundOpacity:Number(value)})} options={[100,90,75,50,35,25,15,10].map(value=>({value:String(value),label:`${value}%`}))}/>
                          </div>
                        </div>
                        <button onClick={() => patchDesign({ backgroundImage: undefined })} className="mt-2 text-xs font-semibold text-red-500 hover:text-red-700">Remover fundo</button>
                      </>
                    ) : null}
                  </div>
                );
              })()}
              {/* Editor dedicado de slider/roleta (hero especial — não tem blocos clicáveis) */}
              {(() => {
                const special = (step?.layers || []).find((l) => HERO_EDITAVEL.has(l.type));
                if (!special) return null;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const sc: any = special.content || {};
                const patchSpecial = (patch: Record<string, unknown>) => patchStep(selStep, { layers: (step!.layers || []).map((l) => l.id === special.id ? { ...l, content: { ...l.content, ...patch } } : l) });

                // Blocos-hero herdados do motor tipado: reaproveitam o MESMO
                // StepEditor de lá, que já edita raspadinha/pedida/medidor/VSL/
                // parabéns campo a campo. Duplicar essa UI aqui seria manter dois
                // editores do mesmo bloco — e um deles ficaria para trás.
                if (HERO_DO_TIPADO.has(special.type)) {
                  // O hero passa pelas MESMAS três abas dos outros blocos.
                  // Antes o StepEditor entrava solto aqui, fora do RightPanel —
                  // então os blocos-hero eram os únicos sem Aparência (largura,
                  // alinhamento, opacidade) e sem Exibição (revelar após N
                  // segundos, ocultar). Era o que faltava no slider.
                  const trocaLayer = (l: Layer) =>
                    patchStep(selStep, { layers: (step!.layers || []).map((x) => (x.id === special.id ? l : x)) });
                  return (
                    <div className="rounded-xl border border-ct-line bg-ct-raised">
                      <p className="px-3 pt-3 text-sm font-bold text-neutral-700">
                        <BlockIcon type={special.type}/> {ROTULO_HERO[special.type] || special.type} <span className="font-normal text-neutral-400">(ocupa a lâmina inteira)</span>
                      </p>
                      <RightPanel
                        layer={special}
                        steps={steps}
                        onChange={trocaLayer}
                        conteudo={
                          <StepEditor
                            step={sc}
                            onChange={(patch) => patchSpecial(patch as Record<string, unknown>)}
                          />
                        }
                      />
                    </div>
                  );
                }
                // Aqui viviam DOIS editores paralelos — roleta e slider — hoje
                // removidos. Os dois cobriam menos que o StepEditor: o da roleta
                // não conhecia tipo, movimento, popup nem som; o do slider não
                // tinha valor padrão, sufixo, escala nem botão. Todo hero passa
                // pelo StepEditor agora, então este ramo é inalcançável.
                return null;
              })()}
              {/* Header POR LÂMINA: cada toggle herda do global (Design) até você mexer */}
              {(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const g = (((funnel.settings as any)?.header) || {}) as Record<string, boolean | undefined>;
                const ov = (step?.headerOverride || {}) as Record<string, boolean | undefined>;
                const keys = ["show_logo", "show_progress", "show_back", "go_to_top", "show_scroll_hint"] as const;
                // A setinha é a ÚNICA que nasce LIGADA — daí o `!== false` em vez
                // do `|| false` das outras. Sem essa distinção ela apareceria
                // desmarcada em todo funil que nunca a tocou.
                const eff = (k: string) => k === "show_scroll_hint"
                  ? (ov[k] !== undefined ? !!ov[k] : g[k] !== false)
                  : ((ov[k] !== undefined ? ov[k] : g[k]) || false);
                const setOv = (k: string, v: boolean) => patchStep(selStep, { headerOverride: { ...ov, [k]: v } });
                const touched = keys.some((k) => ov[k] !== undefined);
                const reset = () => { const n = { ...ov }; keys.forEach((k) => delete n[k]); patchStep(selStep, { headerOverride: n }); };
                const ROWS: [string, string][] = [["show_logo", "Mostrar logo"], ["show_progress", "Mostrar progresso"], ["show_back", "Mostrar botão voltar"], ["go_to_top", 'Ativar botão "Ir ao topo"'], ["show_scroll_hint", "Setinha “role para baixo”"]];
                return (
                  <div className="rounded-xl border border-neutral-200 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-sm font-bold text-neutral-700">Header</p>
                      {touched ? <button onClick={reset} className="text-[11px] font-semibold text-neutral-400 hover:text-neutral-700">↺ herdar do global</button> : null}
                    </div>
                    {ROWS.map(([k, label]) => (
                      <label key={k} className="flex cursor-pointer items-center justify-between py-1.5 text-sm">
                        <span className="text-neutral-600">{label}{ov[k] === undefined ? <span className="ml-1.5 text-[10px] text-neutral-400">global</span> : null}</span>
                        <input type="checkbox" checked={eff(k)} onChange={(e) => setOv(k, e.target.checked)} className="h-4 w-4 accent-neutral-900" />
                      </label>
                    ))}
                    <p className="mt-1 text-[11px] text-neutral-400">Personalize esta etapa ou restaure o padrão do funil.</p>
                  </div>
                );
              })()}
              {/* Só o FUNDO fica aqui: ele é da lâmina inteira, não de um bloco.
                  A barra de vagas virou bloco Alerta (estilo "Barra de vagas")
                  e a cor do checkout saiu para o próprio botão — antes as duas
                  decisões viviam em dois painéis, e mudar num não refletia no
                  outro. */}
              {(step as { tela?: string })?.tela === "vsl" ? (
                <div className="rounded-xl border border-neutral-200 p-3">
                  <p className="mb-1 text-sm font-bold text-neutral-700">Fundo da lâmina (VSL)</p>
                  <input
                    value={(step as { fundo?: string })?.fundo || ""}
                    onChange={(e) => patchStep(selStep, { fundo: e.target.value } as Partial<InleadStep>)}
                    placeholder="URL de imagem, cor (#0b2033) ou gradiente CSS"
                    className={inp}
                  />
                  <p className="mt-1.5 text-[11px] text-neutral-400">
                    Vazio deriva da <b>Cor do tema</b>: trocar o tema repinta o fundo junto.
                  </p>
                  <p className="mt-2 text-[11px] text-neutral-400">
                    A <b>barra de vagas</b> é um bloco Alerta com estilo “Barra de vagas”. A <b>cor do checkout</b> está no próprio botão.
                  </p>
                </div>
              ) : null}
              <p className="text-xs text-neutral-400">Selecione um bloco para editar.</p>
              </>}
            </div>
        </aside>
      </div>
      </>
      )}

      {showSettings ? (
        <FunnelSettingsPanel sourceSlug={localDraft?.sourceSlug} funnel={funnel} onPatch={(patch) => setFunnel((f) => ({ ...f, ...patch }))} onClose={() => setShowSettings(false)} />
      ) : null}

      {/* ── Modal: importar lâmina de outro funil ── */}
      {importOpen ? (
        <div className="ct-controls fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setImportOpen(false)}>
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
              <h2 className="text-sm font-bold text-neutral-800">⬇ Importar lâmina</h2>
              <button onClick={() => setImportOpen(false)} className="text-neutral-400 hover:text-neutral-700">✕</button>
            </div>
            {!importFunnels ? (
              <p className="p-8 text-center text-sm text-neutral-400">Carregando funis…</p>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                <label className="text-xs font-semibold text-neutral-500">De qual funil?
                  <WorkspaceSelect label="Funil de origem" value={importSel} onChange={setImportSel} options={importFunnels.map(f=>({value:f.slug,label:`${f.name} (/${f.slug})`}))}/>
                </label>
                <p className="text-xs font-semibold text-neutral-500">Qual lâmina importar?</p>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-neutral-200">
                  {(importFunnels.find((f) => f.slug === importSel)?.steps || []).map((s: { id: string; title: string; types?: string[]; step: Record<string, unknown> }, i: number) => (
                    <button key={s.id} onClick={() => importStep(s.step)} className="group flex w-full items-center gap-2 border-b border-neutral-100 px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-orange-50">
                      <span className="min-w-0 flex-1 truncate"><span className="mr-1.5 text-xs font-bold text-neutral-400">{i + 1}.</span><span className="font-semibold text-neutral-800">{s.title}</span> <span className="text-[10px] text-neutral-400">{(s.types || []).slice(0, 5).join(" · ")}</span></span>
                      <span className="shrink-0 rounded bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100">Importar</span>
                    </button>
                  ))}
                  {!(importFunnels.find((f) => f.slug === importSel)?.steps || []).length ? <p className="p-6 text-center text-xs text-neutral-400">Esse funil não tem lâminas.</p> : null}
                </div>
                <p className="text-[11px] text-neutral-400">A lâmina entra logo após a atual, com IDs novos (sem conflito). Clique em 💾 Salvar pra persistir.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
    </TemaFunilContext.Provider>
    </LocalDraftContext.Provider>
  );
}
