"use client";

import type {
  Step, RouletteStep, ScratchStep, MeasureStep, SliderStep, HeroStep, NameStep, ConfirmStep, QuestionStep, LoadingStep, GaugeStep,
  ResultStep, OfferStep, CaptureStep, PostStep, BridgeStep, VslStep, RouletteSegment, LoadingCheckpoint,
} from "@/lib/quiz/types";
import { ROULETTE_STYLES } from "@/lib/quiz/types";
import { Field, Text, Area, Num, Toggle, Select, StringList, OptionsList } from "./fields";
import { playSpinTicks, playWin } from "@/lib/quiz/sound";

/** Editor de campos da lâmina selecionada — varia por tipo (estilo inlead). */
export default function StepEditor({ step, onChange }: { step: Step; onChange: (patch: Partial<Step>) => void }) {
  const p = (patch: Partial<Step>) => onChange(patch);
  const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid gap-3 sm:grid-cols-2">{children}</div>;

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
            <Field label="Título"><Text value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
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
      return (
        <div className="space-y-4">
          <Grid>
            <Field label="Título" full><Text value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
            <Field label="Subtítulo" full><Text value={s.subtitle} onChange={(v) => p({ subtitle: v } as Partial<Step>)} /></Field>
            <Field label="Prêmio (revelado)"><Text value={s.prize} onChange={(v) => p({ prize: v } as Partial<Step>)} /></Field>
            <Field label="Emoji do prêmio"><Text value={s.prizeEmoji} onChange={(v) => p({ prizeEmoji: v } as Partial<Step>)} /></Field>
            <Field label="Texto da capa"><Text value={s.coverText} onChange={(v) => p({ coverText: v } as Partial<Step>)} /></Field>
            <Field label="Cor da capa">
              <input type="color" value={s.coverColor ?? "#b8b8b8"} onChange={(e) => p({ coverColor: e.target.value } as Partial<Step>)} className="h-9 w-full rounded-lg border border-neutral-300" />
            </Field>
            <Field label="Título da vitória"><Text value={s.winTitle} onChange={(v) => p({ winTitle: v } as Partial<Step>)} /></Field>
            <Field label="Texto da vitória"><Text value={s.winBody} onChange={(v) => p({ winBody: v } as Partial<Step>)} /></Field>
            <Field label="Botão pós-revelação" full><Text value={s.winCta} onChange={(v) => p({ winCta: v } as Partial<Step>)} /></Field>
          </Grid>
          <div className="rounded-xl bg-neutral-50 p-3">
            <Toggle label="🔊 Som na revelação" value={sound.enabled} onChange={(v) => p({ sound: { ...sound, enabled: v } } as Partial<Step>)} />
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
            <Field label="Título" full><Text value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
            <Field label="Subtítulo" full><Area value={s.subtitle} onChange={(v) => p({ subtitle: v } as Partial<Step>)} /></Field>
            <Field label="Botão (CTA)"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
            <Field label="Prova social"><Text value={s.social} onChange={(v) => p({ social: v } as Partial<Step>)} /></Field>
            <Field label="Tempo"><Text value={s.time} onChange={(v) => p({ time: v } as Partial<Step>)} /></Field>
          </Grid>
          <Field label="Galeria (URLs)"><StringList items={s.gallery ?? []} onChange={(v) => p({ gallery: v } as Partial<Step>)} placeholder="https://..." addLabel="Imagem" /></Field>
        </div>
      );
    }
    case "name": {
      const s = step as NameStep;
      return (
        <Grid>
          <Field label="Emoji"><Text value={s.emoji} onChange={(v) => p({ emoji: v } as Partial<Step>)} /></Field>
          <Field label="Placeholder"><Text value={s.placeholder} onChange={(v) => p({ placeholder: v } as Partial<Step>)} /></Field>
          <Field label="Título" full><Text value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
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
          <Field label="Título" full><Text value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
          <Field label="Corpo (use {nome})" full><Area value={s.body} onChange={(v) => p({ body: v } as Partial<Step>)} /></Field>
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
              <Field label="Título do topo"><Text value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
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
            <Field label="Título" full><Text value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
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
          <Field label="Legenda (use {valor}/{nome})"><Area value={s.caption} onChange={(v) => p({ caption: v } as Partial<Step>)} /></Field>
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
          <Field label="Título (use {nome})" full><Text value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
          <Field label="Subtítulo" full><Text value={s.subtitle} onChange={(v) => p({ subtitle: v } as Partial<Step>)} /></Field>
          <Field label="Corpo" full><Area value={s.body} onChange={(v) => p({ body: v } as Partial<Step>)} /></Field>
        </Grid>
      );
    }
    case "offer": {
      const s = step as OfferStep;
      return (
        <Grid>
          <Field label="Selo"><Text value={s.badge} onChange={(v) => p({ badge: v } as Partial<Step>)} /></Field>
          <Field label="Imagem (URL)"><Text value={s.image} onChange={(v) => p({ image: v } as Partial<Step>)} /></Field>
          <Field label="Título" full><Text value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
          <Field label="Corpo" full><Area value={s.body} onChange={(v) => p({ body: v } as Partial<Step>)} rows={5} /></Field>
          <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
        </Grid>
      );
    }
    case "capture": {
      const s = step as CaptureStep;
      return (
        <Grid>
          <Field label="Título" full><Text value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
          <Field label="Corpo" full><Area value={s.body} onChange={(v) => p({ body: v } as Partial<Step>)} /></Field>
          <Field label="Imagem (URL)" full><Text value={s.image} onChange={(v) => p({ image: v } as Partial<Step>)} /></Field>
          <Field label="Label do nome"><Text value={s.nameLabel} onChange={(v) => p({ nameLabel: v } as Partial<Step>)} /></Field>
          <Field label="Placeholder do nome"><Text value={s.namePlaceholder} onChange={(v) => p({ namePlaceholder: v } as Partial<Step>)} /></Field>
          <Field label="Label do telefone"><Text value={s.phoneLabel} onChange={(v) => p({ phoneLabel: v } as Partial<Step>)} /></Field>
          <Field label="Placeholder do telefone"><Text value={s.phonePlaceholder} onChange={(v) => p({ phonePlaceholder: v } as Partial<Step>)} /></Field>
          <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
          <Field label="component_id (webhook)"><Text value={s.componentId} onChange={(v) => p({ componentId: v } as Partial<Step>)} /></Field>
        </Grid>
      );
    }
    case "post_capture": {
      const s = step as PostStep;
      return (
        <Grid>
          <Field label="Título (use {nome})" full><Text value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
          <Field label="Corpo" full><Area value={s.body} onChange={(v) => p({ body: v } as Partial<Step>)} rows={5} /></Field>
          <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
        </Grid>
      );
    }
    case "bridge": {
      const s = step as BridgeStep;
      return (
        <Grid>
          <Field label="Título" full><Text value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
          <Field label="Corpo" full><Area value={s.body} onChange={(v) => p({ body: v } as Partial<Step>)} /></Field>
          <Field label="Aviso (vermelho)" full><Text value={s.warn} onChange={(v) => p({ warn: v } as Partial<Step>)} /></Field>
          <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
        </Grid>
      );
    }
    case "vsl": {
      const s = step as VslStep;
      return (
        <Grid>
          <Field label="Título" full><Text value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
          <Field label="VTurb Player ID"><Text value={s.vturbPlayerId} onChange={(v) => p({ vturbPlayerId: v } as Partial<Step>)} /></Field>
          <Field label="VTurb Account ID"><Text value={s.vturbAccountId} onChange={(v) => p({ vturbAccountId: v } as Partial<Step>)} /></Field>
          <Field label="Link do checkout" full><Text value={s.checkoutUrl} onChange={(v) => p({ checkoutUrl: v } as Partial<Step>)} /></Field>
          <Field label="Texto do botão"><Text value={s.ctaText} onChange={(v) => p({ ctaText: v } as Partial<Step>)} /></Field>
          <Field label="Liberar CTA após (seg)"><Num value={s.pitchRevealAt ?? 0} onChange={(v) => p({ pitchRevealAt: v } as Partial<Step>)} /></Field>
        </Grid>
      );
    }
  }
}
