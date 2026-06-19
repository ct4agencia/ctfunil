"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_CONTENT,
  DEFAULT_POPUP,
  type Vsl,
  type VslPopup,
} from "@/lib/types";
import { buildTheme } from "@/lib/vsl-theme";
import { collectTrackingParams, getSessionId, trackVsl, trackView, fireMetaEvent } from "@/lib/tracking";
import LeadPopup from "@/components/vsl/LeadPopup";
import DebugBar from "@/components/vsl/DebugBar";

// Tipagem do smartplayer (window) e do custom element (React 19 → React.JSX)
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

export default function VslView({ vsl }: { vsl: Vsl }) {
  const theme = useMemo(() => buildTheme(vsl.primary_color), [vsl.primary_color]);
  const c = { ...DEFAULT_CONTENT, ...(vsl.content ?? {}) };

  const imgGarantia = vsl.img_garantia || "/images/Garantia1.webp";
  const imgPagamentos = vsl.img_pagamentos || "/images/Pagamentos1.png";
  const imgSelo = vsl.img_selo || "/images/Selogoogle1.png";

  const playerId = vsl.vturb_player_id;
  const accountId = vsl.vturb_account_id;
  const scriptUrl =
    playerId && accountId
      ? `https://scripts.converteai.net/${accountId}/players/${playerId}/v4/player.js`
      : null;

  const popup: Required<VslPopup> = { ...DEFAULT_POPUP, ...(c.popup ?? {}) };

  const [showCTA, setShowCTA] = useState(false);
  const [showVagasBar, setShowVagasBar] = useState(false);
  const [vagas, setVagas] = useState(vsl.vagas_inicial);
  const [showPopup, setShowPopup] = useState(false);
  const heartbeatRef = useRef(0);
  const playFiredRef = useRef(false);
  const ctaFiredRef = useRef(false);
  const popupDoneRef = useRef(false);
  const vagasIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function maybeRevealPopup() {
    if (popup.enabled && !popupDoneRef.current) {
      popupDoneRef.current = true;
      setShowPopup(true);
    }
  }

  // Fundo escuro no body + registra visita (funil)
  useEffect(() => {
    document.body.classList.add("vsl-bg-dark");
    trackView(vsl.id);
    return () => document.body.classList.remove("vsl-bg-dark");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carrega o script do player VTurb
  useEffect(() => {
    if (!scriptUrl) return;
    if (!document.querySelector(`script[src="${scriptUrl}"]`)) {
      const script = document.createElement("script");
      script.src = scriptUrl;
      script.async = true;
      document.head.appendChild(script);
    }
  }, [scriptUrl]);

  // Listener do timeupdate do player
  useEffect(() => {
    if (!scriptUrl) return;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    function attach() {
      const player = window.smartplayer?.instances?.[0];
      if (!player) {
        if (attempts < 30) {
          attempts++;
          pollTimeout = setTimeout(attach, 1000);
        }
        return;
      }
      player.on("timeupdate", () => {
        const currentTime = player.video.currentTime;
        const duration = player.video.duration || 0;

        if (!playFiredRef.current && currentTime > 1) {
          playFiredRef.current = true;
          trackVsl(vsl.id, "play", { currentTime, duration });
        }
        if (duration > 0) {
          const decile = Math.floor((currentTime / duration) * 10) * 10;
          if (decile > heartbeatRef.current) {
            heartbeatRef.current = decile;
            trackVsl(vsl.id, "heartbeat", { currentTime, duration });
          }
        }
        if (currentTime >= vsl.vagas_reveal_at) setShowVagasBar(true);
        if (currentTime >= vsl.pitch_reveal_at && !ctaFiredRef.current) {
          ctaFiredRef.current = true;
          setShowCTA(true);
        }
        if (popup.enabled && currentTime >= popup.reveal_at) maybeRevealPopup();
      });
    }
    attach();
    return () => {
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [scriptUrl, vsl.id, vsl.pitch_reveal_at, vsl.vagas_reveal_at]);

  // Decremento das vagas (escassez)
  useEffect(() => {
    if (showVagasBar && !vagasIntervalRef.current) {
      vagasIntervalRef.current = setInterval(() => {
        setVagas((v) => {
          if (v >= vsl.vagas_limite) {
            if (vagasIntervalRef.current) clearInterval(vagasIntervalRef.current);
            return vsl.vagas_limite;
          }
          return Math.min(vsl.vagas_limite, v + Math.floor(Math.random() * 2) + 1);
        });
      }, 15000);
    }
    return () => {
      if (vagasIntervalRef.current) clearInterval(vagasIntervalRef.current);
    };
  }, [showVagasBar, vsl.vagas_limite]);

  // Fallback do popup: sem player VTurb, conta do carregamento da página.
  useEffect(() => {
    if (!popup.enabled || scriptUrl) return;
    const t = setTimeout(maybeRevealPopup, Math.max(0, popup.reveal_at) * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup.enabled, popup.reveal_at, scriptUrl]);

  // URL do checkout com UTMs + session_id no xcod (precisa estar no href antes do click)
  const checkoutHref = useMemo(() => {
    // Prioriza o link colado da Hotmart; senão monta a partir do Product ID.
    let base = vsl.checkout_url?.trim() || "";
    if (!base) {
      if (!vsl.hotmart_product_id) return "#";
      base = `https://pay.hotmart.com/${vsl.hotmart_product_id}?checkoutMode=10${
        vsl.hotmart_src ? `&src=${encodeURIComponent(vsl.hotmart_src)}` : ""
      }`;
    }
    try {
      const url = new URL(base);
      Object.entries(collectTrackingParams()).forEach(([k, v]) => {
        if (v && !url.searchParams.has(k)) url.searchParams.set(k, v);
      });
      const sid = getSessionId();
      if (sid) {
        const existing = url.searchParams.get("xcod") || "";
        url.searchParams.set("xcod", sid + (existing ? "|" + existing : ""));
      }
      return url.toString();
    } catch {
      return base;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vsl.checkout_url, vsl.hotmart_product_id, vsl.hotmart_src]);

  const hasCheckout = checkoutHref !== "#";

  function handleCheckoutClick() {
    trackVsl(vsl.id, "cta_click");
    fireMetaEvent("InitiateCheckout");
  }

  // Estilo do botão CTA — verde (recomendado) ou cor da marca
  const ctaGreen = vsl.cta_keep_green;
  const ctaStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 400,
    margin: "0 auto",
    display: "block",
    padding: "20px 28px",
    border: "none",
    borderRadius: 16,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 17,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    textAlign: "center",
    textDecoration: "none",
    color: "#fff",
    background: ctaGreen
      ? "linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%)"
      : `linear-gradient(135deg, ${theme.dark} 0%, ${theme.primary} 50%, ${theme.light} 100%)`,
    boxShadow: ctaGreen
      ? "0 10px 30px rgba(5,150,105,0.4)"
      : `0 10px 30px ${theme.rgba(0.4)}`,
    transition: "transform 0.25s ease, filter 0.25s ease",
  };

  const CtaButton = () => (
    <a
      href={checkoutHref}
      onClick={handleCheckoutClick}
      style={ctaStyle}
      className={ctaGreen ? "animate-cta-green" : undefined}
      onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.12)")}
      onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
    >
      {c.cta_text}
    </a>
  );

  return (
    <div
      className="vsl-root"
      style={{
        minHeight: "100dvh",
        background: `linear-gradient(180deg, ${theme.bgFrom} 0%, ${theme.bgMid} 40%, ${theme.bgFrom} 100%)`,
        color: theme.textLight,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Barra de VAGAS */}
      {showVagasBar && (
        <div
          style={{
            width: "100%",
            textAlign: "center",
            padding: "14px 20px",
            background: `linear-gradient(90deg, ${theme.dark}, ${theme.primary}33, ${theme.dark})`,
            borderBottom: `2px solid ${theme.rgba(0.3)}`,
            animation: "fade-in 0.5s ease-out",
          }}
        >
          <p style={{ fontWeight: 800, fontSize: 15, margin: 0, lineHeight: 1.5 }}>
            <span
              style={{
                background: "linear-gradient(90deg, #E8A838, #F5C842)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontWeight: 900,
                fontSize: 16,
              }}
            >
              {vagas} DAS {vsl.vagas_total} VAGAS
            </span>{" "}
            <span style={{ color: theme.lighter }}>{c.vagas_suffix}</span>
          </p>
        </div>
      )}

      {/* Player VTurb */}
      <div style={{ padding: "24px 20px 16px", width: "100%" }}>
        <div
          style={{
            width: "100%",
            maxWidth: 400,
            margin: "0 auto",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: `0 8px 40px ${theme.rgba(0.35)}`,
            border: `1px solid ${theme.rgba(0.2)}`,
          }}
        >
          {scriptUrl ? (
            <vturb-smartplayer
              id={`vid-${playerId}`}
              style={{ display: "block", margin: "0 auto", width: "100%", maxWidth: "400px" }}
            />
          ) : (
            <div
              style={{
                aspectRatio: "9 / 16",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#0008",
                color: theme.lighter,
                fontSize: 13,
                textAlign: "center",
                padding: 20,
              }}
            >
              Configure o Player ID e Account ID do VTurb no admin
              para exibir o vídeo.
            </div>
          )}
        </div>
      </div>

      {/* Popup de captura — abaixo do vídeo (inline) ou overlay (blur) */}
      {showPopup && (
        <LeadPopup
          vslId={vsl.id}
          cfg={popup}
          theme={theme}
          ctaGreen={ctaGreen}
          onClose={() => setShowPopup(false)}
          onSubmitted={() => setShowPopup(false)}
        />
      )}

      {/* CTA 1 + pagamentos */}
      {showCTA && (
        <div style={{ padding: "28px 20px 12px", textAlign: "center", animation: "fade-in-up 0.6s ease-out" }}>
          {hasCheckout && <CtaButton />}
          <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
            <img
              src={imgPagamentos}
              alt="Formas de pagamento"
              style={{ width: "100%", maxWidth: 280, height: "auto" }}
              loading="lazy"
            />
          </div>
        </div>
      )}

      {/* Garantia */}
      {showCTA && (
        <div style={{ padding: "40px 20px 28px", textAlign: "center", animation: "fade-in-up 0.6s ease-out 0.15s both" }}>
          <div
            style={{
              width: 60,
              height: 3,
              borderRadius: 2,
              margin: "0 auto 36px",
              background: `linear-gradient(90deg, ${theme.primary}, ${theme.light})`,
              opacity: 0.6,
            }}
          />
          <h2
            style={{
              fontWeight: 900,
              fontSize: 24,
              lineHeight: 1.25,
              marginBottom: 32,
              background: `linear-gradient(135deg, ${theme.light}, ${theme.lighter}, ${theme.primary})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              padding: "0 8px",
            }}
          >
            {c.guarantee_headline}
          </h2>

          <div style={{ width: "100%", maxWidth: 220, margin: "0 auto" }}>
            <img
              src={imgGarantia}
              alt="Garantia"
              style={{
                width: "100%",
                maxWidth: 220,
                height: "auto",
                margin: "0 auto",
                filter: "drop-shadow(0 8px 24px rgba(251,191,36,0.25))",
              }}
              loading="eager"
            />
          </div>

          <div
            style={{
              maxWidth: 360,
              margin: "32px auto 36px",
              background: theme.rgba(0.08),
              border: `1px solid ${theme.rgba(0.2)}`,
              borderRadius: 16,
              padding: "28px 22px",
            }}
          >
            <p style={{ fontWeight: 800, fontSize: 18, color: theme.lighter, lineHeight: 1.45, marginBottom: 20, textTransform: "uppercase" }}>
              {c.guarantee_intro}
            </p>
            <p style={{ fontSize: 15, color: theme.textLight, lineHeight: 1.7, fontWeight: 500 }}>
              {c.guarantee_body}
            </p>
          </div>

          {hasCheckout && <CtaButton />}

          <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 50,
                border: `1.5px solid ${theme.rgba(0.4)}`,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: 13 }}>🔒</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: theme.textLight, letterSpacing: "0.02em" }}>
                {c.guarantee_chip}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: "auto",
          padding: "40px 20px 24px",
          textAlign: "center",
          borderTop: `1px solid ${theme.rgba(0.15)}`,
          background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.4))",
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <img
            src={imgSelo}
            alt="Selo Google"
            style={{ width: "100%", maxWidth: 200, height: "auto", margin: "0 auto", opacity: 0.9 }}
            loading="lazy"
          />
        </div>
        <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10, lineHeight: 1.5 }}>
          Copyright {new Date().getFullYear()} - {c.copyright_name}
          <br />
          Todos os direitos reservados.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 20 }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>Termos de Uso</span>
          <span style={{ fontSize: 12, color: "#64748b" }}>Políticas de Privacidade</span>
        </div>
      </div>

      <DebugBar />
    </div>
  );
}
