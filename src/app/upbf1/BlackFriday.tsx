"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowDown, ArrowRight, Gift, Lock } from "lucide-react";
import RoletaInterativa from "@/components/quiz/RoletaInterativa";
import { fireRouletteConfetti, RouletteCelebration } from "@/components/quiz/RouletteCelebration";
import { playWin } from "@/lib/quiz/sound";
import styles from "./black-friday.module.css";

const benefit = "GUIA COMPLETO + 80% OFF 🔥";
const storageKey = "bf_sonia_roleta_girou_v1";
const segments = [
  { label: benefit, labelLines: ["GUIA", "COMPLETO", "+ 80% OFF 🔥"], labelSize: 7.5 },
  { label: "30% OFF" },
  { label: "APOSTILA VIP" },
  { label: "10% OFF" },
  { label: "LISTA DE MATERIAIS" },
  { label: "TENTE NOVAMENTE", labelLines: ["TENTE", "NOVAMENTE"], labelSize: 8 },
].map((segment, index) => ({ ...segment, color: index % 2 === 0 ? "#1c1915" : "#e3c48d" }));
const chrome = { rim: "#e3c48d", rimInner: "#8c6a33", pegColor: "#fff1d4", pointer: "#e3c48d", dark: true };

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

export default function BlackFriday({ roulette = false, redirectUrl, autoRedirectSeconds }: {
  roulette?: boolean; redirectUrl?: string;
  /** Com valor, o popup do presente leva ao WhatsApp sozinho depois destes segundos. */
  autoRedirectSeconds?: number;
}) {
  const [phase, setPhase] = useState<"idle" | "spinning" | "done">("idle");
  const [skipAnimation, setSkipAnimation] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [next, setNext] = useState("/upbf1/roleta");
  // Segundos que faltam para o redirecionamento automático; null = sem contagem.
  const [remaining, setRemaining] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const benefitButton = useRef<HTMLButtonElement>(null);
  const benefitTitle = useRef<HTMLHeadingElement>(null);
  const effects = useRef<HTMLCanvasElement>(null);
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
        setSkipAnimation(true);
        setPhase("done");
      }
    } catch {}
  }, [roulette]);

  // A contagem recomeça a cada abertura do popup. Fechar o popup a cancela.
  const startCountdown = useCallback(() => {
    if (redirectUrl && autoRedirectSeconds) setRemaining(autoRedirectSeconds);
  }, [redirectUrl, autoRedirectSeconds]);

  const openBenefit = useCallback(() => {
    if (!dialog.current || dialog.current.open) return;
    dialog.current.showModal();
    benefitTitle.current?.focus();
    startCountdown();
  }, [startCountdown]);

  useEffect(() => {
    if (remaining === null || !redirectUrl) return;
    if (remaining <= 0) {
      track("whatsapp_auto_redirect", { seconds: String(autoRedirectSeconds ?? 0) });
      window.location.assign(redirectUrl);
      return;
    }
    const timer = window.setTimeout(() => setRemaining(value => value === null ? null : value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining, redirectUrl, autoRedirectSeconds]);

  // Quem volta do WhatsApp pelo botão Voltar reencontra a página guardada pelo
  // navegador, com a contagem parada em zero: recomeça se o popup estiver aberto.
  useEffect(() => {
    function restore(event: PageTransitionEvent) {
      if (event.persisted && dialog.current?.open) startCountdown();
    }
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, [startCountdown]);

  useEffect(() => {
    if (phase !== "done" || dialog.current?.open) return;
    openBenefit();
    if (celebrate && effects.current) void fireRouletteConfetti(effects.current).catch(() => {});
  }, [phase, celebrate, openBenefit]);

  const finish = useCallback((animate = true) => {
    setCelebrate(animate);
    setPhase("done");
    if (animate) playWin();
    track("roulette_spin_complete");
    track("benefit_revealed", { benefit: "GUIA COMPLETO + 80% OFF" });
  }, []);

  function spin() {
    if (busy.current) return;
    busy.current = true;
    try { localStorage.setItem(storageKey, "1"); } catch {}
    track("roulette_spin_start");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSkipAnimation(true);
      finish(false);
      return;
    }
    setPhase("spinning");
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
          <h1>Seu presente especial de <em>Black Friday</em> está esperando por você!</h1>
          <a className={styles.cta} href={next} onClick={() => track("presell_cta_click")}>RECEBER MEU PRESENTE <ArrowRight aria-hidden="true" /></a>
          <p className={styles.note}>É só tocar uma vez no botão acima.</p>
        </>
      ) : (
        <div className={styles.roulette}>
          <h1>Chegou a hora de descobrir o seu <em>presente especial!</em></h1>
          {phase !== "done" && <p>Gire a roleta para revelar o presente desta Black Friday.</p>}
          <div className={styles.wheelFrame} aria-hidden="true">
            <RoletaInterativa key={String(skipAnimation)} segments={segments} vencedor={0}
              girando={phase === "spinning"} onFim={finish} chrome={chrome}
              hubR={66} hub="#0e0d0b" hubInner="#e3c48d" anguloInicial={skipAnimation ? 0 : -60} />
            <span className={styles.hubIcon}><Gift size={30} /></span>
          </div>
          {phase === "idle" && <span className={styles.hint} aria-hidden="true">TOQUE AQUI <ArrowDown size={20} /></span>}
          {phase === "done" ? <button ref={benefitButton} className={styles.green} type="button" onClick={openBenefit}>VER MEU PRESENTE</button> :
            <button className={styles.green} type="button" disabled={phase === "spinning"} onClick={spin}>{phase === "spinning" ? "GIRANDO…" : "GIRAR AGORA"}</button>}
          <dialog ref={dialog} className={styles.result} aria-labelledby="upbf1-result" onClose={() => {
            setRemaining(null);
            benefitButton.current?.focus();
          }}>
            <canvas ref={effects} className={styles.confetti} aria-hidden="true" />
            <RouletteCelebration />
            <h2 ref={benefitTitle} id="upbf1-result" tabIndex={-1}>PARABÉNS!!!</h2>
            <p>Você tirou:</p>
            <strong>{benefit}</strong>
            {redirectUrl ? (
              <>
                <a className={styles.green} href={redirectUrl} onClick={() => {
                  setRemaining(null);
                  track("whatsapp_cta_click");
                }}><Lock aria-hidden="true" /> DESBLOQUEAR PRESENTE</a>
                <p>{remaining === null ? "Você vai para o WhatsApp da Sônia." : remaining > 0 ?
                  `Você vai para o WhatsApp da Sônia em ${remaining} s.` : "Abrindo o WhatsApp da Sônia…"}</p>
              </>
            ) : <p>O atendimento por WhatsApp está indisponível no momento.</p>}
            <form method="dialog"><button className={styles.close}>Fechar</button></form>
          </dialog>
        </div>
      )}
    </main>
  );
}
