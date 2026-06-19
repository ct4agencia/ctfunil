"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { submitLead, fireMetaEvent } from "@/lib/tracking";
import type { VslTheme } from "@/lib/vsl-theme";
import type { VslPopup } from "@/lib/types";

export default function LeadPopup({
  vslId,
  cfg,
  theme,
  ctaGreen,
  onClose,
  onSubmitted,
}: {
  vslId: string;
  cfg: Required<VslPopup>;
  theme: VslTheme;
  ctaGreen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await submitLead({
      vslId,
      name: name.trim(),
      phone: phone.trim(),
      componentId: cfg.button_id,
    });
    fireMetaEvent("Lead");
    setLoading(false);
    // Mostra a mensagem de "obrigado"; só fecha se não houver mensagem.
    if (cfg.thank_you) {
      setDone(true);
      try {
        confetti({ particleCount: 130, spread: 75, origin: { y: 0.5 }, zIndex: 200 });
      } catch {}
    } else onSubmitted();
  }

  // "Fixado" desligado → fecha o popup automaticamente após alguns segundos.
  useEffect(() => {
    if (done && cfg.thank_you_sticky === false) {
      const t = setTimeout(onSubmitted, 4000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, cfg.thank_you_sticky]);

  const bg = cfg.bg_color || `linear-gradient(180deg, ${theme.bgMid}, ${theme.bgFrom})`;
  const text = cfg.text_color || "#ffffff";
  const accent =
    cfg.accent_color ||
    (ctaGreen
      ? "linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%)"
      : `linear-gradient(135deg, ${theme.dark} 0%, ${theme.primary} 50%, ${theme.light} 100%)`);

  const card = (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "100%",
        maxWidth: 460,
        margin: "0 auto",
        borderRadius: cfg.radius,
        padding: "26px 24px",
        background: bg,
        border: `1px solid ${theme.rgba(0.3)}`,
        boxShadow: cfg.blur ? "0 24px 80px rgba(0,0,0,0.5)" : "0 12px 40px rgba(0,0,0,0.35)",
        position: "relative",
        fontFamily: `"${cfg.font_family}", system-ui, sans-serif`,
        fontSize: cfg.font_size,
        color: text,
        textAlign: cfg.align,
        animation: cfg.blur ? "fade-in-up 0.35s ease-out" : "fade-in 0.4s ease-out",
      }}
    >
      {cfg.blur && (
        <button
          onClick={onClose}
          aria-label="Fechar"
          style={{
            position: "absolute",
            top: 10,
            right: 14,
            background: "none",
            border: "none",
            color: text,
            opacity: 0.7,
            fontSize: 22,
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}

      {done ? (
        <p style={{ fontSize: cfg.font_size + 1, fontWeight: 800, lineHeight: 1.5, color: text }}>
          {cfg.thank_you}
        </p>
      ) : (
        <>
      <h3 style={{ fontSize: cfg.font_size + 6, fontWeight: 900, lineHeight: 1.25, marginBottom: 8, color: text }}>
        {cfg.title}
      </h3>
      <p style={{ fontSize: cfg.font_size, opacity: 0.85, marginBottom: 20, lineHeight: 1.5, color: text }}>
        {cfg.subtitle}
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, textAlign: "left" }}>
        <input
          required
          placeholder="Seu nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle(theme, cfg, text)}
        />
        <input
          required
          type="tel"
          inputMode="tel"
          placeholder="Seu WhatsApp (com DDD)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={inputStyle(theme, cfg, text)}
        />
        <button
          type="submit"
          disabled={loading}
          className={
            [cfg.btn_pulse !== false && "fx-pulse", cfg.btn_shine !== false && "fx-shine"]
              .filter(Boolean)
              .join(" ") || undefined
          }
          style={{
            marginTop: 4,
            padding: "15px 20px",
            border: "none",
            borderRadius: Math.max(8, cfg.radius - 6),
            cursor: loading ? "default" : "pointer",
            fontWeight: 800,
            fontSize: cfg.font_size + 1,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            color: "#fff",
            background: accent,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Enviando..." : cfg.button}
        </button>
      </form>
        </>
      )}
    </div>
  );

  // blur ativo → overlay cobrindo a página. blur desativado → inline abaixo do vídeo.
  if (cfg.blur) {
    return (
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(6px)",
          animation: "fade-in 0.25s ease-out",
        }}
      >
        {card}
      </div>
    );
  }

  return <div style={{ padding: "8px 20px 4px" }}>{card}</div>;
}

function inputStyle(
  theme: VslTheme,
  cfg: Required<VslPopup>,
  text: string,
): React.CSSProperties {
  return {
    width: "100%",
    padding: "13px 16px",
    borderRadius: Math.max(8, cfg.radius - 8),
    border: `1px solid ${theme.rgba(0.3)}`,
    background: "rgba(255,255,255,0.08)",
    color: text,
    fontSize: cfg.font_size,
    fontFamily: `"${cfg.font_family}", system-ui, sans-serif`,
    outline: "none",
  };
}
