"use client";

import { useState } from "react";
import type {
  Step, RouletteStep, ScratchStep, ScratchCard, MeasureStep, SliderStep, HeroStep, NameStep, ConfirmStep, QuestionStep, LoadingStep, GaugeStep,
  ResultStep, OfferStep, CaptureStep, PostStep, BridgeStep, VslStep, RouletteSegment, LoadingCheckpoint, ScarcityBar, StepAppearance,
} from "@/lib/quiz/types";
import { ROULETTE_STYLES } from "@/lib/quiz/types";
import { Field, Text, Area, VisualRichField, Num, Toggle, Select, StringList, OptionsList } from "./fields";
import { playSpinTicks, playWin } from "@/lib/quiz/sound";

/**
 * Grade de 2 colunas. DEFINIDA NO MÓDULO (fora do componente) de propósito:
 * se ficasse dentro do render, viraria um tipo novo a cada tecla e o React
 * remontaria os inputs → o campo perderia o foco a cada caractere digitado.
 */
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

/** Editor de fundo full-screen: 2 cores → gradiente + campo CSS livre + presets. */
function BgField({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  const [c1, setC1] = useState("#1a1340");
  const [c2, setC2] = useState("#0a0a1a");
  const PRESETS = [
    { name: "Roxo escuro", css: "radial-gradient(120% 80% at 50% 35%, #2a1d4d 0%, #150f29 55%, #0a0a1a 100%)" },
    { name: "Âmbar quente", css: "linear-gradient(180deg, #fbe7c6 0%, #f3c969 100%)" },
    { name: "Preto premium", css: "radial-gradient(120% 80% at 50% 30%, #1c1c22 0%, #0a0a0a 100%)" },
    { name: "Azul noite", css: "linear-gradient(180deg, #1e3a5f 0%, #0a1a2e 100%)" },
  ];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input type="color" value={c1} onChange={(e) => setC1(e.target.value)} className="h-9 w-10 rounded border border-neutral-300" title="Cor do topo" />
        <input type="color" value={c2} onChange={(e) => setC2(e.target.value)} className="h-9 w-10 rounded border border-neutral-300" title="Cor da base" />
        <button type="button" onClick={() => onChange(`linear-gradient(180deg, ${c1} 0%, ${c2} 100%)`)} className="rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-white">Aplicar gradiente</button>
        {value ? <button type="button" onClick={() => onChange(undefined)} className="text-xs font-semibold text-red-500">limpar (usa o padrão do estilo)</button> : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button key={p.name} type="button" onClick={() => onChange(p.css)} className="rounded-md border border-neutral-200 px-2 py-1 text-[11px] hover:border-neutral-400" style={{ background: p.css, color: "#fff", textShadow: "0 1px 2px #000" }}>{p.name}</button>
        ))}
      </div>
      <input className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs" value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} placeholder="linear-gradient(180deg, #f3c969, #e89b3a) ou uma cor" />
      {value ? <div className="h-10 w-full rounded-lg border border-neutral-200" style={{ background: value }} /> : null}
    </div>
  );
}

/** Editor de campos da lâmina selecionada — varia por tipo (estilo inlead). */
export default function StepEditor({ step, onChange }: { step: Step; onChange: (patch: Partial<Step>) => void }) {
  const p = (patch: Partial<Step>) => onChange(patch);

  const fields = ((): React.ReactNode => {
  switch (step.type) {
    case "roulette": {
      const s = step as RouletteStep;
      const patchSeg = (i: number, patch: Partial<RouletteSegment>) =>
        p({ segments: s.segments.map((x, k) => (k === i ? { ...x, ...patch } : x)) } as Partial<Step>);
      const setWinner = (i: number) =>
        p({ winningIndex: i, segments: s.segments.map((x, k) => ({ ...x, win: k === i })) } as Partial<Step>);
      const sound = s.sound ?? { enabled: false };
      return (
        <div className="space-y-4">
          <Grid>
            <Field label="Título"><VisualRichField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
            <Field label="Subtítulo"><Text value={s.subtitle} onChange={(v) => p({ subtitle: v } as Partial<Step>)} /></Field>
            <Field label="Imagem do miolo (URL)"><Text value={s.centerImage} onChange={(v) => p({ centerImage: v } as Partial<Step>)} /></Field>
            <Field label="Modo">
              <Select value={s.mode ?? "always"} onChange={(v) => p({ mode: v } as Partial<Step>)}
                options={[{ value: "always", label: "Sempre vence" }, { value: "random", label: "Sorteio real" }]} />
            </Field>
            <Field label="Estilo (modelo da roleta)">
              <Select value={s.style ?? "soft"} onChange={(v) => p({ style: v } as Partial<Step>)}
                options={ROULETTE_STYLES.map((st) => ({ value: st.id, label: st.name }))} />
            </Field>
          </Grid>
          <Field label="Fundo da lâmina (full-screen)"><BgField value={s.background} onChange={(v) => p({ background: v } as Partial<Step>)} /></Field>
          <div>
            <span className="mb-1 block text-xs font-semibold text-neutral-500">Segmentos (marque o vencedor)</span>
            <div className="space-y-2">
              {s.segments.map((seg, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-neutral-200 p-2">
                  <input type="radio" name="winner" checked={s.winningIndex === i} onChange={() => setWinner(i)} className="h-4 w-4 accent-neutral-900" />
                  <input type="color" value={seg.color} onChange={(e) => patchSeg(i, { color: e.target.value })} className="h-8 w-9 shrink-0 rounded border border-neutral-300" />
                  <input className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" value={seg.label} onChange={(e) => patchSeg(i, { label: e.target.value })} />
                  <button type="button" onClick={() => p({ segments: s.segments.filter((_, k) => k !== i), winningIndex: Math.min(s.winningIndex, s.segments.length - 2) } as Partial<Step>)} disabled={s.segments.length <= 2} className="shrink-0 text-sm text-red-500 disabled:opacity-30">✕</button>
                </div>
              ))}
              <button type="button" onClick={() => p({ segments: [...s.segments, { label: "Novo", color: "#f4c69b" }] } as Partial<Step>)} className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-semibold text-white">+ Segmento</button>
            </div>
          </div>
          <Grid>
            <Field label="Botão (girar)"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
            <Field label="Botão pós-vitória"><Text value={s.winCta} onChange={(v) => p({ winCta: v } as Partial<Step>)} /></Field>
            <Field label="Título da vitória"><Text value={s.winTitle} onChange={(v) => p({ winTitle: v } as Partial<Step>)} /></Field>
            <Field label="Texto da vitória"><Text value={s.winBody} onChange={(v) => p({ winBody: v } as Partial<Step>)} /></Field>
          </Grid>
          <div className="rounded-xl bg-neutral-50 p-3">
            <Toggle label="🔊 Efeito sonoro" value={sound.enabled} onChange={(v) => p({ sound: { ...sound, enabled: v } } as Partial<Step>)} />
            {sound.enabled ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <p className="col-span-full text-[11px] text-neutral-500">Vazio = som sintetizado (padrão). Cole a URL de um <b>.mp3</b> próprio, ou busque um royalty-free.</p>
                <Field label="Som do giro (.mp3, opcional)"><Text value={sound.tickUrl} onChange={(v) => p({ sound: { ...sound, tickUrl: v } } as Partial<Step>)} placeholder="https://...mp3" /></Field>
                <Field label="Som da vitória (.mp3, opcional)"><Text value={sound.winUrl} onChange={(v) => p({ sound: { ...sound, winUrl: v } } as Partial<Step>)} placeholder="https://...mp3" /></Field>
                <div className="col-span-full flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => { playSpinTicks(1400, 12); setTimeout(() => playWin(), 1500); }} className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold">▶ Testar som</button>
                  <a href="https://pixabay.com/sound-effects/search/roulette/" target="_blank" rel="noreferrer" className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold">🔎 Royalty-free (giro) ↗</a>
                  <a href="https://pixabay.com/sound-effects/search/win/" target="_blank" rel="noreferrer" className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold">🔎 Royalty-free (vitória) ↗</a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      );
    }
    case "scratch": {
      const s = step as ScratchStep;
      const sound = s.sound ?? { enabled: false };
      // migra a lâmina legada (1 card em prize/prizeEmoji) pra grade, sem perder conteúdo
      const cards: ScratchCard[] = s.cards?.length
        ? s.cards
        : [{ label: s.prize ?? "PRÊMIO", emoji: s.prizeEmoji, weight: 100, popupTitle: s.winTitle, popupBody: s.winBody }];
      const setCards = (next: ScratchCard[]) => p({ cards: next } as Partial<Step>);
      const patchCard = (i: number, patch: Partial<ScratchCard>) =>
        setCards(cards.map((c, k) => (k === i ? { ...c, ...patch } : c)));
      /** peso 100 no escolhido e 0 nos demais = "viciado" (sempre cai nele) */
      const viciar = (i: number) => setCards(cards.map((c, k) => ({ ...c, weight: k === i ? 100 : 0 })));
      const somaPesos = cards.reduce((a, c) => a + Math.max(0, Number(c.weight ?? 0)), 0);

      return (
        <div className="space-y-4">
          <Grid>
            <Field label="Título" full><VisualRichField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
            <Field label="Subtítulo" full><Text value={s.subtitle} onChange={(v) => p({ subtitle: v } as Partial<Step>)} /></Field>
            <Field label="Texto da capa"><Text value={s.coverText} onChange={(v) => p({ coverText: v } as Partial<Step>)} /></Field>
            <Field label="Estilo da capa">
              <Select value={s.coverStyle ?? "solid"} onChange={(v) => p({ coverStyle: v } as Partial<Step>)}
                options={[{ value: "solid", label: "Cor sólida" }, { value: "gradient", label: "Degradê" }]} />
            </Field>
            <Field label={s.coverStyle === "gradient" ? "Cor da capa (início)" : "Cor da capa"}>
              <input type="color" value={s.coverColor ?? "#b8b8b8"} onChange={(e) => p({ coverColor: e.target.value } as Partial<Step>)} className="h-9 w-full rounded-lg border border-neutral-300" />
            </Field>
            {s.coverStyle === "gradient" ? (
              <Field label="Cor da capa (fim)">
                <input type="color" value={s.coverColor2 ?? "#9c9c9c"} onChange={(e) => p({ coverColor2: e.target.value } as Partial<Step>)} className="h-9 w-full rounded-lg border border-neutral-300" />
              </Field>
            ) : null}
            <Field label="Cor do texto da capa">
              <input type="color" value={s.coverTextColor ?? "#000000"} onChange={(e) => p({ coverTextColor: e.target.value } as Partial<Step>)} className="h-9 w-full rounded-lg border border-neutral-300" />
            </Field>
            <Field label="Emoji da capa (vazio = sem)">
              <Text value={s.coverEmoji ?? "👆"} onChange={(v) => p({ coverEmoji: v } as Partial<Step>)} />
            </Field>
            <Field label="Tamanho do texto da capa (px)">
              <input type="number" min={10} max={32} value={s.coverTextSize ?? 15}
                onChange={(e) => p({ coverTextSize: Number(e.target.value) } as Partial<Step>)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="Colunas na grade">
              <Select value={String(s.columns ?? 2)} onChange={(v) => p({ columns: Number(v) } as Partial<Step>)}
                options={[{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }]} />
            </Field>
            <Field label="Raspar quanto p/ revelar (%)">
              <input type="number" min={5} max={90} value={s.revealPct ?? 25}
                onChange={(e) => p({ revealPct: Number(e.target.value) } as Partial<Step>)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            </Field>
          </Grid>

          {/* ── Prêmios (cards) ─────────────────────────────────────── */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <div>
                <span className="block text-xs font-semibold text-neutral-500">Prêmios da raspadinha</span>
                <span className="block text-[11px] text-neutral-400">
                  Soma dos pesos: {somaPesos} · peso <strong>100</strong> = sempre cai nele (viciado)
                </span>
              </div>
              <button type="button"
                onClick={() => setCards([...cards, { label: "NOVO PRÊMIO", color: "#a855f7", weight: 0, popupTitle: "Parabéns!", popupBody: "Você ganhou..." }])}
                className="rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-white">
                + Adicionar prêmio
              </button>
            </div>
            <div className="space-y-2">
              {cards.map((c, i) => (
                <div key={i} className="rounded-lg border border-neutral-200 p-2">
                  <div className="flex items-center gap-2">
                    <input type="radio" name="scratch-winner" title="Sempre cair neste (peso 100)"
                      checked={Number(c.weight ?? 0) >= 100} onChange={() => viciar(i)}
                      className="h-4 w-4 shrink-0 accent-neutral-900" />
                    <input className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      value={c.label} onChange={(e) => patchCard(i, { label: e.target.value })} placeholder="Copy do prêmio" />
                    <input type="color" value={c.color ?? "#a855f7"} onChange={(e) => patchCard(i, { color: e.target.value })}
                      className="h-8 w-9 shrink-0 rounded border border-neutral-300" />
                    <input type="number" min={0} max={100} title="Peso (100 = viciado)" value={c.weight ?? 0}
                      onChange={(e) => patchCard(i, { weight: Number(e.target.value) })}
                      className="w-16 shrink-0 rounded-lg border border-neutral-300 px-2 py-2 text-sm" />
                    <button type="button" onClick={() => setCards(cards.filter((_, k) => k !== i))}
                      disabled={cards.length <= 1} className="shrink-0 text-sm text-red-500 disabled:opacity-30">✕</button>
                  </div>
                  <div className="mt-2 space-y-1.5 rounded-md bg-neutral-50 p-2">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Popup de premiação</span>
                    <input className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                      value={c.popupTitle ?? ""} onChange={(e) => patchCard(i, { popupTitle: e.target.value })} placeholder="Título do popup" />
                    <textarea rows={2} className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                      value={c.popupBody ?? ""} onChange={(e) => patchCard(i, { popupBody: e.target.value })} placeholder="Mensagem do popup" />
                    <input className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                      value={c.redeemUrl ?? ""} onChange={(e) => patchCard(i, { redeemUrl: e.target.value })}
                      placeholder="Link de resgate deste prêmio (opcional — sobrepõe o link geral)" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Popup + botão ───────────────────────────────────────── */}
          <Field label="Fundo da lâmina (full-screen)" full>
            <BgField value={s.background} onChange={(v) => p({ background: v } as Partial<Step>)} />
          </Field>

          <div className="rounded-xl bg-neutral-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500">Popup de premiação</span>
              <Toggle label="Ativar popup" value={s.popupEnabled ?? true} onChange={(v) => p({ popupEnabled: v } as Partial<Step>)} />
            </div>
            <span className="mb-2 block text-[11px] text-neutral-400">
              Desligado: os cards revelam, o prêmio fica em destaque com confete e som — só não aparece o painel.
            </span>
            <Grid>
              <Field label="Fundo do popup">
                <input type="color" value={s.popupBg ?? "#16a34a"} onChange={(e) => p({ popupBg: e.target.value } as Partial<Step>)} className="h-9 w-full rounded-lg border border-neutral-300" />
              </Field>
              <Field label="Botão do popup">
                <input type="color" value={s.popupBtnBg ?? "#ffffff"} onChange={(e) => p({ popupBtnBg: e.target.value } as Partial<Step>)} className="h-9 w-full rounded-lg border border-neutral-300" />
              </Field>
              <Field label="Textos do popup">
                <input type="color" value={s.popupText ?? "#ffffff"} onChange={(e) => p({ popupText: e.target.value } as Partial<Step>)} className="h-9 w-full rounded-lg border border-neutral-300" />
              </Field>
              <Field label="Botão dentro do popup"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
            </Grid>
          </div>

          <div className="rounded-xl bg-neutral-50 p-3">
            <span className="mb-1 block text-xs font-semibold text-neutral-500">Card do prêmio ganho (destaque)</span>
            <span className="mb-2 block text-[11px] text-neutral-400">
              Deixe o fundo vazio para usar a cor do próprio prêmio.
            </span>
            <Grid>
              <Field label="Fundo do card em destaque">
                <div className="flex items-center gap-2">
                  <input type="color" value={s.destaqueBg ?? "#16a34a"} onChange={(e) => p({ destaqueBg: e.target.value } as Partial<Step>)} className="h-9 w-12 shrink-0 rounded-lg border border-neutral-300" />
                  <button type="button" onClick={() => p({ destaqueBg: "" } as Partial<Step>)}
                    className="rounded-md border border-neutral-300 px-2 py-1.5 text-[11px] font-semibold text-neutral-500">
                    usar cor do prêmio
                  </button>
                </div>
              </Field>
              <Field label="Texto do card em destaque">
                <input type="color" value={s.destaqueText ?? "#ffffff"} onChange={(e) => p({ destaqueText: e.target.value } as Partial<Step>)} className="h-9 w-full rounded-lg border border-neutral-300" />
              </Field>
              <Field label={`Opacidade dos outros cards: ${s.perdedoresOpacidade ?? 45}%`} full>
                <input type="range" min={0} max={100} value={s.perdedoresOpacidade ?? 45}
                  onChange={(e) => p({ perdedoresOpacidade: Number(e.target.value) } as Partial<Step>)}
                  className="w-full accent-neutral-900" />
                <span className="mt-0.5 block text-[11px] text-neutral-400">Quanto menor, mais o prêmio ganho se destaca.</span>
              </Field>
            </Grid>
          </div>

          <Grid>
            <Field label="Link do botão (WhatsApp)" full>
              <Text value={s.ctaUrl} onChange={(v) => p({ ctaUrl: v } as Partial<Step>)} />
            </Field>
            <Field label="Texto do botão final" full><Text value={s.winCta} onChange={(v) => p({ winCta: v } as Partial<Step>)} /></Field>
          </Grid>

          <div className="space-y-2 rounded-xl bg-neutral-50 p-3">
            <Toggle label="🔊 Som na revelação" value={sound.enabled} onChange={(v) => p({ sound: { ...sound, enabled: v } } as Partial<Step>)} />
            {sound.enabled ? (
              <div className="space-y-1">
                <span className="block text-[11px] font-semibold text-neutral-500">Som: cole a URL de um .mp3 (vazio = som padrão)</span>
                <div className="flex items-center gap-2">
                  <input className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                    value={sound.winUrl ?? ""} onChange={(e) => p({ sound: { ...sound, winUrl: e.target.value || undefined } } as Partial<Step>)}
                    placeholder="https://.../premiacao.mp3" />
                  <button type="button" title="Ouvir"
                    onClick={() => { try { new Audio(sound.winUrl || "").play(); } catch { /* noop */ } }}
                    disabled={!sound.winUrl}
                    className="shrink-0 rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-30">▶ Testar</button>
                </div>
              </div>
            ) : null}
            <Toggle label="🎉 Confete ao revelar" value={s.confete ?? true} onChange={(v) => p({ confete: v } as Partial<Step>)} />
            <Toggle label="🔒 Permitir apenas 1 raspagem por dispositivo" value={s.oncePerDevice ?? false} onChange={(v) => p({ oncePerDevice: v } as Partial<Step>)} />
          </div>
        </div>
      );
    }
    case "measure": {
      const s = step as MeasureStep;
      return (
        <Grid>
          <Field label="Pergunta" full><Text value={s.question} onChange={(v) => p({ question: v } as Partial<Step>)} /></Field>
          <Field label="Ajuda/subtítulo" full><Text value={s.help} onChange={(v) => p({ help: v } as Partial<Step>)} /></Field>
          <Field label="Unidades (toggle)"><StringList items={s.units ?? []} onChange={(v) => p({ units: v } as Partial<Step>)} addLabel="Unidade" placeholder="KG" /></Field>
          <Field label="Sufixo (se sem unidades)"><Text value={s.suffix} onChange={(v) => p({ suffix: v } as Partial<Step>)} /></Field>
          <Field label="Valor padrão"><Num value={s.defaultValue ?? 0} onChange={(v) => p({ defaultValue: v } as Partial<Step>)} /></Field>
          <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
        </Grid>
      );
    }
    case "slider": {
      const s = step as SliderStep;
      return (
        <Grid>
          <Field label="Pergunta" full><Text value={s.question} onChange={(v) => p({ question: v } as Partial<Step>)} /></Field>
          <Field label="Ajuda/subtítulo" full><Text value={s.help} onChange={(v) => p({ help: v } as Partial<Step>)} /></Field>
          <Field label="Mínimo"><Num value={s.min ?? 0} onChange={(v) => p({ min: v } as Partial<Step>)} /></Field>
          <Field label="Máximo"><Num value={s.max ?? 10} onChange={(v) => p({ max: v } as Partial<Step>)} /></Field>
          <Field label="Passo"><Num value={s.step ?? 1} onChange={(v) => p({ step: v } as Partial<Step>)} /></Field>
          <Field label="Valor padrão"><Num value={s.defaultValue ?? 5} onChange={(v) => p({ defaultValue: v } as Partial<Step>)} /></Field>
          <Field label="Sufixo"><Text value={s.suffix} onChange={(v) => p({ suffix: v } as Partial<Step>)} /></Field>
          <Field label="Imagem (URL, opcional)"><Text value={s.image} onChange={(v) => p({ image: v } as Partial<Step>)} /></Field>
          <div className="flex items-end"><Toggle label="Mostrar escala" value={s.showScale} onChange={(v) => p({ showScale: v } as Partial<Step>)} /></div>
          <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
        </Grid>
      );
    }
    case "hero": {
      const s = step as HeroStep;
      return (
        <div className="space-y-3">
          <Grid>
            <Field label="Selo (badge)"><Text value={s.badge} onChange={(v) => p({ badge: v } as Partial<Step>)} /></Field>
            <Field label="Imagem (URL)"><Text value={s.image} onChange={(v) => p({ image: v } as Partial<Step>)} /></Field>
            <Field label="Título" full><VisualRichField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
            <Field label="Subtítulo" full><VisualRichField value={s.subtitle} onChange={(v) => p({ subtitle: v } as Partial<Step>)} /></Field>
            <Field label="Botão (CTA)"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
            <Field label="Prova social"><Text value={s.social} onChange={(v) => p({ social: v } as Partial<Step>)} /></Field>
            <Field label="Tempo"><Text value={s.time} onChange={(v) => p({ time: v } as Partial<Step>)} /></Field>
          </Grid>
          <Field label="Galeria (URLs)"><StringList items={s.gallery ?? []} onChange={(v) => p({ gallery: v } as Partial<Step>)} placeholder="https://..." addLabel="Imagem" /></Field>
          {s.gallery?.length ? (
            <Grid>
              <Field label="Tamanho das fotos (px)"><Num value={s.gallerySize ?? 96} onChange={(v) => p({ gallerySize: v } as Partial<Step>)} /></Field>
              <Field label="Velocidade do carrossel (seg/volta — menor = + rápido)"><Num value={s.gallerySpeed ?? 20} onChange={(v) => p({ gallerySpeed: v } as Partial<Step>)} /></Field>
            </Grid>
          ) : null}
        </div>
      );
    }
    case "name": {
      const s = step as NameStep;
      return (
        <Grid>
          <Field label="Emoji"><Text value={s.emoji} onChange={(v) => p({ emoji: v } as Partial<Step>)} /></Field>
          <Field label="Placeholder"><Text value={s.placeholder} onChange={(v) => p({ placeholder: v } as Partial<Step>)} /></Field>
          <Field label="Título" full><VisualRichField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
          <Field label="Subtítulo" full><Text value={s.subtitle} onChange={(v) => p({ subtitle: v } as Partial<Step>)} /></Field>
          <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
        </Grid>
      );
    }
    case "confirm": {
      const s = step as ConfirmStep;
      return (
        <Grid>
          <Field label="Emoji"><Text value={s.emoji} onChange={(v) => p({ emoji: v } as Partial<Step>)} /></Field>
          <Field label="Selo"><Text value={s.seal} onChange={(v) => p({ seal: v } as Partial<Step>)} /></Field>
          <Field label="Título" full><VisualRichField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
          <Field label="Corpo (use {nome})" full><VisualRichField value={s.body} onChange={(v) => p({ body: v } as Partial<Step>)} rows={3} /></Field>
          <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
        </Grid>
      );
    }
    case "question": {
      const s = step as QuestionStep;
      return (
        <div className="space-y-3">
          <Field label="Pergunta (use {nome})"><Text value={s.question} onChange={(v) => p({ question: v } as Partial<Step>)} /></Field>
          <Field label="Ajuda/subtítulo"><Text value={s.help} onChange={(v) => p({ help: v } as Partial<Step>)} /></Field>
          <Grid>
            <Field label="Layout das opções">
              <Select value={s.layout ?? "list"} onChange={(v) => p({ layout: v } as Partial<Step>)}
                options={[{ value: "list", label: "Lista" }, { value: "cards", label: "Cards com imagem" }]} />
            </Field>
            <div className="flex items-end"><Toggle label="Múltipla escolha" value={s.multi} onChange={(v) => p({ multi: v } as Partial<Step>)} /></div>
            <Field label="Resposta define a variável (override do IP)">
              <Select value={s.captures ?? ""} onChange={(v) => p({ captures: (v || undefined) as QuestionStep["captures"] } as Partial<Step>)}
                options={[{ value: "", label: "Não (pergunta normal)" }, { value: "estado", label: "{estado} — confirma o estado" }, { value: "cidade", label: "{cidade} — confirma a cidade" }]} />
            </Field>
          </Grid>
          <Field label="Opções"><OptionsList items={s.options} onChange={(v) => p({ options: v } as Partial<Step>)} /></Field>
          <Grid>
            <Field label="Micro-loading (opcional)"><Text value={s.loadingText} onChange={(v) => p({ loadingText: v } as Partial<Step>)} /></Field>
            <Field label="Botão (vazio = auto-avança)"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
            <Field label="Insight pós-resposta (opcional)" full><Area value={s.insight} onChange={(v) => p({ insight: v } as Partial<Step>)} /></Field>
          </Grid>
        </div>
      );
    }
    case "loading": {
      const s = step as LoadingStep;
      const checklist = s.style === "checklist";
      const cps = s.checkpoints ?? [];
      const patchCp = (i: number, patch: Partial<LoadingCheckpoint>) =>
        p({ checkpoints: cps.map((c, k) => (k === i ? { ...c, ...patch } : c)) } as Partial<Step>);
      return (
        <div className="space-y-3">
          <Grid>
            <Field label="Estilo">
              <Select value={s.style ?? "simple"} onChange={(v) => p({ style: v } as Partial<Step>)}
                options={[{ value: "simple", label: "Simples (pulso + frases)" }, { value: "checklist", label: "Sofisticado (barras + micro-perguntas)" }]} />
            </Field>
            <Field label="Variante">
              <Select value={s.variant ?? "light"} onChange={(v) => p({ variant: v } as Partial<Step>)}
                options={[{ value: "light", label: "Claro" }, { value: "dark", label: "Escuro" }]} />
            </Field>
            <Field label={checklist ? "Duração total (ms)" : "Duração por slide (ms)"}><Num value={s.durationMs ?? (checklist ? 4200 : 1700)} onChange={(v) => p({ durationMs: v } as Partial<Step>)} /></Field>
            <Field label="Logo (URL)"><Text value={s.logo} onChange={(v) => p({ logo: v } as Partial<Step>)} /></Field>
          </Grid>
          {checklist ? (
            <>
              <Field label="Título do topo"><VisualRichField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
              <Field label="Barras (rótulos sequenciais)"><StringList items={s.bars ?? []} onChange={(v) => p({ bars: v } as Partial<Step>)} addLabel="Barra" placeholder="Analisando suas respostas" /></Field>
              <Field label="Legenda (use {nome})"><StringList items={s.slides} onChange={(v) => p({ slides: v } as Partial<Step>)} addLabel="Linha" /></Field>
              <div>
                <span className="mb-1 block text-xs font-semibold text-neutral-500">Micro-perguntas (modal pausa o loading)</span>
                <div className="space-y-2">
                  {cps.map((c, i) => (
                    <div key={i} className="space-y-2 rounded-lg border border-neutral-200 p-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-neutral-500">em</span>
                        <input type="number" min={1} max={99} value={c.at} onChange={(e) => patchCp(i, { at: Number(e.target.value) })} className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm" />
                        <span className="text-[11px] text-neutral-500">%</span>
                        <input value={c.question} onChange={(e) => patchCp(i, { question: e.target.value })} placeholder="Pergunta" className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" />
                        <button type="button" onClick={() => p({ checkpoints: cps.filter((_, k) => k !== i) } as Partial<Step>)} className="shrink-0 text-sm text-red-500">✕</button>
                      </div>
                      <StringList items={c.options} onChange={(v) => patchCp(i, { options: v })} addLabel="Opção" placeholder="Opção" />
                    </div>
                  ))}
                  <button type="button" onClick={() => p({ checkpoints: [...cps, { at: 50, question: "Nova pergunta?", options: ["Sim", "Não"] }] } as Partial<Step>)} className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-semibold text-white">+ Micro-pergunta</button>
                </div>
              </div>
            </>
          ) : (
            <Field label="Slides (use {nome})"><StringList items={s.slides} onChange={(v) => p({ slides: v } as Partial<Step>)} addLabel="Slide" /></Field>
          )}
        </div>
      );
    }
    case "gauge": {
      const s = step as GaugeStep;
      const zones = s.zones ?? [];
      const patchZone = (i: number, patch: Partial<{ label: string; color: string }>) =>
        p({ zones: zones.map((z, k) => (k === i ? { ...z, ...patch } : z)) } as Partial<Step>);
      return (
        <div className="space-y-3">
          <Grid>
            <Field label="Título" full><VisualRichField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
            <Field label="Subtítulo" full><Text value={s.subtitle} onChange={(v) => p({ subtitle: v } as Partial<Step>)} /></Field>
            <Field label="Ponteiro mín. (faixa)"><Num value={s.range?.[0] ?? 70} onChange={(v) => p({ range: [v, s.range?.[1] ?? 90] } as Partial<Step>)} /></Field>
            <Field label="Ponteiro máx. (faixa)"><Num value={s.range?.[1] ?? 90} onChange={(v) => p({ range: [s.range?.[0] ?? 70, v] } as Partial<Step>)} /></Field>
            <Field label="Escala mín."><Num value={s.scaleMin ?? 0} onChange={(v) => p({ scaleMin: v } as Partial<Step>)} /></Field>
            <Field label="Escala máx."><Num value={s.scaleMax ?? 100} onChange={(v) => p({ scaleMax: v } as Partial<Step>)} /></Field>
            <Field label="Sufixo"><Text value={s.suffix} onChange={(v) => p({ suffix: v } as Partial<Step>)} /></Field>
            <Field label="Veredito (use {valor})"><Text value={s.verdict} onChange={(v) => p({ verdict: v } as Partial<Step>)} /></Field>
          </Grid>
          <div>
            <span className="mb-1 block text-xs font-semibold text-neutral-500">Zonas (esquerda → direita)</span>
            <div className="space-y-2">
              {zones.map((z, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-neutral-200 p-2">
                  <input type="color" value={z.color} onChange={(e) => patchZone(i, { color: e.target.value })} className="h-8 w-9 shrink-0 rounded border border-neutral-300" />
                  <input value={z.label} onChange={(e) => patchZone(i, { label: e.target.value })} placeholder="Rótulo" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
                  <button type="button" onClick={() => p({ zones: zones.filter((_, k) => k !== i) } as Partial<Step>)} disabled={zones.length <= 1} className="shrink-0 text-sm text-red-500 disabled:opacity-30">✕</button>
                </div>
              ))}
              <button type="button" onClick={() => p({ zones: [...zones, { label: "Nova", color: "#43b97f" }] } as Partial<Step>)} className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-semibold text-white">+ Zona</button>
            </div>
          </div>
          <Field label="Legenda (use {valor}/{nome})"><VisualRichField value={s.caption} onChange={(v) => p({ caption: v } as Partial<Step>)} /></Field>
          <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
        </div>
      );
    }
    case "result": {
      const s = step as ResultStep;
      return (
        <Grid>
          <Field label="% mínimo (faixa)"><Num value={s.range[0]} onChange={(v) => p({ range: [v, s.range[1]] } as Partial<Step>)} /></Field>
          <Field label="% máximo (faixa)"><Num value={s.range[1]} onChange={(v) => p({ range: [s.range[0], v] } as Partial<Step>)} /></Field>
          <Field label="'Mínimo necessário' exibido"><Num value={s.minShown ?? 0} onChange={(v) => p({ minShown: v } as Partial<Step>)} /></Field>
          <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
          <Field label="Rótulo do anel"><Text value={s.ringLabel} onChange={(v) => p({ ringLabel: v } as Partial<Step>)} placeholder="Compatível" /></Field>
          <Field label="Título (use {nome})" full><VisualRichField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
          <Field label="Subtítulo" full><VisualRichField value={s.subtitle} onChange={(v) => p({ subtitle: v } as Partial<Step>)} /></Field>
          <Field label="Corpo" full><VisualRichField value={s.body} onChange={(v) => p({ body: v } as Partial<Step>)} rows={3} /></Field>
          <Field label="Card verde — título"><Text value={s.approvedTitle} onChange={(v) => p({ approvedTitle: v } as Partial<Step>)} placeholder="Você foi aprovada!" /></Field>
          <Field label="Card verde — texto" full><VisualRichField value={s.approvedBody} onChange={(v) => p({ approvedBody: v } as Partial<Step>)} /></Field>
        </Grid>
      );
    }
    case "offer": {
      const s = step as OfferStep;
      const stats = s.stats ?? [];
      const patchStat = (i: number, patch: Partial<{ value: string; label: string }>) =>
        p({ stats: stats.map((x, k) => (k === i ? { ...x, ...patch } : x)) } as Partial<Step>);
      return (
        <div className="space-y-4">
          <Grid>
            <Field label="Selo"><Text value={s.badge} onChange={(v) => p({ badge: v } as Partial<Step>)} /></Field>
            <Field label="Imagem (URL — foto redonda)"><Text value={s.image} onChange={(v) => p({ image: v } as Partial<Step>)} /></Field>
            <div className="flex items-end"><Toggle label="Selo verificado (azul) na foto" value={s.verified} onChange={(v) => p({ verified: v } as Partial<Step>)} /></div>
            <Field label="Título" full><VisualRichField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
            <Field label="Corpo (apresentação)" full><VisualRichField value={s.body} onChange={(v) => p({ body: v } as Partial<Step>)} rows={5} /></Field>
          </Grid>
          <div>
            <span className="mb-1 block text-xs font-semibold text-neutral-500">Caixas de prova social (ex: 5+ anos)</span>
            <div className="space-y-2">
              {stats.map((st, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-neutral-200 p-2">
                  <input className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm font-bold" value={st.value} onChange={(e) => patchStat(i, { value: e.target.value })} placeholder="5+" />
                  <input className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" value={st.label} onChange={(e) => patchStat(i, { label: e.target.value })} placeholder="anos" />
                  <button type="button" onClick={() => p({ stats: stats.filter((_, k) => k !== i) } as Partial<Step>)} className="shrink-0 text-sm text-red-500">✕</button>
                </div>
              ))}
              <button type="button" onClick={() => p({ stats: [...stats, { value: "", label: "" }] } as Partial<Step>)} className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-semibold text-white">+ Caixa</button>
            </div>
          </div>
          <div className="rounded-xl bg-[#3a241a]/5 p-3">
            <Field label="Card escuro do presente — título"><Text value={s.giftTitle} onChange={(v) => p({ giftTitle: v } as Partial<Step>)} placeholder="🎁 Presente de boas-vindas" /></Field>
            <div className="mt-3"><Field label="Card do presente — texto"><VisualRichField value={s.giftBody} onChange={(v) => p({ giftBody: v } as Partial<Step>)} rows={3} /></Field></div>
          </div>
          <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
        </div>
      );
    }
    case "capture": {
      const s = step as CaptureStep;
      return (
        <Grid>
          <Field label="Título" full><VisualRichField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
          <Field label="Corpo" full><VisualRichField value={s.body} onChange={(v) => p({ body: v } as Partial<Step>)} rows={3} /></Field>
          <Field label="Imagem (URL — ebook)"><Text value={s.image} onChange={(v) => p({ image: v } as Partial<Step>)} /></Field>
          <Field label="Selo na imagem (ex: GRÁTIS)"><Text value={s.freeBadge} onChange={(v) => p({ freeBadge: v } as Partial<Step>)} placeholder="GRÁTIS" /></Field>
          <Field label="Nota verde (WhatsApp) acima do form" full><VisualRichField value={s.note} onChange={(v) => p({ note: v } as Partial<Step>)} rows={2} /></Field>
          <Field label="Linha de segurança (abaixo do botão)" full><Text value={s.secure} onChange={(v) => p({ secure: v } as Partial<Step>)} placeholder="🔒 Seus dados estão protegidos..." /></Field>
          <Field label="Label do nome"><Text value={s.nameLabel} onChange={(v) => p({ nameLabel: v } as Partial<Step>)} /></Field>
          <Field label="Placeholder do nome"><Text value={s.namePlaceholder} onChange={(v) => p({ namePlaceholder: v } as Partial<Step>)} /></Field>
          <Field label="Label do telefone"><Text value={s.phoneLabel} onChange={(v) => p({ phoneLabel: v } as Partial<Step>)} /></Field>
          <Field label="Placeholder do telefone"><Text value={s.phonePlaceholder} onChange={(v) => p({ phonePlaceholder: v } as Partial<Step>)} /></Field>
          <Field label="Máscara do telefone (9 = dígito)">
            <Select value={s.phoneMask ?? ""} onChange={(v) => p({ phoneMask: v || undefined } as Partial<Step>)}
              options={[
                { value: "", label: "Sem máscara" },
                { value: "(99) 99999-9999", label: "(99) 99999-9999 — Brasil" },
                { value: "+55 (99) 99999-9999", label: "+55 (99) 99999-9999 — Brasil c/ país" },
                { value: "+1 (999) 999-9999", label: "+1 (999) 999-9999 — EUA" },
                { value: "+999 999 999 999", label: "+999 999 999 999 — Europa" },
              ]} />
          </Field>
          <Field label="Máscara personalizada (sobrescreve)"><Text value={s.phoneMask} onChange={(v) => p({ phoneMask: v || undefined } as Partial<Step>)} placeholder="(99) 99999-9999" /></Field>
          <Field label="id/name do telefone"><Text value={s.phoneId} onChange={(v) => p({ phoneId: v } as Partial<Step>)} placeholder="telefone" /></Field>
          <Field label="id/name do nome"><Text value={s.nameId} onChange={(v) => p({ nameId: v } as Partial<Step>)} placeholder="nome" /></Field>
          <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
          <Field label="component_id (webhook)"><Text value={s.componentId} onChange={(v) => p({ componentId: v } as Partial<Step>)} /></Field>
        </Grid>
      );
    }
    case "post_capture": {
      const s = step as PostStep;
      return (
        <Grid>
          <Field label="Título (use {nome})" full><VisualRichField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
          <Field label="Corpo" full><VisualRichField value={s.body} onChange={(v) => p({ body: v } as Partial<Step>)} rows={3} /></Field>
          <Field label="Card de aviso amarelo (🚨)" full><VisualRichField value={s.warn} onChange={(v) => p({ warn: v } as Partial<Step>)} rows={2} /></Field>
          <Field label="Card secundário (Ahhh, quase ia esquecendo…)" full><VisualRichField value={s.note} onChange={(v) => p({ note: v } as Partial<Step>)} rows={3} /></Field>
          <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
        </Grid>
      );
    }
    case "bridge": {
      const s = step as BridgeStep;
      return (
        <Grid>
          <Field label="Título" full><VisualRichField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
          <Field label="Corpo" full><VisualRichField value={s.body} onChange={(v) => p({ body: v } as Partial<Step>)} rows={3} /></Field>
          <Field label="Aviso (vermelho)" full><Text value={s.warn} onChange={(v) => p({ warn: v } as Partial<Step>)} /></Field>
          <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
        </Grid>
      );
    }
    case "vsl": {
      const s = step as VslStep;
      const bar = s.headerBar ?? { enabled: false, text: "" };
      const patchBar = (patch: Partial<ScarcityBar>) => p({ headerBar: { ...bar, ...patch } } as Partial<Step>);
      return (
        <div className="space-y-4">
          <Field label="Embed do player (cole o <script>+<iframe> do VTurb/converteai)" full>
            <Area value={s.embedHtml} onChange={(v) => p({ embedHtml: v } as Partial<Step>)} rows={5} />
          </Field>
          <p className="-mt-2 text-[11px] text-neutral-400">Cole o código completo que o VTurb gera (botão &quot;Embed&quot;). Se preencher, ele substitui o Player ID antigo.</p>
          <Grid>
            <Field label="Título (acima do vídeo)" full><VisualRichField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
            <Field label="Link do checkout" full><Text value={s.checkoutUrl} onChange={(v) => p({ checkoutUrl: v } as Partial<Step>)} /></Field>
            <Field label="Texto do botão"><Text value={s.ctaText} onChange={(v) => p({ ctaText: v } as Partial<Step>)} /></Field>
            <Field label="Liberar CTA após (seg)"><Num value={s.pitchRevealAt ?? 0} onChange={(v) => p({ pitchRevealAt: v } as Partial<Step>)} /></Field>
          </Grid>
          <Field label="Fundo da lâmina (full-screen)"><BgField value={s.background} onChange={(v) => p({ background: v } as Partial<Step>)} /></Field>
          <div className="rounded-xl bg-neutral-50 p-3">
            <Toggle label="📢 Barra de escassez/cabeçalho" value={bar.enabled} onChange={(v) => patchBar({ enabled: v })} />
            {bar.enabled ? (
              <div className="mt-3 space-y-3">
                <Field label="Texto da barra"><Text value={bar.text} onChange={(v) => patchBar({ text: v })} placeholder="⚠️ ATENÇÃO: ESTE VÍDEO SAI DO AR EM BREVE" /></Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Cor de fundo">
                    <input type="color" value={bar.bg || "#b86b00"} onChange={(e) => patchBar({ bg: e.target.value })} className="h-9 w-full rounded-lg border border-neutral-300" />
                  </Field>
                  <Field label="Cor do texto">
                    <input type="color" value={bar.color || "#ffffff"} onChange={(e) => patchBar({ color: e.target.value })} className="h-9 w-full rounded-lg border border-neutral-300" />
                  </Field>
                  <Field label="Revelar após (seg)"><Num value={bar.revealAt ?? 0} onChange={(v) => patchBar({ revealAt: v })} /></Field>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      );
    }
  }
  return null;
  })();

  return <EditorShell step={step} onChange={onChange} fields={fields} />;
}

/** Casca do editor com abas Conteúdo | Aparência (estrutura UX do inlead). */
function EditorShell({ step, onChange, fields }: { step: Step; onChange: (patch: Partial<Step>) => void; fields: React.ReactNode }) {
  const [tab, setTab] = useState<"conteudo" | "aparencia">("conteudo");
  const tabs: { key: "conteudo" | "aparencia"; label: string }[] = [
    { key: "conteudo", label: "Conteúdo" },
    { key: "aparencia", label: "Aparência" },
  ];
  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-neutral-200">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${tab === t.key ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-400 hover:text-neutral-700"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "conteudo" ? fields : <AppearanceFields step={step} onChange={onChange} />}
    </div>
  );
}

/** Aparência do título da lâmina (alinhamento/tamanho/peso/cor) — WYSIWYG fase 2. */
function AppearanceFields({ step, onChange }: { step: Step; onChange: (patch: Partial<Step>) => void }) {
  const a = step.appearance ?? {};
  const set = (patch: Partial<StepAppearance>) => onChange({ appearance: { ...a, ...patch } } as Partial<Step>);
  const ALIGNS: { v: NonNullable<StepAppearance["align"]>; ic: string }[] = [
    { v: "left", ic: "⟝" }, { v: "center", ic: "≡" }, { v: "right", ic: "⟞" },
  ];
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <p className="mb-3 text-xs font-bold text-neutral-600">🎨 Título da lâmina</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="mb-1 block text-xs font-semibold text-neutral-500">Alinhamento</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-neutral-300">
            {ALIGNS.map((al) => (
              <button key={al.v} type="button" onClick={() => set({ align: al.v })}
                className={`px-3 py-1.5 text-sm ${(a.align ?? "left") === al.v ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 hover:bg-neutral-100"}`}>{al.ic}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold text-neutral-500">Cor do título</span>
          <div className="flex items-center gap-2">
            <input type="color" value={a.titleColor ?? "#171717"} onChange={(e) => set({ titleColor: e.target.value })} className="h-9 w-12 rounded border border-neutral-300" />
            {a.titleColor ? <button type="button" onClick={() => set({ titleColor: undefined })} className="text-xs text-red-500">limpar</button> : <span className="text-[11px] text-neutral-400">padrão do tema</span>}
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-neutral-500">Tamanho do título: <b>{a.titleSize ?? 26}px</b></span>
          <input type="range" min={16} max={56} value={a.titleSize ?? 26} onChange={(e) => set({ titleSize: Number(e.target.value) })} className="w-full accent-neutral-900" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-neutral-500">Peso do título</span>
          <select className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm" value={String(a.titleWeight ?? 700)} onChange={(e) => set({ titleWeight: Number(e.target.value) })}>
            <option value="400">Normal</option>
            <option value="600">Semi-bold</option>
            <option value="700">Bold</option>
            <option value="800">Extra-bold</option>
            <option value="900">Black</option>
          </select>
        </label>
      </div>
    </div>
  );
}
