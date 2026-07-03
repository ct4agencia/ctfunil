"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Funnel } from "@/lib/quiz/types";
import type { TbConditionItem, TbFunnel, TbInput, TbVsl } from "@/lib/quiz/typebot/types";
import { isBubble, isInput, TB_DEFAULT_THEME } from "@/lib/quiz/typebot/types";
import { getSessionId, collectTrackingParams, fireMetaEvent } from "@/lib/tracking";
import { attachVslWatch } from "@/lib/quiz/vsl-watch";
import { trackAnswer, trackStep } from "@/lib/quiz/track";

type FeedBase = { id: string; time?: string };
type FeedItem =
  | (FeedBase & { side: "host" | "guest"; kind: "text"; html: string; reaction?: string })
  | (FeedBase & { side: "host"; kind: "image"; url: string })
  | (FeedBase & { side: "host"; kind: "audio"; url: string })
  | (FeedBase & { side: "host"; kind: "video"; url: string })
  | (FeedBase & { side: "host"; kind: "embed"; html: string })
  | (FeedBase & { side: "host"; kind: "voice"; duration: string; url?: string })
  | (FeedBase & { side: "host"; kind: "call"; mode: "voice" | "video"; status?: string; duration?: string })
  | (FeedBase & { side: "host"; kind: "document"; name: string; size?: string })
  | (FeedBase & { side: "host"; kind: "link"; url: string; title?: string; desc?: string; image?: string })
  | (FeedBase & { side: "host"; kind: "location"; address?: string; image?: string })
  | (FeedBase & { side: "host"; kind: "contact"; name?: string; phone?: string; avatar?: string })
  | (FeedBase & { side: "center"; kind: "date"; label: string })
  | (FeedBase & { side: "center"; kind: "system"; variant: string; html: string });

const SYS_TEXT: Record<string, string> = {
  encrypted: "🔒 As mensagens e chamadas são protegidas com criptografia de ponta a ponta. Ninguém fora desta conversa pode lê-las.",
  deleted: "🚫 Você apagou esta mensagem",
  disappearing: "⏲️ As mensagens temporárias estão ativadas",
};

const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const WAVE = [7, 11, 16, 9, 13, 18, 8, 12, 15, 10, 17, 7, 14, 9, 12, 16, 8, 11, 13, 7, 15, 9, 13, 17, 8, 12, 10, 14];
const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Runtime do funil typebot: reproduz a conversa (bolhas progressivas + digitação),
 *  coleta inputs, interpola {variavel}, ramifica e captura o lead. */
export default function ChatRunner({ funnel, preview = false, startGroupId }: { funnel: Funnel; preview?: boolean; startGroupId?: string }) {
  const tb = funnel.settings?.typebot as TbFunnel | undefined;
  const theme = useMemo(() => ({ ...TB_DEFAULT_THEME, ...(tb?.theme || {}) }), [tb]);
  const groupById = useMemo(() => Object.fromEntries((tb?.groups || []).map((g) => [g.id, g])), [tb]);
  const groupIndex = useMemo(() => Object.fromEntries((tb?.groups || []).map((g, i) => [g.id, i])), [tb]);

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [pending, setPending] = useState<{ groupId: string; blockIdx: number; block: TbInput } | null>(null);
  const [typing, setTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [textVal, setTextVal] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [voiceState, setVoiceState] = useState<Record<string, { prog: number; clock: string }>>({});
  const [multiSel, setMultiSel] = useState<string[]>([]);
  const [vsl, setVsl] = useState<TbVsl | null>(null);

  const varsRef = useRef<Record<string, string>>({});
  const lastQRef = useRef<string>("");
  const started = useRef(false);
  const fid = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sid = () => `${getSessionId()}::${funnel.slug}`;
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const interp = (s: string) => (s || "").replace(/\{\{?(\w+)\}?\}/g, (_, k) => varsRef.current[k] ?? "");
  const stripMd = (s: string) => s.replace(/\*\*/g, "").replace(/<[^>]+>/g, "");
  const toHtml = (s: string) =>
    interp(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
  const push = (it: Record<string, unknown>) => setFeed((f) => [...f, { ...it, id: `f${++fid.current}`, time: nowHM() } as FeedItem]);
  const typeDelay = (s: string) => {
    if (!theme || !tb?.typing?.enabled) return 0;
    const cps = tb.typing.speed || 28;
    return Math.min((tb.typing.maxDelay || 1.4) * 1000, Math.max(450, (stripMd(interp(s)).length / cps) * 1000));
  };

  const evalExpr = (expr: string): string => {
    try {
      const keys = Object.keys(varsRef.current);
      const vals = keys.map((k) => varsRef.current[k]);
      const body = /return\s/.test(expr) ? expr : `return (${expr})`;
      // eslint-disable-next-line no-new-func
      const fn = new Function(...keys, body);
      return String(fn(...vals) ?? "");
    } catch {
      return "";
    }
  };
  const matchCond = (items: TbConditionItem[]): string | undefined => {
    for (const it of items) {
      const a = (varsRef.current[it.variable] ?? "").toLowerCase();
      const b = (it.value ?? "").toLowerCase();
      const na = Number(a), nb = Number(b);
      const ok = it.op === "igual" ? a === b : it.op === "diferente" ? a !== b
        : it.op === "contém" ? a.includes(b) : it.op === "maior" ? na > nb : na < nb;
      if (ok) return it.to;
    }
    return undefined;
  };

  async function runFrom(groupId: string, blockIdx: number) {
    let gid = groupId, bi = blockIdx;
    while (true) {
      const g = groupById[gid];
      if (!g) return;
      if (bi === 0 && !preview) trackStep(funnel.slug, groupIndex[gid] ?? 0, gid, "typebot");
      if (bi >= g.blocks.length) {
        if (g.to) { gid = g.to; bi = 0; continue; }
        return;
      }
      const b = g.blocks[bi];
      if (isBubble(b)) {
        if (b.type === "text") {
          const d = typeDelay(b.richText);
          if (d) { setTyping(true); await sleep(d); setTyping(false); }
          lastQRef.current = stripMd(interp(b.richText));
          push({ side: "host", kind: "text", html: toHtml(b.richText), reaction: b.reaction });
        } else if (b.type === "image") push({ side: "host", kind: "image", url: b.url });
        else if (b.type === "audio") push({ side: "host", kind: "audio", url: b.url });
        else if (b.type === "video") push({ side: "host", kind: "video", url: b.url });
        else if (b.type === "embed") push({ side: "host", kind: "embed", html: b.html });
        else if (b.type === "date") push({ side: "center", kind: "date", label: b.label || "Hoje" });
        else if (b.type === "voice") push({ side: "host", kind: "voice", duration: b.duration || "0:08", url: b.url });
        else if (b.type === "call") push({ side: "host", kind: "call", mode: b.mode, status: b.status, duration: b.duration });
        else if (b.type === "system") push({ side: "center", kind: "system", variant: b.variant, html: b.variant === "custom" ? (b.text || "") : (SYS_TEXT[b.variant] || "") });
        else if (b.type === "document") push({ side: "host", kind: "document", name: b.name || "Documento.pdf", size: b.size });
        else if (b.type === "link") push({ side: "host", kind: "link", url: interp(b.url), title: b.title, desc: b.desc, image: b.image });
        else if (b.type === "location") push({ side: "host", kind: "location", address: interp(b.address || ""), image: b.image });
        else if (b.type === "contact") push({ side: "host", kind: "contact", name: interp(b.name || ""), phone: b.phone, avatar: b.avatar });
        await sleep(160);
        bi++; continue;
      }
      if (b.type === "wait") {
        // se o próximo bloco é uma nota de voz, mostra "gravando áudio…" em vez do "digitando"
        const nextVoice = g.blocks[bi + 1]?.type === "voice";
        if (nextVoice) setRecording(true);
        await sleep((Number(b.seconds) || 0) * 1000);
        if (nextVoice) setRecording(false);
        bi++; continue;
      }
      if (b.type === "set-variable") { if (b.variable) varsRef.current[b.variable] = evalExpr(b.expression); bi++; continue; }
      if (b.type === "condition") { const to = matchCond(b.items) ?? g.to; if (to) { gid = to; bi = 0; continue; } return; }
      if (b.type === "redirect") {
        const url = interp(b.url);
        if (preview) { push({ side: "host", kind: "text", html: `→ <em>redirect:</em> ${url}` }); return; }
        fireMetaEvent("InitiateCheckout");
        if (b.newTab) window.open(url, "_blank"); else window.location.href = url;
        return;
      }
      // VSL (página): repaginação no mesmo domínio — cobre o chat com a VSL.
      if (b.type === "vsl") { setVsl(b); return; }
      if (isInput(b)) { setPending({ groupId: gid, blockIdx: bi, block: b }); return; }
      bi++;
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    runFrom(startGroupId || tb?.startGroup || (tb?.groups?.[0]?.id ?? ""), 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [feed, typing, pending]);

  async function capture() {
    const v = varsRef.current;
    const phone = (v.whatsapp || v.telefone || v.phone || "").replace(/\D/g, "");
    if (!phone || preview) return;
    const payload = {
      funnelSlug: funnel.slug, name: v.nome || "", phone, componentId: "captura",
      session_id: sid(), estado: v.estado || "", cidade: v.cidade || "",
      viewport: `${window.innerWidth}x${window.innerHeight}`, screen: `${window.screen.width}x${window.screen.height}`,
      platform: navigator.platform, user_agent: navigator.userAgent,
      tracking: collectTrackingParams() as unknown as Record<string, string>,
    };
    try {
      const r = await fetch("/api/funnel-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (r.ok) fireMetaEvent("Lead", { content_name: "lead_capture" });
    } catch { /* best-effort */ }
  }

  function submit(raw: string, item?: { label?: string; to?: string }) {
    if (!pending) return;
    const b = pending.block;
    const val = (raw || "").trim();
    // obrigatório pra continuar: input vazio avisa em vez de só não avançar
    if (b.type !== "input-choice" && !item && !val) { alert("Por favor, preencha pra continuar 🙂"); return; }
    if (b.type === "input-phone" && val.replace(/\D/g, "").length < 10) { alert("Confere seu WhatsApp com DDD 🙂"); return; }
    if (b.type === "input-number" && val && isNaN(Number(val.replace(",", ".")))) { alert("Digite um número 🙂"); return; }
    if (b.type === "input-email" && val && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)) { alert("E-mail inválido 🙂"); return; }

    const display = item?.label ?? val;
    const bVar = (b as { variable?: string }).variable;
    if (bVar) varsRef.current[bVar] = b.type === "input-phone" ? val.replace(/\D/g, "") : val;
    push({ side: "guest", kind: "text", html: toHtml(display) });
    if (!preview) {
      if (lastQRef.current) trackAnswer(funnel.slug, b.id, lastQRef.current, stripMd(display));
      if (b.type === "input-phone") capture();
    }
    const np = pending;
    setPending(null); setTextVal(""); setMultiSel([]);
    if (item?.to) runFrom(item.to, 0);
    else runFrom(np.groupId, np.blockIdx + 1);
  }

  if (!tb || !tb.groups?.length) return <div className="grid min-h-[100dvh] place-items-center text-neutral-400">Funil typebot vazio.</div>;

  const ios = (theme.device || "ios") === "ios";
  const dark = !!theme.dark;
  const avatar = theme.avatarUrl || null;
  const botName = theme.botName || funnel.name || "Chat";
  const pt = pending?.block.type;
  const isChoice = pt === "input-choice";
  const isRating = pt === "input-rating";
  const isPicture = pt === "input-picture";
  const isCards = pt === "input-cards";
  const isFile = pt === "input-file";
  const isText = !!pending && !isChoice && !isRating && !isPicture && !isCards && !isFile;
  const inputType = pt === "input-number" ? "number" : pt === "input-email" ? "email" : pt === "input-phone" ? "tel"
    : pt === "input-date" ? "date" : pt === "input-time" ? "time" : pt === "input-url" ? "url" : "text";
  const choiceBlock = pt === "input-choice" ? (pending!.block as Extract<TbInput, { type: "input-choice" }>) : null;
  const ratingBlock = pt === "input-rating" ? (pending!.block as Extract<TbInput, { type: "input-rating" }>) : null;
  const pictureBlock = pt === "input-picture" ? (pending!.block as Extract<TbInput, { type: "input-picture" }>) : null;
  const cardsBlock = pt === "input-cards" ? (pending!.block as Extract<TbInput, { type: "input-cards" }>) : null;

  // paleta efetiva (claro/escuro/android) + cromo do "celular"
  const chromeBg = dark ? "#1f2c34" : ios ? "#f7f7f7" : (theme.headerColor || "#008069");
  const chromeText = dark ? "#e9edef" : ios ? "#0b141a" : "#ffffff";
  const accent = ios && !dark ? "#007aff" : chromeText;
  const C = dark
    ? { bg: "#0b141a", host: "#202c33", hostText: "#e9edef", guest: "#005c4b", guestText: "#e9edef", time: "rgba(233,237,239,.55)", tick: "#53bdeb", inputBar: "#1f2c34", inputBg: "#2a3942", inputText: "#e9edef", doodle: "#16222c", typing: "#8696a0" }
    : { bg: theme.bg || "#efeae2", host: theme.hostBubbleBg || "#ffffff", hostText: theme.hostBubbleColor || "#111b21", guest: theme.guestBubbleBg || "#e6ffda", guestText: theme.guestBubbleColor || "#111b21", time: "rgba(0,0,0,.45)", tick: "#34b7f1", inputBar: ios ? "#f7f7f7" : "#f0f2f5", inputBg: "#ffffff", inputText: theme.inputColor || "#111b21", doodle: "#e4ddce", typing: "#9aa6ac" };
  // padrão "doodle" AUTORAL (não é o asset do WhatsApp) — evoca o fundo da conversa
  const doodle = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='112' height='112'><g fill='none' stroke='${C.doodle}' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'><path d='M20 26c-3-5-11-3-11 2 0 5 11 11 11 11s11-6 11-11c0-5-8-7-11-2z'/><path d='M84 16l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z'/><circle cx='32' cy='84' r='10'/><path d='M27 86c2 2.5 8 2.5 10 0'/><path d='M76 74v18M76 74c6-1 11 1 11 4.5s-5 5.5-11 4.5'/><path d='M100 100c-7-2-14 2-14 9 0 0 9 1 14-3 3-3 3-8 0-6z'/></g></svg>`)}`;
  const battery = Math.max(0, Math.min(100, theme.battery ?? 80));
  const bubbleFs = theme.textSize === "small" ? 14 : theme.textSize === "large" ? 16.5 : 15;

  const fmtClock = (hm?: string) => {
    if (!hm) return "";
    if (!theme.clock12h) return hm;
    const [h, mm] = hm.split(":").map(Number);
    return `${h % 12 || 12}:${String(mm || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };
  const Time = ({ m }: { m: FeedItem }) => (
    <span className="ml-1.5 inline-flex translate-y-0.5 items-center gap-1 text-[11.5px] leading-none" style={{ color: C.time }}>
      {fmtClock(m.time)}
      {m.side === "guest" ? (
        <svg width="15" height="11" viewBox="0 0 18 12" fill="none" stroke={C.tick} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6.4 L4.3 9.5 L9.8 2.6" /><path d="M7.2 9 L13.6 2.4" /></svg>
      ) : null}
    </span>
  );

  return (
    <div className={`relative flex flex-col overflow-hidden ${preview ? "h-full" : "h-[100dvh]"}`}
      style={{ fontFamily: ({ system: "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif", poppins: "Poppins,system-ui,sans-serif", roboto: "Roboto,system-ui,sans-serif", opensans: "'Open Sans',system-ui,sans-serif" } as Record<string, string>)[(theme.font || "poppins").toLowerCase()] || `${theme.font || "Poppins"},system-ui,sans-serif`, ["--wa-host" as string]: C.host, ["--wa-guest" as string]: C.guest }}>
      {/* fundo FIXO atrás de tudo (não rola com a conversa) */}
      <div className="pointer-events-none absolute inset-0" style={theme.chatBgImage
        ? { zIndex: 0, background: C.bg, backgroundImage: `url("${theme.chatBgImage}")`, backgroundSize: "cover", backgroundPosition: "center" }
        : { zIndex: 0, background: C.bg, backgroundImage: `url("${doodle}")`, backgroundSize: "94px 94px" }} />
      <style>{`
        .wa-bubble{position:relative;border-radius:10px}
        .wa-host{border-top-left-radius:2px}
        .wa-guest{border-top-right-radius:2px}
        .wa-host::before{content:"";position:absolute;top:0;left:-7px;border-style:solid;border-width:0 8px 7px 0;border-color:transparent var(--wa-host) transparent transparent}
        .wa-guest::before{content:"";position:absolute;top:0;right:-7px;border-style:solid;border-width:0 0 7px 8px;border-color:transparent transparent transparent var(--wa-guest)}
      `}</style>

      {/* barra de status (só no preview — no celular real existe a de verdade) */}
      {preview && theme.showStatusBar !== false ? (
        <div className="relative z-10 flex shrink-0 items-center justify-between px-5 pb-0.5 pt-2 text-[12px] font-semibold" style={{ background: chromeBg, color: chromeText }}>
          <span>{theme.statusTime || "10:04"}</span>
          <span className="flex items-center gap-1.5">
            <span className="flex items-end gap-[2px]">{[5, 7, 9, 11].map((h, i) => <span key={i} className="w-[2.6px] rounded-sm" style={{ height: h, background: chromeText, opacity: i === 3 ? 0.4 : 1 }} />)}</span>
            {theme.dualSim ? <span className="flex items-end gap-[2px]">{[5, 7, 9, 11].map((h, i) => <span key={i} className="w-[2.6px] rounded-sm" style={{ height: h, background: chromeText, opacity: i >= 2 ? 0.4 : 1 }} />)}</span> : null}
            <span className="text-[11px]">{theme.network || "5G"}</span>
            {theme.charging ? <span className="text-[10px] leading-none">⚡</span> : null}
            {theme.showBatteryPct ? <span className="text-[11px]">{battery}</span> : null}
            <span className="relative inline-block h-[12px] w-[23px] rounded-[3px]" style={{ border: `1px solid ${chromeText}` }}>
              <span className="absolute bottom-[1.5px] left-[1.5px] top-[1.5px] rounded-[1px]" style={{ background: chromeText, width: `calc(${battery}% - 3px)` }} />
              <span className="absolute -right-[3px] top-1/2 h-[5px] w-[2px] -translate-y-1/2 rounded-r" style={{ background: chromeText }} />
            </span>
          </span>
        </div>
      ) : null}

      {/* header */}
      {!theme.hideHeader ? (
        <header className="relative z-10 flex shrink-0 items-center gap-2.5 px-2.5 py-2 shadow-sm" style={{ background: chromeBg, color: chromeText }}>
          <span className="text-2xl leading-none" style={{ color: accent }}>‹</span>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : <span className="grid h-9 w-9 place-items-center rounded-full text-sm" style={{ background: "#0000001a" }}>👤</span>}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold leading-tight">{botName}</div>
            <div className="truncate text-[11px] leading-tight" style={{ opacity: 0.65 }}>{recording ? "gravando áudio…" : typing ? "digitando…" : (theme.online || "online")}</div>
          </div>
          {theme.headerSilent ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"><path d="M9 8a3 3 0 016 0v1.5M18 14v-1a6 6 0 00-.7-2.8M6 9v5l-2 2h12M10 19a2 2 0 004 0M3 3l18 18" /></svg> : null}
          {theme.showCallVideo ? (
            <button onClick={() => push({ side: "host", kind: "call", mode: "video", status: "missed" })} aria-label="Chamada de vídeo">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.7" strokeLinejoin="round"><rect x="2.5" y="6.5" width="12" height="11" rx="2.5" /><path d="M14.5 10.5l7-3.2v9.4l-7-3.2z" /></svg>
            </button>
          ) : null}
          {theme.showCallVoice ? (
            <button onClick={() => push({ side: "host", kind: "call", mode: "voice", status: "missed" })} aria-label="Chamada de voz">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.7" strokeLinejoin="round"><path d="M6.8 10.7a13.5 13.5 0 006.5 6.5l2.1-2.1a1 1 0 011-.25 11 11 0 003.3.53 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.4a1 1 0 011 1 11 11 0 00.53 3.3 1 1 0 01-.25 1z" /></svg>
            </button>
          ) : null}
        </header>
      ) : null}

      {/* conversa */}
      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[680px] flex-col gap-1.5 px-3 py-3">
          {theme.encryptionBanner !== false ? (
            <div className="mx-auto my-1 max-w-[90%] rounded-lg px-3 py-1.5 text-center text-[11.5px] leading-snug shadow-sm" style={{ background: dark ? "#182229" : "#fdf3c4", color: dark ? "#ffd27d" : "#5c5638" }}>
              🔒 {theme.encryptionText || "As mensagens e chamadas são protegidas com criptografia de ponta a ponta."}
            </div>
          ) : null}
          {feed.map((m) => {
            if (m.kind === "date") return (
              <div key={m.id} className="my-1 flex justify-center"><span className="rounded-md px-2.5 py-1 text-[11.5px] font-medium uppercase shadow-sm" style={{ background: dark ? "#182229" : "#ffffff", color: dark ? "#8696a0" : "#54656f" }}>{m.label}</span></div>
            );
            if (m.kind === "system") return (
              <div key={m.id} className="my-1 flex justify-center"><span className="mx-auto max-w-[90%] rounded-lg px-3 py-1.5 text-center text-[11.5px] leading-snug shadow-sm" style={{ background: m.variant === "encrypted" ? (dark ? "#182229" : "#fdf3c4") : (dark ? "#182229" : "#ffffff"), color: dark ? "#8696a0" : "#54656f" }}>{m.html}</span></div>
            );
            const guest = m.side === "guest";
            return (
              <div key={m.id} className={`flex ${guest ? "justify-end" : "justify-start"}`}>
                <div className={`wa-bubble ${guest ? "wa-guest" : "wa-host"} max-w-[82%] px-[7px] py-[5px] leading-snug`}
                  style={{ background: guest ? C.guest : C.host, color: guest ? C.guestText : C.hostText, boxShadow: "0 1px 1px rgba(0,0,0,.13)", fontSize: bubbleFs }}>
                  {m.kind === "text" ? (
                    <div className="relative px-0.5">
                      <span dangerouslySetInnerHTML={{ __html: m.html }} />
                      {/* espaçador na última linha p/ o horário não sobrepor o texto (truque do WhatsApp) */}
                      <span aria-hidden className="inline-block align-bottom" style={{ width: guest ? 54 : 42 }} />
                      <span className="absolute bottom-[1px] right-[3px] inline-flex items-center gap-1 text-[11px] leading-none" style={{ color: C.time }}>
                        {fmtClock(m.time)}
                        {guest ? <svg width="15" height="11" viewBox="0 0 18 12" fill="none" stroke={C.tick} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6.4 L4.3 9.5 L9.8 2.6" /><path d="M7.2 9 L13.6 2.4" /></svg> : null}
                      </span>
                      {m.reaction ? <span className="absolute -bottom-2.5 z-10 rounded-full bg-white px-1 py-0.5 text-[12px] leading-none shadow" style={{ [guest ? "left" : "right"]: 8 }}>{m.reaction}</span> : null}
                    </div>
                  ) : m.kind === "image" ? (<div className="px-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt="" className="block w-[min(250px,66vw)] rounded-[6px] object-cover" />
                    <div className="text-right"><Time m={m} /></div>
                  </div>) : m.kind === "audio" ? (<div className="px-0.5"><audio controls src={m.url} className="h-9 w-[230px]" /><div className="text-right"><Time m={m} /></div></div>)
                    : m.kind === "video" ? (<div className="px-0.5"><video controls src={m.url} className="w-[min(250px,66vw)] rounded-[6px]" /><div className="text-right"><Time m={m} /></div></div>)
                      : m.kind === "voice" ? (
                        <div data-voice className="flex items-center gap-2.5 py-0.5 pl-0.5 pr-0.5" style={{ minWidth: 230 }}>
                          <button onClick={(e) => { const a = e.currentTarget.closest("[data-voice]")?.querySelector("audio") as HTMLAudioElement | null; if (a) { if (a.paused) a.play().catch(() => { /* formato não suportado (use MP3) */ }); else a.pause(); } }} className="grid h-9 w-9 shrink-0 place-items-center" style={{ color: dark ? "#e9edef" : "#54656f" }} aria-label={playingId === m.id ? "Pausar" : "Tocar"}>
                            {playingId === m.id
                              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.2" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" /></svg>
                              : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2v13.6a1 1 0 001.52.85l11-6.8a1 1 0 000-1.7l-11-6.8A1 1 0 008 5.2z" /></svg>}
                          </button>
                          {m.url ? <audio src={m.url} autoPlay preload="auto"
                            onPlay={() => setPlayingId(m.id)}
                            onPause={() => setPlayingId((p) => (p === m.id ? null : p))}
                            onEnded={() => { setPlayingId((p) => (p === m.id ? null : p)); setVoiceState((s) => ({ ...s, [m.id]: { prog: 0, clock: "" } })); }}
                            onTimeUpdate={(e) => { const a = e.currentTarget; if (a.duration) setVoiceState((s) => ({ ...s, [m.id]: { prog: a.currentTime / a.duration, clock: fmtSec(a.currentTime) } })); }} /> : null}
                          {(() => {
                            const prog = voiceState[m.id]?.prog ?? 0;
                            return (
                              <div className="flex flex-1 flex-col gap-1">
                                <div className="relative flex items-center gap-[2px]">
                                  {WAVE.map((h, i) => {
                                    const played = i / (WAVE.length - 1) <= prog;
                                    return <span key={i} className="w-[2px] rounded-full" style={{ height: h, background: played ? (dark ? "#e9edef" : "#54656f") : (dark ? "#5a6a73" : "#c4ccce") }} />;
                                  })}
                                  <span className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full shadow-sm" style={{ left: `calc(${Math.min(100, prog * 100)}% - 6px)`, background: dark ? "#e9edef" : "#54656f" }} />
                                </div>
                                <div className="flex items-center justify-between"><span className="text-[11px]" style={{ color: C.time }}>{voiceState[m.id]?.clock || m.duration}</span><Time m={m} /></div>
                              </div>
                            );
                          })()}
                          <div className="relative shrink-0">
                            {avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
                            ) : <span className="grid h-11 w-11 place-items-center rounded-full text-lg" style={{ background: dark ? "#ffffff14" : "#00000010" }}>👤</span>}
                            <span className="absolute -bottom-0.5 -left-1 grid h-[18px] w-[18px] place-items-center rounded-full" style={{ background: "#25d366" }}>
                              <svg width="10" height="11" viewBox="0 0 24 24" fill="#ffffff"><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0013 0h-2a4.5 4.5 0 01-9 0z" /><rect x="11" y="17.5" width="2" height="3.5" rx="1" /></svg>
                            </span>
                          </div>
                        </div>
                      ) : m.kind === "call" ? (
                        <div className="flex items-center gap-2.5 px-1 py-1" style={{ minWidth: 190 }}>
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[16px]" style={{ background: dark ? "#00a88433" : "#dff3ea" }}>{m.mode === "video" ? "📹" : "📞"}</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-medium">Chamada de {m.mode === "video" ? "vídeo" : "voz"}</div>
                            <div className="text-[11.5px]" style={{ color: C.time }}>{m.status === "missed" ? "Perdida" : (m.duration || "Tocando…")}</div>
                          </div>
                          <Time m={m} />
                        </div>
                      ) : m.kind === "document" ? (
                        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2" style={{ background: dark ? "#ffffff0d" : "#00000008", minWidth: 200 }}>
                          <span className="grid h-10 w-9 shrink-0 place-items-center rounded text-[18px]" style={{ background: dark ? "#ffffff14" : "#ffffff" }}>📄</span>
                          <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-medium">{m.name}</div><div className="text-[11.5px]" style={{ color: C.time }}>{m.size || "PDF"}</div></div>
                          <span className="text-lg" style={{ color: C.time }}>⤓</span>
                        </div>
                      ) : m.kind === "link" ? (
                        <a href={m.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg" style={{ background: dark ? "#ffffff0d" : "#00000008", maxWidth: 250 }}>
                          {m.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.image} alt="" className="block h-28 w-full object-cover" />
                          ) : null}
                          <div className="px-2.5 py-1.5">
                            {m.title ? <div className="text-[13.5px] font-semibold leading-tight">{m.title}</div> : null}
                            {m.desc ? <div className="mt-0.5 text-[11.5px] leading-snug" style={{ color: C.time }}>{m.desc}</div> : null}
                            <div className="mt-0.5 truncate text-[11px]" style={{ color: C.tick }}>{m.url}</div>
                          </div>
                        </a>
                      ) : m.kind === "location" ? (
                        <div className="overflow-hidden rounded-lg" style={{ maxWidth: 230 }}>
                          {m.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.image} alt="" className="block h-28 w-full object-cover" />
                          ) : <div className="grid h-28 w-full place-items-center text-3xl" style={{ background: dark ? "#0e3a2f" : "#cfe8d8" }}>📍</div>}
                          <div className="px-2 py-1.5 text-[12.5px]"><span className="mr-1">📍</span>{m.address || "Localização"}<Time m={m} /></div>
                        </div>
                      ) : m.kind === "contact" ? (
                        <div className="flex items-center gap-2.5 px-1 py-1" style={{ minWidth: 200 }}>
                          {m.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                          ) : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg" style={{ background: dark ? "#ffffff14" : "#00000010" }}>👤</span>}
                          <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-medium">{m.name || "Contato"}</div>{m.phone ? <div className="text-[11.5px]" style={{ color: C.time }}>{m.phone}</div> : null}</div>
                        </div>
                      ) : <div className="px-0.5"><span dangerouslySetInnerHTML={{ __html: m.html }} /></div>}
                </div>
              </div>
            );
          })}
          {recording ? (
            <div className="flex justify-start">
              <div className="wa-bubble wa-host flex items-center gap-2 px-3 py-2" style={{ background: C.host, boxShadow: "0 1px 0.5px rgba(0,0,0,.13)" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"><rect x="9" y="2.5" width="6" height="11.5" rx="3" fill="#ef4444" stroke="none" /><path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3.2M8.5 21.5h7" /></svg>
                <span className="animate-pulse text-[12.5px]" style={{ color: C.typing }}>gravando áudio…</span>
              </div>
            </div>
          ) : typing ? (
            <div className="flex justify-start">
              <div className="wa-bubble wa-host flex gap-1 px-3.5 py-3" style={{ background: C.host, boxShadow: "0 1px 0.5px rgba(0,0,0,.13)" }}>
                {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full" style={{ background: C.typing, animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* input (estilo WhatsApp) — sempre na pergunta; rodapé ocioso some se hideFooter */}
      {pending || !theme.hideFooter ? (
      <div className="relative z-10 shrink-0" style={{ background: C.inputBar }}>
        {isChoice && choiceBlock ? (
          <div className="mx-auto w-full max-w-[680px] px-2.5 pt-2.5">
            <div className="flex flex-col gap-2">
              {/* botão ÚNICO (1 opção, sem múltipla escolha): maior, preenchido e pulsando pra chamar o clique */}
              {(() => { const single = !choiceBlock.multiple && choiceBlock.items.length === 1; return choiceBlock.items.map((it) => {
                const sel = multiSel.includes(it.id);
                if (single) {
                  return (
                    <button key={it.id} onClick={() => submit(it.label, it)}
                      className="tb-cta-pulse rounded-full px-5 py-4 text-[17px] font-extrabold leading-tight transition active:scale-[0.97]"
                      style={{ background: theme.buttonBg, color: theme.buttonColor, ["--tb-cta-glow" as string]: `color-mix(in srgb, ${theme.buttonBg} 45%, transparent)` } as CSSProperties}>
                      {it.label}
                    </button>
                  );
                }
                return (
                  <button key={it.id}
                    onClick={() => choiceBlock.multiple ? setMultiSel((s) => sel ? s.filter((x) => x !== it.id) : [...s, it.id]) : submit(it.label, it)}
                    className="rounded-full px-4 py-2.5 text-[14.5px] font-semibold shadow-sm transition active:scale-[0.99]"
                    style={{ background: sel ? theme.buttonBg : C.inputBg, color: sel ? theme.buttonColor : theme.buttonBg, border: `1.5px solid ${theme.buttonBg}` }}>
                    {it.label}
                  </button>
                );
              }); })()}
              {choiceBlock.multiple ? (
                <button onClick={() => { const items = choiceBlock.items.filter((x) => multiSel.includes(x.id)); submit(items.map((x) => x.label).join(", "), items[0]); }}
                  className="mt-1 rounded-full px-4 py-2.5 font-bold" style={{ background: theme.buttonBg, color: theme.buttonColor }}>Enviar</button>
              ) : null}
            </div>
          </div>
        ) : null}
        {isRating && ratingBlock ? (
          <div className="mx-auto w-full max-w-[680px] px-2.5 pt-3">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {Array.from({ length: Math.max(2, ratingBlock.max || 5) }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => submit(String(n))} className="transition active:scale-90" aria-label={`${n}`}>
                  {ratingBlock.icon === "number"
                    ? <span className="grid h-10 w-10 place-items-center rounded-full border-2 text-base font-bold" style={{ borderColor: theme.buttonBg, color: theme.buttonBg }}>{n}</span>
                    : <span className="text-[30px] leading-none">{ratingBlock.icon === "heart" ? "❤️" : "⭐"}</span>}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {isPicture && pictureBlock ? (
          <div className="mx-auto w-full max-w-[680px] px-2.5 pt-2.5">
            <div className="grid grid-cols-2 gap-2">
              {pictureBlock.items.map((it) => (
                <button key={it.id} onClick={() => submit(it.label, it)} className="overflow-hidden rounded-xl border bg-white text-left shadow-sm transition active:scale-[0.99]" style={{ borderColor: theme.buttonBg }}>
                  {it.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image} alt="" className="h-24 w-full object-cover" />
                  ) : <div className="grid h-24 w-full place-items-center text-2xl" style={{ background: "#00000008" }}>🖼️</div>}
                  <div className="px-2.5 py-2 text-[13.5px] font-semibold" style={{ color: theme.buttonBg }}>{it.label}</div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {isCards && cardsBlock ? (
          <div className="mx-auto w-full max-w-[680px] px-2.5 pt-2.5">
            <div className="flex flex-col gap-2">
              {cardsBlock.items.map((c) => (
                <div key={c.id} className="overflow-hidden rounded-xl border bg-white shadow-sm" style={{ borderColor: "#0000001a" }}>
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image} alt="" className="h-32 w-full object-cover" />
                  ) : null}
                  <div className="px-3 py-2">
                    {c.title ? <div className="text-[14px] font-bold text-neutral-900">{c.title}</div> : null}
                    {c.desc ? <div className="mt-0.5 text-[12.5px] text-neutral-500">{c.desc}</div> : null}
                    <button onClick={() => submit(c.title || c.button || "Selecionar", c)} className="mt-2 w-full rounded-full px-4 py-2 text-[14px] font-semibold" style={{ background: theme.buttonBg, color: theme.buttonColor }}>{c.button || "Selecionar"}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mx-auto flex w-full max-w-[680px] items-center gap-2 px-2.5 py-2">
          <span className="text-2xl leading-none" style={{ color: dark ? "#8696a0" : "#54656f" }}>＋</span>
          {isText ? (
            <form onSubmit={(e) => { e.preventDefault(); submit(textVal); }} className="flex flex-1 items-center gap-2">
              <input autoFocus value={textVal} onChange={(e) => setTextVal(e.target.value)} type={inputType}
                inputMode={inputType === "tel" ? "tel" : inputType === "number" ? "numeric" : "text"}
                placeholder={(pending?.block as { placeholder?: string })?.placeholder || "Mensagem"}
                className="min-w-0 flex-1 rounded-full border-0 px-4 py-2.5 text-[15px] shadow-sm outline-none" style={{ background: C.inputBg, color: C.inputText }} />
              <button type="submit" aria-label="Enviar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white" style={{ background: theme.buttonBg }}>➤</button>
            </form>
          ) : isFile ? (
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[15px] font-semibold shadow-sm" style={{ background: theme.buttonBg, color: theme.buttonColor }}>
              📎 {(pending?.block as { button?: string })?.button || "Anexar arquivo"}
              <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) submit(`📎 ${f.name}`); }} />
            </label>
          ) : (() => {
            const ic = dark ? "#8696a0" : "#54656f";
            return (
              <>
                <div className="flex flex-1 items-center gap-2 rounded-full px-4 py-2 shadow-sm" style={{ background: C.inputBg }}>
                  <span className="flex-1 text-[15px]" style={{ color: dark ? "#8696a0" : "#8e99a0" }}>Mensagem</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ic} strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="6" /><path d="M8.5 14.5s1.2 1.5 3.5 1.5 3.5-1.5 3.5-1.5" /><circle cx="9" cy="10" r="0.6" fill={ic} stroke="none" /><circle cx="15" cy="10" r="0.6" fill={ic} stroke="none" /></svg>
                </div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ic} strokeWidth="1.6"><path d="M3.5 8.5a1.5 1.5 0 011.5-1.5h1.8l1.1-1.6a1 1 0 01.8-.4h4.6a1 1 0 01.8.4l1.1 1.6H19a1.5 1.5 0 011.5 1.5v8A1.5 1.5 0 0119 18H5a1.5 1.5 0 01-1.5-1.5z" /><circle cx="12" cy="12.5" r="3.4" /></svg>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ic} strokeWidth="1.7"><rect x="9" y="2.5" width="6" height="11.5" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3.2M8.5 21.5h7" /></svg>
              </>
            );
          })()}
        </div>
      </div>
      ) : null}

      {/* REPAGINAÇÃO: bloco VSL cobre o chat (mesmo domínio) */}
      {vsl ? <TypebotVsl block={vsl} interp={interp} preview={preview} slug={funnel.slug} /> : null}
    </div>
  );
}

/** Injeta o EMBED do player (VTurb/converteai) e RE-EXECUTA os <script> (innerHTML não roda script). */
function VturbEmbed({ html, slug, preview }: { html: string; slug: string; preview?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = html;
    // re-executa os <script> (innerHTML não roda script) e RASTREIA os que
    // foram pro <head> pra removê-los no cleanup — o preview do builder remonta
    // a cada troca de grupo/reiniciar, então sem isso o player vaza/duplica.
    const injected: HTMLScriptElement[] = [];
    el.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
      if (!old.src) s.textContent = old.textContent;
      s.async = true;
      document.head.appendChild(s);
      injected.push(s);
      old.remove();
    });
    const detach = attachVslWatch({ funnelSlug: slug, html, disabled: preview });
    return () => { el.innerHTML = ""; injected.forEach((s) => s.remove()); detach(); };
  }, [html, slug, preview]);
  return <div ref={ref} className="mx-auto w-full overflow-hidden rounded-2xl shadow-lg" />;
}

/**
 * VSL como repaginação: cobre o chat com a página de VSL no MESMO domínio.
 * Reaproveita a estrutura da lâmina VSL do inlead (banner + player + pitch reveal).
 */
function TypebotVsl({ block, interp, preview, slug }: { block: TbVsl; interp: (s: string) => string; preview: boolean; slug: string }) {
  const [reveal, setReveal] = useState((block.pitchRevealAt ?? 0) <= 0);
  useEffect(() => {
    if (reveal) return;
    const t = setTimeout(() => setReveal(true), (block.pitchRevealAt ?? 0) * 1000);
    return () => clearTimeout(t);
  }, [reveal, block.pitchRevealAt]);

  const openCheckout = () => {
    if (!preview) fireMetaEvent("InitiateCheckout");
    const url = interp(block.checkoutUrl || "");
    if (url) window.open(url, "_blank");
  };
  const titleHtml = interp(block.title || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const fx = block.effect || "none";
  const shineCls = fx === "shine" || fx === "shine-pulse" ? "fx-shine" : "";

  return (
    <div className="absolute inset-0 z-50 overflow-y-auto" style={{ background: block.background || "#ffffff" }}>
      <div className="mx-auto w-full max-w-md px-5 py-6">
        {block.barText ? (
          <div className="mb-4 rounded-xl border-2 px-4 py-2.5 text-center text-[13px] font-extrabold uppercase leading-snug"
            style={{ borderColor: block.barColor || "#f59e0b", background: block.barBg || "#fff7ed", color: block.barColor || "#9a3412" }}>
            {interp(block.barText)}
          </div>
        ) : null}
        {block.title ? <h2 className="mb-4 text-center text-lg font-extrabold leading-tight text-neutral-900" dangerouslySetInnerHTML={{ __html: titleHtml }} /> : null}
        {block.embedHtml ? (
          <VturbEmbed html={block.embedHtml} slug={slug} preview={preview} />
        ) : (
          <div className="grid aspect-[9/16] w-full place-items-center overflow-hidden rounded-2xl bg-neutral-900 text-center text-white/70 shadow-lg">
            <div>
              <span className="text-4xl">▶</span>
              <p className="mt-3 px-6 text-sm">Cole o embed do VTurb no campo “Embed do player” (editor do bloco VSL).</p>
            </div>
          </div>
        )}
        <AnimatePresence mode="wait">
          {reveal ? (
            <motion.div key="cta" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
              <button onClick={openCheckout}
                className={`tb-cta-pulse w-full rounded-full bg-emerald-500 px-6 py-4 text-[17px] font-extrabold uppercase text-white active:scale-[0.97] ${shineCls}`}
                style={{ ["--tb-cta-glow" as string]: "color-mix(in srgb, #10b981 55%, transparent)" } as CSSProperties}>
                {block.ctaText || "QUERO GARANTIR MINHA VAGA"}
              </button>
            </motion.div>
          ) : (
            <motion.p key="wait" exit={{ opacity: 0 }} className="mt-6 text-center text-sm text-neutral-400">⏳ Assista o vídeo para liberar o acesso...</motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
