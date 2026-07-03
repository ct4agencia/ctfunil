"use client";

import { getSessionId } from "@/lib/tracking";

/**
 * Rastreia quanto da VSL a sessão assistiu (REQ-1/REQ-4 da spec vturb).
 * Escuta o player do VTurb (window.smartplayer) e manda beacon pro
 * /api/vsl-progress a cada avanço de 10 p.p. + ao sair da página.
 * Best-effort: sem player/sem embed → no-op; nunca quebra o funil.
 */

const PLAYER_RE = /players\/([0-9a-f]{24})/i;

export function extractPlayerId(html: string | null | undefined): string | null {
  const m = PLAYER_RE.exec(html ?? "");
  return m ? m[1].toLowerCase() : null;
}

type SmartInstance = {
  on: (ev: string, cb: () => void) => void;
  video: { currentTime: number; duration: number };
};

// Window.smartplayer já é declarado globalmente em components/vsl/BlockRenderer.tsx;
// aqui acessamos de forma estrutural pra não conflitar com aquela declaração.
function smartInstances(): SmartInstance[] | undefined {
  return (window as unknown as { smartplayer?: { instances?: SmartInstance[] } }).smartplayer?.instances;
}

export function attachVslWatch(opts: { funnelSlug: string; html?: string | null; disabled?: boolean }): () => void {
  const playerId = opts.disabled ? null : extractPlayerId(opts.html);
  if (!playerId || typeof window === "undefined") return () => {};

  const session_id = `${getSessionId()}::${opts.funnelSlug}`;
  let maxT = 0;
  let dur = 0;
  let lastSentPct = 0;
  let poll: ReturnType<typeof setTimeout> | null = null;
  let attempts = 0;

  const send = (force: boolean) => {
    if (dur <= 0 || maxT <= 0) return;
    const pct = Math.min(100, Math.round((maxT / dur) * 100));
    // marcos de 10 p.p. (o servidor deriva 25/50/75/100 + pitch do tempo real)
    if (!force && pct < lastSentPct + 10 && pct < 100) return;
    if (pct <= lastSentPct) return;
    lastSentPct = pct;
    const body = JSON.stringify({
      session_id, funnel_slug: opts.funnelSlug, player_id: playerId,
      t: Math.round(maxT), d: Math.round(dur),
    });
    try {
      const ok = navigator.sendBeacon?.("/api/vsl-progress", new Blob([body], { type: "application/json" }));
      if (!ok) {
        fetch("/api/vsl-progress", {
          method: "POST", body, keepalive: true,
          headers: { "Content-Type": "application/json" },
        }).catch(() => {});
      }
    } catch { /* best-effort */ }
  };

  const flush = () => send(true);

  const attach = () => {
    const player = smartInstances()?.[0];
    if (!player) {
      if (attempts < 90) { attempts++; poll = setTimeout(attach, 1000); }
      return;
    }
    player.on("timeupdate", () => {
      const t = player.video.currentTime;
      const d = player.video.duration || 0;
      if (d > 0) dur = d;
      if (t > maxT) { maxT = t; send(false); }
    });
  };

  attach();
  const onVis = () => { if (document.visibilityState === "hidden") flush(); };
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("pagehide", flush);

  return () => {
    if (poll) clearTimeout(poll);
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("pagehide", flush);
    flush();
  };
}
