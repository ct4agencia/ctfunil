"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowRight, Gift, Lock } from "lucide-react";
import styles from "./black-friday.module.css";

const benefit = "GUIA COMPLETO + 80% OFF 🔥";
const storageKey = "bf_sonia_roleta_girou_v1";
const segments = ["GUIA\nCOMPLETO\n+ 80% OFF", "30%\nOFF", "APOSTILA\nVIP", "10%\nOFF", "LISTA DE\nMATERIAIS", "TENTE\nNOVAMENTE"];
const colors = ["#E3C48D", "#16834A", "#F6F1E7", "#C9A15C", "#E8743B"];

type CampaignWindow = Window & {
  dataLayer?: Record<string, unknown>[];
  fbq?: (type: "trackCustom", name: string, payload: Record<string, unknown>) => void;
};

function track(event: string, data: Record<string, string> = {}) {
  const browser = window as CampaignWindow;
  const payload = { event, campaign: "bf_sonia", ...data };
  browser.dataLayer ??= [];
  browser.dataLayer.push(payload);
  try {
    browser.fbq?.("trackCustom", event, payload);
  } catch {}
}

function playApplause(audio: AudioContext) {
  const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.05), audio.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 3;
  }
  const volume = audio.createGain();
  volume.gain.value = 0.22;
  volume.connect(audio.destination);
  for (let i = 0; i < 125; i++) {
    const clap = audio.createBufferSource();
    clap.buffer = buffer;
    clap.playbackRate.value = 0.8 + Math.random() * 0.6;
    clap.connect(volume);
    clap.start(audio.currentTime + 0.03 + Math.random() * 2.4);
  }
}

export default function BlackFriday({ roulette = false, redirectUrl }: { roulette?: boolean; redirectUrl?: string }) {
  const [phase, setPhase] = useState<"idle" | "spinning" | "done">("idle");
  const [rotation, setRotation] = useState(0);
  const [duration, setDuration] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [next, setNext] = useState("/upbf1/roleta");
  const dialog = useRef<HTMLDialogElement>(null);
  const audio = useRef<AudioContext>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  const viewed = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    track(roulette ? "roulette_view" : "presell_view");
    if (!roulette) {
      const source = new URLSearchParams(window.location.search);
      const campaign = new URLSearchParams();
      for (const [key, value] of source) {
        if (/^utm_[a-z0-9_]+$/i.test(key) || key === "fbclid" || key === "gclid") campaign.append(key, value);
      }
      if (campaign.size) setNext("/upbf1/roleta?" + campaign.toString());
      return;
    }
    try {
      if (localStorage.getItem(storageKey) === "1") {
        busy.current = true;
        setRotation(330);
        setPhase("done");
      }
    } catch {}
  }, [roulette]);

  useEffect(() => {
    if (phase === "done" && !dialog.current?.open) dialog.current?.showModal();
  }, [phase]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (audio.current) void audio.current.close().catch(() => {});
  }, []);

  function spin() {
    if (busy.current) return;
    busy.current = true;
    try { localStorage.setItem(storageKey, "1"); } catch {}
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced && typeof AudioContext !== "undefined") {
      try {
        audio.current = new AudioContext();
        void audio.current.resume().catch(() => {});
      } catch {}
    }
    const delay = reduced ? 0 : 5200;
    setDuration(delay);
    setRotation((reduced ? 0 : 2160) + 330);
    setPhase("spinning");
    track("roulette_spin_start");
    timer.current = setTimeout(() => {
      setCelebrate(!reduced);
      setPhase("done");
      if (audio.current?.state === "running") playApplause(audio.current);
      track("roulette_spin_complete");
      track("benefit_revealed", { benefit: "GUIA COMPLETO + 80% OFF" });
    }, delay + 100);
  }

  return (
    <main className={styles.page}>
      <div className={styles.banner} aria-hidden="true">
        <div className={styles.bannerTrack}>
          {[0, 1].map(copy => (
            <span className={styles.bannerRepeat} key={copy}>
              {"BLACK FRIDAY · ".repeat(6)}
            </span>
          ))}
        </div>
      </div>
      {!roulette ? (
        <>
          <p className={styles.kicker}>Um presente da Sônia</p>
          <div className={styles.images}>
            <img src="/upbf1/vela.jpg" alt="Vela aromática artesanal" />
            <img src="/upbf1/bolsa.jpg" alt="Bolsa de crochê" />
            <img src="/upbf1/resina.jpg" alt="Porta-copos de resina com flores" />
          </div>
          <h1>Seu benefício especial de <em>Black Friday</em> está esperando por você!</h1>
          <a className={styles.cta} href={next} onClick={() => track("presell_cta_click")}>RECEBER MEU BENEFÍCIO <ArrowRight aria-hidden="true" /></a>
          <p className={styles.note}>É só tocar uma vez no botão acima.</p>
        </>
      ) : (
        <div className={styles.roulette}>
          <h1>Chegou a hora de receber o seu <em>benefício especial!</em></h1>
          {phase !== "done" && <p>Gire a roleta para revelar o benefício desta Black Friday.</p>}
          <div className={styles.wheelFrame} aria-hidden="true">
            <svg className={styles.pointer} viewBox="0 0 44 46"><path d="M4 4h36L22 42z" fill="#E3C48D" stroke="#14110C" strokeWidth="3" strokeLinejoin="round" /></svg>
            <div className={styles.wheelRim}>
              <div className={styles.wheel} style={{ transform: `rotate(${rotation}deg)`, transitionDuration: `${duration}ms` }}>
                {segments.map((label, index) => <div className={styles.segment} key={label} style={{ "--segment": `${index * 60 + 30}deg` } as CSSProperties}><span>{label}</span></div>)}
              </div>
              <span className={styles.hub}><Gift size={32} /></span>
            </div>
          </div>
          {phase === "idle" && <span className={styles.hint} aria-hidden="true">TOQUE AQUI <ArrowDown size={20} /></span>}
          {phase === "done" ? <button className={styles.green} type="button" onClick={() => dialog.current?.showModal()}>VER MEU BENEFÍCIO</button> :
            <button className={styles.green} type="button" disabled={phase === "spinning"} onClick={spin}>{phase === "spinning" ? "GIRANDO…" : "GIRAR AGORA"}</button>}
          <dialog ref={dialog} className={styles.result} aria-labelledby="upbf1-result">
            {celebrate && <div className={styles.particles} aria-hidden="true">
              {Array.from({ length: 16 }, (_, i) => <i key={i} style={{ left: `${4 + i * 6}%`, background: colors[i % colors.length], animationDelay: `${i % 5 * 0.12}s` }} />)}
            </div>}
            <h2 id="upbf1-result">PARABÉNS!!!</h2>
            <p>Seu benefício está liberado.</p>
            <strong>{benefit}</strong>
            {redirectUrl ? (
              <>
                <a className={styles.green} href={redirectUrl} onClick={() => track("whatsapp_cta_click")}><Lock aria-hidden="true" /> DESBLOQUEAR BENEFÍCIO</a>
                <p>Você vai para o WhatsApp da Sônia.</p>
              </>
            ) : <p>O atendimento por WhatsApp está indisponível no momento.</p>}
            <form method="dialog"><button className={styles.close}>Fechar</button></form>
          </dialog>
        </div>
      )}
    </main>
  );
}
