"use client";

import { useEffect, useState } from "react";
import { fireMetaEvent } from "@/lib/tracking";

/**
 * Barra de teste de pixel — aparece SÓ com ?debug=1 na URL (invisível pros
 * leads reais). Mostra o status do pixel e dispara eventos de teste pra
 * validar no Meta Pixel Helper / Events Manager / painel UTMify.
 */
export default function DebugBar() {
  const [show, setShow] = useState(false);
  const [st, setSt] = useState({ fbq: false, utmify: false, google: false });
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get("debug") !== "1") return;
    } catch {
      return;
    }
    setShow(true);
    const check = () =>
      setSt({
        fbq: typeof window.fbq === "function",
        utmify: !!(window as unknown as { pixelId?: string }).pixelId,
        google: !!(window as unknown as { googlePixelId?: string }).googlePixelId,
      });
    check();
    const t = setInterval(check, 1500);
    return () => clearInterval(t);
  }, []);

  if (!show) return null;

  function fire(name: string, params?: Record<string, unknown>) {
    fireMetaEvent(name, params);
    setLog((l) => [
      `${name} ${st.fbq ? "→ fbq ✓" : "→ SEM fbq (nada disparou)"}`,
      ...l,
    ].slice(0, 6));
  }

  const Dot = ({ ok }: { ok: boolean }) => (
    <span style={{ color: ok ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
      {ok ? "●" : "●"}
    </span>
  );
  const btn: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        left: 12,
        zIndex: 9999,
        width: 290,
        background: "rgba(15,23,42,0.96)",
        border: "1px solid #334155",
        borderRadius: 12,
        padding: 12,
        color: "#e2e8f0",
        fontFamily: "system-ui, sans-serif",
        boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
      }}
    >
      <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: 13 }}>
        🧪 Debug do Pixel
      </p>
      <div style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 8 }}>
        <div>
          <Dot ok={st.fbq} /> Pixel Meta (fbq):{" "}
          <strong>{st.fbq ? "detectado" : "NÃO detectado"}</strong>
        </div>
        <div>
          <Dot ok={st.utmify} /> UTMify (pixelId):{" "}
          <strong>{st.utmify ? "ativo" : "ausente"}</strong>
        </div>
        <div>
          <Dot ok={st.google} /> Pixel Google:{" "}
          <strong>{st.google ? "ativo" : "ausente"}</strong>
        </div>
      </div>
      {!st.fbq && (
        <p style={{ fontSize: 11, color: "#fbbf24", margin: "0 0 8px" }}>
          Sem fbq → os eventos abaixo não vão pro Meta navegador. Falta o
          Facebook Pixel ID nesta página.
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button style={btn} onClick={() => fire("PageView")}>PageView</button>
        <button style={btn} onClick={() => fire("Lead")}>Lead</button>
        <button style={btn} onClick={() => fire("InitiateCheckout")}>InitiateCheckout</button>
        <button style={btn} onClick={() => fire("ViewContent")}>ViewContent</button>
        <button
          style={btn}
          onClick={() => fire("Purchase", { value: 1, currency: "BRL" })}
        >
          Purchase (teste)
        </button>
      </div>
      {log.length > 0 && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: "#94a3b8",
            borderTop: "1px solid #334155",
            paddingTop: 6,
          }}
        >
          {log.map((l, i) => (
            <div key={i}>↳ {l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
