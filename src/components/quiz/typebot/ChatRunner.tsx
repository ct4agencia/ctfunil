"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Funnel } from "@/lib/quiz/types";
import type { TbConditionItem, TbFunnel, TbInput } from "@/lib/quiz/typebot/types";
import { isBubble, isInput, TB_DEFAULT_THEME } from "@/lib/quiz/typebot/types";
import { getSessionId, collectTrackingParams, fireMetaEvent } from "@/lib/tracking";
import { trackAnswer, trackStep } from "@/lib/quiz/track";

type FeedBase = { id: string; time?: string };
type FeedItem =
  | (FeedBase & { side: "host" | "guest"; kind: "text"; html: string; reaction?: string })
  | (FeedBase & { side: "host"; kind: "image"; url: string })
  | (FeedBase & { side: "host"; kind: "audio"; url: string })
  | (FeedBase & { side: "host"; kind: "video"; url: string })
  | (FeedBase & { side: "host"; kind: "embed"; html: string })
  | (FeedBase & { side: "host"; kind: "voice"; duration: string })
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

/** Runtime do funil typebot: reproduz a conversa (bolhas progressivas + digitação),
 *  coleta inputs, interpola {variavel}, ramifica e captura o lead. */
export default function ChatRunner({ funnel, preview = false }: { funnel: Funnel; preview?: boolean }) {
  const tb = funnel.settings?.typebot as TbFunnel | undefined;
  const theme = useMemo(() => ({ ...TB_DEFAULT_THEME, ...(tb?.theme || {}) }), [tb]);
  const groupById = useMemo(() => Object.fromEntries((tb?.groups || []).map((g) => [g.id, g])), [tb]);
  const groupIndex = useMemo(() => Object.fromEntries((tb?.groups || []).map((g, i) => [g.id, i])), [tb]);

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [pending, setPending] = useState<{ groupId: string; blockIdx: number; block: TbInput } | null>(null);
  const [typing, setTyping] = useState(false);
  const [textVal, setTextVal] = useState("");
  const [multiSel, setMultiSel] = useState<string[]>([]);

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
        else if (b.type === "voice") push({ side: "host", kind: "voice", duration: b.duration || "0:08" });
        else if (b.type === "call") push({ side: "host", kind: "call", mode: b.mode, status: b.status, duration: b.duration });
        else if (b.type === "system") push({ side: "center", kind: "system", variant: b.variant, html: b.variant === "custom" ? (b.text || "") : (SYS_TEXT[b.variant] || "") });
        else if (b.type === "document") push({ side: "host", kind: "document", name: b.name || "Documento.pdf", size: b.size });
        else if (b.type === "link") push({ side: "host", kind: "link", url: interp(b.url), title: b.title, desc: b.desc, image: b.image });
        else if (b.type === "location") push({ side: "host", kind: "location", address: interp(b.address || ""), image: b.image });
        else if (b.type === "contact") push({ side: "host", kind: "contact", name: interp(b.name || ""), phone: b.phone, avatar: b.avatar });
        await sleep(160);
        bi++; continue;
      }
      if (b.type === "wait") { await sleep((Number(b.seconds) || 0) * 1000); bi++; continue; }
      if (b.type === "set-variable") { if (b.variable) varsRef.current[b.variable] = evalExpr(b.expression); bi++; continue; }
      if (b.type === "condition") { const to = matchCond(b.items) ?? g.to; if (to) { gid = to; bi = 0; continue; } return; }
      if (b.type === "redirect") {
        const url = interp(b.url);
        if (preview) { push({ side: "host", kind: "text", html: `→ <em>redirect:</em> ${url}` }); return; }
        fireMetaEvent("InitiateCheckout");
        if (b.newTab) window.open(url, "_blank"); else window.location.href = url;
        return;
      }
      if (isInput(b)) { setPending({ groupId: gid, blockIdx: bi, block: b }); return; }
      bi++;
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    runFrom(tb?.startGroup || (tb?.groups?.[0]?.id ?? ""), 0);
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
    if (b.type !== "input-choice" && !item && !val) return;
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

  const Time = ({ m }: { m: FeedItem }) => (
    <span className="ml-1.5 inline-flex translate-y-0.5 items-center gap-0.5 text-[11.5px] leading-none" style={{ color: C.time }}>
      {m.time}{m.side === "guest" ? <span style={{ color: C.tick }}>✓✓</span> : null}
    </span>
  );

  return (
    <div className={`flex flex-col ${preview ? "h-full" : "min-h-[100dvh]"}`}
      style={{ fontFamily: `${theme.font || "Poppins"}, system-ui, sans-serif`, ["--wa-host" as string]: C.host, ["--wa-guest" as string]: C.guest }}>
      <style>{`
        .wa-bubble{position:relative;border-radius:10px}
        .wa-host{border-top-left-radius:2px}
        .wa-guest{border-top-right-radius:2px}
        .wa-host::before{content:"";position:absolute;top:0;left:-7px;border-style:solid;border-width:0 8px 7px 0;border-color:transparent var(--wa-host) transparent transparent}
        .wa-guest::before{content:"";position:absolute;top:0;right:-7px;border-style:solid;border-width:0 0 7px 8px;border-color:transparent transparent transparent var(--wa-guest)}
      `}</style>

      {/* barra de status (só no preview — no celular real existe a de verdade) */}
      {preview ? (
        <div className="flex items-center justify-between px-5 pb-0.5 pt-2 text-[12px] font-semibold" style={{ background: chromeBg, color: chromeText }}>
          <span>{theme.statusTime || "10:04"}</span>
          <span className="flex items-center gap-1.5">
            <span className="flex items-end gap-[2px]">{[5, 7, 9, 11].map((h, i) => <span key={i} className="w-[2.6px] rounded-sm" style={{ height: h, background: chromeText, opacity: i === 3 ? 0.4 : 1 }} />)}</span>
            <span className="text-[11px]">{theme.network || "5G"}</span>
            {theme.charging ? <span className="text-[10px] leading-none">⚡</span> : null}
            <span className="relative inline-block h-[12px] w-[23px] rounded-[3px]" style={{ border: `1px solid ${chromeText}` }}>
              <span className="absolute bottom-[1.5px] left-[1.5px] top-[1.5px] rounded-[1px]" style={{ background: chromeText, width: `calc(${battery}% - 3px)` }} />
              <span className="absolute -right-[3px] top-1/2 h-[5px] w-[2px] -translate-y-1/2 rounded-r" style={{ background: chromeText }} />
            </span>
          </span>
        </div>
      ) : null}

      {/* header */}
      {!theme.hideHeader ? (
        <header className="flex items-center gap-2.5 px-2.5 py-2 shadow-sm" style={{ background: chromeBg, color: chromeText }}>
          <span className="text-2xl leading-none" style={{ color: accent }}>‹</span>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : <span className="grid h-9 w-9 place-items-center rounded-full text-sm" style={{ background: "#0000001a" }}>👤</span>}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold leading-tight">{botName}</div>
            <div className="truncate text-[11px] leading-tight" style={{ opacity: 0.65 }}>{typing ? "digitando…" : (theme.online || "online")}</div>
          </div>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.7" strokeLinejoin="round"><rect x="2.5" y="6.5" width="12" height="11" rx="2.5" /><path d="M14.5 10.5l7-3.2v9.4l-7-3.2z" /></svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.7" strokeLinejoin="round"><path d="M6.8 10.7a13.5 13.5 0 006.5 6.5l2.1-2.1a1 1 0 011-.25 11 11 0 003.3.53 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.4a1 1 0 011 1 11 11 0 00.53 3.3 1 1 0 01-.25 1z" /></svg>
        </header>
      ) : null}

      {/* conversa */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ background: C.bg, backgroundImage: `url("${doodle}")`, backgroundSize: "94px 94px" }}>
        <div className="mx-auto flex w-full max-w-[680px] flex-col gap-1.5 px-3 py-3">
          {theme.encryptionBanner !== false ? (
            <div className="mx-auto my-1 max-w-[90%] rounded-lg px-3 py-1.5 text-center text-[11.5px] leading-snug shadow-sm" style={{ background: dark ? "#182229" : "#fdf3c4", color: dark ? "#ffd27d" : "#5c5638" }}>
              🔒 As mensagens e chamadas são protegidas com criptografia de ponta a ponta.
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
                <div className={`wa-bubble ${guest ? "wa-guest" : "wa-host"} max-w-[82%] px-[7px] py-[5px] text-[15px] leading-snug`}
                  style={{ background: guest ? C.guest : C.host, color: guest ? C.guestText : C.hostText, boxShadow: "0 1px 1px rgba(0,0,0,.13)" }}>
                  {m.kind === "text" ? (
                    <div className="px-0.5"><span dangerouslySetInnerHTML={{ __html: m.html }} /><Time m={m} />
                      {m.reaction ? <span className="absolute -bottom-2.5 z-10 rounded-full bg-white px-1 py-0.5 text-[12px] leading-none shadow" style={{ [guest ? "left" : "right"]: 8 }}>{m.reaction}</span> : null}
                    </div>
                  ) : m.kind === "image" ? (<div className="px-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt="" className="block w-[min(250px,66vw)] rounded-[6px] object-cover" />
                    <div className="text-right"><Time m={m} /></div>
                  </div>) : m.kind === "audio" ? (<div className="px-0.5"><audio controls src={m.url} className="h-9 w-[230px]" /><div className="text-right"><Time m={m} /></div></div>)
                    : m.kind === "video" ? (<div className="px-0.5"><video controls src={m.url} className="w-[min(250px,66vw)] rounded-[6px]" /><div className="text-right"><Time m={m} /></div></div>)
                      : m.kind === "voice" ? (
                        <div className="flex items-center gap-2 px-1 py-0.5" style={{ minWidth: 210 }}>
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[15px]" style={{ background: dark ? "#ffffff14" : "#00000010", color: dark ? "#e9edef" : "#54656f" }}>▶</span>
                          <div className="flex flex-1 items-center gap-[2px]">
                            {[7, 11, 16, 9, 13, 18, 8, 12, 15, 10, 17, 7, 14, 9, 12, 16, 8, 11, 13, 7].map((h, i) => <span key={i} className="w-[2px] rounded-full" style={{ height: h, background: dark ? "#8696a0" : "#9aa6ac" }} />)}
                          </div>
                          <div className="flex flex-col items-end leading-none"><span className="text-[11px]" style={{ color: C.time }}>{m.duration}</span><Time m={m} /></div>
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
          {typing ? (
            <div className="flex justify-start">
              <div className="wa-bubble wa-host flex gap-1 px-3.5 py-3" style={{ background: C.host, boxShadow: "0 1px 0.5px rgba(0,0,0,.13)" }}>
                {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full" style={{ background: C.typing, animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* input (sempre visível, estilo WhatsApp) */}
      <div style={{ background: C.inputBar }}>
        {isChoice && choiceBlock ? (
          <div className="mx-auto w-full max-w-[680px] px-2.5 pt-2.5">
            <div className="flex flex-col gap-2">
              {choiceBlock.items.map((it) => {
                const sel = multiSel.includes(it.id);
                return (
                  <button key={it.id}
                    onClick={() => choiceBlock.multiple ? setMultiSel((s) => sel ? s.filter((x) => x !== it.id) : [...s, it.id]) : submit(it.label, it)}
                    className="rounded-full px-4 py-2.5 text-[14.5px] font-semibold shadow-sm transition active:scale-[0.99]"
                    style={{ background: sel ? theme.buttonBg : C.inputBg, color: sel ? theme.buttonColor : theme.buttonBg, border: `1.5px solid ${theme.buttonBg}` }}>
                    {it.label}
                  </button>
                );
              })}
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
          ) : (
            <>
              <div className="flex flex-1 items-center rounded-full px-4 py-2.5 text-[15px] shadow-sm" style={{ background: C.inputBg, color: dark ? "#8696a0" : "#8e99a0" }}>Mensagem</div>
              <span className="text-xl" style={{ color: dark ? "#8696a0" : "#54656f" }}>📷</span>
              <span className="text-xl" style={{ color: dark ? "#8696a0" : "#54656f" }}>🎤</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
