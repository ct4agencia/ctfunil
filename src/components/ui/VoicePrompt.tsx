"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/referencias/beui/lib/reduced-motion-seguro";
import { WorkspaceOrb } from "@/components/workspace/WorkspaceFrame";
import { Mic, MicOff } from "lucide-react";

type VoiceResult = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type Recognition = {
  lang: string;
  onresult: ((event: { resultIndex: number; results: ArrayLike<VoiceResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: (track?: MediaStreamTrack) => void;
  stop: () => void;
  abort: () => void;
};
type VoiceWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

type SpeechSession = {
  recognizer: Recognition;
  retry: "available" | "scheduled" | "starting" | "used" | "disabled";
  stream?: MediaStream;
  stopTimer?: number;
};

function stopTracks(stream?: MediaStream | null) {
  stream?.getTracks().forEach(track => track.stop());
}

export default function VoicePrompt({ disabled, onTranscript, onListeningChange }: {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  onListeningChange?: (listening: boolean) => void;
}) {
  const reducedMotion = useReducedMotion();
  const meter = useRef<HTMLButtonElement>(null);
  const sessionRef = useRef<SpeechSession | null>(null);
  const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);
  const [supported, setSupported] = useState<boolean>();
  const [listening, setListening] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const browser = window as VoiceWindow;
    setSupported(!!(browser.SpeechRecognition || browser.webkitSpeechRecognition));
    return () => {
      const session = sessionRef.current;
      sessionRef.current = null;
      if (!session) return;
      window.clearTimeout(session.stopTimer);
      const { recognizer } = session;
      recognizer.onend = null;
      recognizer.onerror = null;
      recognizer.onresult = null;
      if (session.retry !== "starting") recognizer.abort();
      stopTracks(session.stream);
      onListeningChange?.(false);
    };
  }, [onListeningChange]);

  useEffect(() => {
    if (!listening || stopping || reducedMotion) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) return;

    const button = meter.current;
    let disposed = false;
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    let frame = 0;

    function release() {
      cancelAnimationFrame(frame);
      stopTracks(stream);
      stream = undefined;
      if (context) void context.close().catch(() => undefined);
      context = undefined;
      button?.style.removeProperty("--ct-mic-level");
    }

    async function measure() {
      try {
        const input = captureStream ?? await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!captureStream) stream = input;
        if (disposed) {
          release();
          return;
        }
        context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        context.createMediaStreamSource(input).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        let level = 0;
        function sample() {
          analyser.getByteTimeDomainData(samples);
          const energy = samples.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0);
          const amplitude = Math.min(1, Math.sqrt(energy / samples.length) * 4);
          level = level * .72 + amplitude * .28;
          button?.style.setProperty("--ct-mic-level", level.toFixed(3));
          frame = requestAnimationFrame(sample);
        }
        await context.resume();
        if (!disposed) sample();
      } catch {
        release();
      }
    }
    void measure();
    return () => {
      disposed = true;
      release();
    };
  }, [captureStream, listening, reducedMotion, stopping]);

  function finish(session: SpeechSession) {
    if (sessionRef.current !== session) return;
    sessionRef.current = null;
    window.clearTimeout(session.stopTimer);
    stopTracks(session.stream);
    setCaptureStream(null);
    setListening(false);
    onListeningChange?.(false);
    setStopping(false);
  }

  async function retryWithTrack(session: SpeechSession) {
    session.retry = "starting";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (sessionRef.current !== session) {
        stopTracks(stream);
        return;
      }
      session.stream = stream;
      const [track] = stream.getAudioTracks();
      if (!track) throw new Error();
      session.retry = "used";
      session.recognizer.start(track);
      setCaptureStream(stream);
    } catch (error) {
      if (sessionRef.current !== session) return;
      setError(error instanceof DOMException && error.name === "NotAllowedError"
        ? "Permita o acesso ao microfone nas configurações do navegador."
        : "Não foi possível acessar o microfone. Confira o dispositivo de entrada.");
      finish(session);
    }
  }

  function toggle() {
    const current = sessionRef.current;
    if (current) {
      if (stopping) return;
      if (current.retry === "starting" || current.retry === "scheduled") {
        finish(current);
        return;
      }
      current.retry = "disabled";
      setStopping(true);
      function endUnresponsiveCapture(session: SpeechSession) {
        if (sessionRef.current !== session) return;
        finish(session);
        session.recognizer.abort();
      }
      current.stopTimer = window.setTimeout(() => endUnresponsiveCapture(current), 2000);
      try {
        current.recognizer.stop();
      } catch {
        endUnresponsiveCapture(current);
      }
      return;
    }
    const browser = window as VoiceWindow;
    const SpeechRecognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const active = new SpeechRecognition();
    const session: SpeechSession = { recognizer: active, retry: "available" };
    sessionRef.current = session;
    setError("");
    active.lang = "pt-BR";
    active.onresult = event => {
      if (sessionRef.current !== session) return;
      const segments: string[] = [];
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal && result[0]?.transcript) segments.push(result[0].transcript.trim());
      }
      const text = segments.filter(Boolean).join(" ");
      if (text) onTranscript(text);
    };
    active.onerror = event => {
      if (sessionRef.current !== session) return;
      if (event.error === "audio-capture" && session.retry === "available" && typeof navigator.mediaDevices?.getUserMedia === "function") {
        session.retry = "scheduled";
        return;
      }
      switch (event.error) {
        case "aborted":
          return;
        case "not-allowed":
          setError("Permita o acesso ao microfone nas configurações do navegador.");
          return;
        case "audio-capture":
          setError("Não foi possível acessar o microfone. Confira o dispositivo de entrada.");
          return;
        case "no-speech":
          setError("Nenhuma fala foi detectada. Tente ditar novamente.");
          return;
        case "network":
        case "service-not-allowed":
          setError("O serviço de ditado do navegador está indisponível. Tente novamente ou digite a mensagem.");
          return;
        case "language-not-supported":
          setError("O navegador não oferece ditado em português neste dispositivo.");
          return;
        default:
          setError("Não foi possível concluir o ditado. Tente novamente.");
      }
    };
    active.onend = () => {
      if (sessionRef.current !== session) return;
      if (session.retry === "scheduled") void retryWithTrack(session);
      else finish(session);
    };
    try {
      active.start();
      if (sessionRef.current === session) {
        setListening(true);
        onListeningChange?.(true);
      }
    } catch {
      finish(session);
      setError("Não foi possível iniciar o microfone.");
    }
  }

  if (supported === undefined) return null;
  if (!supported) return <p className="text-xs text-ct-dim">Ditado indisponível neste navegador. Digite a mensagem no campo acima.</p>;
  const action = stopping ? "Encerrando ditado" : listening ? "Parar ditado" : "Ditar mensagem";
  return <div className="ct-voice-prompt">
    <button ref={meter} type="button" className="ct-icon-button" onClick={toggle} aria-pressed={listening}
      aria-label={action} title={action}
      aria-disabled={stopping || undefined} disabled={disabled && !listening}>
      {listening ? <MicOff size={17} /> : <Mic size={17} />}
    </button>
    {listening && <span className="ct-voice-status" role="status">{!stopping && <WorkspaceOrb state="listening" size={20} />}{stopping ? "Encerrando ditado…" : "Ouvindo"}</span>}
    {error && <span role="alert">{error}</span>}
  </div>;
}
