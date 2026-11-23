"use client";

import type { ReactNode } from "react";
import type { Funnel } from "@/lib/quiz/types";
import type { InleadDesign } from "@/lib/quiz/layers/types";
import { FUNNEL_FONTS, designNumber } from "@/lib/quiz/layers/design";
import { ImageField } from "./fields";
import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";
import ColorField from "@/components/ui/ColorField";
import "./design.css";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="ct-design-row"><span>{label}</span><div>{children}</div></div>;
}

export default function FunnelDesignPanel({ funnel, setFunnel }: { funnel: Funnel; setFunnel: (update: (f: Funnel) => Funnel) => void }) {
  const design: InleadDesign = funnel.settings?.design || {};
  const header = (funnel.settings?.header || {}) as Record<string, boolean>;
  const patch = (value: Partial<InleadDesign>) => setFunnel(f => ({ ...f, settings: { ...f.settings, design: { ...f.settings?.design, ...value } } }));
  const patchHeader = (value: Record<string, boolean>) => setFunnel(f => ({ ...f, settings: { ...f.settings, header: { ...f.settings?.header, ...value } } }));
  const color = (label: string, key: "themeColor" | "backgroundColor" | "titleColor" | "contentColor" | "gradientColor", fallback: string) =>
    <Row label={label}><ColorField label={label} value={design[key] || fallback} onChange={value => patch({ [key]: value })} className="h-8 w-8" /><span>{design[key] || fallback}</span></Row>;
  const range = (label: string, key: "gap" | "elementSize" | "logoSize" | "logoOpacity" | "backgroundOpacity" | "gradientAngle", fallback: number, min: number, max: number, unit: string, step = 1) => {
    const number = designNumber(String(design[key] ?? fallback).replace("px", ""), fallback, min, max);
    return <Row label={label}><input aria-label={label} type="range" min={min} max={max} step={step} value={number}
      onChange={event => patch({ [key]: key === "elementSize" ? `${event.target.value}px` : event.target.valueAsNumber })}/><output>{number}{unit}</output></Row>;
  };
  const font = (label: string, key: "featuredFont" | "contentFont") => <Row label={label}>
    <WorkspaceSelect label={label} value={design[key] || ""} onChange={value=>patch({[key]:value || undefined})} options={[{value:'',label:'Herdar do funil'},...(design[key] && !FUNNEL_FONTS.some(font=>font===design[key]) ? [{value:design[key]!,label:design[key]!}] : []),...FUNNEL_FONTS.map(font=>({value:font,label:font}))]}/>
  </Row>;
  const typography = (title: boolean) => {
    const label = title ? "títulos" : "textos";
    const size = title ? "titleSize" : "contentSize";
    const weight = title ? "titleWeight" : "contentWeight";
    const line = title ? "titleLineHeight" : "contentLineHeight";
    return <fieldset><legend>{title ? "Títulos" : "Textos"}</legend>
      {font(`Fonte dos ${label}`, title ? "featuredFont" : "contentFont")}
      {color(`Cor dos ${label}`, title ? "titleColor" : "contentColor", design.contentColor || "#000000")}
      <Row label="Tamanho"><input aria-label={`Tamanho dos ${label}`} type="number" min={12} max={title ? 96 : 40} value={design[size] ?? (title ? 32 : 17)}
        onChange={event => { if (event.target.value) patch({ [size]: designNumber(event.target.value, title ? 32 : 17, 12, title ? 96 : 40) }); }}/><span>px</span></Row>
      <Row label="Peso"><WorkspaceSelect label={`Peso dos ${label}`} value={String(design[weight] ?? (title ? 700 : 400))} onChange={value=>patch({[weight]:Number(value)})} options={[[400,'Regular'],[500,'Médio'],[600,'Seminegrito'],[700,'Negrito'],[800,'Extranegrito'],[900,'Black']].map(([value,label])=>({value:String(value),label:String(label)}))}/></Row>
      <Row label="Entrelinha"><input aria-label={`Entrelinha dos ${label}`} type="number" step=".05" min="1" max="2.5" value={design[line] ?? (title ? 1.15 : 1.45)}
        onChange={event => { if (event.target.value) patch({ [line]: designNumber(event.target.value, 1.45, 1, 2.5) }); }}/></Row>
    </fieldset>;
  };
  return <section className="ct-design-panel" aria-label="Design do funil">
    <h2>Design do funil</h2>
    <fieldset><legend>Geral</legend>
      {color("Cor de destaque", "themeColor", "#ea580c")}
      <Row label="Alinhamento vertical"><WorkspaceSelect label="Alinhamento vertical" value={design.verticalAlign || 'justify-start'} onChange={value=>patch({verticalAlign:value})} options={[{value:'justify-start',label:'Topo'},{value:'justify-center',label:'Centralizado'},{value:'justify-end',label:'Base'}]}/></Row>
      <Row label="Largura"><WorkspaceSelect label="Largura do funil" value={design.container || 'max-w-[34rem]'} onChange={value=>patch({container:value})} options={(()=>{const sizes=['max-w-[24rem]','max-w-[30rem]','max-w-[34rem]','max-w-[40rem]','max-w-[48rem]'];const options=sizes.map(value=>({value,label:`${Number(value.match(/[\d]+/)?.[0])*16}px`}));if(design.container&&!sizes.includes(design.container))options.push({value:design.container,label:'Personalizada'});return options;})()}/></Row>
      {range("Altura dos botões e opções", "elementSize", 64, 40, 88, "px")}
      {range("Espaçamento entre blocos", "gap", .6, 0, 3, "rem", .1)}
      <Row label="Bordas e cantos"><WorkspaceSelect label="Bordas e cantos" value={design.rounded || 'rounded-2xl'} onChange={value=>patch({rounded:value})} options={[["rounded-none","Retos"],["rounded","8px"],["rounded-lg","12px"],["rounded-xl","16px"],["rounded-2xl","16px (padrão)"],["rounded-3xl","24px"],["rounded-full","Pílula"]].map(([value,label])=>({value,label}))}/></Row>
    </fieldset>
    {typography(true)}{typography(false)}
    <fieldset><legend>Fundo</legend>
      {color("Cor de fundo", "backgroundColor", "#ffffff")}
      <Row label="Plano de fundo"><WorkspaceSelect label="Plano de fundo" value={design.backgroundType || 'solid'} onChange={value=>patch({backgroundType:value as InleadDesign['backgroundType']})} options={[["solid","Cor sólida"],["image","Imagem"],["gradient","Gradiente"],["effect","Pontos"],["video","Vídeo"]].map(([value,label])=>({value,label}))}/></Row>
      {design.backgroundType === "image" && <><ImageField value={design.backgroundImage?.src || ""} onChange={src => patch({ backgroundImage: { type: "image", src } })}/>
        <Row label="Ajuste da imagem"><WorkspaceSelect label="Ajuste da imagem" value={design.backgroundSize || 'cover'} onChange={value=>patch({backgroundSize:value as 'cover'|'contain'})} options={[{value:'cover',label:'Preencher'},{value:'contain',label:'Imagem inteira'}]}/></Row>
        <Row label="Posição da imagem"><WorkspaceSelect label="Posição da imagem" value={design.backgroundPosition || 'center'} onChange={value=>patch({backgroundPosition:value})} options={['center','top','bottom','left','right'].map((value,i)=>({value,label:['Centro','Topo','Base','Esquerda','Direita'][i]}))}/></Row>
      </>}
      {design.backgroundType === "gradient" && <>{color("Segunda cor", "gradientColor", "#e1eef8")}{range("Ângulo do gradiente", "gradientAngle", 135, 0, 360, "°")}</>}
      {design.backgroundType === "video" && <label className="ct-design-media">URL do vídeo<input type="url" aria-label="URL do vídeo de fundo" placeholder="https://…/fundo.mp4" value={design.backgroundVideo || ""} onChange={event => patch({ backgroundVideo: event.target.value })}/></label>}
      {(design.backgroundType === "image" || design.backgroundType === "video") && range("Opacidade do fundo", "backgroundOpacity", 100, 0, 100, "%")}
    </fieldset>
    <fieldset><legend>Marca e cabeçalho</legend>
      <ImageField value={design.logo?.src || ""} onChange={src => patch({ logo: { type: "image", src } })}/>
      {range("Tamanho da logo", "logoSize", 36, 16, 120, "px")}
      {range("Opacidade da logo", "logoOpacity", 100, 0, 100, "%")}
      <Row label="Alinhamento da logo"><WorkspaceSelect label="Alinhamento da logo" value={design.logoAlign || 'center'} onChange={value=>patch({logoAlign:value as 'left'|'center'})} options={[{value:'center',label:'Centro'},{value:'left',label:'Esquerda'}]}/></Row>
      <Row label="Barra de progresso"><WorkspaceSelect label="Estilo da barra de progresso" value={design.header?.progress || 'default'} onChange={value=>patch({header:{...design.header,progress:value}})} options={[{value:'default',label:'Padrão'},{value:'fixed',label:'Fixada ao topo'},{value:'flat',label:'Flat'}]}/></Row>
      {([["show_logo","Mostrar logo"],["show_progress","Mostrar progresso"],["show_back","Mostrar botão voltar"],["show_scroll_hint","Indicar conteúdo abaixo"]] as const).map(([key,label]) => <label key={key} className="ct-design-toggle"><span>{label}</span><input type="checkbox" checked={key === "show_scroll_hint" ? header[key] !== false : !!header[key]} onChange={event => patchHeader({ [key]: event.target.checked })}/></label>)}
      <p>A aparência da etapa pode substituir estes ajustes.</p>
    </fieldset>
  </section>;
}
