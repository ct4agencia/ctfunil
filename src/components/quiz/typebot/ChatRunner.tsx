"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Funnel } from "@/lib/quiz/types";
import type { TbChoiceItem, TbConditionItem, TbFunnel, TbInput } from "@/lib/quiz/typebot/types";
import { isBubble, isInput, TB_DEFAULT_THEME } from "@/lib/quiz/typebot/types";
import { getSessionId, collectTrackingParams, fireMetaEvent } from "@/lib/tracking";
import { trackAnswer, trackStep } from "@/lib/quiz/track";

type FeedItem =
  | { id: string; side: "host" | "guest"; kind: "text"; html: string }
  | { id: string; side: "host"; kind: "image"; url: string }
  | { id: string; side: "host"; kind: "audio"; url: string }
  | { id: string; side: "host"; kind: "video"; url: string }
  | { id: string; side: "host"; kind: "embed"; html: string };

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
  const push = (it: Record<string, unknown>) => setFeed((f) => [...f, { ...it, id: `f${++fid.current}` } as FeedItem]);
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
          push({ side: "host", kind: "text", html: toHtml(b.richText) });
        } else if (b.type === "image") push({ side: "host", kind: "image", url: b.url });
        else if (b.type === "audio") push({ side: "host", kind: "audio", url: b.url });
        else if (b.type === "video") push({ side: "host", kind: "video", url: b.url });
        else if (b.type === "embed") push({ side: "host", kind: "embed", html: b.html });
        await sleep(160);
        bi++; continue;
      }
      if (b.type === "wait") { await sleep((Number(b.seconds) || 0) * 1000); bi++; continue; }
      if (b.type === "set-variable") { if (b.variable) varsRef.current[b.variable] = evalExpr(b.expression); bi++; continue; }
      if (b.type === "condition") { const to = matchCond(b.items) ?? g.to; if (to) { gid = to; bi = 0; continue; } return; }
      if (b.type === "redirect") {
        const url = interp(b.url);
        if (preview) push({ side: "host", kind: "text", html: `→ <em>redirect:</em> ${url}` });
        else if (b.newTab) window.open(url, "_blank"); else window.location.href = url;
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

  function submit(raw: string, item?: TbChoiceItem) {
    if (!pending) return;
    const b = pending.block;
    const val = (raw || "").trim();
    if (b.type !== "input-choice" && !val) return;
    if (b.type === "input-phone" && val.replace(/\D/g, "").length < 10) { alert("Confere seu WhatsApp com DDD 🙂"); return; }
    if (b.type === "input-number" && val && isNaN(Number(val.replace(",", ".")))) { alert("Digite um número 🙂"); return; }
    if (b.type === "input-email" && val && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)) { alert("E-mail inválido 🙂"); return; }

    const display = item?.label ?? val;
    if (b.variable) varsRef.current[b.variable] = b.type === "input-phone" ? val.replace(/\D/g, "") : val;
    push({ side: "guest", kind: "text", html: toHtml(display) });
    if (!preview) {
      if (lastQRef.current) trackAnswer(funnel.slug, b.id, lastQRef.current, stripMd(display));
      if (b.type === "input-phone") capture();
    }
    const np = pending;
    setPending(null); setTextVal(""); setMultiSel([]);
    if (b.type === "input-choice" && item?.to) runFrom(item.to, 0);
    else runFrom(np.groupId, np.blockIdx + 1);
  }

  if (!tb || !tb.groups?.length) return <div className="grid min-h-[100dvh] place-items-center text-neutral-400">Funil typebot vazio.</div>;

  const avatar = theme.showAvatar && theme.avatarUrl ? theme.avatarUrl : null;
  const isChoice = pending?.block.type === "input-choice";
  const inputType = pending?.block.type === "input-number" ? "number"
    : pending?.block.type === "input-email" ? "email" : pending?.block.type === "input-phone" ? "tel" : "text";

  return (
    <div className="flex min-h-[100dvh] flex-col" style={{ background: theme.bg, fontFamily: `${theme.font || "Poppins"}, system-ui, sans-serif` }}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[680px] flex-col gap-2.5 px-3 py-5">
          {feed.map((m) => (
            <div key={m.id} className={`flex items-end gap-2 ${m.side === "guest" ? "flex-row-reverse" : ""}`}>
              {m.side === "host" && avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
              ) : m.side === "host" ? <span className="w-7 shrink-0" /> : null}
              <div className="max-w-[80%] overflow-hidden rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug shadow-sm"
                style={m.side === "guest"
                  ? { background: theme.guestBubbleBg, color: theme.guestBubbleColor, borderBottomRightRadius: 4 }
                  : { background: theme.hostBubbleBg, color: theme.hostBubbleColor, borderBottomLeftRadius: 4 }}>
                {m.kind === "text" ? <span dangerouslySetInnerHTML={{ __html: m.html }} />
                  : m.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="" className="-mx-3.5 -my-2.5 block w-[min(280px,70vw)] object-cover" />
                  ) : m.kind === "audio" ? <audio controls src={m.url} className="w-[230px]" />
                    : m.kind === "video" ? <video controls src={m.url} className="w-[min(280px,70vw)] rounded-lg" />
                      : <span dangerouslySetInnerHTML={{ __html: m.html }} />}
              </div>
            </div>
          ))}
          {typing ? (
            <div className="flex items-end gap-2">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
              ) : <span className="w-7 shrink-0" />}
              <div className="flex gap-1 rounded-2xl px-4 py-3" style={{ background: theme.hostBubbleBg, borderBottomLeftRadius: 4 }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 animate-bounce rounded-full" style={{ background: theme.hostBubbleColor, opacity: 0.45, animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* área de input */}
      {pending ? (
        <div className="border-t" style={{ borderColor: "#0000000f", background: theme.bg }}>
          <div className="mx-auto w-full max-w-[680px] px-3 py-3">
            {isChoice ? (
              <div className="flex flex-col gap-2">
                {(pending.block as Extract<TbInput, { type: "input-choice" }>).items.map((it) => {
                  const sel = multiSel.includes(it.id);
                  const multiple = (pending.block as Extract<TbInput, { type: "input-choice" }>).multiple;
                  return (
                    <button key={it.id}
                      onClick={() => multiple ? setMultiSel((s) => sel ? s.filter((x) => x !== it.id) : [...s, it.id]) : submit(it.label, it)}
                      className="rounded-xl px-4 py-3 text-[15px] font-semibold transition active:scale-[0.99]"
                      style={{ background: sel ? theme.buttonBg : "transparent", color: sel ? theme.buttonColor : theme.buttonBg, border: `2px solid ${theme.buttonBg}` }}>
                      {it.label}
                    </button>
                  );
                })}
                {(pending.block as Extract<TbInput, { type: "input-choice" }>).multiple ? (
                  <button onClick={() => { const items = (pending.block as Extract<TbInput, { type: "input-choice" }>).items.filter((x) => multiSel.includes(x.id)); submit(items.map((x) => x.label).join(", "), items[0]); }}
                    className="mt-1 rounded-xl px-4 py-3 font-bold" style={{ background: theme.buttonBg, color: theme.buttonColor }}>Enviar</button>
                ) : null}
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); submit(textVal); }} className="flex items-center gap-2">
                <input autoFocus value={textVal} onChange={(e) => setTextVal(e.target.value)} type={inputType}
                  inputMode={inputType === "tel" ? "tel" : inputType === "number" ? "numeric" : "text"}
                  placeholder={pending.block.type !== "input-choice" ? (pending.block.placeholder || "Digite aqui…") : ""}
                  className="flex-1 rounded-xl border px-4 py-3 text-[15px] outline-none"
                  style={{ background: theme.inputBg, color: theme.inputColor, borderColor: "#0000001f" }} />
                <button type="submit" className="rounded-xl px-5 py-3 font-bold" style={{ background: theme.buttonBg, color: theme.buttonColor }}>
                  {pending.block.type !== "input-choice" ? (pending.block.button || "Enviar") : "Enviar"}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
