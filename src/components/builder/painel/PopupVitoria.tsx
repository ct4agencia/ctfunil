"use client";
/**
 * Componente "Popup da vitória" da roleta, aprovado pelo Luca em 26/11: tudo o
 * que é do popup sai do editor da roleta e fica aqui, em grupos minimizados e
 * nesta ordem:
 *   1. confete e efeito sonoro · 2. emoji · 3. título · 4. texto ·
 *   5. exibir como popup (liga/desliga) · 6. efeito de entrada ·
 *   7. botão (texto e link), com o redirecionamento como submecanismo.
 *
 * Os campos são os mesmos do editor de hoje (StepEditor), gravados nos mesmos
 * lugares do bloco da roleta; nada de dado novo. Onde um ajuste não vale com o
 * popup desligado (o resultado aparece na própria tela), o grupo diz isso.
 */
import { useContext, useState } from "react";
import type { RouletteStep, RouletteSegment } from "@/lib/quiz/types";
import type { Layer } from "@/lib/quiz/layers/types";
import { checarLink, linkSeguro } from "@/lib/quiz/link-seguro";
import { ROULETTE_REDIRECT_SECONDS_DEFAULT } from "@/lib/quiz/roleta-redirect";
import { AudioField, HtmlField, TemaFunilContext } from "@/components/builder/fields";
import {
  BotaoResultadoFields, CartaoPremio, CTX_PREVIA, ENTRADAS_POPUP, OrdemPopup, RedirecionamentoFields, TipografiaFields,
  avisosContraste, limparTipografia, testarSom, type PecaPopup,
} from "@/components/builder/StepEditor";
import { textoPuro } from "./modelo";
import { EscolhaCurta, GrupoComponente, Interruptor, LigaDesliga, LinhaCor, LinhaImagem, NaoValeAqui } from "./pecas";

type Grupo = "efeitos" | "emoji" | "titulo" | "texto" | "exibir" | "entrada" | "botao";

const ENTRADAS_CURTAS: Record<string, string> = { mola: "Mola", fade: "Aparecer", zoom: "Zoom", subir: "Subir", nenhuma: "Nenhuma" };
const SO_COM_POPUP = "Só com o popup ligado";

export function PopupVitoria({ layer, onChange, ultimaEtapa }: { layer: Layer; onChange: (layer: Layer) => void; ultimaEtapa: boolean }) {
  const fundoTema = useContext(TemaFunilContext);
  const [aberto, setAberto] = useState<Grupo | null>(null);
  const [previa, setPrevia] = useState(0);
  const alternar = (grupo: Grupo) => setAberto(atual => (atual === grupo ? null : grupo));

  const s = (layer.content ?? {}) as unknown as RouletteStep;
  const p = (patch: Partial<RouletteStep>) => onChange({ ...layer, content: { ...(layer.content ?? {}), ...patch } });

  const popup = !!s.popupEnabled;
  const sound = s.sound ?? { enabled: false };
  const confete = s.popupConfete !== false;
  const segmentos = s.segments ?? [];
  const indicePremio = segmentos[s.winningIndex] ? s.winningIndex : 0;
  const premio: RouletteSegment | undefined = segmentos[indicePremio];
  const emoji = premio?.emoji;
  const link = checarLink(s.winCtaUrl);
  const destino = s.winCtaUrl ? (link?.ok ? link.url.hostname.replace(/^www\./, "") : "link inválido") : "próxima etapa";
  const avisos = avisosContraste(s, fundoTema);
  const entrada = s.popupEntrada ?? "mola";

  const mudarEmoji = (valor: string) => p({ segments: segmentos.map((seg, i) => (i === indicePremio ? { ...seg, emoji: valor || undefined } : seg)) });
  const verPopup = () => {
    setPrevia(v => v + 1);
    document.getElementById("popup-vitoria-previa")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div>
      <div className="border-b border-neutral-200 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-ct-ink">Popup da vitória</h2>
            <p className="text-[11px] leading-snug text-neutral-500">O que a pessoa vê quando a roleta para no prêmio.</p>
          </div>
          <button type="button" onClick={verPopup}
            className="shrink-0 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-ct-ink hover:bg-neutral-50">
            {previa ? "Ver de novo" : "Ver o popup"}
          </button>
        </div>
        <div id="popup-vitoria-previa" className="scroll-mt-16">
          {previa ? (
            <div key={previa} className="mt-3 flex justify-center rounded-lg bg-black/55 px-4 py-6" style={{ ["--q-primary" as string]: fundoTema || "#1d4f88" }}>
              <CartaoPremio step={s} premio={premio} ctx={CTX_PREVIA} destino={linkSeguro(s.winCtaUrl, s.winCtaMensagem)}
                onBotao={() => {}} reduzir={false}
                rodape={s.popupAutoRedirect ? `Redirecionando em ${s.popupAutoRedirectSeconds ?? ROULETTE_REDIRECT_SECONDS_DEFAULT} s…` : undefined} />
            </div>
          ) : null}
          {previa && !popup ? <p className="mt-2 text-[11px] leading-snug text-neutral-500">O popup está desligado: no funil, o resultado aparece na própria tela. A prévia mostra como ficaria ligado.</p> : null}
        </div>
        {avisos.length ? (
          <ul role="status" className="mt-3 space-y-1 rounded-md bg-amber-50 px-2.5 py-2 text-[11px] font-semibold leading-snug text-amber-900 ring-1 ring-amber-200">
            {avisos.map(aviso => <li key={aviso}>{aviso}</li>)}
          </ul>
        ) : null}
      </div>

      <GrupoComponente titulo="Confete e efeito sonoro" aberto={aberto === "efeitos"} onAlternar={() => alternar("efeitos")}
        resumo={`${confete ? "Confete ligado" : "Sem confete"} · ${sound.enabled ? (sound.tickUrl || sound.winUrl ? "som próprio" : "som padrão") : "sem som"}`}>
        <LigaDesliga rotulo="Confete na vitória" ligado={confete} onMudar={v => p({ popupConfete: v ? undefined : false })} />
        <LigaDesliga rotulo="Efeito sonoro" ajuda="Som do giro e som da vitória" ligado={sound.enabled} onMudar={v => p({ sound: { ...sound, enabled: v } })} />
        {sound.enabled ? (
          <div className="space-y-3 rounded-lg bg-neutral-50 p-2.5">
            <p className="text-[11px] leading-snug text-neutral-500">Sem arquivo, a roleta usa os sons padrão.</p>
            <AudioField rotulo="Som do giro" value={sound.tickUrl} onChange={v => p({ sound: { ...sound, tickUrl: v } })} />
            <AudioField rotulo="Som da vitória" value={sound.winUrl} onChange={v => p({ sound: { ...sound, winUrl: v } })} />
            {sound.tickUrl ? (
              <LigaDesliga rotulo="Terminar o giro junto com o som do giro" ligado={!!sound.sincronizar} onMudar={v => p({ sound: { ...sound, sincronizar: v || undefined } })} />
            ) : null}
            <button type="button" onClick={() => testarSom(sound.tickUrl, sound.winUrl)}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50">Testar som</button>
          </div>
        ) : null}
        <p className="text-[11px] text-neutral-500">Valem com o popup ligado ou desligado.</p>
      </GrupoComponente>

      <GrupoComponente titulo="Emoji" aberto={aberto === "emoji"} onAlternar={() => alternar("emoji")} aviso={popup ? undefined : SO_COM_POPUP}
        resumo={<><span className="text-base leading-none">{emoji === " " ? "∅" : emoji || "🎉"}</span>entra girando e balança no topo do popup</>}>
        <label className="flex items-center gap-3 text-xs text-neutral-600">
          <input value={emoji ?? ""} onChange={e => mudarEmoji(e.target.value)} placeholder="🎉" maxLength={4} aria-label="Emoji do popup"
            className="h-12 w-16 rounded-md border border-neutral-300 text-center text-2xl" />
          <span className="leading-snug">Emoji do prêmio <strong className="text-ct-ink">{textoPuro(premio?.label) || `fatia ${indicePremio + 1}`}</strong>. Vazio usa 🎉; um espaço tira o emoji.</span>
        </label>
      </GrupoComponente>

      <GrupoComponente titulo="Título" aberto={aberto === "titulo"} onAlternar={() => alternar("titulo")}
        resumo={`${textoPuro(s.winTitle) || "Parabéns!"} · ${s.popupTitulo?.tamanho ?? 20} px`}>
        <HtmlField value={s.winTitle} onChange={v => p({ winTitle: v })} />
        {popup ? <TipografiaFields titulo="Fonte do título" valor={s.popupTitulo} padraoTamanho={20} padraoCor={s.popupText ?? "#ffffff"} onChange={v => p({ popupTitulo: v })} />
          : <NaoValeAqui>Com o popup desligado, o título aparece na própria tela com a fonte do funil. A fonte do título vale só no popup.</NaoValeAqui>}
      </GrupoComponente>

      <GrupoComponente titulo="Texto" aberto={aberto === "texto"} onAlternar={() => alternar("texto")}
        resumo={`${textoPuro(s.winBody) || "Você ganhou..."} · ${s.popupCorpo?.tamanho ?? 14} px`}>
        <HtmlField value={s.winBody} onChange={v => p({ winBody: v })} />
        {popup ? <TipografiaFields titulo="Fonte do texto" valor={s.popupCorpo} padraoTamanho={14} padraoCor={s.popupText ?? "#ffffff"} onChange={v => p({ popupCorpo: v })} />
          : <NaoValeAqui>Com o popup desligado, o texto aparece na própria tela com a fonte do funil. A fonte do texto vale só no popup.</NaoValeAqui>}
      </GrupoComponente>

      <GrupoComponente titulo="Exibir como popup" aberto={aberto === "exibir"} onAlternar={() => alternar("exibir")}
        extra={<Interruptor rotulo="Exibir como popup" ligado={popup} onMudar={v => p({ popupEnabled: v })} />}
        resumo={popup ? `Ligado · fundo ${s.popupBg ? s.popupBg.toUpperCase() : "do funil"}${s.popupImagem ? " · com imagem" : ""}` : "Desligado: o resultado aparece na própria tela"}>
        {popup ? null : <p className="text-[11px] leading-snug text-neutral-500">Desligado, o resultado aparece num cartão na própria tela, com o fundo e a cor do texto daqui.</p>}
        <LinhaCor rotulo="Fundo" valor={s.popupBg} padrao="cor do funil" onMudar={v => p({ popupBg: v })} />
        <LinhaCor rotulo="Cor do texto" valor={s.popupText} padrao="#FFFFFF" onMudar={v => p({ popupText: v })} />
        {popup ? (
          <>
            <LinhaImagem rotulo="Imagem do prêmio" src={s.popupImagem} onMudar={v => p({ popupImagem: v })} />
            {s.popupImagem ? (
              <div className="space-y-1">
                <span className="block text-xs text-neutral-600">Ordem dentro do popup (arraste)</span>
                <OrdemPopup ordem={(s.popupOrdem?.length ? s.popupOrdem : ["imagem", "texto"]) as PecaPopup[]} onChange={v => p({ popupOrdem: v })} />
                <p className="text-[11px] text-neutral-500">O emoji fica sempre no topo e o botão sempre no fim.</p>
              </div>
            ) : null}
          </>
        ) : null}
      </GrupoComponente>

      <GrupoComponente titulo="Efeito de entrada" aberto={aberto === "entrada"} onAlternar={() => alternar("entrada")} aviso={popup ? undefined : SO_COM_POPUP}
        resumo={ENTRADAS_CURTAS[entrada] ?? entrada}>
        <EscolhaCurta rotulo="Como o popup aparece" opcoes={ENTRADAS_POPUP.map(e => ({ valor: e.value, rotulo: ENTRADAS_CURTAS[e.value] ?? e.label }))}
          valor={entrada} onMudar={v => p({ popupEntrada: v === "mola" ? undefined : v })} />
        <button type="button" onClick={verPopup} className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50">Ver a entrada</button>
      </GrupoComponente>

      <GrupoComponente titulo="Botão" aberto={aberto === "botao"} onAlternar={() => alternar("botao")}
        resumo={`${textoPuro(s.winCta) || "Pegar meu prêmio"} → ${destino}${s.popupAutoRedirect ? ` · redireciona em ${s.popupAutoRedirectSeconds ?? ROULETTE_REDIRECT_SECONDS_DEFAULT} s` : ""}`}>
        <BotaoResultadoFields s={s} p={p} />
        {popup ? (
          <>
            <LinhaCor rotulo="Fundo do botão" valor={s.popupBtnBg} padrao="#FFFFFF" onMudar={v => p({ popupBtnBg: v })} />
            <LinhaCor rotulo="Texto do botão" valor={s.popupBotao?.cor} padrao="fundo do popup" onMudar={v => p({ popupBotao: limparTipografia({ ...s.popupBotao, cor: v }) })} />
            <TipografiaFields titulo="Fonte do botão" valor={s.popupBotao} padraoTamanho={15} comCor={false} onChange={v => p({ popupBotao: v })} />
          </>
        ) : <NaoValeAqui>Com o popup desligado, o botão usa o estilo do funil. Cores e fonte do botão valem só no popup.</NaoValeAqui>}
        <div className="border-t border-neutral-100 pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">↳ Redirecionamento</span>
          <RedirecionamentoFields s={s} p={p} ultimaEtapa={ultimaEtapa} />
        </div>
      </GrupoComponente>
    </div>
  );
}
