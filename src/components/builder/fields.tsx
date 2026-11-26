"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";
import type { QuizOption } from "@/lib/quiz/types";
import { AUDIO_ACCEPT, AUDIO_DURACAO_MAXIMA, AUDIO_EXTENSOES, AUDIO_LIMITE_BYTES, MENSAGENS_AUDIO, extensaoDe } from "@/lib/quiz/audio-upload";

// ── Editor de texto VISUAL (WYSIWYG fase 3b) ──────────────────────
// Mostra o texto JÁ FORMATADO (negrito/pílula), sem exibir os marcadores.
// Converte marcação -> HTML pra exibir e HTML -> marcação ao editar.
const PILL_CSS = "display:inline-block;border-radius:9px;padding:1px 8px;font-weight:800;color:#fff;background:linear-gradient(95deg,#e8842a,#f4b85c)";
const BOLD_CSS = "color:#e8842a;font-weight:800";

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Cor do tema do funil, para os campos que geram HTML colorido (a pílula).
 *
 * É contexto e não prop porque o `HtmlField` aparece em ~20 pontos entre os dois
 * construtores; passar a cor em cada um deixaria alguns para trás — que foi
 * exatamente o que houve: a prop `theme` existia, ninguém passava, e a pílula
 * saía laranja em funil de qualquer paleta.
 */
export const TemaFunilContext = createContext<string | null>(null);
/** Local previews must never upload assets to the server. Other builders keep their existing behavior. */
export const LocalDraftContext = createContext(false);

/**
 * Clareia um hex em direção ao branco. Deriva o segundo tom do degradê da pílula
 * a partir da cor do tema — o funil define UMA cor e o conjunto sai coerente.
 * Entrada inválida devolve a própria string: perde o degradê, nunca a cor.
 */
function clarear(hex: string, fator: number): string {
  const m = /^#?([\da-f]{6})$/i.exec((hex || "").trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * fator);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
function mdToHtml(md: string): string {
  let h = escHtml(md ?? "");
  h = h.replace(/==([^=\n]+)==/g, `<span data-pill="1" style="${PILL_CSS}">$1</span>`);
  h = h.replace(/\*\*([^*\n]+)\*\*/g, `<b data-bold="1" style="${BOLD_CSS}">$1</b>`);
  h = h.replace(/\*([^*\n]+)\*/g, `<b data-bold="1" style="${BOLD_CSS}">$1</b>`);
  h = h.replace(/\n/g, "<br>");
  return h;
}
function domToMd(el: Node): string {
  let out = "";
  el.childNodes.forEach((node) => {
    if (node.nodeType === 3) { out += node.textContent ?? ""; return; }
    if (node.nodeName === "BR") { out += "\n"; return; }
    const e = node as HTMLElement;
    const txt = e.textContent ?? "";
    if (e.dataset && e.dataset.pill) out += "==" + txt + "==";
    else if ((e.dataset && e.dataset.bold) || e.nodeName === "B" || e.nodeName === "STRONG") out += "**" + txt + "**";
    else if (e.nodeName === "DIV" || e.nodeName === "P") out += (out && !out.endsWith("\n") ? "\n" : "") + domToMd(e);
    else out += domToMd(e);
  });
  return out;
}

export function VisualRichField({ value, onChange, rows = 2, vars = ["nome", "estado", "cidade"] }: { value?: string; onChange: (v: string) => void; rows?: number; vars?: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  // marcação → HTML quando o valor muda DE FORA (e o campo não está focado)
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const html = mdToHtml(value ?? "");
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [value]);

  // serializa + LIMPA artefatos (marcadores vazios/duplicados que corrompiam o texto)
  const emit = () => {
    const el = ref.current; if (!el) return;
    let md = domToMd(el);
    md = md
      .replace(/\*\*\*\*/g, "").replace(/====/g, "")       // marcadores colados (ex: **a****b**)
      .replace(/\*\*\s*\*\*/g, " ").replace(/==\s*==/g, " ") // marcadores vazios
      .replace(/ {2,}/g, " ");
    onChange(md);
  };

  const apply = (kind: "bold" | "pill") => {
    const el = ref.current; if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer) || range.collapsed) return;
    if (!range.toString().trim()) return;
    // ANTI-ANINHAMENTO: se a seleção já está dentro de um nó do mesmo tipo, não envolve de novo
    let anc: Node | null = range.commonAncestorContainer;
    while (anc && anc !== el) {
      if (anc.nodeType === 1) {
        const e = anc as HTMLElement;
        if (kind === "bold" && (e.dataset?.bold || e.nodeName === "B" || e.nodeName === "STRONG")) return;
        if (kind === "pill" && e.dataset?.pill) return;
      }
      anc = anc.parentNode;
    }
    const node = document.createElement(kind === "pill" ? "span" : "b");
    node.setAttribute(kind === "pill" ? "data-pill" : "data-bold", "1");
    node.setAttribute("style", kind === "pill" ? PILL_CSS : BOLD_CSS);
    node.textContent = range.toString();
    range.deleteContents();
    range.insertNode(node);
    sel.removeAllRanges();
    el.normalize();
    emit();
  };

  const insertVar = (vn: string) => {
    const el = ref.current; if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount && el.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(`{${vn}}`));
      sel.collapseToEnd();
    } else {
      el.appendChild(document.createTextNode(`{${vn}}`));
    }
    emit();
  };

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-300 bg-white focus-within:border-neutral-900">
      <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50 px-2 py-1">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => apply("bold")} className="grid h-6 w-6 place-items-center rounded font-bold hover:bg-neutral-200" title="Negrito (realce na cor do tema)">B</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => apply("pill")} className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ background: "linear-gradient(95deg,#e8842a,#f4b85c)" }} title="Destaque (pílula)">Destaque</button>
        {vars.map((vn) => (
          <button key={vn} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertVar(vn)} className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100" title={`Inserir {${vn}}`}>{`{${vn}}`}</button>
        ))}
        <span className="ml-auto text-[10px] text-neutral-400">edição visual</span>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning onInput={emit} onBlur={emit}
        className="w-full whitespace-pre-wrap break-words px-3 py-2 text-sm text-neutral-900 outline-none"
        style={{ minHeight: `${Math.max(2, rows) * 1.6}rem` }} />
    </div>
  );
}

// ── Campo de imagem com upload ────────────────────────────────────────────
// Mesma história do HtmlField abaixo: vivia dentro do LayersBuilder e só o
// motor `layers` alcançava. Enquanto isso o StepEditor — que edita TODOS os
// blocos-hero, nos dois motores — pedia a imagem como URL crua digitada à mão.
// Agora os dois usam o mesmo campo: cola a URL ou envia o arquivo.
/**
 * Converte a imagem para webp de no máximo 1080px ANTES de enviar.
 *
 * Isto era feito no servidor com `sharp`, um módulo nativo que não carregava na
 * Vercel (binário linux ausente) e derrubava a rota inteira. O navegador faz o
 * mesmo trabalho com `canvas`, sem dependência alguma — e faz melhor: o arquivo
 * já sai pequeno da máquina, então uma capa de 8 MB não esbarra mais no teto de
 * 4,5 MB por requisição da Vercel, e sobe em uma fração do tempo.
 *
 * Devolve o arquivo original quando a conversão não compensa (ficou maior) ou
 * quando o navegador não colabora — subir a imagem crua é sempre melhor do que
 * não subir nada.
 */
async function paraWebp(file: File): Promise<File> {
  if (!/^image\/(png|jpe?g)$/i.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const escala = Math.min(1, 1080 / bmp.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.75));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
  } catch { return file; }
}

/** Duração de um arquivo de áudio local, em segundos, ou null se não der para ler. */
function duracaoDoArquivo(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const fim = (valor: number | null) => { URL.revokeObjectURL(url); resolve(valor); };
    const limite = setTimeout(() => fim(null), 6000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => { clearTimeout(limite); fim(Number.isFinite(audio.duration) ? audio.duration : null); };
    audio.onerror = () => { clearTimeout(limite); fim(null); };
    audio.src = url;
  });
}

/**
 * Som próprio (roleta e afins): envia um arquivo ou aceita um link HTTPS.
 * Confere formato, tamanho e duração ANTES de enviar, com as mesmas regras que
 * a rota /api/upload confere de novo no servidor (audio-upload.ts).
 */
export function AudioField({ value, onChange, rotulo }: { value?: string; onChange: (v: string | undefined) => void; rotulo: string }) {
  const local = useContext(LocalDraftContext);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const tocando = useRef<HTMLAudioElement | null>(null);
  const enviar = async (file: File) => {
    setErro("");
    if (!AUDIO_EXTENSOES.includes(extensaoDe(file.name))) { setErro(MENSAGENS_AUDIO.formato); return; }
    if (file.size > AUDIO_LIMITE_BYTES) { setErro(MENSAGENS_AUDIO.grande); return; }
    const duracao = await duracaoDoArquivo(file);
    if (duracao === null) { setErro(MENSAGENS_AUDIO.invalido); return; }
    if (duracao > AUDIO_DURACAO_MAXIMA) { setErro(MENSAGENS_AUDIO.longo); return; }
    setEnviando(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const resposta = await fetch("/api/upload", { method: "POST", body });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok || !dados.url) throw new Error(dados.error || "Não foi possível enviar o áudio. Tente de novo.");
      onChange(dados.url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o áudio. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };
  const ouvir = () => {
    try { tocando.current?.pause(); } catch { /* noop */ }
    if (!value) return;
    const audio = new Audio(value);
    tocando.current = audio;
    audio.play().catch(() => setErro("Não foi possível tocar este áudio. Confira o link ou envie o arquivo de novo."));
  };
  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-semibold text-neutral-500">{rotulo}</span>
      <input className={base} value={value ?? ""} placeholder="Som padrão (sintetizado)" readOnly={enviando}
        onChange={(e) => { setErro(""); onChange(e.target.value.trim() || undefined); }} aria-label={`${rotulo}: link do arquivo`} />
      <div className="flex flex-wrap items-center gap-2">
        <label className={`rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold ${local || enviando ? "opacity-50" : "cursor-pointer"}`}>
          {enviando ? "Enviando…" : "Enviar arquivo"}
          <input type="file" accept={AUDIO_ACCEPT} className="sr-only" disabled={local || enviando}
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void enviar(file); }} />
        </label>
        {value ? <button type="button" onClick={ouvir} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold">Ouvir</button> : null}
        {value ? <button type="button" onClick={() => { setErro(""); onChange(undefined); }} className="text-xs text-neutral-500 underline">Usar o som padrão</button> : null}
      </div>
      <span className="block text-[11px] leading-snug text-neutral-400">MP3, WAV, OGG, M4A, AAC ou WebM, até {AUDIO_LIMITE_BYTES / 1024 / 1024} MB e {AUDIO_DURACAO_MAXIMA} s.{local ? " No laboratório, use um link para testar sem enviar arquivos." : ""}</span>
      {erro ? <span role="alert" className="block text-[11px] font-semibold leading-snug text-red-600">{erro}</span> : null}
    </div>
  );
}

export function ImageField({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const localDraft = useContext(LocalDraftContext);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const embedded = localDraft && value?.startsWith("data:image/");
  const accept = localDraft ? "image/png,image/jpeg,image/webp,image/gif" : "image/*";
  const up = async (file: File) => {
    setBusy(true);
    setErro(null);
    try {
      if (localDraft) {
        if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
          setErro("Escolha uma imagem PNG, JPEG, WebP ou GIF.");
          return;
        }
        const image = await paraWebp(file);
        if (image.size > 1024 * 1024) {
          setErro("A imagem do rascunho precisa ter até 1 MB após a otimização.");
          return;
        }
        const bitmap = await createImageBitmap(image);
        bitmap.close();
        const src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject();
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(image);
        });
        onChange(src);
        return;
      }
      const fd = new FormData(); fd.append("file", await paraWebp(file));
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({} as { url?: string; error?: string }));
      if (j.url) onChange(j.url);
      else if (r.status === 401) setErro("Sessão expirada — recarregue a página e entre de novo.");
      else if (r.status === 413) setErro(`Arquivo grande demais (${(file.size / 1024 / 1024).toFixed(1)} MB). O limite é 4,5 MB.`);
      else setErro(j.error || `Falha no upload (HTTP ${r.status}).`);
    } catch {
      setErro(localDraft ? "Não foi possível ler esta imagem." : "Sem resposta do servidor. Verifique a conexão e tente de novo.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-1.5">
      <input aria-label="URL da imagem" disabled={busy} value={embedded ? "" : value || ""} onChange={(e) => onChange(e.target.value)}
        placeholder={embedded ? "Imagem local selecionada" : "https://…/imagem.jpg"} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs" />
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-neutral-900 px-2 py-1 text-xs font-semibold text-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ct-blue">
          {busy ? (localDraft ? "Lendo imagem…" : "Enviando…") : localDraft ? "Escolher imagem local" : "⬆ Upload"}
          <input type="file" accept={accept} disabled={busy} className="sr-only" onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void up(file);
          }} />
        </label>
        {embedded && <button type="button" disabled={busy} onClick={() => { setErro(null); onChange(""); }}
          className="text-xs text-ct-blue underline">Remover imagem local</button>}
      </div>
      {erro ? <p role="alert" className="rounded-md bg-red-50 px-2 py-1 text-[11px] leading-snug text-red-700">{erro}</p> : null}
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="mt-1 max-h-24 rounded-md border border-neutral-200 object-contain" />
      ) : null}
    </div>
  );
}

// ── Editor rico COMPLETO (o padrão do construtor, o que o cdb-01 usa) ─────
// Vivia dentro do LayersBuilder e só o motor `layers` alcançava. Mora aqui pra
// que os blocos-hero (raspadinha, pedida, medidor, VSL, parabéns) editem texto
// com as mesmas ferramentas — fonte, tamanho, cor, realce, pílula, alinhamento,
// entrelinhas e variáveis. Devolve HTML.
const EDITOR_FONTS = ["Poppins", "Arial", "Georgia", "Times New Roman", "Verdana", "Courier New"];
const EDITOR_SIZES = [12, 14, 16, 18, 20, 24, 28, 34, 40, 48];
const EDITOR_VARS: [string, string][] = [["{nome}", "Nome"], ["{cidade}", "Cidade"], ["{estado}", "Estado"]];

export function HtmlField({ value, onChange, theme: themeProp, rows = 2 }: { value?: string; onChange: (v: string) => void; theme?: string; rows?: number }) {
  // prop explícita > tema do funil > laranja histórico
  const themeContext = useContext(TemaFunilContext);
  const theme = themeProp ?? themeContext ?? "#ea580c";
  const ref = useRef<HTMLDivElement>(null);
  const saved = useRef<Range | null>(null);
  const [menu, setMenu] = useState<"para" | "var" | null>(null);
  // contentEditable NÃO-controlado: re-sincroniza só quando a mudança vem de fora E o
  // campo não está focado → enquanto digita nunca re-seta (não pula o cursor).
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    // Texto legado vem em marcação (`==pílula==`, `**negrito**`). Sem converter,
    // o editor mostraria os sinais crus na tela. Converte na EXIBIÇÃO; ao salvar
    // já sai HTML, e o `RichText` do funil aceita os dois formatos.
    const html = /<[a-z][^>]*>/i.test(value || "") ? (value || "") : mdToHtml(value || "");
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [value]);
  const push = () => { if (ref.current) onChange(ref.current.innerHTML); };
  const cmd = (c: string, v?: string) => { ref.current?.focus(); document.execCommand(c, false, v); push(); };
  // salva/restaura a seleção (pros color pickers, que tiram o foco do campo)
  const saveSel = () => { const s = window.getSelection(); if (s && s.rangeCount && ref.current?.contains(s.anchorNode)) saved.current = s.getRangeAt(0).cloneRange(); };
  const withSel = (fn: () => void) => { ref.current?.focus(); const s = window.getSelection(); if (saved.current && s) { s.removeAllRanges(); s.addRange(saved.current); } fn(); push(); };
  const setSize = (px: string) => {
    const el = ref.current; if (!el) return; el.focus();
    document.execCommand("fontSize", false, "7");
    el.querySelectorAll('font[size="7"]').forEach((f) => { f.removeAttribute("size"); (f as HTMLElement).style.fontSize = `${px}px`; });
    push();
  };
  const insHtml = (html: string) => { ref.current?.focus(); document.execCommand("insertHTML", false, html); push(); };
  const wrapPill = () => {
    const txt = window.getSelection()?.toString() || "destaque";
    // A cor sai do TEMA do funil, não de um laranja fixo. Antes o `#ea580c`
    // estava escrito aqui, então a pílula nascia laranja em funil de qualquer
    // paleta — e a prop `theme`, que já existia na assinatura, era ignorada.
    // O segundo tom do degradê é o próprio tema clareado e a sombra é o tema
    // com alfa: uma cor só define o conjunto inteiro.
    insHtml(`<span style="display:inline-block;margin:0 2px;border-radius:0.75rem;padding:0.1rem 0.6rem;font-weight:800;color:#fff;background:linear-gradient(95deg, ${theme}, ${clarear(theme, 0.22)});box-shadow:0 6px 16px -6px ${theme}8c;">${txt}</span>&nbsp;`);
  };
  // entrelinhas: aplica line-height nos parágrafos do bloco (ou envolve o texto solto)
  const setLineHeight = (lh: string) => {
    const el = ref.current; if (!el) return; el.focus();
    const blocks = el.querySelectorAll("p,h1,h2,h3,div,li");
    if (blocks.length) blocks.forEach((bl) => { (bl as HTMLElement).style.lineHeight = lh; });
    else el.innerHTML = `<div style="line-height:${lh}">${el.innerHTML}</div>`;
    push();
  };
  const b = "grid h-7 min-w-[28px] place-items-center rounded border border-neutral-300 px-1.5 text-xs hover:bg-neutral-50";
  return (
    <div className="ct-rich-editor">
      <div className="ct-rich-toolbar mb-1 flex flex-wrap items-center gap-1">
        <span onPointerDownCapture={saveSel} onKeyDownCapture={saveSel}><WorkspaceSelect label="Fonte" value="" preserveFocus onChange={value=>{if(value)withSel(()=>cmd('fontName',value));}} options={[{value:'',label:'Fonte'},...EDITOR_FONTS.map(value=>({value,label:value}))]} /></span>
        <span onPointerDownCapture={saveSel} onKeyDownCapture={saveSel}><WorkspaceSelect label="Tamanho do trecho" value="" preserveFocus onChange={value=>{if(value)withSel(()=>setSize(value));}} options={[{value:'',label:'Tamanho'},...EDITOR_SIZES.map(size=>({value:String(size),label:`${size}px`}))]} /></span>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("bold"); }} className={`${b} font-bold`}>B</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("italic"); }} className={`${b} italic`}>I</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("underline"); }} className={`${b} underline`}>U</button>
        <label className={`${b} relative cursor-pointer font-bold`} title="Cor da fonte" onMouseDown={saveSel}><span style={{ color: theme }}>A</span>
          <input type="color" onChange={(e) => withSel(() => document.execCommand("foreColor", false, e.target.value))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" /></label>
        <label className={`${b} relative cursor-pointer`} title="Cor de fundo (grifado)" onMouseDown={saveSel}>🖊
          <input type="color" onChange={(e) => withSel(() => document.execCommand("hiliteColor", false, e.target.value))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" /></label>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); wrapPill(); }} className={b} title="Caixa de destaque (pílula)">▭</button>
        <button type="button" onClick={() => setMenu(menu === "para" ? null : "para")} className={b} title="Parágrafo / alinhamento">⋮</button>
        <button type="button" onClick={() => setMenu(menu === "var" ? null : "var")} className={b} title="Inserir variável">{"{}"}</button>
      </div>
      {menu === "para" ? (
        <div className="mb-1 space-y-1 rounded border border-neutral-200 bg-white p-1.5">
          <div className="flex gap-1">
            <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("justifyLeft"); }} className={b} title="Esquerda">⬅</button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("justifyCenter"); }} className={b} title="Centro">↔</button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("justifyRight"); }} className={b} title="Direita">➡</button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-semibold text-neutral-400">Entrelinhas:</span>
            {([["1", "Simples"], ["1.15", "1,15"], ["1.5", "1,5"], ["2", "Duplo"]] as const).map(([lh, lbl]) => (
              <button key={lh} type="button" onMouseDown={(e) => { e.preventDefault(); setLineHeight(lh); }} className={b}>{lbl}</button>
            ))}
          </div>
        </div>
      ) : null}
      {menu === "var" ? (
        <div className="mb-1 flex flex-wrap gap-1 rounded border border-neutral-200 bg-white p-1">
          {EDITOR_VARS.map(([tok, lbl]) => (
            <button key={tok} type="button" onMouseDown={(e) => { e.preventDefault(); insHtml(tok); }} className="rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-50">{lbl}</button>
          ))}
        </div>
      ) : null}
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML || "")}
        style={{ minHeight: `${Math.max(2, rows) * 1.6}rem` }}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900" />
    </div>
  );
}

const base =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900";

/**
 * `<div>`, não `<label>`, de propósito.
 *
 * Um `<label>` sem `htmlFor` manda o clique para o PRIMEIRO controle rotulável
 * que houver dentro dele. Com o editor rico, esse primeiro controle é o
 * `<select>` de fonte — então clicar no texto para escrever roubava o foco para
 * a lista de fontes. Campo com vários controles não cabe num label só.
 */
export function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-semibold text-neutral-500">{label}</span>
      {children}
    </div>
  );
}

export function Text({ value, onChange, placeholder }: { value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className={base} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Area({ value, onChange, rows = 3 }: { value?: string; onChange: (v: string) => void; rows?: number }) {
  return <textarea className={base} rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
}

/**
 * Campo de texto com TOOLBAR de formatação (estilo inlead, Fase 1 do WYSIWYG).
 * Negrito (**…**) e Destaque/pílula (==…==) envolvem o texto selecionado.
 * A renderização desses marcadores já existe no funil (RichText).
 */
export function RichField({ value, onChange, rows = 2, placeholder, vars = ["nome"] }: { value?: string; onChange: (v: string) => void; rows?: number; placeholder?: string; vars?: string[] }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const wrap = (mark: string) => {
    const el = ref.current; if (!el) return;
    const v = value ?? "";
    const s = el.selectionStart ?? v.length, e = el.selectionEnd ?? v.length;
    const sel = v.slice(s, e) || "texto";
    onChange(v.slice(0, s) + mark + sel + mark + v.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + mark.length, s + mark.length + sel.length); });
  };
  const insert = (text: string) => {
    const el = ref.current; if (!el) return;
    const v = value ?? "";
    const s = el.selectionStart ?? v.length, e = el.selectionEnd ?? v.length;
    onChange(v.slice(0, s) + text + v.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + text.length, s + text.length); });
  };
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-300 bg-white focus-within:border-neutral-900">
      <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50 px-2 py-1">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap("**")} className="grid h-6 w-6 place-items-center rounded font-bold hover:bg-neutral-200" title="Negrito (realce na cor do tema)">B</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap("==")} className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ background: "linear-gradient(95deg,#e8842a,#f4b85c)" }} title="Destaque (pílula gradiente)">Destaque</button>
        {vars.map((vn) => (
          <button key={vn} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(`{${vn}}`)} className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100" title={`Inserir a variável {${vn}}`}>{`{${vn}}`}</button>
        ))}
        <span className="ml-auto text-[10px] text-neutral-400">selecione e clique</span>
      </div>
      <textarea ref={ref} className="w-full resize-y px-3 py-2 text-sm text-neutral-900 outline-none" rows={rows} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Num({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return <input type="number" className={base} value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} />;
}

export function Toggle({ label, value, onChange }: { label: string; value?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-neutral-900" />
      {label}
    </label>
  );
}

export function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return <WorkspaceSelect label="Selecionar" value={value} onChange={value=>onChange(value as T)} options={options}/>;
}

/** Lista editável de strings (galeria de imagens, slides de loading, etc.). */
export function StringList({ items, onChange, placeholder, addLabel }: { items: string[]; onChange: (v: string[]) => void; placeholder?: string; addLabel?: string }) {
  const set = (i: number, v: string) => onChange(items.map((x, k) => (k === i ? v : x)));
  const add = () => onChange([...items, ""]);
  const remove = (i: number) => onChange(items.filter((_, k) => k !== i));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className={base} value={it} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} />
          <button type="button" onClick={() => remove(i)} className="shrink-0 rounded-md px-2 py-1 text-sm text-red-500">✕</button>
        </div>
      ))}
      <button type="button" onClick={add} className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-semibold text-white">+ {addLabel ?? "Adicionar"}</button>
    </div>
  );
}

/** Lista de opções de pergunta (emoji + texto). */
export function OptionsList({ items, onChange }: { items: QuizOption[]; onChange: (v: QuizOption[]) => void }) {
  const set = (i: number, patch: Partial<QuizOption>) => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const add = () => onChange([...items, { label: "Nova opção" }]);
  const remove = (i: number) => onChange(items.filter((_, k) => k !== i));
  return (
    <div className="space-y-2">
      {items.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className={`${base} w-14 text-center`} value={o.emoji ?? ""} placeholder="🙂" onChange={(e) => set(i, { emoji: e.target.value })} />
          <input className={base} value={o.label} onChange={(e) => set(i, { label: e.target.value })} />
          <button type="button" onClick={() => remove(i)} disabled={items.length <= 1} className="shrink-0 rounded-md px-2 py-1 text-sm text-red-500 disabled:opacity-30">✕</button>
        </div>
      ))}
      <button type="button" onClick={add} className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-semibold text-white">+ Opção</button>
    </div>
  );
}
