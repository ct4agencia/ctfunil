"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PALETTES } from "@/lib/quiz/theme";

/**
 * Seletor de cor único do CTFUNNEL — área saturação × brilho + trilha de matiz
 * + campo hex + sorteio, no estilo do "color generator".
 *
 * Substitui os ~31 `<input type="color">` soltos, hoje com 6 tamanhos de swatch
 * diferentes. Ficam de fora só os 2 da toolbar do editor rico
 * (`builder/fields.tsx:182,184`), que dependem de `document.execCommand` com a
 * seleção viva e quebrariam dentro de um popover.
 *
 * Três decisões que vieram de defeito real, não de gosto:
 *
 * - **Hex commita no blur/Enter, nunca por tecla.** Commitar a cada tecla faz o
 *   pai re-renderizar e sobrescrever o que está sendo digitado: ao digitar
 *   "ea580c", o estado intermediário "ea5" já é hex válido de 3 dígitos, vira
 *   "#eeaa55" e o campo é clobbado no meio da digitação.
 * - **Nunca dispara `onChange` na montagem.** Há pontos que guardam
 *   `"transparent"` ou vazio como valor semântico ("herda do tema"); um
 *   `onChange` de saída normalizaria isso para `#000000` sem ninguém pedir.
 * - **`preventDefault` no clique do painel.** Em ~11 dos pontos o campo fica
 *   dentro de um `<label>`, cujo comportamento de ativação reenvia o clique ao
 *   primeiro controle — o próprio botão do popover — e o painel fecharia
 *   sozinho. É o mesmo mecanismo que roubava o foco no campo de texto.
 */

/** Cor primária de cada paleta do funil + neutros de uso frequente. */
const SWATCHES: string[] = [
  ...PALETTES.map((p) => p.primary),
  "#16a34a", "#ef4444", "#f59e0b", "#3b82f6",
  "#ffffff", "#919191", "#171717",
];

/** `"#EA5"` | `"ea580c"` | `"#EA580C"` → `"#ea580c"`. Inválido → `""`. */
export function normalizarHex(v?: string): string {
  const s = (v || "").trim().toLowerCase();
  if (!s) return "";
  const h = s.startsWith("#") ? s : `#${s}`;
  if (/^#[0-9a-f]{3}$/.test(h)) return `#${h.slice(1).split("").map((c) => c + c).join("")}`;
  return /^#[0-9a-f]{6}$/.test(h) ? h : "";
}

// ── conversões ───────────────────────────────────────────────────────────────

function hexParaHsv(hex: string): { h: number; s: number; v: number } {
  const n = normalizarHex(hex) || "#000000";
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function hsvParaHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hx = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

const XADREZ = {
  backgroundImage:
    "linear-gradient(45deg,#e5e5e5 25%,transparent 25%,transparent 75%,#e5e5e5 75%),linear-gradient(45deg,#e5e5e5 25%,transparent 25%,transparent 75%,#e5e5e5 75%)",
  backgroundSize: "8px 8px",
  backgroundPosition: "0 0,4px 4px",
};

export default function ColorField({
  value,
  onChange,
  label,
  className = "h-9 w-full",
  allowEmpty = false,
}: {
  value?: string;
  onChange: (v: string) => void;
  label?: string;
  /** tamanho do botão-swatch; o padrão cobre a maioria dos usos */
  className?: string;
  /** vazio é significado ("herda do tema"), não erro */
  allowEmpty?: boolean;
}) {
  const hex = normalizarHex(value);
  const [aberto, setAberto] = useState(false);
  /** de que lado o painel abre; decidido no clique, pelo espaço que sobra */
  const [ancora, setAncora] = useState<"esquerda" | "direita">("esquerda");
  const [rascunho, setRascunho] = useState(hex);
  const painelId = useId();
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  const { h: matiz, s: sat, v: brilho } = hexParaHsv(hex || "#000000");

  // Sincroniza com o valor de fora, MAS não enquanto o campo está focado —
  // senão o texto some debaixo dos dedos de quem digita.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setRascunho(hex);
  }, [hex]);

  // fecha ao clicar fora / Esc
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !caixaRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      setAberto(false);
      gatilhoRef.current?.focus();
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc, true);
    };
  }, [aberto]);

  const aplicarDaArea = useCallback((ev: { clientX: number; clientY: number }) => {
    const el = areaRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
    const v = 1 - Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
    onChange(hsvParaHex(matiz, s, v));
  }, [matiz, onChange]);

  const pegarArea = (ev: React.PointerEvent) => {
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    aplicarDaArea(ev);
  };
  const moverArea = (ev: React.PointerEvent) => {
    if (ev.buttons !== 1) return;
    aplicarDaArea(ev);
  };

  const commitHex = () => {
    const n = normalizarHex(rascunho);
    if (n) onChange(n);
    else if (allowEmpty && !rascunho.trim()) onChange("");
    else setRascunho(hex);       // entrada inválida volta ao que era
  };

  const sortear = () =>
    onChange(hsvParaHex(Math.random() * 360, 0.55 + Math.random() * 0.4, 0.55 + Math.random() * 0.4));

  return (
    <div className="relative" ref={caixaRef}>
      <button
        type="button"
        ref={gatilhoRef}
        aria-expanded={aberto}
        aria-controls={aberto ? painelId : undefined}
        onClick={() => {
          /* Antes de abrir, decide de que lado o painel cabe. Ele tem 248px de
             largura fixa e nascia sempre ancorado à esquerda: no painel da
             direita do construtor não havia espaço, e ele vazava para fora da
             tela — metade do seletor ficava inalcançável.
             Medido no clique, não no render: a coluna do construtor rola, e a
             posição no momento da abertura é a única que vale. */
          const r = caixaRef.current?.getBoundingClientRect();
          if (r) setAncora(r.left + 248 > window.innerWidth - 12 ? "direita" : "esquerda");
          setAberto((o) => !o);
        }}
        title={hex || "Sem cor (herda do tema)"}
        aria-label={`${label || "Cor"}: ${hex || "Herdar do tema"}`}
        className={`block shrink-0 rounded-lg border border-neutral-300 transition hover:border-neutral-400 ${className}`}
        style={hex ? { background: hex } : XADREZ}
      />

      {aberto ? (
        <div
          id={painelId}
          role="group"
          aria-label={`Seletor de ${label || "cor"}`}
          onClick={(e) => e.preventDefault()}
          className={`ct-color-panel absolute top-[calc(100%+6px)] z-30 w-[248px] rounded-xl border border-neutral-200 bg-white p-2.5 shadow-lg ${ancora === "direita" ? "right-0" : "left-0"}`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-neutral-500">{label || "Cor"}</span>
            <button type="button" onClick={sortear}
              className="rounded-md border border-neutral-300 px-2 py-0.5 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-50">
              ⟳ Sortear
            </button>
          </div>

          <div
            ref={areaRef}
            onPointerDown={pegarArea}
            onPointerMove={moverArea}
            className="relative h-[132px] w-full cursor-crosshair rounded-lg"
            style={{
              backgroundColor: hsvParaHex(matiz, 1, 1),
              backgroundImage:
                "linear-gradient(to right,#fff,rgba(255,255,255,0)),linear-gradient(to top,#000,rgba(0,0,0,0))",
              touchAction: "none",
            }}
          >
            <span
              className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${sat * 100}%`, top: `${(1 - brilho) * 100}%` }}
            />
          </div>

          <input
            type="range" min={0} max={359} value={Math.round(matiz)}
            onChange={(e) => onChange(hsvParaHex(Number(e.target.value), sat || 1, brilho || 1))}
            aria-label="Matiz"
            className="mt-2 h-3 w-full cursor-pointer appearance-none rounded-full"
            style={{
              background:
                "linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)",
            }}
          />

          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-7 w-7 shrink-0 rounded-md border border-neutral-300"
              style={hex ? { background: hex } : XADREZ} />
            <input
              ref={inputRef}
              aria-label="Código hexadecimal"
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              onBlur={commitHex}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitHex(); } }}
              placeholder={allowEmpty ? "herda do tema" : "#000000"}
              spellCheck={false}
              className="w-full rounded-md border border-neutral-300 px-2 py-1 font-mono text-xs uppercase text-neutral-800 outline-none focus:border-neutral-900"
            />
            <button type="button" title="Copiar cor" aria-label="Copiar cor"
              onClick={() => { void navigator.clipboard?.writeText(hex).catch(() => {}); }}
              className="shrink-0 rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50">⧉</button>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {SWATCHES.map((c) => (
              <button key={c} type="button" onClick={() => onChange(c)} title={c} aria-label={`Selecionar ${c}`} aria-pressed={hex === c}
                className="h-5 w-5 rounded border border-neutral-300 transition hover:scale-110"
                style={{ background: c }} />
            ))}
            {allowEmpty ? (
              <button type="button" onClick={() => onChange("")} title="Sem cor (herda do tema)" aria-label="Herdar cor do tema"
                className="h-5 w-5 rounded border border-neutral-300 transition hover:scale-110" style={XADREZ} />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
