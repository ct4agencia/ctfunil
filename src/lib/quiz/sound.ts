"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Efeitos sonoros da roleta via Web Audio (sem arquivos). Tudo best-effort:
 * se o navegador bloquear/áudio falhar, nunca quebra. O AudioContext é criado
 * no gesto do usuário (clique em "Girar"), evitando bloqueio de autoplay.
 */

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new C();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Um "tique" curto (passagem do pino). */
function tick(c: AudioContext, at: number, freq: number) {
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "triangle";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + 0.07);
}

/** Agenda os tiques ao longo do giro, desacelerando (easeOutCubic inverso). */
export function playSpinTicks(durationMs: number, n = 30): void {
  const c = ac();
  if (!c) return;
  const dur = durationMs / 1000;
  for (let m = 1; m <= n; m++) {
    const p = m / n;
    const t = dur * (1 - Math.pow(1 - p, 1 / 3));
    tick(c, t, 1000 + (1 - p) * 600);
  }
}

/** Chime de vitória (arpejo ascendente). */
export function playWin(at = 0): void {
  const c = ac();
  if (!c) return;
  const base = c.currentTime + at;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const t = base + i * 0.12;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + 0.55);
  });
}

/** Click suave de avanço entre lâminas (Imersão). */
export function playClick(): void {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(620, t);
  o.frequency.exponentialRampToValueAtTime(880, t + 0.05);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + 0.14);
}

/** Trilha sonora em loop (background). Retorna o elemento p/ controle. */
let music: HTMLAudioElement | null = null;
export function startMusic(url: string, volume = 0.25): void {
  try {
    if (music && music.src.includes(url)) return;
    stopMusic();
    music = new Audio(url);
    music.loop = true;
    music.volume = volume;
    music.play().catch(() => {});
  } catch {
    /* best-effort */
  }
}
export function stopMusic(): void {
  try { music?.pause(); music = null; } catch { /* noop */ }
}

/** Toca um arquivo de áudio por URL (som customizado). */
export function playUrl(url: string): void {
  try {
    const a = new Audio(url);
    a.play().catch(() => {});
  } catch {
    /* best-effort */
  }
}

/**
 * Arquivo de som pronto para tocar sem atraso (som próprio da roleta).
 *
 * O arquivo é carregado ao montar a lâmina, e não no clique: o som do giro tem
 * de sair junto com o gesto, não depois dele. `liberar()` deve ser chamado
 * DENTRO do toque em "Girar": no iOS, um áudio que nunca tocou num gesto não
 * pode tocar depois sozinho (o som da vitória chega segundos mais tarde).
 * Se o arquivo falhar, `falhou` vira true e quem usa volta ao som sintetizado.
 */
export function useAudioPronto(url?: string) {
  const elemento = useRef<HTMLAudioElement | null>(null);
  const [info, setInfo] = useState<{ url: string; duracao?: number; falhou?: boolean } | null>(null);
  useEffect(() => {
    if (!url || typeof Audio === "undefined") { elemento.current = null; return; }
    const audio = new Audio();
    audio.preload = "auto";
    const meta = () => setInfo({ url, duracao: Number.isFinite(audio.duration) ? audio.duration : undefined });
    const erro = () => setInfo({ url, falhou: true });
    audio.addEventListener("loadedmetadata", meta);
    audio.addEventListener("error", erro);
    audio.src = url;
    elemento.current = audio;
    return () => {
      audio.removeEventListener("loadedmetadata", meta);
      audio.removeEventListener("error", erro);
      audio.pause();
      elemento.current = null;
    };
  }, [url]);
  const atual = info?.url === url ? info : null;
  const falhou = Boolean(url && atual?.falhou);

  /** Toca do começo. Resolve false se o navegador recusar: aí vale o som sintetizado. */
  const tocar = useCallback((): Promise<boolean> => {
    const audio = elemento.current;
    if (!audio) return Promise.resolve(false);
    try {
      audio.muted = false;
      audio.currentTime = 0;
      return audio.play().then(() => true, () => false);
    } catch {
      return Promise.resolve(false);
    }
  }, []);

  /** Destrava o áudio no gesto do usuário, sem som, para tocar depois. */
  const liberar = useCallback(() => {
    const audio = elemento.current;
    if (!audio) return;
    try {
      audio.muted = true;
      void audio.play().then(() => { audio.pause(); audio.currentTime = 0; audio.muted = false; }, () => { audio.muted = false; });
    } catch { /* best-effort */ }
  }, []);

  const parar = useCallback(() => { try { elemento.current?.pause(); } catch { /* noop */ } }, []);

  return { ativo: Boolean(url) && !falhou, falhou, duracao: atual?.duracao, tocar, liberar, parar };
}
