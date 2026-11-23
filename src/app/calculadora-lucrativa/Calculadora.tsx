"use client";

import Image from "next/image";
import { useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import s from "./calculadora.module.css";
import {
  CAMPOS_CUSTO, ROTULOS, VALORES_VAZIOS, calcularLucro, formatarBRL, formatarMargem, formatarPct,
  lerNumero, mascararCelular, textoParaCopiar, type CampoNumerico, type Resultado, type Valores,
} from "@/lib/calculadora-lucro";

type Ok = Extract<Resultado, { ok: true }>;
const ORDEM: CampoNumerico[] = ["material", "embalagem", "frete", "adicionais", "maoDeObra", "margem"];

const CUSTOS: { k: (typeof CAMPOS_CUSTO)[number]; label: string; ph: string; ajuda: string; obrigatorio?: boolean }[] = [
  { k: "material", label: "Custo do material", ph: "Ex.: 130,00", ajuda: "Some os materiais utilizados nesta peça.", obrigatorio: true },
  { k: "embalagem", label: "Embalagem", ph: "0,00", ajuda: "Caixa, sacola, etiqueta e outros itens de apresentação." },
  { k: "frete", label: "Custo do frete", ph: "0,00", ajuda: "Informe apenas o frete que será pago por você." },
  { k: "adicionais", label: "Custos adicionais", ph: "0,00", ajuda: "Inclua outros custos por peça que ainda não foram considerados." },
  { k: "maoDeObra", label: "Custo da mão de obra", ph: "Ex.: 15,00", ajuda: "Informe o valor do seu trabalho para produzir uma peça.", obrigatorio: true },
];

function Alerta({ children, className }: { children: ReactNode; className: string }) {
  return <span className={className}><span className={s.dot} aria-hidden="true">!</span><span>{children}</span></span>;
}

export default function Calculadora() {
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const [valores, setValores] = useState<Valores>(VALORES_VAZIOS);
  const [erros, setErros] = useState<Partial<Record<CampoNumerico, string>>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Ok | null>(null);
  const [desatualizado, setDesatualizado] = useState(false);
  const [copia, setCopia] = useState<"ok" | "falha" | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const refs = useRef<Partial<Record<CampoNumerico, HTMLInputElement | null>>>({});
  const resultadoRef = useRef<HTMLDivElement>(null);

  const alterar = (k: keyof Valores) => (e: ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value;
    if (k === "celular") v = mascararCelular(v);
    else if (k !== "nome") v = v.replace(/[^\d.,-]/g, "");
    setValores((atual) => (atual[k] === v ? atual : { ...atual, [k]: v }));
    setErros((atual) => { const resto = { ...atual }; delete resto[k as CampoNumerico]; return resto; });
    setErroGeral(null);
    setCopia(null);
    if (resultado && k !== "celular") setDesatualizado(true);
  };

  const formatarAoSair = (k: (typeof CAMPOS_CUSTO)[number]) => () => {
    const p = lerNumero(valores[k]);
    if (p.valor != null && p.valor >= 0) {
      const f = p.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (f !== valores[k]) setValores((atual) => ({ ...atual, [k]: f }));
    }
  };

  const calcular = () => {
    const r = calcularLucro(valores);
    if (!r.ok) {
      setErros(r.erros);
      setErroGeral(r.erroGeral);
      setAnuncio("");
      const primeiro = ORDEM.find((k) => r.erros[k]);
      if (primeiro) refs.current[primeiro]?.focus();
      return;
    }
    setErros({}); setErroGeral(null); setResultado(r); setDesatualizado(false); setCopia(null);
    setAnuncio(`Preço sugerido ${formatarBRL(r.preco)}. Lucro estimado ${formatarBRL(r.lucro)} por peça.`);
    requestAnimationFrame(() => {
      const alvo = resultadoRef.current;
      if (!alvo) return;
      const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      alvo.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "start" });
      alvo.focus({ preventScroll: true });
    });
  };

  const enviar = (e: FormEvent) => { e.preventDefault(); calcular(); };

  const limpar = () => {
    setValores(VALORES_VAZIOS); setErros({}); setErroGeral(null); setResultado(null);
    setDesatualizado(false); setCopia(null); setAnuncio("");
    refs.current.material?.focus();
  };

  const copiar = async () => {
    if (!resultado || desatualizado) return;
    const texto = textoParaCopiar(resultado);
    let ok = false;
    try { await navigator.clipboard.writeText(texto); ok = true; } catch {
      try {
        const t = document.createElement("textarea");
        t.value = texto; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
        document.body.appendChild(t); t.select(); ok = document.execCommand("copy"); t.remove();
      } catch { ok = false; }
    }
    setCopia(ok ? "ok" : "falha");
  };

  const descrito = (k: string, extra?: string) => [erros[k as CampoNumerico] ? id(`e-${k}`) : null, extra ?? id(`h-${k}`)].filter(Boolean).join(" ");
  const erroCampo = (k: CampoNumerico) => erros[k]
    ? <p id={id(`e-${k}`)} className={s.error}><span className={s.dot} aria-hidden="true">!</span>{erros[k]}</p> : null;
  const rotulo = (label: string, obrigatorio?: boolean) => <>{label} {obrigatorio
    ? <span className={s.req} aria-hidden="true">*</span>
    : <span className={s.optional}>(opcional)</span>}</>;

  const r = resultado;
  const pctCusto = r ? (r.custo / r.preco) * 100 : 0;
  const pctLucro = 100 - pctCusto;

  return (
    <main className={s.page}>
      <div className={s.shell}>
        <header className={s.hero}>
          <Image src="/icons/icon-192.png" alt="" aria-hidden="true" width={120} height={120} priority className={s.heroImg} sizes="120px" />
          <h1 className={s.title}>Calculadora de <span>Lucro</span></h1>
          <p className={s.lead}>Calcule seus custos, valorize seu tempo e descubra quanto cobrar por cada peça.</p>
        </header>

        <form className={`${s.card} ${s.form}`} onSubmit={enviar} noValidate aria-labelledby={id("titulo")}>
          <div className={s.formHead}>
            <h2 id={id("titulo")} className={s.h2}>Quanto custa criar sua peça?</h2>
            <p className={s.muted}>Informe os custos de uma única peça. Campos com <span className={s.req} aria-hidden="true">*</span><span className={s.srOnly}>asterisco</span> são obrigatórios.</p>
          </div>

          {erroGeral ? <div role="alert"><Alerta className={s.alert}>{erroGeral}</Alerta></div> : null}

          <fieldset className={s.group}>
            <legend className={s.legend}>Custos da peça</legend>
            {CUSTOS.map((c) => (
              <div key={c.k} className={s.field}>
                <label htmlFor={id(c.k)} className={s.label}>{rotulo(c.label, c.obrigatorio)}</label>
                <div className={s.control}>
                  <span className={`${s.affix} ${s.prefix}`} aria-hidden="true">R$</span>
                  <input
                    id={id(c.k)} ref={(el) => { refs.current[c.k] = el; }} className={`${s.input} ${s.withPrefix}`}
                    type="text" inputMode="decimal" autoComplete="off" placeholder={c.ph}
                    value={valores[c.k]} onChange={alterar(c.k)} onBlur={formatarAoSair(c.k)}
                    aria-required={c.obrigatorio || undefined} aria-invalid={erros[c.k] ? true : undefined}
                    aria-describedby={descrito(c.k)}
                  />
                </div>
                {erroCampo(c.k)}
                <p id={id(`h-${c.k}`)} className={s.help}>{c.ajuda}</p>
              </div>
            ))}
          </fieldset>

          <fieldset className={s.group}>
            <legend className={s.legend}>Lucro desejado</legend>
            <div className={s.field}>
              <label htmlFor={id("margem")} className={s.label}>{rotulo("Margem de lucro", true)}</label>
              <div className={s.control}>
                <input
                  id={id("margem")} ref={(el) => { refs.current.margem = el; }} className={`${s.input} ${s.withSuffix}`}
                  type="text" inputMode="decimal" autoComplete="off" placeholder="Ex.: 45"
                  value={valores.margem} onChange={alterar("margem")}
                  aria-required aria-invalid={erros.margem ? true : undefined} aria-describedby={descrito("margem")}
                />
                <span className={`${s.affix} ${s.suffix}`} aria-hidden="true">%</span>
              </div>
              {erroCampo("margem")}
              <p id={id("h-margem")} className={s.help}>Percentual do preço de venda que você deseja manter como lucro.</p>
            </div>
            <p className={s.note}>Sua mão de obra já está incluída nos custos. O lucro é o valor que sobra depois de cobrir todos os custos informados.</p>
          </fieldset>

          <fieldset className={s.group}>
            <legend className={s.legend}>Identificação opcional</legend>
            <div className={s.field}>
              <label htmlFor={id("nome")} className={s.label}>{rotulo("Nome da peça")}</label>
              <input id={id("nome")} className={s.input} type="text" autoComplete="off" maxLength={60}
                placeholder="Ex.: Bolsa artesanal" value={valores.nome} onChange={alterar("nome")} />
            </div>
            <div className={s.field}>
              <label htmlFor={id("celular")} className={s.label}>{rotulo("Celular do cliente")}</label>
              <input id={id("celular")} className={s.input} type="tel" inputMode="tel" autoComplete="off"
                placeholder="(11) 98765-4321" value={valores.celular} onChange={alterar("celular")} aria-describedby={id("h-celular")} />
              <p id={id("h-celular")} className={s.help}>Não interfere no cálculo.</p>
            </div>
          </fieldset>

          <div className={s.actions}>
            <button type="submit" className={s.primary}>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3.5" y="2.5" width="13" height="15" rx="3" stroke="currentColor" strokeWidth="1.8" /><rect x="6.5" y="5.5" width="7" height="3" rx="1" fill="currentColor" /><circle cx="7.5" cy="12" r="1.1" fill="currentColor" /><circle cx="12.5" cy="12" r="1.1" fill="currentColor" /><circle cx="7.5" cy="15" r="1.1" fill="currentColor" /><circle cx="12.5" cy="15" r="1.1" fill="currentColor" /></svg>
              <span>{r && desatualizado ? "Recalcular preço e lucro" : "Calcular preço e lucro"}</span>
            </button>
            <div className={s.actionsRow}>
              <p className={s.muted}>Todos os valores são por peça.</p>
              <button type="button" className={s.ghost} onClick={limpar}>Limpar campos</button>
            </div>
          </div>
        </form>

        <section aria-label="Resultado">
          <div aria-live="polite" className={s.srOnly}>{anuncio}</div>
          <div ref={resultadoRef} tabIndex={-1} className={s.result}>
            {!r ? (
              <div className={s.empty}>
                <span className={s.tag} aria-hidden="true">R$</span>
                <h2 className={s.h2}>Seu preço começa aqui</h2>
                <p className={s.emptyText}>Preencha os custos e a margem desejada para descobrir o preço sugerido da sua peça.</p>
              </div>
            ) : (
              <>
                {desatualizado ? (
                  <div role="status" className={s.stale}>
                    <p className={s.staleText}><span className={s.dot} aria-hidden="true">!</span><span><strong>Resultado desatualizado.</strong> Você alterou valores. Recalcule para ver o preço correto.</span></p>
                    <button type="button" className={s.dark} onClick={calcular}>Recalcular preço e lucro</button>
                  </div>
                ) : null}

                <div className={`${s.summary} ${desatualizado ? s.dim : ""}`}>
                  <div>
                    <h2 className={s.overline}>Preço de venda sugerido</h2>
                    {r.nome ? <p className={s.pieceName}>{r.nome}</p> : null}
                    <p className={s.price}>{formatarBRL(r.preco)}</p>
                  </div>
                  <div className={s.metrics}>
                    <div className={`${s.metric} ${s.profit}`}>
                      <span className={s.metricLabel}>Lucro estimado por peça</span>
                      <span className={s.metricValue}>{formatarBRL(r.lucro)}</span>
                    </div>
                    <div className={`${s.metric} ${s.cost}`}>
                      <span className={s.metricLabel}>Custo total</span>
                      <span className={s.metricValue}>{formatarBRL(r.custo)}</span>
                    </div>
                  </div>
                  <div className={s.marginRow}>
                    <span className={s.marginLabel}>Margem sobre a venda</span>
                    <span className={s.marginValue}>{formatarMargem(r.margemEfetiva)}</span>
                  </div>
                </div>

                <div className={`${s.card} ${s.details}`}>
                  <div className={desatualizado ? s.dim : undefined}>
                    <h3 className={s.h3}>Detalhamento dos custos</h3>
                    <dl className={s.list}>
                      {CAMPOS_CUSTO.map((k) => (
                        <div key={k} className={s.row}><dt>{ROTULOS[k]}</dt><dd>{formatarBRL(r.itens[k])}</dd></div>
                      ))}
                      <div className={`${s.row} ${s.rowTotal}`}><dt>Custo total</dt><dd>{formatarBRL(r.custo)}</dd></div>
                    </dl>
                  </div>
                  <div className={desatualizado ? s.dim : undefined} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <p className={s.label} style={{ margin: 0 }}>Composição do preço de venda</p>
                    <div className={s.bar} role="img" aria-label={`Custos ${formatarPct(pctCusto, 1)} e lucro ${formatarPct(pctLucro, 1)} do preço de venda`}>
                      <div className={s.barCost} style={{ width: `${pctCusto}%` }} />
                      <div className={s.barProfit} style={{ width: `${pctLucro}%` }} />
                    </div>
                    <div className={s.legendRow} aria-hidden="true">
                      <span className={s.legendItem}><span className={`${s.swatch} ${s.barCost}`} />Custos {formatarPct(pctCusto, 1)}</span>
                      <span className={s.legendItem}><span className={`${s.swatch} ${s.barProfit}`} />Lucro {formatarPct(pctLucro, 1)}</span>
                    </div>
                  </div>
                  <button type="button" className={s.secondary} onClick={copiar} disabled={desatualizado}>
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="6" y="6" width="9" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" /><path d="M12 3.5H5A1.5 1.5 0 0 0 3.5 5v7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                    <span>Copiar resultado</span>
                  </button>
                  {copia === "ok" ? <p role="status" className={s.ok}>Resultado copiado. O celular do cliente não foi incluído.</p> : null}
                  {copia === "falha" ? <p role="status" className={s.fail}>Não foi possível copiar neste navegador.</p> : null}
                  <p className={s.help}>Esta é uma estimativa baseada nos valores preenchidos. Taxas, impostos e outros custos não informados não estão incluídos.</p>
                </div>
              </>
            )}
          </div>
        </section>

        <section className={`${s.card} ${s.install}`} aria-labelledby={id("instalar-titulo")}>
          <h2 id={id("instalar-titulo")} className={s.h2}>Leve a calculadora para a tela inicial</h2>
          <p className={s.muted}>Abra este site no navegador do celular e siga os passos do seu aparelho.</p>
          <details className={s.installDetails}>
            <summary>iPhone ou iPad (Safari)</summary>
            <ol>
              <li>Abra esta página no Safari e toque no botão <strong>Compartilhar</strong>.</li>
              <li>Role as opções e toque em <strong>Adicionar à Tela de Início</strong>.</li>
              <li>Confirme em <strong>Adicionar</strong>. Se aparecer a opção, ative <strong>Abrir como App</strong>.</li>
            </ol>
          </details>
          <details className={s.installDetails}>
            <summary>Android (Google Chrome)</summary>
            <ol>
              <li>Abra esta página no Chrome e toque no menu <strong>⋮</strong>.</li>
              <li>Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
              <li>Confirme em <strong>Instalar</strong> ou <strong>Adicionar</strong>.</li>
            </ol>
          </details>
          <p className={s.help}>O nome da opção pode variar conforme o navegador e o aparelho.</p>
        </section>
      </div>
    </main>
  );
}
