"use client";

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
