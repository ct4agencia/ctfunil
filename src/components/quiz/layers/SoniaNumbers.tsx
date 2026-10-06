"use client";

import { useEffect, useId, useRef, type Dispatch, type SetStateAction } from "react";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { SONIA_DEFAULTS, initialSoniaState, pickSonia, soniaCells, soniaConfigError, soniaLabel, type SoniaConfig, type SoniaState } from "@/lib/quiz/layers/sonia";
import styles from "./SoniaNumbers.module.css";

const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap", preload: false, variable: "--sonia-display" });
const body = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", preload: false, variable: "--sonia-body" });
const Lock = () => <svg width="10" height="12" viewBox="0 0 11 12" aria-hidden="true"><rect x="1" y="5" width="9" height="7" rx="1.5" fill="currentColor" /><path d="M3 5V3.5a2.5 2.5 0 0 1 5 0V5" stroke="currentColor" strokeWidth="1.4" fill="none" /></svg>;

/** Renderer de um layer-hero; navegação e estado durável pertencem ao runner. */
export default function SoniaNumbers({ config, state, setState, preview, destination, navigate, back, trackSelection, allowExternalNavigation = false }: {
  config: SoniaConfig;
  state: SoniaState;
  setState: Dispatch<SetStateAction<SoniaState>>;
  preview: boolean;
  allowExternalNavigation?: boolean;
  destination: string | null;
  navigate: (destination: string) => void;
  back?: () => void;
  trackSelection: (value: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const availableX = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const confirmTitle = useRef<HTMLHeadingElement>(null);
  const confirmedStatus = useRef<HTMLParagraphElement>(null);
  const confirming = useRef(false);
  const interactionLocked = useRef(false);
  const confettiCanvas = useRef<HTMLCanvasElement>(null);
  const uid = useId();
  const error = soniaConfigError(config);
  const x = config.numeroX ?? SONIA_DEFAULTS.numeroX;
  const y = config.numeroY ?? SONIA_DEFAULTS.numeroY;
  const closeModal = () => { interactionLocked.current = false; setState((s) => ({ ...s, modal: null })); };

  // Native top-layer dialog: trap, Escape, inert background (incl. builder) and
  // focus restore. Y is disabled after clicking, so restore to X instead.
  useEffect(() => {
    const el = dialog.current;
    if (!state.modal || !el) return;
    const trigger = document.activeElement as HTMLElement | null;
    const fallback = availableX.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el.showModal();
    primary.current?.focus();
    let cancelled = false;
    let stopConfetti: (() => void) | undefined;
    const canvas = confettiCanvas.current;
    if (state.modal === "x" && canvas && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      import("canvas-confetti").then(({ default: confetti }) => {
        if (cancelled) return;
        const fire = confetti.create(canvas, { resize: true, useWorker: false });
        fire({ particleCount: 160, spread: 360, startVelocity: 35, gravity: .7, origin: { x: .5, y: .45 }, colors: ["#D6AC54", "#E6C274", "#F3DCA0", "#F7F2E8", "#C99A42", "#7FA2D6"], disableForReducedMotion: true });
        stopConfetti = () => fire.reset();
      });
    }
    return () => {
      cancelled = true;
      stopConfetti?.();
      el.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected && !(trigger instanceof HTMLButtonElement && trigger.disabled)) trigger.focus();
      else fallback?.focus();
    };
  }, [state.modal]);

  const pick = (number: number) => {
    if (interactionLocked.current || state.modal || error) return;
    const next = pickSonia(config, state, number);
    if (next === state) return;
    interactionLocked.current = true;
    if (number === x && !state.selected) trackSelection(soniaLabel(x));
    setState(next);
  };
  const goConfirm = () => {
    if (!state.selected || state.screen !== "select" || error || confirming.current) return;
    dialog.current?.close();
    interactionLocked.current = false;
    // Configured destinations continue directly through the existing engine.
    // Only the destination-less demo uses the reference confirmation screen.
    if (destination && !(preview && !allowExternalNavigation && /^https?:\/\//i.test(destination))) {
      confirming.current = true;
      setState((s) => ({ ...s, modal: null, screen: "select" }));
      navigate(destination);
      return;
    }
    setState((s) => ({ ...s, modal: null, screen: "confirm" }));
    requestAnimationFrame(() => confirmTitle.current?.focus());
  };
  const confirm = () => {
    if (!state.selected || error || confirming.current || state.confirmed) return;
    // No reservation service exists. A configured route only navigates; an
    // absent/external preview target stays demonstrative with no side effects.
    if (!destination && !preview) return;
    confirming.current = true;
    if (destination && !(preview && !allowExternalNavigation && /^https?:\/\//i.test(destination))) {
      setState((s) => ({ ...s, modal: null, screen: "select" }));
      navigate(destination);
    } else {
      setState((s) => ({ ...s, confirmed: true }));
      requestAnimationFrame(() => confirmedStatus.current?.focus());
    }
  };
  const returnToNumbers = () => {
    confirming.current = false;
    interactionLocked.current = false;
    setState((s) => ({ ...s, screen: "select", confirmed: false }));
    requestAnimationFrame(() => availableX.current?.focus());
  };
  const reset = () => {
    confirming.current = false;
    interactionLocked.current = false;
    setState({ ...initialSoniaState });
    requestAnimationFrame(() => title.current?.focus());
  };

  return <div className={`${styles.root} ${display.variable} ${body.variable}`}>
    <header className={styles.header}>
      {/* Original transparent PNG, dimensions and ratio preserved. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/sorteio-da-sonia/logo-sorteio-da-sonia.png" alt="Sorteio da Sônia" width={1918} height={820} />
    </header>
    <main className={styles.main}>
      {error ? <p role="alert" className={styles.notice}>Configuração inválida: {error}</p> : null}
      {state.screen === "select" ? <div className={styles.selection}>
        <div className={styles.heading}>
          <h1 ref={title} tabIndex={-1}>Escolha seu número</h1>
          <p>Selecione uma opção disponível.</p>
        </div>
        <ul aria-label="Legenda" className={styles.legend}>
          <li><span className={styles.lockSample}><Lock /></span>Indisponível</li>
          <li><span className={styles.availableSample} />Disponível</li>
        </ul>
        <div role="group" aria-label="Números de 01 a 60" className={styles.grid}>
          {soniaCells(config, state).map((c) => <button key={c.number} type="button" data-number={c.label}
            ref={c.number === x ? availableX : undefined}
            disabled={c.status === "locked" || !!error}
            aria-label={`Número ${c.label}, ${c.status === "locked" ? "indisponível" : c.status === "selected" ? "selecionado" : "disponível"}`}
            aria-pressed={c.status === "selected" ? true : undefined}
            className={`${styles.cell} ${c.status === "locked" ? styles.locked : c.status === "selected" ? styles.selected : styles.available}`}
            onClick={() => pick(c.number)}>
            {c.status === "locked" ? <Lock /> : c.status === "selected" ? <span aria-hidden="true" className={styles.check}>✓</span> : null}
            <span>{c.label}</span>
          </button>)}
        </div>
        <p aria-live="polite" className={styles.status}>{state.selected ? `Número ${soniaLabel(x)} selecionado.` : ""}</p>
        {/* Requirement addition: final reference HTML has only modal Continue. */}
        <button type="button" className={styles.goldButton} disabled={!state.selected || !!error} onClick={goConfirm}>Continuar</button>
      </div> : <div className={styles.confirmation}>
        <h1 ref={confirmTitle} tabIndex={-1}>Confirme seu número</h1>
        <div aria-hidden="true" className={styles.bigNumber}>{soniaLabel(x)}</div>
        <p>Você selecionou o número <strong>{soniaLabel(x)}</strong>.</p>
        {state.confirmed ? <p ref={confirmedStatus} tabIndex={-1} role="status" className={styles.notice}>Seleção confirmada nesta demonstração. Nenhum número foi reservado.</p> : <>
          {!preview && !destination ? <p role="alert" className={styles.notice}>Destino não configurado. Não é possível continuar; nenhuma reserva foi realizada.</p> : null}
          {preview ? <p className={styles.previewNote}>Demonstração local — não reserva números nem confirma participação.{destination && /^https?:\/\//i.test(destination) ? " Destino externo não será aberto no preview." : ""}</p> : null}
          <button type="button" className={styles.goldButton} disabled={!!error || (!preview && !destination)} onClick={confirm}>Confirmar número</button>
          <button type="button" className={styles.backButton} onClick={returnToNumbers}>Voltar</button>
        </>}
      </div>}
    </main>
    <footer className={styles.footer}>
      {back ? <button type="button" onClick={back}>Voltar à etapa anterior</button> : null}
      {preview ? <button type="button" onClick={reset}>Reiniciar demonstração</button> : null}
    </footer>
    <dialog ref={dialog} className={`${styles.dialog} ${state.modal === "x" ? styles.chosenDialog : ""}`}
      aria-labelledby={`${uid}-title`} aria-describedby={`${uid}-description`}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }}
      onCancel={(e) => { e.preventDefault(); closeModal(); }}
      onClick={(e) => { if (e.detail > 1) return; if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeModal(); } }}>
      <canvas ref={confettiCanvas} aria-hidden="true" className={styles.confetti} />
      <div className={styles.modalContent}>
        <button type="button" aria-label="Fechar" className={styles.close} onClick={closeModal}>×</button>
        {state.modal === "x" ? <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true" className={styles.successIcon}><circle cx="26" cy="26" r="24.5" stroke="#D6AC54" strokeWidth="1.5" fill="none" /><path className={styles.drawCheck} d="M16 26.5l7 7 13-14" stroke="#D6AC54" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="40" /></svg> : <div aria-hidden="true" className={styles.modalIcon}>i</div>}
        <h2 id={`${uid}-title`}>{state.modal === "y" ? "Número indisponível" : "Número escolhido"}</h2>
        <p id={`${uid}-description`}>{state.modal === "y" ? "Escolha outra opção para continuar." : "Continue para confirmar sua seleção."}</p>
        <div className={state.modal === "y" ? styles.unavailableNumber : styles.modalNumber}>{soniaLabel(state.modal === "y" ? y : x)}{state.modal === "y" ? <Lock /> : null}</div>
        <button ref={primary} type="button" className={state.modal === "y" ? styles.modalBack : styles.goldButton} onClick={state.modal === "y" ? closeModal : goConfirm}>{state.modal === "y" ? "Voltar aos números" : "Continuar"}</button>
      </div>
    </dialog>
  </div>;
}
