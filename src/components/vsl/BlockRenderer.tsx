"use client";

import { useEffect, useMemo, useState } from "react";
import { type Block, type Vsl } from "@/lib/types";
import { buildTheme } from "@/lib/vsl-theme";
import { comRastreio } from "@/lib/quiz/rastreio";
import DebugBar from "@/components/vsl/DebugBar";
import confetti from "canvas-confetti";
import {
  collectTrackingParams,
  getSessionId,
  trackVsl,
  trackView,
  submitLead,
  fireMetaEvent,
} from "@/lib/tracking";

declare global {
  interface Window {
    smartplayer?: {
      instances?: Array<{
        video: HTMLVideoElement;
        on: (event: string, cb: () => void) => void;
      }>;
    };
  }
}
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "vturb-smartplayer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}

type Align = "left" | "center" | "right";
const marginFor = (a: Align) =>
  a === "left" ? "0 auto 0 0" : a === "right" ? "0 0 0 auto" : "0 auto";

// Confete na captura concluída (efeito de celebração).
function fireConfetti() {
  try {
    confetti({ particleCount: 130, spread: 75, origin: { y: 0.6 }, zIndex: 200 });
    setTimeout(
      () => confetti({ particleCount: 70, spread: 110, startVelocity: 35, origin: { y: 0.5 }, zIndex: 200 }),
      250,
    );
  } catch {
    // confete nunca quebra a captura
  }
}

type Theme = ReturnType<typeof buildTheme>;

// Barra unificada: modo "escassez" (conta vagas) ou "texto" (cabeçalho fixo).
function BarBlock({
  mode,
  text,
  inicial,
  limite,
  total,
  suffix,
  intervalMs,
  bgColor,
  textColor,
  numberColor,
  theme,
}: {
  mode: string;
  text: string;
  inicial: number;
  limite: number;
  total: number;
  suffix: string;
  intervalMs: number;
  bgColor: string;
  textColor: string;
  numberColor: string;
  theme: Theme;
}) {
  const [vagas, setVagas] = useState(inicial);
  useEffect(() => {
    if (mode !== "escassez" || vagas >= limite) return;
    const id = setInterval(() => {
      setVagas((v) => {
        if (v >= limite) {
          clearInterval(id);
          return limite;
        }
        return Math.min(limite, v + Math.floor(Math.random() * 2) + 1);
      });
    }, Math.max(2000, intervalMs || 15000));
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, limite, intervalMs]);

  const bg =
    bgColor || `linear-gradient(90deg, ${theme.dark}, ${theme.primary}33, ${theme.dark})`;
  const txt = textColor || theme.lighter;
  const numberStyle: React.CSSProperties = numberColor
    ? { color: numberColor, fontWeight: 900, fontSize: 16 }
    : {
        background: "linear-gradient(90deg, #E8A838, #F5C842)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        fontWeight: 900,
        fontSize: 16,
      };

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "14px 20px",
        background: bg,
        borderBottom: `2px solid ${theme.rgba(0.3)}`,
        animation: "fade-in 0.5s ease-out",
      }}
    >
      <p style={{ fontWeight: 800, fontSize: 15, margin: 0, lineHeight: 1.5, color: txt, textAlign: "center", width: "100%" }}>
        {mode === "texto" ? (
          text
        ) : (
          <>
            <span style={numberStyle}>
              {vagas} DAS {total} VAGAS
            </span>{" "}
            <span style={{ color: txt }}>{suffix}</span>
          </>
        )}
      </p>
    </div>
  );
}

// Bloco de captura (nome + WhatsApp) inline, com mensagem pós-captura.
function CaptureForm({
  vslId,
  cfg,
  theme,
}: {
  vslId: string;
  cfg: Record<string, unknown>;
  theme: Theme;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Se "fixado" desligado, some o card de obrigado após alguns segundos.
  useEffect(() => {
    if (done && cfg.thankYouSticky === false) {
      const t = setTimeout(() => setHidden(true), 4000);
      return () => clearTimeout(t);
    }
  }, [done, cfg.thankYouSticky]);

  const bg = (cfg.bgColor as string) || `linear-gradient(180deg, ${theme.bgMid}, ${theme.bgFrom})`;
  const text = (cfg.textColor as string) || "#ffffff";
  const accent =
    (cfg.accentColor as string) ||
    "linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%)";
  const radius = Number(cfg.radius ?? 16);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await submitLead({
      vslId,
      name: name.trim(),
      phone: phone.trim(),
      componentId: String(cfg.buttonId ?? ""),
    });
    fireMetaEvent("Lead");
    setLoading(false);
    setDone(true);
    fireConfetti();
  }

  const card: React.CSSProperties = {
    width: "100%",
    maxWidth: 460,
    margin: "0 auto",
    borderRadius: radius,
    padding: "26px 24px",
    background: bg,
    border: `1px solid ${theme.rgba(0.3)}`,
    color: text,
    textAlign: "center",
  };

  if (hidden) return null;
  if (done) {
    return (
      <div style={{ padding: "0 20px" }}>
        <div style={{ ...card, animation: "fade-in-up 0.45s ease-out" }}>
          <p style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.5, color: text }}>
            {String(cfg.thankYou ?? "Pronto! Recebemos seus dados.")}
          </p>
        </div>
      </div>
    );
  }

  const input: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    borderRadius: Math.max(8, radius - 8),
    border: `1px solid ${theme.rgba(0.3)}`,
    background: "rgba(255,255,255,0.08)",
    color: text,
    fontSize: 15,
    outline: "none",
  };

  return (
    <div style={{ padding: "0 20px" }}>
      <div style={card}>
        <h3 style={{ fontSize: 21, fontWeight: 900, lineHeight: 1.25, marginBottom: 8, color: text }}>
          {String(cfg.title ?? "")}
        </h3>
        <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 20, lineHeight: 1.5, color: text }}>
          {String(cfg.subtitle ?? "")}
        </p>
        <form onSubmit={submit} style={{ display: "grid", gap: 12, textAlign: "left" }}>
          <input required placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} style={input} />
          <input required type="tel" inputMode="tel" placeholder="Seu WhatsApp (com DDD)" value={phone} onChange={(e) => setPhone(e.target.value)} style={input} />
          <button
            type="submit"
            disabled={loading}
            className={
              [cfg.pulse !== false && "fx-pulse", cfg.shine !== false && "fx-shine"]
                .filter(Boolean)
                .join(" ") || undefined
            }
            style={{
              marginTop: 4,
              padding: "15px 20px",
              border: "none",
              borderRadius: Math.max(8, radius - 4),
              cursor: loading ? "default" : "pointer",
              fontWeight: 800,
              fontSize: 16,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              color: "#fff",
              background: accent,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Enviando..." : String(cfg.buttonLabel ?? "Enviar")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function BlockRenderer({
  vsl,
  blocks,
}: {
  vsl: Vsl;
  blocks: Block[];
}) {
  const theme = useMemo(() => buildTheme(vsl.primary_color), [vsl.primary_color]);
  const [elapsed, setElapsed] = useState(0);

  const playerId = vsl.vturb_player_id;
  const accountId = vsl.vturb_account_id;
  const hasVideoBlock = blocks.some((b) => b.type === "video" && b.enabled);
  const scriptUrl =
    hasVideoBlock && playerId && accountId
      ? `https://scripts.converteai.net/${accountId}/players/${playerId}/v4/player.js`
      : null;

  // fundo escuro no body + registra visita (funil)
  useEffect(() => {
    document.body.classList.add("vsl-bg-dark");
    trackView(vsl.id);
    return () => document.body.classList.remove("vsl-bg-dark");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // carrega player VTurb
  useEffect(() => {
    if (!scriptUrl) return;
    if (!document.querySelector(`script[src="${scriptUrl}"]`)) {
      const s = document.createElement("script");
      s.src = scriptUrl;
      s.async = true;
      document.head.appendChild(s);
    }
  }, [scriptUrl]);

  // relógio: tempo do vídeo se houver player; senão, tempo desde o load
  useEffect(() => {
    let poll: ReturnType<typeof setTimeout> | null = null;
    let tick: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;
    const heartbeat = { d: 0 };
    const playFired = { v: false };

    function attach() {
      const player = window.smartplayer?.instances?.[0];
      if (!player) {
        // Há vídeo: espera o player (NÃO usa relógio de página). Assim o reveal
        // fica preso ao tempo real do vídeo — se pausar/sair, o tempo congela.
        if (attempts < 90) {
          attempts++;
          poll = setTimeout(attach, 1000);
        }
        return;
      }
      player.on("timeupdate", () => {
        const t = player.video.currentTime;
        const d = player.video.duration || 0;
        setElapsed(t);
        if (!playFired.v && t > 1) {
          playFired.v = true;
          trackVsl(vsl.id, "play", { currentTime: t, duration: d });
        }
        if (d > 0) {
          const dec = Math.floor((t / d) * 10) * 10;
          if (dec > heartbeat.d) {
            heartbeat.d = dec;
            trackVsl(vsl.id, "heartbeat", { currentTime: t, duration: d });
          }
        }
      });
    }

    if (scriptUrl) attach();
    else tick = setInterval(() => setElapsed((e) => e + 1), 1000);

    return () => {
      if (poll) clearTimeout(poll);
      if (tick) clearInterval(tick);
    };
  }, [scriptUrl, vsl.id]);

  // checkout href (UTMs + session)
  const checkoutHref = useMemo(() => {
    let base = vsl.checkout_url?.trim() || "";
    if (!base && vsl.hotmart_product_id) {
      base = `https://pay.hotmart.com/${vsl.hotmart_product_id}?checkoutMode=10`;
    }
    if (!base) return "";
    try {
      const url = new URL(base);
      Object.entries(collectTrackingParams()).forEach(([k, v]) => {
        if (v && !url.searchParams.has(k)) url.searchParams.set(k, v);
      });
      const sid = getSessionId();
      if (sid) {
        const ex = url.searchParams.get("xcod") || "";
        url.searchParams.set("xcod", sid + (ex ? "|" + ex : ""));
      }
      return url.toString();
    } catch {
      return base;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vsl.checkout_url, vsl.hotmart_product_id]);

  function renderBlock(b: Block) {
    if (!b.enabled) return null;
    const p = b.props as Record<string, unknown>;
    const revealAfter = Number(p.revealAfter ?? 0);
    if (revealAfter > 0 && elapsed < revealAfter) return null;

    switch (b.type) {
      case "text": {
        const align = (p.align as Align) ?? "center";
        return (
          <p
            key={b.id}
            style={{
              maxWidth: Number(p.maxWidth ?? 600),
              margin: marginFor(align),
              color: (p.color as string) || theme.textLight,
              fontSize: Number(p.fontSize ?? 16),
              fontWeight: Number(p.weight ?? 600),
              textAlign: align,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              padding: "0 20px",
            }}
          >
            {String(p.content ?? "")}
          </p>
        );
      }
      case "destaque": {
        const align = (p.align as Align) ?? "center";
        return (
          <div key={b.id} style={{ padding: "0 20px", textAlign: align }}>
            <span
              style={{
                display: "inline-block",
                background: (p.bgColor as string) || "#F5C842",
                color: (p.textColor as string) || "#0a1428",
                padding: "8px 16px",
                borderRadius: Number(p.radius ?? 8),
                fontSize: Number(p.fontSize ?? 16),
                fontWeight: Number(p.weight ?? 800),
                lineHeight: 1.4,
              }}
            >
              {String(p.content ?? "")}
            </span>
          </div>
        );
      }
      case "image": {
        const align = (p.align as Align) ?? "center";
        if (!p.url) return null;
        return (
          <div key={b.id} style={{ padding: "0 20px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={String(p.url)}
              alt=""
              style={{
                width: "100%",
                maxWidth: Number(p.maxWidth ?? 400),
                margin: marginFor(align),
                borderRadius: Number(p.radius ?? 12),
                display: "block",
              }}
              loading="lazy"
            />
          </div>
        );
      }
      case "button": {
        const align = (p.align as Align) ?? "center";
        const isCheckout = (p.linkType ?? "checkout") === "checkout";
        const href = isCheckout ? checkoutHref : String(p.url || "#");
        if (isCheckout && !checkoutHref) return null; // sem checkout, esconde
        const green = !p.bgColor;
        return (
          <div key={b.id} style={{ padding: "8px 20px", textAlign: align }}>
            <a
              href={href || "#"}
              target={isCheckout ? "_blank" : undefined}
              rel={isCheckout ? "noopener" : undefined}
              onClick={(e) => {
                trackVsl(vsl.id, "cta_click");
                if (isCheckout) {
                  fireMetaEvent("InitiateCheckout");
                  // Abre o checkout via JS pra driblar interceptação do
                  // launcher da Hotmart (que captura cliques em pay.hotmart).
                  // Lê o href do DOM, não da closure: a UTMify reescreve o
                  // atributo pra anexar o rastreio, e o valor da closure é o
                  // original, sem UTM. Ver `rastreio.ts`.
                  const destino = e.currentTarget.getAttribute("href") || href;
                  if (destino) {
                    e.preventDefault();
                    window.open(comRastreio(destino), "_blank", "noopener");
                  }
                }
              }}
              className={
                [p.pulse && "fx-pulse", p.shine && "fx-shine"]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              style={{
                width: "100%",
                maxWidth: 400,
                margin: marginFor(align),
                display: "block",
                padding: "20px 28px",
                borderRadius: Number(p.radius ?? 16),
                fontWeight: 800,
                fontSize: 17,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                textAlign: "center",
                textDecoration: "none",
                color: (p.textColor as string) || "#fff",
                background: green
                  ? "linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%)"
                  : (p.bgColor as string),
                boxShadow: green
                  ? "0 10px 30px rgba(5,150,105,0.4)"
                  : `0 10px 30px ${theme.rgba(0.4)}`,
              }}
            >
              {String(p.label ?? "Comprar")}
            </a>
          </div>
        );
      }
      case "video": {
        if (!scriptUrl) {
          return (
            <div key={b.id} style={{ padding: "0 20px" }}>
              <div
                style={{
                  maxWidth: Number(p.maxWidth ?? 400),
                  margin: "0 auto",
                  aspectRatio: "9 / 16",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#0008",
                  color: theme.lighter,
                  fontSize: 13,
                  textAlign: "center",
                  padding: 20,
                  borderRadius: 12,
                }}
              >
                Configure Player ID e Account ID do VTurb (aba Conteúdo).
              </div>
            </div>
          );
        }
        return (
          <div key={b.id} style={{ padding: "0 20px" }}>
            <div
              style={{
                width: "100%",
                maxWidth: Number(p.maxWidth ?? 400),
                margin: "0 auto",
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: `0 8px 40px ${theme.rgba(0.35)}`,
                border: `1px solid ${theme.rgba(0.2)}`,
              }}
            >
              <vturb-smartplayer
                id={`vid-${playerId}`}
                style={{ display: "block", margin: "0 auto", width: "100%", maxWidth: "400px" }}
              />
            </div>
          </div>
        );
      }
      case "vagas":
        return (
          <BarBlock
            key={b.id}
            mode={String(p.mode ?? "escassez")}
            text={String(p.text ?? "")}
            inicial={Number(p.inicial ?? 37)}
            limite={Number(p.limite ?? 48)}
            total={Number(p.total ?? 50)}
            suffix={String(p.suffix ?? "")}
            intervalMs={Number(p.intervalMs ?? 15000)}
            bgColor={String(p.bgColor ?? "")}
            textColor={String(p.textColor ?? "")}
            numberColor={String(p.numberColor ?? "")}
            theme={theme}
          />
        );
      case "capture":
        return <CaptureForm key={b.id} vslId={vsl.id} cfg={p} theme={theme} />;
      case "spacer":
        return <div key={b.id} style={{ height: Number(p.height ?? 32) }} />;
      case "html":
        return (
          <div
            key={b.id}
            style={{ padding: "0 20px" }}
            dangerouslySetInnerHTML={{ __html: String(p.code ?? "") }}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div
      className="vsl-root"
      style={{
        minHeight: "100dvh",
        background: `linear-gradient(180deg, ${theme.bgFrom} 0%, ${theme.bgMid} 40%, ${theme.bgFrom} 100%)`,
        color: theme.textLight,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        paddingTop: 0,
        paddingBottom: 40,
      }}
    >
      {blocks.map(renderBlock)}
      <DebugBar />
    </div>
  );
}
