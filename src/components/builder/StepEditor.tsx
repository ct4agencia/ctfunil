"use client";

import { useState } from "react";
import type {
  Step, RouletteStep, ScratchStep, ScratchCard, MeasureStep, SliderStep, HeroStep, NameStep, ConfirmStep, QuestionStep, LoadingStep, GaugeStep,
  ResultStep, OfferStep, CaptureStep, PostStep, BridgeStep, VslStep, RouletteSegment, LoadingCheckpoint, ScarcityBar, StepAppearance,
} from "@/lib/quiz/types";
import { ROULETTE_STYLES, ROULETTE_ENGINES } from "@/lib/quiz/types";
// Presets de movimento da roleta interativa — os mesmos que /lab/roleta usa,
// para o que o Luca ouve no laboratório ser o que o funil publica.
import { PRESETS as PRESETS_ROLETA, PADRAO as PARAMS_PADRAO_ROLETA } from "@/lib/quiz/roleta-fisica";
import { Field, Text, Area, HtmlField, Num, Toggle, Select, StringList, OptionsList } from "./fields";
import { playSpinTicks, playWin } from "@/lib/quiz/sound";
// Seletor único do painel. Substitui os <input type="color"> nativos, que aqui
// apareciam em 4 tamanhos diferentes de swatch e sem campo hex.
import ColorField from "@/components/ui/ColorField";

/**
 * Grade de 2 colunas. DEFINIDA NO MÓDULO (fora do componente) de propósito:
 * se ficasse dentro do render, viraria um tipo novo a cada tecla e o React
 * remontaria os inputs → o campo perderia o foco a cada caractere digitado.
 */
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

/** Editor de fundo full-screen: 2 cores → gradiente + campo CSS livre + presets. */
function BgField({ value, onChange, onImagem }: { value?: string; onChange: (v: string | undefined) => void; onImagem?: (css: string) => void }) {
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
        <ColorField value={c1} onChange={setC1} className="h-9 w-10" label="Cor do topo" />
        <ColorField value={c2} onChange={setC2} className="h-9 w-10" label="Cor da base" />
        <button type="button" onClick={() => onChange(`linear-gradient(180deg, ${c1} 0%, ${c2} 100%)`)} className="rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-white">Aplicar gradiente</button>
        {value ? <button type="button" onClick={() => onChange(undefined)} className="text-xs font-semibold text-red-500">limpar (usa o padrão do estilo)</button> : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button key={p.name} type="button" onClick={() => onChange(p.css)} className="rounded-md border border-neutral-200 px-2 py-1 text-[11px] hover:border-neutral-400" style={{ background: p.css, color: "#fff", textShadow: "0 1px 2px #000" }}>{p.name}</button>
        ))}
      </div>
      {/* IMAGEM de fundo: sobe pro storage e vira url(...) no mesmo campo CSS */}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">
        🖼️ Anexar imagem de fundo
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const fd = new FormData();
              fd.append("file", f);
              const r = await fetch("/api/upload", { method: "POST", body: fd });
              const j = await r.json();
              if (j.url) {
                const css = `url("${j.url}")`;
                // UM patch só: a url e o enquadramento saem juntos. Separá-los
                // gerava um render intermediário com a arte sem enquadramento
                // (texto escuro sobre a imagem, logo cortada, conteúdo por cima).
                if (onImagem) onImagem(css);
                else onChange(css);
              } else alert(j.error || "Falha no upload");
            } catch { alert("Falha no upload"); }
            e.target.value = "";
          }}
        />
      </label>
      <input className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs" value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} placeholder="linear-gradient(180deg, #f3c969, #e89b3a) ou uma cor" />
      {value ? <div className="h-10 w-full rounded-lg border border-neutral-200" style={{ background: value }} /> : null}
    </div>
  );
}

/** Editor de campos da lâmina selecionada — varia por tipo (estilo inlead). */
export default function StepEditor({ step, onChange }: { step: Step; onChange: (patch: Partial<Step>) => void }) {
  // Feedback do botão "Salvar" do movimento da roleta. Volta a false a cada
  // mudança, para não ficar dizendo "Salvo" sobre algo que já mudou depois.
  const [salvoRoleta, setSalvoRoleta] = useState(false);
  /**
   * Intensidade SUGERIDA de cada modo da roleta. Vive só no painel: o
   * "Surpreenda-me" sorteia todos de uma vez e o Luca testa um por um clicando
   * nos cards — só o card clicado vai para a lâmina. Sem esse estado, sortear
   * todos gravaria seis configurações que ele ainda não ouviu.
   */
  const [sugestoes, setSugestoes] = useState<Record<string, number>>({});
  /**
   * Sugestão do modo "Personalizado". Ele não tem régua — o que se sorteia são
   * os valores crus dentro dos limites de cada controle, e por isso precisa de
   * um estado próprio em vez de caber no mapa de intensidades.
   */
  const [sugestaoCustom, setSugestaoCustom] = useState<typeof PARAMS_PADRAO_ROLETA | null>(null);
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
            <Field label="Título"><HtmlField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
            <Field label="Subtítulo"><HtmlField value={s.subtitle} onChange={(v) => p({ subtitle: v } as Partial<Step>)} /></Field>
            <Field label="Imagem do miolo (URL)"><Text value={s.centerImage} onChange={(v) => p({ centerImage: v } as Partial<Step>)} /></Field>
            <Field label="Modo">
              <Select value={s.mode ?? "always"} onChange={(v) => p({ mode: v } as Partial<Step>)}
                options={[{ value: "always", label: "Sempre vence" }, { value: "random", label: "Sorteio real" }]} />
            </Field>
            <Field label="Estilo (modelo da roleta)">
              <Select value={s.style ?? "soft"} onChange={(v) => p({ style: v } as Partial<Step>)}
                options={ROULETTE_STYLES.map((st) => ({ value: st.id, label: st.name }))} />
            </Field>
            <Field label="Tipo de roleta">
              <Select value={s.engine ?? "classica"} onChange={(v) => p({ engine: v } as Partial<Step>)}
                options={ROULETTE_ENGINES.map((e) => ({ value: e.id, label: e.name }))} />
            </Field>
          </Grid>

          {/* O tipo muda só a ANIMAÇÃO: sorteio, trava de 24 h e prêmios são os
              mesmos nos dois motores. */}
          <p className="-mt-2 text-[11px] leading-snug text-neutral-500">
            {ROULETTE_ENGINES.find((e) => e.id === (s.engine ?? "classica"))?.hint}
          </p>

          {/* MESMOS CARDS DO /lab/roleta. Um <select> escondia o que cada estilo
              faz — aqui a descrição, o eixo e a régua ficam à vista, e a escolha
              é exatamente a que se ouve no laboratório.
              O card ATIVO é o do preset salvo na lâmina; mexer na régua de outro
              card também o seleciona (senão seria preciso clicar duas vezes). */}
          {s.engine === "interativa" ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                Movimento — escolha e ajuste a intensidade
              </p>
              <div className="mt-2.5 grid gap-2">
                {PRESETS_ROLETA.filter((pr) => pr.nome !== "Personalizado").map((pr) => {
                  const escolhido = (s.preset ?? PRESETS_ROLETA[0].nome) === pr.nome;
                  // O card ATIVO mostra o que está na lâmina; os outros mostram
                  // a sugestão sorteada (ou 0). Assim o "Surpreenda-me" propõe
                  // seis movimentos sem gravar nenhum.
                  const n = escolhido ? (s.intensidade ?? 0) : (sugestoes[pr.nome] ?? 0);
                  const sugerido = !escolhido && sugestoes[pr.nome] !== undefined;
                  return (
                    <div key={pr.nome}
                      className={`rounded-lg border p-2.5 transition ${
                        escolhido ? "border-neutral-900 bg-neutral-900 text-white"
                        : sugerido ? "border-orange-300 bg-orange-50/40" : "border-neutral-200"}`}>
                      <button type="button"
                        onClick={() => p({ preset: pr.nome, intensidade: n } as Partial<Step>)}
                        className="block w-full text-left">
                        <span className="block text-xs font-bold">
                          {pr.nome}
                          {sugerido ? <span className="ml-1 font-normal text-[10px] text-orange-600">sugerido — clique para ouvir</span> : null}
                        </span>
                        <span className={`block text-[11px] leading-snug ${escolhido ? "text-neutral-300" : "text-neutral-500"}`}>
                          {pr.desc}
                        </span>
                      </button>
                      <p className="mt-2 text-[10px] text-neutral-400">{pr.eixo}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="w-6 shrink-0 text-[10px] text-neutral-400">−10</span>
                        <span className="relative flex-1">
                          <span className={`pointer-events-none absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 ${escolhido ? "bg-neutral-600" : "bg-neutral-300"}`} />
                          <input type="range" min={-10} max={10} step={1} value={n}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setSugestoes((o) => ({ ...o, [pr.nome]: v }));
                              // mexer na régua já escolhe o card: evita ter de
                              // ajustar e depois clicar para valer
                              p({ preset: pr.nome, intensidade: v } as Partial<Step>);
                              setSalvoRoleta(false);
                            }}
                            onDoubleClick={() => {
                              setSugestoes((o) => ({ ...o, [pr.nome]: 0 }));
                              p({ preset: pr.nome, intensidade: 0 } as Partial<Step>);
                            }}
                            className="relative w-full accent-orange-500"
                            title="arraste para os lados · duplo clique volta ao 0" />
                        </span>
                        <span className="w-6 shrink-0 text-right text-[10px] text-neutral-400">+10</span>
                        <b className={`w-8 shrink-0 rounded px-1 py-0.5 text-center text-[11px] tabular-nums ${
                          n === 0 ? (escolhido ? "bg-neutral-700 text-neutral-300" : "bg-neutral-100 text-neutral-500") : "bg-orange-500 text-white"
                        }`}>{n > 0 ? `+${n}` : n}</b>
                      </div>
                    </div>
                  );
                })}
                {/* PERSONALIZADO — abre os controles crus. Diferente dos outros
                    cards, ele não tem régua: aqui não há característica para
                    amplificar, os valores são o próprio ajuste. */}
                {(() => {
                  const custom = (s.preset ?? PRESETS_ROLETA[0].nome) === "Personalizado";
                  // sorteado e ainda não ouvido: mostra a proposta, não o que está salvo
                  const sugCustom = !custom && sugestaoCustom !== null;
                  const pv = custom ? (s.paramsRoleta ?? PARAMS_PADRAO_ROLETA) : (sugestaoCustom ?? PARAMS_PADRAO_ROLETA);
                  const setPv = (patch: Partial<typeof pv>) => {
                    p({ preset: "Personalizado", paramsRoleta: { ...pv, ...patch } } as Partial<Step>);
                    setSalvoRoleta(false);
                  };
                  const fino = (
                    k: keyof typeof pv, min: number, max: number, passo: number,
                    rotulo: string, menos: string, mais: string,
                  ) => (
                    <div key={k} className="border-t border-neutral-100 pt-2 first:border-0 first:pt-0">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[11px] font-semibold text-neutral-700">{rotulo}</span>
                        <b className="text-[11px] tabular-nums">{pv[k] as number}</b>
                      </div>
                      <input type="range" min={min} max={max} step={passo} value={pv[k] as number}
                        onChange={(e) => setPv({ [k]: Number(e.target.value) } as Partial<typeof pv>)}
                        className="mt-1 w-full accent-neutral-900" />
                      <div className="flex justify-between text-[10px] text-neutral-400">
                        <span>← {menos}</span><span>{mais} →</span>
                      </div>
                    </div>
                  );
                  return (
                    <div className={`rounded-lg border p-2.5 transition ${
                      custom ? "border-neutral-900 bg-neutral-900 text-white"
                      : sugCustom ? "border-orange-300 bg-orange-50/40" : "border-neutral-200"}`}>
                      <button type="button"
                        onClick={() => p({ preset: "Personalizado", paramsRoleta: pv } as Partial<Step>)}
                        className="block w-full text-left">
                        <span className="block text-xs font-bold">
                          Personalizado {custom ? "▾" : "▸"}
                          {sugCustom ? <span className="ml-1 font-normal text-[10px] text-orange-600">sugerido — clique para ouvir</span> : null}
                        </span>
                        <span className={`block text-[11px] leading-snug ${custom ? "text-neutral-300" : "text-neutral-500"}`}>
                          {sugCustom
                            ? `${pv.voltas} voltas · ${pv.duracaoAlvo}s · recuo ${pv.overshoot}°${pv.pegHang ? " · para no pino" : ""}`
                            : "Abre os controles finos. Parte do padrão e é só ajustar."}
                        </span>
                      </button>
                      {custom ? (
                        <div className="mt-2 space-y-2 rounded-lg bg-white p-2.5 text-neutral-900">
                          {fino("voltas", 2, 10, 1, "Quantas voltas ela dá", "curto", "longo")}
                          {fino("duracaoAlvo", 2, 8, 0.2, "Duração do giro (s)", "2 s", "8 s")}
                          {fino("limiarCatraca", 60, 400, 10, "Quando o suspense começa", "só no fim", "bem antes")}
                          {fino("pedagio", 0, 40, 1, "Força com que o pino segura", "escorrega", "agarra")}
                          {fino("overshoot", 0, 20, 1, "Quanto ela passa do ponto", "sem recuo", "recua muito")}
                          {fino("amortecimento", 2, 20, 0.5, "Quanto ela balança no fim", "balança", "firme")}
                          {fino("rigidez", 40, 300, 10, "Força do encaixe final", "molenga", "seco")}
                          <label className="flex cursor-pointer items-start justify-between gap-2 border-t border-neutral-100 pt-2 text-[11px]">
                            <span>
                              <b className="text-neutral-700">Parar em cima do pino</b>
                              <span className="mt-0.5 block leading-snug text-neutral-500">
                                Equilibra na divisória, hesita e tomba.
                              </span>
                            </span>
                            <input type="checkbox" checked={pv.pegHang}
                              onChange={(e) => setPv({ pegHang: e.target.checked })}
                              className="mt-0.5 h-4 w-4 shrink-0 accent-neutral-900" />
                          </label>
                          <button type="button" onClick={() => setPv(PARAMS_PADRAO_ROLETA)}
                            className="text-[10px] text-neutral-400 underline">restaurar padrão</button>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>

              <div className="mt-2.5 flex gap-2">
                {/* SURPREENDA-ME: sorteia TODOS os modos de uma vez, sem gravar
                    nenhum. Vira uma bateria de seis propostas para ouvir uma a
                    uma; só a que for clicada entra na lâmina. */}
                <button type="button"
                  onClick={() => {
                    const novas: Record<string, number> = {};
                    for (const pr of PRESETS_ROLETA) {
                      if (pr.nome === "Personalizado") continue;
                      novas[pr.nome] = Math.floor(Math.random() * 21) - 10; // -10..+10
                    }
                    setSugestoes(novas);
                    // "Personalizado" não tem régua: sorteia os valores CRUS,
                    // cada um dentro do próprio limite. `passo` respeita a casa
                    // decimal de cada controle (duração vai de 0,2 em 0,2).
                    const sorteia = (min: number, max: number, passo: number) => {
                      const casas = Math.round((max - min) / passo);
                      return Math.round((min + Math.floor(Math.random() * (casas + 1)) * passo) * 10) / 10;
                    };
                    setSugestaoCustom({
                      voltas: sorteia(3, 9, 1),
                      duracaoAlvo: sorteia(2.6, 6.4, 0.2),
                      limiarCatraca: sorteia(80, 380, 10),
                      pedagio: sorteia(4, 38, 1),
                      rigidez: sorteia(60, 280, 10),
                      amortecimento: sorteia(2.5, 16, 0.5),
                      overshoot: sorteia(0, 19, 1),
                      pegHang: Math.random() < 0.3, // hesitação é tempero, não regra
                    });
                    setSalvoRoleta(false);
                  }}
                  className="flex-1 rounded-lg border border-dashed border-neutral-300 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">
                  🎲 Surpreenda-me <span className="font-normal text-neutral-400">— sorteia os 6</span>
                </button>
                {/* SALVAR: guarda esta combinação como a preferida, no navegador.
                    A lâmina já recebe as mudanças na hora (é o funil que publica);
                    isto é para a PRÓXIMA roleta nascer com o mesmo movimento. */}
                <button type="button"
                  onClick={() => {
                    try {
                      localStorage.setItem("ct4-roleta-preferido", JSON.stringify({
                        preset: s.preset ?? PRESETS_ROLETA[0].nome,
                        intensidade: s.intensidade ?? 0,
                        params: s.paramsRoleta ?? null,
                      }));
                      setSalvoRoleta(true);
                    } catch { /* navegador sem storage: não impede publicar */ }
                  }}
                  className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                    salvoRoleta ? "bg-green-600 text-white" : "bg-neutral-900 text-white hover:bg-neutral-700"}`}>
                  {salvoRoleta ? "✓ Salvo" : "Salvar"}
                </button>
              </div>
              <p className="mt-1.5 text-center text-[10px] leading-relaxed text-neutral-400">
                <b>Surpreenda-me</b> sorteia os 6 de uma vez — clique em cada um para ouvir no
                preview. Só o clicado entra na lâmina.
                <br />0 = estilo puro · duplo clique na régua volta ao 0 ·{" "}
                <b>Salvar</b> guarda o escolhido como seu padrão para as próximas roletas
              </p>
            </div>
          ) : null}
          <Field label="Fundo da lâmina (full-screen)"><BgField value={s.background} onChange={(v) => p({ background: v } as Partial<Step>)} /></Field>
          <div>
            <span className="mb-1 block text-xs font-semibold text-neutral-500">Segmentos (marque o vencedor)</span>
            <div className="space-y-2">
              {s.segments.map((seg, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-neutral-200 p-2">
                  <input type="radio" name="winner" checked={s.winningIndex === i} onChange={() => setWinner(i)} className="h-4 w-4 accent-neutral-900" />
                  <ColorField value={seg.color} onChange={(v) => patchSeg(i, { color: v })} className="h-8 w-9" label="Cor da fatia" />
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
            <Field label="Título da vitória"><HtmlField value={s.winTitle} onChange={(v) => p({ winTitle: v } as Partial<Step>)} /></Field>
            <Field label="Texto da vitória"><HtmlField value={s.winBody} onChange={(v) => p({ winBody: v } as Partial<Step>)} /></Field>
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

          {/* POPUP DE PRÊMIO — mesmo liga/desliga da raspadinha. Desligado por
              padrão: as roletas publicadas não podem ganhar uma tela nova por
              conta de um campo que ninguém marcou. */}
          <div className="rounded-xl bg-neutral-50 p-3">
            <Toggle label="🎉 Popup de prêmio" value={s.popupEnabled ?? false} onChange={(v) => p({ popupEnabled: v } as Partial<Step>)} />
            {s.popupEnabled ? (
              <div className="mt-3 space-y-3">
                <p className="text-[11px] text-neutral-500">
                  Aparece no <b>centro da tela</b> quando a roleta para, usando o <b>título</b> e o{" "}
                  <b>texto da vitória</b> acima. O botão é o <b>botão pós-vitória</b>. Com ele ligado, o
                  card de vitória embaixo da roda não aparece (seria a mesma copy duas vezes) e o
                  avanço automático fica desativado.
                </p>
                <Grid>
                  <Field label="Fundo do popup"><ColorField value={s.popupBg ?? "#16a34a"} onChange={(v) => p({ popupBg: v } as Partial<Step>)} label="Fundo do popup" /></Field>
                  <Field label="Cor do texto"><ColorField value={s.popupText ?? "#ffffff"} onChange={(v) => p({ popupText: v } as Partial<Step>)} label="Cor do texto" /></Field>
                  <Field label="Fundo do botão"><ColorField value={s.popupBtnBg ?? "#ffffff"} onChange={(v) => p({ popupBtnBg: v } as Partial<Step>)} label="Fundo do botão" /></Field>
                </Grid>
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
            <Field label="Título" full><HtmlField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
            <Field label="Subtítulo" full><HtmlField value={s.subtitle} onChange={(v) => p({ subtitle: v } as Partial<Step>)} /></Field>
            <Field label="Texto da capa"><Text value={s.coverText} onChange={(v) => p({ coverText: v } as Partial<Step>)} /></Field>
            <Field label="Estilo da capa">
              <Select value={s.coverStyle ?? "solid"} onChange={(v) => p({ coverStyle: v } as Partial<Step>)}
                options={[{ value: "solid", label: "Cor sólida" }, { value: "gradient", label: "Degradê" }]} />
            </Field>
            <Field label={s.coverStyle === "gradient" ? "Cor da capa (início)" : "Cor da capa"}>
              <ColorField value={s.coverColor ?? "#b8b8b8"} onChange={(v) => p({ coverColor: v } as Partial<Step>)} label="Cor da capa" />
            </Field>
            {s.coverStyle === "gradient" ? (
              <Field label="Cor da capa (fim)">
                <ColorField value={s.coverColor2 ?? "#9c9c9c"} onChange={(v) => p({ coverColor2: v } as Partial<Step>)} label="Cor da capa (fim)" />
              </Field>
            ) : null}
            <Field label="Cor do texto da capa">
              <ColorField value={s.coverTextColor ?? "#000000"} onChange={(v) => p({ coverTextColor: v } as Partial<Step>)} label="Cor do texto da capa" />
            </Field>
            <Field label="Tamanho do texto da capa (px)">
              <input type="number" min={10} max={72} value={s.coverTextSize ?? 15}
                onChange={(e) => p({ coverTextSize: Number(e.target.value) } as Partial<Step>)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
              <span className="mt-0.5 block text-[11px] text-neutral-400">O texto (com emoji) quebra linha sozinho.</span>
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
                    <ColorField value={c.color ?? "#a855f7"} onChange={(v) => patchCard(i, { color: v })}
                      className="h-8 w-9" label="Cor do card" />
                    <input type="number" min={0} max={100} title="Peso (100 = viciado)" value={c.weight ?? 0}
                      onChange={(e) => patchCard(i, { weight: Number(e.target.value) })}
                      className="w-16 shrink-0 rounded-lg border border-neutral-300 px-2 py-2 text-sm" />
                    <button type="button" onClick={() => setCards(cards.filter((_, k) => k !== i))}
                      disabled={cards.length <= 1} className="shrink-0 text-sm text-red-500 disabled:opacity-30">✕</button>
                  </div>
                  <div className="mt-2 space-y-1.5 rounded-md bg-neutral-50 p-2">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Popup de premiação</span>
                    <HtmlField value={c.popupTitle ?? ""} onChange={(v) => patchCard(i, { popupTitle: v })} />
                    <HtmlField value={c.popupBody ?? ""} onChange={(v) => patchCard(i, { popupBody: v })} rows={2} />
                    <input className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                      value={c.redeemUrl ?? ""} onChange={(e) => patchCard(i, { redeemUrl: e.target.value })}
                      placeholder="Link de resgate deste prêmio (opcional — sobrepõe o link geral)" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-neutral-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-neutral-500">Popup de premiação</span>
              <div className="flex items-center gap-2">
                <Toggle label="Ativar popup" value={s.popupEnabled ?? true} onChange={(v) => p({ popupEnabled: v } as Partial<Step>)} />
                {/* "1 raspagem por dispositivo" grava `ctf_scratch_<slug>_<id>` no
                    navegador e, uma vez raspado, a lâmina abre sempre revelada —
                    impossível testar de novo sem limpar isso à mão. */}
                <button type="button" title="Esquecer a raspagem já feita neste navegador e poder testar de novo"
                  onClick={() => {
                    try {
                      const alvos = Object.keys(localStorage).filter((k) => k.startsWith("ctf_scratch_") && k.endsWith(`_${s.id}`));
                      alvos.forEach((k) => localStorage.removeItem(k));
                      alert(alvos.length ? "Raspagem resetada. Recarregue o preview." : "Nada para resetar neste navegador.");
                    } catch { /* storage bloqueado */ }
                  }}
                  className="shrink-0 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">↺ Resetar</button>
              </div>
            </div>
            <span className="mb-2 block text-[11px] text-neutral-400">
              Desligado: os cards revelam, o prêmio fica em destaque com confete e som — só não aparece o painel.
            </span>
            <Grid>
              <Field label="Fundo do popup">
                <ColorField value={s.popupBg ?? "#16a34a"} onChange={(v) => p({ popupBg: v } as Partial<Step>)} label="Fundo do popup" />
              </Field>
              <Field label="Botão do popup">
                <ColorField value={s.popupBtnBg ?? "#ffffff"} onChange={(v) => p({ popupBtnBg: v } as Partial<Step>)} label="Botão do popup" />
              </Field>
              <Field label="Textos do popup">
                <ColorField value={s.popupText ?? "#ffffff"} onChange={(v) => p({ popupText: v } as Partial<Step>)} label="Textos do popup" />
              </Field>
              <Field label="Botão dentro do popup"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
            </Grid>
          </div>

          {/* ── Popup + botão ───────────────────────────────────────── */}
          <Field label="Fundo da lâmina (full-screen)" full>
            <BgField
              value={s.background}
              onChange={(v) => p({ background: v } as Partial<Step>)}
              onImagem={(css) => p({
                background: css,
                bgSize: "cover",
                bgPosition: "top center",  // mantém a arte de cima (logo) visível
                topSpacing: 170,           // desce o conteúdo pra não cobri-la
                titleShadow: true,         // texto legível sobre a imagem
                // texto claro: sobre arte escura o preto padrão some
                appearance: { ...(s.appearance ?? {}), titleColor: "#ffffff" },
              } as Partial<Step>)}
            />
          </Field>

          {s.background ? (
            <div className="rounded-xl bg-neutral-50 p-3">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">Ajuste do fundo e do conteúdo</span>
              <span className="mb-2 block text-[11px] text-neutral-400">
                Imagem 16:9 numa tela 9:16 (celular): ancore no <strong>topo</strong> pra manter a arte de cima
                (logo) visível, e use o espaço no topo pra o conteúdo não cobri-la.
              </span>
              <Grid>
                <Field label="Encaixe da imagem">
                  <Select value={s.bgSize ?? "cover"} onChange={(v) => p({ bgSize: v } as Partial<Step>)}
                    options={[
                      { value: "cover", label: "Preencher (corta sobras)" },
                      { value: "contain", label: "Caber inteira" },
                      { value: "auto", label: "Tamanho original" },
                    ]} />
                </Field>
                <Field label="Ancorar em">
                  <Select value={s.bgPosition ?? "center"} onChange={(v) => p({ bgPosition: v } as Partial<Step>)}
                    options={[
                      { value: "top center", label: "Topo" },
                      { value: "center", label: "Centro" },
                      { value: "bottom center", label: "Rodapé" },
                    ]} />
                </Field>
                <Field label={`Espaço no topo: ${s.topSpacing ?? 0}px`} full>
                  <input type="range" min={0} max={400} step={10} value={s.topSpacing ?? 0}
                    onChange={(e) => p({ topSpacing: Number(e.target.value) } as Partial<Step>)}
                    className="w-full accent-neutral-900" />
                  <span className="mt-0.5 block text-[11px] text-neutral-400">Desce título, cards e botão.</span>
                </Field>
              </Grid>
              <div className="mt-2">
                <Toggle label="🌑 Sombra no texto (legibilidade sobre imagem)" value={s.titleShadow ?? false} onChange={(v) => p({ titleShadow: v } as Partial<Step>)} />
              </div>
            </div>
          ) : null}


          <div className="rounded-xl bg-neutral-50 p-3">
            <span className="mb-1 block text-xs font-semibold text-neutral-500">Card do prêmio ganho (destaque)</span>
            <span className="mb-2 block text-[11px] text-neutral-400">
              Deixe o fundo vazio para usar a cor do próprio prêmio.
            </span>
            <Grid>
              {/* botão em linha própria: dividindo a célula com o seletor de cor
                  ele quebrava em 3 linhas e sobrepunha o campo ao lado */}
              <Field label="Fundo do card em destaque">
                <div className="space-y-1.5">
                  <ColorField value={s.destaqueBg ?? "#16a34a"} onChange={(v) => p({ destaqueBg: v } as Partial<Step>)} label="Fundo do destaque" />
                  <button type="button" onClick={() => p({ destaqueBg: "" } as Partial<Step>)}
                    className="w-full whitespace-nowrap rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-semibold text-neutral-500 hover:bg-neutral-100">
                    usar cor do prêmio
                  </button>
                </div>
              </Field>
              <Field label="Texto do card em destaque">
                <ColorField value={s.destaqueText ?? "#ffffff"} onChange={(v) => p({ destaqueText: v } as Partial<Step>)} label="Texto do destaque" />
              </Field>
              <Field label={`Opacidade dos outros cards: ${s.perdedoresOpacidade ?? 45}%`} full>
                <input type="range" min={0} max={100} value={s.perdedoresOpacidade ?? 45}
                  onChange={(e) => p({ perdedoresOpacidade: Number(e.target.value) } as Partial<Step>)}
                  className="w-full accent-neutral-900" />
                <span className="mt-0.5 block text-[11px] text-neutral-400">Quanto menor, mais o prêmio ganho se destaca.</span>
              </Field>
              <Field label={`Escurecimento da tela ao revelar: ${s.escurecimento ?? 68}%`} full>
                <input type="range" min={0} max={100} value={s.escurecimento ?? 68}
                  onChange={(e) => p({ escurecimento: Number(e.target.value) } as Partial<Step>)}
                  className="w-full accent-neutral-900" />
                <span className="mt-0.5 block text-[11px] text-neutral-400">Efeito holofote: só o prêmio e o botão de redirect ficam iluminados. 0% desliga.</span>
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
                  {/* Sem URL o botão ficava DESABILITADO, contradizendo o rótulo
                      "vazio = som padrão" — não dava pra ouvir o padrão. Agora
                      toca o `playWin()` sintetizado e solta o confete junto,
                      que é exatamente o que a lead recebe ao revelar. */}
                  <button type="button" title="Ouvir como fica na revelação"
                    onClick={() => {
                      if (sound.winUrl) { try { new Audio(sound.winUrl).play(); } catch { /* url inválida */ } }
                      else playWin();
                      if (s.confete ?? true) {
                        import("canvas-confetti")
                          .then((m) => m.default({ particleCount: 140, spread: 80, origin: { y: 0.4 } }))
                          .catch(() => { /* pacote ausente: fica só o som */ });
                      }
                    }}
                    className="shrink-0 rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-white">▶ Testar</button>
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
          {/* `title`/`subtitle` são os nomes novos; se a lâmina veio do formato
              antigo (question/help), grava nos dois pra não perder o texto. */}
          <Field label="Pergunta" full><HtmlField value={s.title ?? s.question} onChange={(v) => p({ title: v, question: v } as Partial<Step>)} /></Field>
          <Field label="Ajuda/subtítulo" full><HtmlField value={s.subtitle ?? s.help} onChange={(v) => p({ subtitle: v, help: v } as Partial<Step>)} /></Field>
          <Field label="Mínimo da régua"><Num value={s.min ?? 0} onChange={(v) => p({ min: v } as Partial<Step>)} /></Field>
          <Field label="Máximo da régua"><Num value={s.max ?? 100} onChange={(v) => p({ max: v } as Partial<Step>)} /></Field>
          <Field label="Passo (de quanto em quanto)"><Num value={s.step ?? 1} onChange={(v) => p({ step: v || 1 } as Partial<Step>)} /></Field>
          <Field label="Começa em"><Num value={s.value ?? s.defaultValue ?? 0} onChange={(v) => p({ value: v, defaultValue: v } as Partial<Step>)} /></Field>
          <Field label="Marca numerada a cada N"><Num value={s.majorEvery ?? 5} onChange={(v) => p({ majorEvery: Math.max(1, v) } as Partial<Step>)} /></Field>
          <Field label="Sufixo (se sem unidades)"><Text value={s.suffix} onChange={(v) => p({ suffix: v } as Partial<Step>)} /></Field>
          <Field label="Unidades (toggle)"><StringList items={s.units ?? []} onChange={(v) => p({ units: v } as Partial<Step>)} addLabel="Unidade" placeholder="KG" /></Field>
          <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
          <Toggle label="Vibrar a cada marca (celular)" value={s.haptic !== false} onChange={(v) => p({ haptic: v } as Partial<Step>)} />
        </Grid>
      );
    }
    case "slider": {
      const s = step as SliderStep;
      return (
        <Grid>
          <Field label="Pergunta" full><HtmlField value={s.question} onChange={(v) => p({ question: v } as Partial<Step>)} /></Field>
          <Field label="Ajuda/subtítulo" full><HtmlField value={s.help} onChange={(v) => p({ help: v } as Partial<Step>)} /></Field>
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
            <Field label="Título" full><HtmlField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
            <Field label="Subtítulo" full><HtmlField value={s.subtitle} onChange={(v) => p({ subtitle: v } as Partial<Step>)} /></Field>
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
          <Field label="Título" full><HtmlField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
          <Field label="Subtítulo" full><HtmlField value={s.subtitle} onChange={(v) => p({ subtitle: v } as Partial<Step>)} /></Field>
          <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
        </Grid>
      );
    }
    case "confirm": {
      const s = step as ConfirmStep;
      const zonasGauge = s.gaugeZones ?? [];
      const temGauge = s.gaugeValue != null;
      const patchZonaGauge = (i: number, patch: Partial<{ label: string; color: string; upTo: number }>) =>
        p({ gaugeZones: zonasGauge.map((z, k) => (k === i ? { ...z, ...patch } : z)) } as Partial<Step>);
      return (
        <div className="space-y-3">
          <Grid>
            <Field label="Emoji"><Text value={s.emoji} onChange={(v) => p({ emoji: v } as Partial<Step>)} /></Field>
            <Field label="Selo"><Text value={s.seal} onChange={(v) => p({ seal: v } as Partial<Step>)} /></Field>
            <Field label="Título" full><HtmlField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
            <Field label="Corpo (use {nome})" full><HtmlField value={s.body} onChange={(v) => p({ body: v } as Partial<Step>)} rows={3} /></Field>
            <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
          </Grid>

          <div className="rounded-xl bg-neutral-50 p-3">
            <Toggle
              label="🎯 Mostrar medidor no topo"
              value={temGauge}
              onChange={(v) => p((v
                ? {
                    gaugeValue: 92, gaugeMax: 100, gaugeSuffix: "%",
                    gaugeZones: [
                      { label: "BAIXO", color: "#ef4444", upTo: 40 },
                      { label: "MÉDIO", color: "#f59e0b", upTo: 70 },
                      { label: "ALTO", color: "#16a34a", upTo: 100 },
                    ],
                  }
                : { gaugeValue: undefined }) as Partial<Step>)}
            />
            {temGauge ? (
              <div className="mt-2 space-y-2">
                <Grid>
                  <Field label="Valor do ponteiro"><Num value={s.gaugeValue ?? 92} onChange={(v) => p({ gaugeValue: v } as Partial<Step>)} /></Field>
                  <Field label="Escala máxima"><Num value={s.gaugeMax ?? 100} onChange={(v) => p({ gaugeMax: v || 100 } as Partial<Step>)} /></Field>
                  <Field label="Sufixo"><Text value={s.gaugeSuffix} onChange={(v) => p({ gaugeSuffix: v } as Partial<Step>)} /></Field>
                  <Field label="Rótulo fixo (vazio = nome da faixa)"><Text value={s.gaugeLabel} onChange={(v) => p({ gaugeLabel: v || undefined } as Partial<Step>)} /></Field>
                </Grid>
                <div>
                  <span className="mb-1 block text-xs font-semibold text-neutral-500">Faixas (esquerda → direita)</span>
                  <p className="mb-1.5 text-[11px] leading-snug text-neutral-400">
                    &quot;Até&quot; = valor onde a faixa termina. Todas em 0 divide o arco em partes iguais.
                  </p>
                  <div className="space-y-2">
                    {zonasGauge.map((z, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-neutral-200 p-2">
                        <ColorField value={z.color} onChange={(v) => patchZonaGauge(i, { color: v })} className="h-8 w-9" label="Cor da faixa" />
                        <input value={z.label} onChange={(e) => patchZonaGauge(i, { label: e.target.value })} placeholder="Rótulo" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
                        <input type="number" value={z.upTo ?? 0} onChange={(e) => patchZonaGauge(i, { upTo: Number(e.target.value) })}
                          title="Até que valor esta faixa vai" className="w-[68px] shrink-0 rounded-lg border border-neutral-300 px-2 py-2 text-sm tabular-nums" />
                        <button type="button" onClick={() => p({ gaugeZones: zonasGauge.filter((_, k) => k !== i) } as Partial<Step>)}
                          disabled={zonasGauge.length <= 1} className="shrink-0 text-sm text-red-500 disabled:opacity-30">✕</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => p({ gaugeZones: [...zonasGauge, { label: "Nova", color: "#43b97f" }] } as Partial<Step>)}
                      className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-semibold text-white">+ Faixa</button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      );
    }
    case "question": {
      const s = step as QuestionStep;
      return (
        <div className="space-y-3">
          <Field label="Pergunta (use {nome})"><HtmlField value={s.question} onChange={(v) => p({ question: v } as Partial<Step>)} /></Field>
          <Field label="Ajuda/subtítulo"><HtmlField value={s.help} onChange={(v) => p({ help: v } as Partial<Step>)} /></Field>
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
      const diag = s.style === "diagnostico";
      // O diagnóstico reusa os mesmos campos do checklist (título, rótulos,
      // legenda) — só as micro-perguntas ficam de fora, porque ele não pausa.
      const checklist = s.style === "checklist" || diag;
      const cps = s.checkpoints ?? [];
      const patchCp = (i: number, patch: Partial<LoadingCheckpoint>) =>
        p({ checkpoints: cps.map((c, k) => (k === i ? { ...c, ...patch } : c)) } as Partial<Step>);
      return (
        <div className="space-y-3">
          <Grid>
            <Field label="Estilo">
              <Select value={s.style ?? "simple"} onChange={(v) => p({ style: v } as Partial<Step>)}
                options={[
                  { value: "simple", label: "Simples (pulso + frases)" },
                  { value: "checklist", label: "Sofisticado (barras + micro-perguntas)" },
                  { value: "diagnostico", label: "Diagnóstico (anel + caixas com ícone)" },
                ]} />
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
              <Field label="Título do topo"><HtmlField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
              <Field label={diag ? "Caixas (uma verificação por linha)" : "Barras (rótulos sequenciais)"}>
                <StringList items={s.bars ?? []} onChange={(v) => p({ bars: v } as Partial<Step>)} addLabel={diag ? "Caixa" : "Barra"} placeholder="Analisando suas respostas" />
              </Field>
              {diag ? (
                <Field label="Ícones das caixas (emoji, mesma ordem)">
                  <StringList items={s.icons ?? []} onChange={(v) => p({ icons: v } as Partial<Step>)} addLabel="Ícone" placeholder="🔍" />
                </Field>
              ) : null}
              <Field label={diag ? "Subtítulo (use {nome})" : "Legenda (use {nome})"}><StringList items={s.slides} onChange={(v) => p({ slides: v } as Partial<Step>)} addLabel="Linha" /></Field>
              {/* micro-perguntas não existem no diagnóstico: ele não pausa */}
              {!diag ? (
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
              ) : null}
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
      const patchZone = (i: number, patch: Partial<{ label: string; color: string; upTo: number }>) =>
        p({ zones: zones.map((z, k) => (k === i ? { ...z, ...patch } : z)) } as Partial<Step>);
      const modo = s.mode ?? (s.range ? "range" : "fixed");
      return (
        <div className="space-y-3">
          <Grid>
            <Field label="Título" full><HtmlField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
            <Field label="Subtítulo" full><HtmlField value={s.subtitle} onChange={(v) => p({ subtitle: v } as Partial<Step>)} /></Field>
            <Field label="Ponteiro" full>
              <Select value={modo} onChange={(v) => p({ mode: v } as Partial<Step>)}
                options={[
                  { value: "fixed" as const, label: "Fixo — sempre no mesmo valor" },
                  { value: "range" as const, label: "Sorteado dentro de uma faixa" },
                ]} />
            </Field>
            {modo === "range" ? (
              <>
                <Field label="Ponteiro mín. (faixa)"><Num value={s.range?.[0] ?? 70} onChange={(v) => p({ range: [v, s.range?.[1] ?? 90] } as Partial<Step>)} /></Field>
                <Field label="Ponteiro máx. (faixa)"><Num value={s.range?.[1] ?? 90} onChange={(v) => p({ range: [s.range?.[0] ?? 70, v] } as Partial<Step>)} /></Field>
              </>
            ) : (
              <Field label="Valor do ponteiro" full><Num value={s.value ?? 82} onChange={(v) => p({ value: v } as Partial<Step>)} /></Field>
            )}
            <Field label="Escala mín."><Num value={s.scaleMin ?? 0} onChange={(v) => p({ scaleMin: v } as Partial<Step>)} /></Field>
            <Field label="Escala máx."><Num value={s.scaleMax ?? 100} onChange={(v) => p({ scaleMax: v } as Partial<Step>)} /></Field>
            <Field label="Marcas numeradas (0 = nenhuma)"><Num value={s.ticks ?? 5} onChange={(v) => p({ ticks: Math.max(0, v) } as Partial<Step>)} /></Field>
            <Toggle label="Mostrar o número grande" value={s.showValue !== false} onChange={(v) => p({ showValue: v } as Partial<Step>)} />
            <Field label="Sufixo"><Text value={s.suffix} onChange={(v) => p({ suffix: v } as Partial<Step>)} /></Field>
            <Field label="Veredito (use {valor})"><Text value={s.verdict} onChange={(v) => p({ verdict: v } as Partial<Step>)} /></Field>
          </Grid>
          <div>
            <span className="mb-1 block text-xs font-semibold text-neutral-500">Zonas (esquerda → direita)</span>
            <p className="mb-1.5 text-[11px] leading-snug text-neutral-400">
              &quot;Até&quot; = valor da escala onde a zona termina. Deixe todas em 0 para dividir o arco em fatias iguais.
            </p>
            <div className="space-y-2">
              {zones.map((z, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-neutral-200 p-2">
                  <ColorField value={z.color} onChange={(v) => patchZone(i, { color: v })} className="h-8 w-9" label="Cor da faixa" />
                  <input value={z.label} onChange={(e) => patchZone(i, { label: e.target.value })} placeholder="Rótulo" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
                  <input type="number" value={z.upTo ?? 0} onChange={(e) => patchZone(i, { upTo: Number(e.target.value) })}
                    title="Até que valor da escala esta zona vai" className="w-[68px] shrink-0 rounded-lg border border-neutral-300 px-2 py-2 text-sm tabular-nums" />
                  <button type="button" onClick={() => p({ zones: zones.filter((_, k) => k !== i) } as Partial<Step>)} disabled={zones.length <= 1} className="shrink-0 text-sm text-red-500 disabled:opacity-30">✕</button>
                </div>
              ))}
              <button type="button" onClick={() => p({ zones: [...zones, { label: "Nova", color: "#43b97f" }] } as Partial<Step>)} className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-semibold text-white">+ Zona</button>
            </div>
          </div>
          <Field label="Legenda (use {valor}/{nome})"><HtmlField value={s.caption} onChange={(v) => p({ caption: v } as Partial<Step>)} /></Field>
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
          <Field label="Título (use {nome})" full><HtmlField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
          <Field label="Subtítulo" full><HtmlField value={s.subtitle} onChange={(v) => p({ subtitle: v } as Partial<Step>)} /></Field>
          <Field label="Corpo" full><HtmlField value={s.body} onChange={(v) => p({ body: v } as Partial<Step>)} rows={3} /></Field>
          <Field label="Card verde — título"><Text value={s.approvedTitle} onChange={(v) => p({ approvedTitle: v } as Partial<Step>)} placeholder="Você foi aprovada!" /></Field>
          <Field label="Card verde — texto" full><HtmlField value={s.approvedBody} onChange={(v) => p({ approvedBody: v } as Partial<Step>)} /></Field>
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
            <Field label="Título" full><HtmlField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
            <Field label="Corpo (apresentação)" full><HtmlField value={s.body} onChange={(v) => p({ body: v } as Partial<Step>)} rows={5} /></Field>
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
            <div className="mt-3"><Field label="Card do presente — texto"><HtmlField value={s.giftBody} onChange={(v) => p({ giftBody: v } as Partial<Step>)} rows={3} /></Field></div>
          </div>
          <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
        </div>
      );
    }
    case "capture": {
      const s = step as CaptureStep;
      return (
        <Grid>
          <Field label="Título" full><HtmlField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
          <Field label="Corpo" full><HtmlField value={s.body} onChange={(v) => p({ body: v } as Partial<Step>)} rows={3} /></Field>
          <Field label="Imagem (URL — ebook)"><Text value={s.image} onChange={(v) => p({ image: v } as Partial<Step>)} /></Field>
          <Field label="Selo na imagem (ex: GRÁTIS)"><Text value={s.freeBadge} onChange={(v) => p({ freeBadge: v } as Partial<Step>)} placeholder="GRÁTIS" /></Field>
          <Field label="Nota verde (WhatsApp) acima do form" full><HtmlField value={s.note} onChange={(v) => p({ note: v } as Partial<Step>)} rows={2} /></Field>
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
          <Field label="Título (use {nome})" full><HtmlField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
          <Field label="Corpo" full><HtmlField value={s.body} onChange={(v) => p({ body: v } as Partial<Step>)} rows={3} /></Field>
          <Field label="Card de aviso amarelo (🚨)" full><HtmlField value={s.warn} onChange={(v) => p({ warn: v } as Partial<Step>)} rows={2} /></Field>
          <Field label="Card secundário (Ahhh, quase ia esquecendo…)" full><HtmlField value={s.note} onChange={(v) => p({ note: v } as Partial<Step>)} rows={3} /></Field>
          <Field label="Botão"><Text value={s.cta} onChange={(v) => p({ cta: v } as Partial<Step>)} /></Field>
        </Grid>
      );
    }
    case "bridge": {
      const s = step as BridgeStep;
      return (
        <Grid>
          <Field label="Título" full><HtmlField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
          <Field label="Corpo" full><HtmlField value={s.body} onChange={(v) => p({ body: v } as Partial<Step>)} rows={3} /></Field>
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
            <Field label="Título (acima do vídeo)" full><HtmlField value={s.title} onChange={(v) => p({ title: v } as Partial<Step>)} /></Field>
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
                    <ColorField value={bar.bg || "#b86b00"} onChange={(v) => patchBar({ bg: v })} label="Cor de fundo" />
                  </Field>
                  <Field label="Cor do texto">
                    <ColorField value={bar.color || "#ffffff"} onChange={(v) => patchBar({ color: v })} label="Cor do texto" />
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
            <ColorField value={a.titleColor ?? "#171717"} onChange={(v) => set({ titleColor: v })} className="h-9 w-12" label="Cor do título" />
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
