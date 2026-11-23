"use client";

import type { InleadStep, Layer, LayerDisplay } from "@/lib/quiz/layers/types";
import { FUNNEL_FONTS } from "@/lib/quiz/layers/design";
import { plainLabel } from "@/lib/quiz/layers/component-settings";
import { CatalogAppearance } from "./CatalogFields";
import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";
import ColorField from "@/components/ui/ColorField";
import "./component-settings.css";

type Props = { layer: Layer; onChange: (layer: Layer) => void };
const fontOptions = [{value:"",label:"Herdar do tema"},...FUNNEL_FONTS.map(font=>({value:font,label:font}))];
const weights = [{value:"",label:"Herdar"},...[400,500,600,700,800,900].map(value=>({value:String(value),label:String(value)}))];

export function StageAppearance({ step, onChange }: { step: InleadStep; onChange: (design: InleadStep['design']) => void }) {
  const d = step.design || {};
  const patch = (value: Partial<typeof d>) => onChange({ ...d, ...value });
  return <div className="ct-component-settings"><fieldset><legend>Aparência desta etapa</legend>
    <p>Campos vazios acompanham o Design do funil.</p>
    <div className="ct-component-color"><span>Fundo da etapa</span><ColorField className="h-7 w-8" label="Fundo da etapa" value={d.backgroundColor || ''} onChange={value => patch({ backgroundColor: value })} /><button onClick={() => patch({ backgroundColor: undefined })}>Herdar</button></div>
    {(['title','content'] as const).map(kind => {
      const title = kind === 'title';
      const font = title ? 'featuredFont' : 'contentFont';
      const size = title ? 'titleSize' : 'contentSize';
      const color = title ? 'titleColor' : 'contentColor';
      const weight = title ? 'titleWeight' : 'contentWeight';
      const line = title ? 'titleLineHeight' : 'contentLineHeight';
      const label = title ? 'Títulos da etapa' : 'Textos da etapa';
      return <fieldset key={kind}><legend>{label}</legend>
        <label>Fonte<WorkspaceSelect label={`Fonte — ${label}`} value={d[font] || ''} onChange={value=>patch({[font]:value||undefined})} options={fontOptions}/></label>
        <div className="ct-component-pair"><label>Tamanho (px)<input aria-label={`Tamanho — ${label}`} type="number" min="10" max="96" placeholder="Herdar" value={d[size] ?? ''} onChange={e => patch({ [size]: e.target.value ? Number(e.target.value) : undefined })} /></label>
        <label>Peso<WorkspaceSelect label={`Peso — ${label}`} value={String(d[weight] ?? '')} onChange={value=>patch({[weight]:value?Number(value):undefined})} options={weights}/></label></div>
        <label>Altura da linha<input type="number" min="1" max="3" step=".05" placeholder="Herdar" value={d[line] ?? ''} onChange={e => patch({ [line]: e.target.value ? Number(e.target.value) : undefined })} /></label>
        <div className="ct-component-color"><span>Cor</span><ColorField className="h-7 w-8" label={`Cor — ${label}`} value={d[color] || ''} onChange={value => patch({ [color]: value })} /><button onClick={() => patch({ [color]: undefined })}>Herdar</button></div>
      </fieldset>;
    })}
  </fieldset></div>;
}

export function ComponentAppearance({ layer, onChange }: Props) {
  const d = layer.design || {};
  const patch = (value: Record<string, unknown>) => onChange({ ...layer, design: { ...d, ...value } });
  const interactive = layer.type === "button" || layer.type === "options";
  return <div className="ct-component-settings">
    <fieldset><legend>Fonte do componente</legend>
      <label>Família<WorkspaceSelect label="Família" value={d.fontFamily || ''} onChange={value=>patch({fontFamily:value||undefined})} options={fontOptions}/></label>
      <div className="ct-component-pair">
        <label>Tamanho (px)<input type="number" min="10" max="96" placeholder="Herdar" value={d.fontSize ?? ""} onChange={e => patch({ fontSize: e.target.value ? Number(e.target.value) : undefined })} /></label>
        <label>Peso<WorkspaceSelect label="Peso" value={String(d.fontWeight ?? '')} onChange={value=>patch({fontWeight:value?Number(value):undefined})} options={weights}/></label>
      </div>
      <label>Altura da linha<input type="number" min="1" max="3" step="0.05" placeholder="Herdar" value={d.lineHeight ?? ""} onChange={e => patch({ lineHeight: e.target.value ? Number(e.target.value) : undefined })} /></label>
      <div className="ct-component-color"><span>Cor do texto</span><ColorField className="h-7 w-8" label="Cor do componente" value={d.textColor || ""} onChange={value => patch({ textColor: value })} /><button onClick={() => patch({ textColor: undefined })}>Herdar</button></div>
      <button onClick={() => patch({ fontFamily: undefined, fontSize: undefined, fontWeight: undefined, lineHeight: undefined, textColor: undefined })}>Restaurar fonte do tema</button>
    </fieldset>
    <CatalogAppearance layer={layer} onChange={onChange}/>
    {interactive && <>
      <fieldset><legend>Cores por estado</legend>
        <p>Personalize repouso, passagem do cursor e seleção.</p>
        {([['default','Normal'],['hover','Ao passar'],['active','Selecionado / pressionado']] as const).map(([state, label]) => <div key={state} className="ct-component-state"><strong>{label}</strong><div className="ct-component-swatches">
          {([['background','Fundo'],['color','Texto'],['border','Borda']] as const).map(([key,title]) => <span key={key}><ColorField className="h-7 w-8" label={`${label} — ${title}`} value={d.states?.[state]?.[key] || ""} onChange={value => patch({ states: { ...d.states, [state]: { ...d.states?.[state], [key]: value } } })} />{title}</span>)}
        </div></div>)}
        <button onClick={() => patch({ states: undefined })}>Restaurar cores herdadas</button>
      </fieldset>
      <fieldset><legend>Bordas e espaçamento</legend><div className="ct-component-pair">
        <label>Raio (px)<input type="number" min="0" max="100" placeholder="Herdar" value={d.cornerRadius ?? ""} onChange={e => patch({ cornerRadius: e.target.value ? Number(e.target.value) : undefined })} /></label>
        <label>Borda (px)<input type="number" min="0" max="12" placeholder="Herdar" value={d.borderWidth ?? ""} onChange={e => patch({ borderWidth: e.target.value ? Number(e.target.value) : undefined })} /></label>
      </div>
      <label>Sombra<WorkspaceSelect label="Sombra" value={d.componentShadow ?? ''} onChange={value=>patch({componentShadow:value||undefined})} options={[["","Herdar"],["none","Sem sombra"],["small","Pequena"],["medium","Média"],["large","Grande"]].map(([value,label])=>({value,label}))}/></label>
      {layer.type === "options" && <>
        <label>Espaço entre respostas (px)<input type="number" min="0" max="48" placeholder="Herdar" value={d.optionGap ?? ""} onChange={e => patch({ optionGap: e.target.value ? Number(e.target.value) : undefined })} /></label>
        <label>Orientação<WorkspaceSelect label="Orientação" value={d.orientation||''} onChange={value=>patch({orientation:value||undefined})} options={[["","Automática"],["horizontal","Horizontal"],["vertical","Vertical"]].map(([value,label])=>({value,label}))}/></label>
        <label>Proporção da imagem<WorkspaceSelect label="Proporção da imagem" value={d.imageRatio||''} onChange={value=>patch({imageRatio:value||undefined})} options={[{value:'',label:'Original'},...['1 / 1','16 / 9','4 / 3','9 / 16'].map(value=>({value,label:value}))]}/></label>
        <label className="ct-component-toggle"><input type="checkbox" checked={!!d.imageAfterText} onChange={e => patch({ imageAfterText: e.target.checked })} />Texto antes da imagem</label>
      </>}
      {layer.type === "button" && <>
        <label className="ct-component-toggle"><input type="checkbox" checked={d.relief !== false} onChange={e => patch({ relief: e.target.checked })} />Efeito de relevo</label>
        <label className="ct-component-toggle"><input type="checkbox" checked={!!d.stickyFooter} onChange={e => patch({ stickyFooter: e.target.checked })} />Fixar no rodapé ao rolar</label>
      </>}
      </fieldset>
    </>}
  </div>;
}

export function ComponentDisplay({ layer, steps, onChange }: Props & { steps: InleadStep[] }) {
  const display = layer.display || {};
  const patch = (value: Partial<LayerDisplay>) => onChange({ ...layer, display: { ...display, ...value } });
  const sources = steps.flatMap(step => step.layers.filter(item => item.id !== layer.id && ['options','field'].includes(item.type)).map(item => ({ item, step })));
  return <div className="ct-component-settings">
    <fieldset><legend>Quando aparece</legend>
      <label>Atraso (segundos)<input type="number" min="0" max="86400" value={layer.effects?.starts ?? 0} onChange={e => onChange({ ...layer, effects: { ...layer.effects, starts: Math.max(0, Number(e.target.value)) } })} /></label>
      <label className="ct-component-toggle"><input type="checkbox" checked={!!display.preserveSpace} onChange={e => patch({ preserveSpace: e.target.checked })} />Preservar área durante o atraso</label>
      <label>Entrada<WorkspaceSelect label="Entrada" value={display.entrance ?? ''} onChange={value=>patch({entrance:(value||undefined) as LayerDisplay['entrance']})} options={[["","Padrão do funil"],["none","Estático"],["fade","Aparecer suavemente"],["slide","Deslizar de baixo"],["zoom","Ampliar"]].map(([value,label])=>({value,label}))}/></label>
      <label>Depois de aparecer<WorkspaceSelect label="Depois de aparecer" value={display.behavior || 'none'} onChange={value=>patch({behavior:value as LayerDisplay['behavior']})} options={[["none","Estático"],["pulse","Pulsar"],["float","Flutuar"]].map(([value,label])=>({value,label}))}/></label>
      <label>Dispositivos<WorkspaceSelect label="Dispositivos" value={display.device || 'all'} onChange={value=>patch({device:value as LayerDisplay['device']})} options={[["all","Todos"],["mobile","Celular (até 767 px)"],["desktop","Computador (768 px ou mais)"]].map(([value,label])=>({value,label}))}/></label>
      <label className="ct-component-toggle"><input type="checkbox" checked={!!layer.design?.hidden} onChange={e => onChange({ ...layer, design: { ...layer.design, hidden: e.target.checked } })} />Ocultar componente</label>
    </fieldset>
    <fieldset><legend>Regras por resposta</legend><p>Sem regras, o componente aparece sempre.</p>
      <p>Condições do grupo usam E. Entre grupos, vale OU.</p>
      {(display.groups || (display.rules?.length ? (display.match === 'any' ? display.rules.map(rule => [rule]) : [display.rules]) : [])).map((group,groupIndex,groups) => <fieldset key={groupIndex}><legend>Grupo {groupIndex + 1}</legend>
        {group.map((rule,index) => {
          const update = (value: Partial<typeof rule>) => patch({ rules: undefined, match: undefined, groups: groups.map((g,gi) => gi === groupIndex ? g.map((item,i)=>i===index?{...item,...value}:item) : g) });
          const source = sources.find(({item}) => (item.type === 'field' ? item.content.name || item.content.id || item.id : item.id) === rule.source)?.item;
          return <div className="ct-component-rule" key={index}>
            <label>Resposta de<WorkspaceSelect label="Resposta de" value={rule.source} onChange={value=>update({source:value,value:''})} options={[{value:'',label:'Escolha um componente'},{value:'__total_points__',label:'Total de pontos'},...sources.map(({item,step})=>({value:item.type==='field'?item.content.name||item.content.id||item.id:item.id,label:`${step.title} · ${item.title||item.webhookKey||item.type}`}))]}/></label>
            <label>Condição<WorkspaceSelect label="Condição" value={rule.operator} onChange={value=>update({operator:value as typeof rule.operator})} options={[["equals","É igual a"],["notEquals","É diferente de"],["greater","Maior que"],["greaterEqual","Maior ou igual"],["less","Menor que"],["lessEqual","Menor ou igual"],["contains","Contém"],["answered","Foi respondido"],["empty","Não foi respondido"]].map(([value,label])=>({value,label}))}/></label>
            {!['answered','empty'].includes(rule.operator)&&<label>Resposta esperada{source?.type==='options'&&['equals','notEquals'].includes(rule.operator)?<WorkspaceSelect label="Resposta esperada" value={rule.value||''} onChange={value=>update({value})} options={[{value:'',label:'Escolha uma resposta'},...(source.content.options||[]).map(option=>({value:option.id,label:plainLabel(option.label)}))]}/>:<input value={rule.value||''} onChange={e=>update({value:e.target.value})}/>}</label>}
            <button onClick={()=>patch({rules:undefined,match:undefined,groups:groups.map((g,gi)=>gi===groupIndex?g.filter((_,i)=>i!==index):g).filter(g=>g.length)})}>Remover condição</button>
          </div>;
        })}
        <button onClick={()=>patch({rules:undefined,match:undefined,groups:groups.map((g,gi)=>gi===groupIndex?[...g,{source:'',operator:'equals',value:''}]:g)})}>+ Condição E</button>
        <button onClick={()=>patch({rules:undefined,match:undefined,groups:groups.filter((_,gi)=>gi!==groupIndex)})}>Remover grupo</button>
      </fieldset>)}
      <button onClick={()=>{const groups=display.groups || (display.rules?.length ? (display.match==='any'?display.rules.map(rule=>[rule]):[display.rules]):[]);patch({rules:undefined,match:undefined,groups:[...groups,[{source:'',operator:'equals',value:''}]]});}}>+ Grupo OU</button>
    </fieldset>
  </div>;
}
