"use client";

import { useMemo, useState } from "react";
import type { Funnel } from "@/lib/quiz/types";
import type { TbBlock, TbFunnel, TbGroup } from "@/lib/quiz/typebot/types";
import { TB_BLOCK_LABEL, TB_DEFAULT_THEME, isInput } from "@/lib/quiz/typebot/types";
import ChatRunner from "@/components/quiz/typebot/ChatRunner";
import { LeadsTab } from "@/components/builder/LayersBuilder";
import FunnelSettingsPanel from "@/components/builder/FunnelSettingsPanel";
import TypebotFlow from "@/components/builder/TypebotFlow";
import { saveFunnelAction } from "@/app/builder/[slug]/actions";

function genId() {
  try { return "b" + crypto.randomUUID().slice(0, 8); } catch { return "b" + Math.random().toString(36).slice(2, 10); }
}
const inp = "w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm outline-none focus:border-neutral-500";
const Lbl = ({ children }: { children: React.ReactNode }) => <label className="mb-0.5 mt-2 block text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{children}</label>;

const ADD_TYPES: [string, string[]][] = [
  ["Bolhas", ["text", "image", "audio", "video", "embed"]],
  ["Inputs", ["input-text", "input-number", "input-email", "input-phone", "input-choice"]],
  ["Lógica", ["wait", "set-variable", "condition", "redirect"]],
];

function newBlock(type: string): TbBlock {
  const id = genId();
  switch (type) {
    case "text": return { id, type: "text", richText: "Nova mensagem" };
    case "image": return { id, type: "image", url: "" };
    case "audio": return { id, type: "audio", url: "" };
    case "video": return { id, type: "video", url: "" };
    case "embed": return { id, type: "embed", html: "" };
    case "input-text": return { id, type: "input-text", variable: "resposta", placeholder: "Digite aqui…", button: "Enviar" };
    case "input-number": return { id, type: "input-number", variable: "numero", placeholder: "Digite…", button: "Enviar" };
    case "input-email": return { id, type: "input-email", variable: "email", placeholder: "seu@email.com", button: "Enviar" };
    case "input-phone": return { id, type: "input-phone", variable: "whatsapp", placeholder: "WhatsApp com DDD", button: "Enviar" };
    case "input-choice": return { id, type: "input-choice", variable: "opcao", items: [{ id: genId(), label: "Opção 1" }] };
    case "wait": return { id, type: "wait", seconds: 2 };
    case "set-variable": return { id, type: "set-variable", variable: "var", expression: "" };
    case "condition": return { id, type: "condition", items: [{ id: genId(), variable: "var", op: "igual", value: "" }] };
    case "redirect": return { id, type: "redirect", url: "https://", newTab: false };
    default: return { id, type: "text", richText: "" };
  }
}

const ICON: Record<string, string> = {
  text: "💬", image: "🖼️", audio: "🎧", video: "🎬", embed: "🔗",
  "input-text": "✏️", "input-number": "🔢", "input-email": "📧", "input-phone": "📱", "input-choice": "🔘",
  wait: "⏲️", "set-variable": "🧮", condition: "🔀", redirect: "↗️",
};

export default function TypebotBuilder({ initial }: { initial: Funnel }) {
  const [funnel, setFunnel] = useState<Funnel>(initial);
  const tb = (funnel.settings?.typebot || { startGroup: "", groups: [], variables: [], theme: TB_DEFAULT_THEME, typing: { enabled: true, speed: 28, maxDelay: 1.4 } }) as TbFunnel;
  const groups = tb.groups || [];
  const [selG, setSelG] = useState(0);
  const [selB, setSelB] = useState<string | null>(null);
  const [tab, setTab] = useState<"chat" | "fluxo" | "tema" | "leads">("chat");
  const [addOpen, setAddOpen] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const group = groups[selG];
  const block = group?.blocks.find((b) => b.id === selB) || null;
  const groupOpts = useMemo(() => groups.map((g) => ({ id: g.id, title: g.title })), [groups]);

  const setTb = (next: Partial<TbFunnel>) =>
    setFunnel((f) => ({ ...f, settings: { ...(f.settings || {}), engine: "typebot", typebot: { ...tb, ...next } } }));
  const setGroups = (gs: TbGroup[]) => setTb({ groups: gs });
  const patchGroup = (gi: number, patch: Partial<TbGroup>) => setGroups(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const patchBlock = (bid: string, patch: Record<string, unknown>) =>
    patchGroup(selG, { blocks: group.blocks.map((b) => (b.id === bid ? { ...b, ...patch } as TbBlock : b)) });
  const addBlock = (type: string) => { const b = newBlock(type); patchGroup(selG, { blocks: [...group.blocks, b] }); setSelB(b.id); setAddOpen(false); };
  const delBlock = (bid: string) => { patchGroup(selG, { blocks: group.blocks.filter((b) => b.id !== bid) }); if (selB === bid) setSelB(null); };
  const moveBlock = (bid: string, dir: -1 | 1) => {
    const i = group.blocks.findIndex((b) => b.id === bid); const j = i + dir;
    if (i < 0 || j < 0 || j >= group.blocks.length) return;
    const bs = [...group.blocks];[bs[i], bs[j]] = [bs[j], bs[i]]; patchGroup(selG, { blocks: bs });
  };
  const addGroup = () => {
    const g: TbGroup = { id: genId(), title: `Grupo ${groups.length + 1}`, x: 40, y: 40, blocks: [] };
    setGroups([...groups, g]); setSelG(groups.length); setSelB(null);
  };
  const delGroup = (gi: number) => { if (groups.length <= 1) return; setGroups(groups.filter((_, i) => i !== gi)); setSelG(Math.max(0, gi - 1)); setSelB(null); };

  const save = async () => {
    setSaving(true); setMsg(null);
    const r = await saveFunnelAction(funnel);
    setSaving(false); setMsg(r.ok ? "Salvo ✓" : `Erro: ${r.error}`);
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-neutral-50 text-neutral-900">
      {/* HEADER */}
      <header className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="rounded bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">TYPEBOT</span>
          <input value={funnel.name} onChange={(e) => setFunnel((f) => ({ ...f, name: e.target.value }))} className="w-64 rounded border border-transparent px-1 py-0.5 text-sm font-bold text-neutral-900 hover:border-neutral-200" />
          <span className="text-xs text-neutral-500">/{funnel.slug}</span>
        </div>
        <nav className="flex gap-1 rounded-lg bg-neutral-100 p-1">
          {([["chat", "💬 Construtor"], ["fluxo", "🔀 Fluxo"], ["tema", "🎨 Tema"], ["leads", "👥 Leads"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${tab === k ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"}`}>{l}</button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {msg ? <span className="text-xs font-semibold text-neutral-600">{msg}</span> : null}
          <button onClick={() => setShowSettings(true)} title="Configurações do funil (pixel, checkout, domínio, webhooks)" className="rounded-lg border border-neutral-300 px-2.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">⚙</button>
          <button onClick={save} disabled={saving} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700">{saving ? "Salvando…" : "Salvar"}</button>
          <a href={`/${funnel.slug}`} target="_blank" className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white">Ver ao vivo ↗</a>
        </div>
      </header>

      {tab === "leads" ? (
        <div className="flex-1 overflow-auto p-4"><LeadsTab slug={funnel.slug} /></div>
      ) : tab === "fluxo" ? (
        <TypebotFlow tb={tb} setGroups={setGroups} onSelect={(gid) => { const i = groups.findIndex((g) => g.id === gid); if (i >= 0) { setSelG(i); setSelB(null); setTab("chat"); } }} />
      ) : tab === "tema" ? (
        <ThemeTab tb={tb} setTb={setTb} />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* GRUPOS */}
          <aside className="w-56 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white p-2">
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Grupos</span>
              <button onClick={addGroup} className="text-xs font-bold text-violet-600">+ grupo</button>
            </div>
            {groups.map((g, i) => (
              <button key={g.id} onClick={() => { setSelG(i); setSelB(null); }}
                className={`mb-1 w-full rounded-lg px-2.5 py-2 text-left text-xs ${i === selG ? "bg-violet-50 ring-1 ring-violet-300" : "hover:bg-neutral-50"}`}>
                <div className="font-semibold text-neutral-800">{g.title}</div>
                <div className="text-[10px] text-neutral-400">{g.blocks.length} bloco(s)</div>
              </button>
            ))}
          </aside>

          {/* BLOCOS + EDITOR */}
          <section className="w-[360px] shrink-0 overflow-y-auto border-r border-neutral-200 bg-white p-3">
            {group ? (
              <>
                <div className="flex items-center gap-2">
                  <input value={group.title} onChange={(e) => patchGroup(selG, { title: e.target.value })} className={`${inp} font-semibold`} />
                  {groups.length > 1 ? <button onClick={() => delGroup(selG)} className="shrink-0 text-xs text-red-500">excluir</button> : null}
                </div>
                <Lbl>Próximo grupo (ao terminar)</Lbl>
                <select value={group.to || ""} onChange={(e) => patchGroup(selG, { to: e.target.value || undefined })} className={inp}>
                  <option value="">— fim do funil —</option>
                  {groupOpts.filter((o) => o.id !== group.id).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                </select>

                <div className="mb-1 mt-3 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Blocos</span>
                  <div className="relative">
                    <button onClick={() => setAddOpen((v) => !v)} className="rounded bg-violet-600 px-2 py-1 text-[11px] font-bold text-white">+ bloco</button>
                    {addOpen ? (
                      <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
                        {ADD_TYPES.map(([cat, types]) => (
                          <div key={cat} className="mb-1">
                            <p className="px-1 py-0.5 text-[10px] font-bold uppercase text-neutral-400">{cat}</p>
                            {types.map((t) => (
                              <button key={t} onClick={() => addBlock(t)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-neutral-50">
                                <span>{ICON[t]}</span>{TB_BLOCK_LABEL[t]}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-1">
                  {group.blocks.map((b) => (
                    <div key={b.id} className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 ${selB === b.id ? "border-violet-400 bg-violet-50" : "border-neutral-200"}`}>
                      <button onClick={() => setSelB(b.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <span>{ICON[b.type]}</span>
                        <span className="truncate text-xs text-neutral-700">{blockPreview(b)}</span>
                      </button>
                      <button onClick={() => moveBlock(b.id, -1)} className="text-neutral-300 hover:text-neutral-600">▲</button>
                      <button onClick={() => moveBlock(b.id, 1)} className="text-neutral-300 hover:text-neutral-600">▼</button>
                      <button onClick={() => delBlock(b.id)} className="text-red-300 hover:text-red-600">✕</button>
                    </div>
                  ))}
                  {!group.blocks.length ? <p className="px-1 py-4 text-center text-xs text-neutral-400">Nenhum bloco. Clique em + bloco.</p> : null}
                </div>

                {block ? <div className="mt-3 border-t border-neutral-100 pt-3"><BlockEditor block={block} patch={(p) => patchBlock(block.id, p)} groupOpts={groupOpts.filter((o) => o.id !== group.id)} /></div> : null}
              </>
            ) : <p className="text-sm text-neutral-400">Sem grupos.</p>}
          </section>

          {/* PREVIEW */}
          <div className="flex flex-1 flex-col items-center justify-start overflow-hidden bg-neutral-100 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-400">Pré-visualização</span>
              <button onClick={() => setNonce((n) => n + 1)} className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold">↺ Reiniciar</button>
            </div>
            <div className="h-full w-full max-w-[400px] overflow-hidden rounded-[2rem] border-8 border-neutral-800 bg-white shadow-xl">
              <div className="h-full overflow-hidden">
                <ChatRunner key={nonce} funnel={funnel} preview />
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettings ? (
        <FunnelSettingsPanel funnel={funnel} onPatch={(patch) => setFunnel((f) => ({ ...f, ...patch }))} onClose={() => setShowSettings(false)} />
      ) : null}
    </div>
  );
}

function blockPreview(b: TbBlock): string {
  if (b.type === "text") return b.richText.replace(/\*\*/g, "").slice(0, 40) || "(texto vazio)";
  if (b.type === "image") return "Imagem";
  if (b.type === "audio") return "Áudio";
  if (b.type === "video") return "Vídeo";
  if (b.type === "embed") return "Embed";
  if (b.type === "input-choice") return `Botões: ${b.items.map((i) => i.label).join(" / ").slice(0, 34)}`;
  if (isInput(b)) return `${TB_BLOCK_LABEL[b.type]} → {${b.variable || "?"}}`;
  if (b.type === "wait") return `Esperar ${b.seconds}s`;
  if (b.type === "set-variable") return `{${b.variable}} = ${b.expression.slice(0, 20)}`;
  if (b.type === "condition") return `Condição (${b.items.length})`;
  if (b.type === "redirect") return `Redirect → ${b.url.slice(0, 28)}`;
  return "Bloco";
}

function BlockEditor({ block: b, patch, groupOpts }: { block: TbBlock; patch: (p: Record<string, unknown>) => void; groupOpts: { id: string; title: string }[] }) {
  if (b.type === "text") return (<><Lbl>Texto (use **negrito** e {`{variavel}`})</Lbl><textarea value={b.richText} onChange={(e) => patch({ richText: e.target.value })} rows={4} className={inp} /></>);
  if (b.type === "image" || b.type === "audio" || b.type === "video") return (<><Lbl>URL do arquivo</Lbl><input value={b.url} onChange={(e) => patch({ url: e.target.value })} placeholder="https://…" className={inp} />{b.type === "image" && b.url ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={b.url} alt="" className="mt-2 max-h-32 rounded" />) : null}</>);
  if (b.type === "embed") return (<><Lbl>HTML / iframe</Lbl><textarea value={b.html} onChange={(e) => patch({ html: e.target.value })} rows={4} className={inp} /></>);
  if (b.type === "input-text" || b.type === "input-number" || b.type === "input-email" || b.type === "input-phone") return (<>
    <Lbl>Salvar na variável</Lbl><input value={b.variable || ""} onChange={(e) => patch({ variable: e.target.value })} placeholder="ex: nome" className={inp} />
    <Lbl>Placeholder</Lbl><input value={b.placeholder || ""} onChange={(e) => patch({ placeholder: e.target.value })} className={inp} />
    <Lbl>Texto do botão</Lbl><input value={b.button || ""} onChange={(e) => patch({ button: e.target.value })} className={inp} />
    {b.type === "input-phone" ? <p className="mt-1 text-[11px] text-amber-600">📱 Este input dispara a captura do lead (webhook Datacrazy).</p> : null}
  </>);
  if (b.type === "input-choice") return (<>
    <Lbl>Salvar na variável (opcional)</Lbl><input value={b.variable || ""} onChange={(e) => patch({ variable: e.target.value })} placeholder="ex: idade" className={inp} />
    <Lbl>Opções (botões)</Lbl>
    {b.items.map((it, i) => (
      <div key={it.id} className="mb-1 flex items-center gap-1">
        <input value={it.label} onChange={(e) => patch({ items: b.items.map((x) => x.id === it.id ? { ...x, label: e.target.value } : x) })} className={inp} />
        <select value={it.to || ""} onChange={(e) => patch({ items: b.items.map((x) => x.id === it.id ? { ...x, to: e.target.value || undefined } : x) })} className="w-24 shrink-0 rounded border border-neutral-300 px-1 py-1.5 text-[11px]" title="pular para grupo">
          <option value="">→ padrão</option>
          {groupOpts.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
        <button onClick={() => patch({ items: b.items.filter((x) => x.id !== it.id) })} className="shrink-0 text-red-400">✕</button>
      </div>
    ))}
    <button onClick={() => patch({ items: [...b.items, { id: genId(), label: `Opção ${b.items.length + 1}` }] })} className="mt-1 text-xs font-semibold text-violet-600">+ opção</button>
  </>);
  if (b.type === "wait") return (<><Lbl>Esperar (segundos)</Lbl><input type="number" min={0} step={0.5} value={b.seconds} onChange={(e) => patch({ seconds: Number(e.target.value) })} className={inp} /></>);
  if (b.type === "set-variable") return (<>
    <Lbl>Variável</Lbl><input value={b.variable} onChange={(e) => patch({ variable: e.target.value })} className={inp} />
    <Lbl>Expressão (JS — use {`{{variavel}}`})</Lbl><textarea value={b.expression} onChange={(e) => patch({ expression: e.target.value })} rows={3} className={inp} />
  </>);
  if (b.type === "condition") return (<>
    <Lbl>Condições (primeira verdadeira ganha)</Lbl>
    {b.items.map((it) => (
      <div key={it.id} className="mb-1 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1">
        <input value={it.variable} onChange={(e) => patch({ items: b.items.map((x) => x.id === it.id ? { ...x, variable: e.target.value } : x) })} placeholder="var" className="rounded border border-neutral-300 px-1.5 py-1 text-xs" />
        <select value={it.op} onChange={(e) => patch({ items: b.items.map((x) => x.id === it.id ? { ...x, op: e.target.value as typeof x.op } : x) })} className="rounded border border-neutral-300 px-1 py-1 text-xs">
          {["igual", "diferente", "contém", "maior", "menor"].map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <input value={it.value} onChange={(e) => patch({ items: b.items.map((x) => x.id === it.id ? { ...x, value: e.target.value } : x) })} placeholder="valor" className="rounded border border-neutral-300 px-1.5 py-1 text-xs" />
        <select value={it.to || ""} onChange={(e) => patch({ items: b.items.map((x) => x.id === it.id ? { ...x, to: e.target.value || undefined } : x) })} className="w-16 rounded border border-neutral-300 px-1 py-1 text-[10px]">
          <option value="">→</option>
          {groupOpts.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
      </div>
    ))}
    <button onClick={() => patch({ items: [...b.items, { id: genId(), variable: "var", op: "igual", value: "" }] })} className="mt-1 text-xs font-semibold text-violet-600">+ condição</button>
  </>);
  if (b.type === "redirect") return (<>
    <Lbl>URL de destino (checkout/VSL)</Lbl><input value={b.url} onChange={(e) => patch({ url: e.target.value })} placeholder="https://…" className={inp} />
    <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600"><input type="checkbox" checked={!!b.newTab} onChange={(e) => patch({ newTab: e.target.checked })} className="h-3.5 w-3.5 accent-neutral-900" /> Abrir em nova aba</label>
  </>);
  return null;
}

function ThemeTab({ tb, setTb }: { tb: TbFunnel; setTb: (n: Partial<TbFunnel>) => void }) {
  const t = { ...TB_DEFAULT_THEME, ...tb.theme };
  const set = (p: Partial<typeof t>) => setTb({ theme: { ...t, ...p } });
  const Color = ({ label, k }: { label: string; k: keyof typeof t }) => (
    <div className="flex items-center justify-between border-b border-neutral-100 py-2 text-sm"><span className="text-neutral-600">{label}</span>
      <input type="color" value={(t[k] as string) || "#000000"} onChange={(e) => set({ [k]: e.target.value })} className="h-8 w-12" /></div>
  );
  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="mx-auto max-w-xl rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-base font-bold">🎨 Tema do chat</h2>
        <Color label="Fundo da página" k="bg" />
        <Color label="Bolha do bot — fundo" k="hostBubbleBg" />
        <Color label="Bolha do bot — texto" k="hostBubbleColor" />
        <Color label="Bolha do lead — fundo" k="guestBubbleBg" />
        <Color label="Bolha do lead — texto" k="guestBubbleColor" />
        <Color label="Botões — fundo" k="buttonBg" />
        <Color label="Botões — texto" k="buttonColor" />
        <Color label="Barra de topo (WhatsApp)" k="headerColor" />
        <Lbl>Nome do contato (topo)</Lbl>
        <input value={t.botName || ""} onChange={(e) => set({ botName: e.target.value })} placeholder="ex: Sônia 🧡" className={inp} />
        <Lbl>Avatar do bot (URL)</Lbl>
        <input value={t.avatarUrl || ""} onChange={(e) => set({ avatarUrl: e.target.value })} placeholder="https://…" className={inp} />

        <div className="mt-4 border-t border-neutral-100 pt-3">
          <p className="mb-2 text-sm font-bold text-neutral-700">Celular (estilo WhatsApp)</p>
          <div className="mb-2 flex gap-2">
            <button onClick={() => set({ dark: false, bg: "#efeae2", hostBubbleBg: "#ffffff", hostBubbleColor: "#111b21", guestBubbleBg: "#d9fdd3", guestBubbleColor: "#111b21", buttonBg: "#008069", buttonColor: "#ffffff" })} className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold hover:bg-neutral-50">☀️ WhatsApp Claro</button>
            <button onClick={() => set({ dark: true })} className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold hover:bg-neutral-50">🌙 WhatsApp Escuro</button>
          </div>
          <div className="flex items-center justify-between py-1.5 text-sm"><span className="text-neutral-600">Aparelho</span>
            <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
              {(["ios", "android"] as const).map((d) => (
                <button key={d} onClick={() => set({ device: d })} className={`rounded-md px-3 py-1 text-xs font-semibold ${(t.device || "ios") === d ? "bg-white shadow-sm" : "text-neutral-500"}`}>{d === "ios" ? " iOS" : "🤖 Android"}</button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between py-1.5 text-sm"><span className="text-neutral-600">Modo escuro</span>
            <input type="checkbox" checked={!!t.dark} onChange={(e) => set({ dark: e.target.checked })} className="h-4 w-4 accent-neutral-900" /></label>
          <label className="flex items-center justify-between py-1.5 text-sm"><span className="text-neutral-600">Esconder header</span>
            <input type="checkbox" checked={!!t.hideHeader} onChange={(e) => set({ hideHeader: e.target.checked })} className="h-4 w-4 accent-neutral-900" /></label>
          <Lbl>Status do contato</Lbl>
          <input value={t.online || ""} onChange={(e) => set({ online: e.target.value })} placeholder="online" className={inp} />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div><Lbl>Hora</Lbl><input value={t.statusTime || ""} onChange={(e) => set({ statusTime: e.target.value })} placeholder="10:04" className={inp} /></div>
            <div><Lbl>Rede</Lbl><input value={t.network || ""} onChange={(e) => set({ network: e.target.value })} placeholder="5G" className={inp} /></div>
            <div><Lbl>Bateria %</Lbl><input type="number" min={0} max={100} value={t.battery ?? 80} onChange={(e) => set({ battery: Number(e.target.value) })} className={inp} /></div>
          </div>
        </div>

        <div className="mt-4 border-t border-neutral-100 pt-3">
          <p className="mb-1 text-sm font-bold text-neutral-700">Digitação</p>
          <label className="flex items-center justify-between py-1.5 text-sm"><span className="text-neutral-600">Emular digitação (indicador …)</span>
            <input type="checkbox" checked={!!tb.typing?.enabled} onChange={(e) => setTb({ typing: { ...tb.typing, enabled: e.target.checked } })} className="h-4 w-4 accent-neutral-900" /></label>
          <div className="flex items-center justify-between py-1.5 text-sm"><span className="text-neutral-600">Velocidade (caracteres/seg)</span>
            <input type="number" min={5} max={120} value={tb.typing?.speed || 28} onChange={(e) => setTb({ typing: { ...tb.typing, speed: Number(e.target.value) } })} className="w-20 rounded border border-neutral-300 px-2 py-1 text-xs" /></div>
          <div className="flex items-center justify-between py-1.5 text-sm"><span className="text-neutral-600">Atraso máx. por bolha (s)</span>
            <input type="number" min={0.3} max={5} step={0.1} value={tb.typing?.maxDelay || 1.4} onChange={(e) => setTb({ typing: { ...tb.typing, maxDelay: Number(e.target.value) } })} className="w-20 rounded border border-neutral-300 px-2 py-1 text-xs" /></div>
        </div>
      </div>
    </div>
  );
}
