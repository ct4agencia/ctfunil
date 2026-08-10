"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Moldura de celular do construtor — a MESMA para os 3 motores.
 *
 * Existiam duas implementações paralelas (FunnelBuilder e LayersBuilder) com
 * listas de aparelhos divergentes, modelos de estado diferentes (id vs índice) e
 * matemática de moldura diferente. Só uma delas neutralizava o `100dvh`, então o
 * preview do LayersBuilder mostrava barra de rolagem em TODA lâmina, mesmo vazia
 * — porque `dvh` mede a janela do navegador (~950px), não o aparelho (844px).
 *
 * Fica em `builder/` de propósito: é chunk admin, nunca entra em /q/[slug].
 */

export interface Device {
  id: string;
  nome: string;
  /** largura CSS, igual ao device toolbar do DevTools */
  w: number;
  /** altura CSS */
  h: number;
}

/**
 * Lista única. A antiga do LayersBuilder tinha TRÊS entradas idênticas
 * (Pixel 7, Galaxy S20 Ultra e Galaxy A51/71 são todas ~412×915), e os dois
 * construtores davam nomes diferentes ao mesmo aparelho.
 */
export const DEVICES: readonly Device[] = [
  { id: "compacto", nome: "Compacto", w: 360, h: 640 },
  { id: "galaxy-s8p", nome: "Galaxy S8+", w: 360, h: 740 },
  { id: "galaxy-s20", nome: "Galaxy S20", w: 360, h: 800 },
  { id: "iphone-se", nome: "iPhone SE", w: 375, h: 667 },
  { id: "iphone-12", nome: "iPhone 12 / 13 / 14", w: 390, h: 844 },
  { id: "pixel-7", nome: "Pixel 7 / Galaxy S20 Ultra", w: 412, h: 915 },
  { id: "iphone-xr", nome: "iPhone XR / 11", w: 414, h: 896 },
  { id: "iphone-pro-max", nome: "iPhone 14 / 15 Pro Max", w: 430, h: 932 },
  { id: "ipad-mini", nome: "iPad Mini", w: 768, h: 1024 },
] as const;

export const DEFAULT_DEVICE = "iphone-12";
/** espessura da borda da "moldura" do celular, em px */
const BORDER = 10;
/** folga entre a moldura e a barra de ferramentas, ao calcular o zoom "Ajustar" */
const FOLGA = 12;

export const getDevice = (id: string): Device =>
  DEVICES.find((d) => d.id === id) ?? DEVICES.find((d) => d.id === DEFAULT_DEVICE)!;

export type Zoom = number | "fit";

export interface DevicePreviewProps {
  deviceId: string;
  onDeviceChange: (id: string) => void;
  /** Zoom manual (0.5–1) ou "fit" para caber na altura disponível. */
  zoom?: Zoom;
  onZoomChange?: (z: Zoom) => void;
  /**
   * Modo largura fixa: escala para o celular caber em N px de largura.
   * Tem prioridade sobre `zoom` — é o modo do FunnelBuilder, que vive numa
   * coluna estreita.
   */
  fitWidth?: number;
  /** Mostra a barra de aparelho/dimensões/zoom. */
  toolbar?: boolean;
  onRestart?: () => void;
  /** Clique no fundo do celular (o LayersBuilder usa pra desselecionar bloco). */
  onBackdropClick?: () => void;
  /** CSS vars/fonte aplicadas ao contêiner que rola. */
  scrollStyle?: React.CSSProperties;
  /** O runner JÁ montado. Recebido como children pra este componente não
   *  importar QuizRunner + LayersRunner + ChatRunner juntos. */
  children: React.ReactNode;
}

export default function DevicePreview({
  deviceId, onDeviceChange, zoom = "fit", onZoomChange,
  fitWidth, toolbar = true, onRestart, onBackdropClick, scrollStyle, children,
}: DevicePreviewProps) {
  const dev = getDevice(deviceId);
  const areaRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [alturaArea, setAlturaArea] = useState(0);

  // Altura disponível: define o zoom no modo "Ajustar", pra moldura sempre caber
  // e a coluna de fora nunca ganhar uma SEGUNDA barra de rolagem.
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const medir = () => setAlturaArea(el.clientHeight);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const escala = fitWidth
    ? fitWidth / dev.w
    : zoom !== "fit"
      ? zoom
      // Antes do 1º ResizeObserver, `alturaArea` é 0 — sem este guard a escala
      // cairia no clamp mínimo e o celular apareceria minúsculo por um frame.
      : alturaArea > 0
        ? Math.min(1, Math.max(0.3, (alturaArea - (toolbar ? 46 : 0) - FOLGA - BORDER * 2) / dev.h))
        : 0.8;

  // A barra nativa some: ela rouba ~15px de LARGURA e o preview deixaria de ser
  // 1:1 com o celular. Quem avisa que há conteúdo abaixo da dobra é o próprio
  // <ScrollHint> do funil (components/quiz/ui.tsx) — a setinha pulsante que o
  // visitante também vê. Assim o preview mostra exatamente o que vai ao ar.
  const pct = Math.round(escala * 100);

  return (
    <div ref={areaRef} className="flex h-full min-h-0 flex-col items-center overflow-hidden p-4">
      {/* O `dvh` dentro do preview mediria a JANELA do construtor, não o aparelho
          — era isso que punha barra em toda lâmina. Os 3 motores usam as mesmas
          classes do Tailwind; os dois VSL usam style inline, daí o !important
          em .vsl-root. Escopado no .qf-device: não vaza pro funil publicado. */}
      <style>{`
        .qf-device{--qf-vh:${dev.h}px}
        .qf-device .min-h-\\[100dvh\\]{min-height:var(--qf-vh)}
        .qf-device .h-\\[100dvh\\]{height:var(--qf-vh)}
        .qf-device .min-h-screen{min-height:var(--qf-vh)}
        .qf-device .vsl-root{min-height:var(--qf-vh)!important}
        .qf-scroll{scrollbar-width:none;-ms-overflow-style:none}
        .qf-scroll::-webkit-scrollbar{width:0;height:0}
      `}</style>

      {toolbar ? (
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs shadow-sm">
          <span className="text-neutral-400">📱</span>
          <select
            value={dev.id}
            onChange={(e) => onDeviceChange(e.target.value)}
            className="rounded border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700"
          >
            {DEVICES.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          <span className="font-mono text-neutral-400">{dev.w} × {dev.h}</span>
          {onZoomChange && !fitWidth ? (
            <>
              <span className="text-neutral-200">|</span>
              <select
                value={zoom === "fit" ? "fit" : String(Math.round(zoom * 100))}
                onChange={(e) => onZoomChange(e.target.value === "fit" ? "fit" : Number(e.target.value) / 100)}
                className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600"
                title="Ajustar = a moldura sempre cabe na tela"
              >
                <option value="fit">Ajustar ({pct}%)</option>
                {[50, 60, 70, 80, 90, 100].map((v) => <option key={v} value={v}>{v}%</option>)}
              </select>
            </>
          ) : (
            <span className="font-mono text-neutral-300">{pct}%</span>
          )}
          {onRestart ? (
            <button onClick={onRestart} className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold" title="Voltar a lâmina ao estado inicial">
              ↻ Reiniciar
            </button>
          ) : null}
        </div>
      ) : null}

      {/* A moldura é o miolo escalado MAIS as duas bordas. Somar explicitamente
          evita o erro antigo: com box-sizing:border-box (padrão do Tailwind),
          width:340 + border:10 dava caixa de conteúdo 320 e cortava ~20px do
          celular em silêncio. */}
      <div
        className="relative shrink-0"
        style={{ width: Math.round(dev.w * escala) + BORDER * 2, height: Math.round(dev.h * escala) + BORDER * 2 }}
      >
        <div
          className="overflow-hidden rounded-[2rem] bg-white shadow-xl"
          style={{ border: `${BORDER}px solid #171717`, width: "100%", height: "100%" }}
        >
          <div
            className="qf-device origin-top-left"
            style={{ width: dev.w, height: dev.h, transform: `scale(${escala})` }}
          >
            <div
              ref={scrollRef}
              className="qf-scroll h-full overflow-y-auto transform-gpu"
              style={scrollStyle}
              onClick={onBackdropClick}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
