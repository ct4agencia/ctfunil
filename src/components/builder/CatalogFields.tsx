"use client";

import { useContext, useState } from 'react';
import type { Layer } from '@/lib/quiz/layers/types';
import { COLLECTION_COMPONENTS, type ContentItem } from '@/lib/quiz/layers/catalog';
import { ImageField, LocalDraftContext } from './fields';
import { WorkspaceSelect } from "@/components/ui/WorkspaceSelect";
import ColorField from '@/components/ui/ColorField';
import './component-settings.css';

type Props = { layer: Layer; onChange: (layer: Layer) => void };

export function CatalogAppearance({layer,onChange}:Props) {
  if(!['field','audio','arguments','testimonials','faq','price','checklist','html'].includes(layer.type))return null;
  const d=layer.design||{};
  const patch=(values:Record<string,unknown>)=>onChange({...layer,design:{...d,...values}});
  return <fieldset><legend>Layout e aparência</legend>
    <div className="ct-component-pair">{[['basis','Largura (%)',100],['padding','Espaço interno (px)',16],['optionGap','Espaço entre itens (px)',12],['cornerRadius','Cantos (px)',12],['borderWidth','Borda (px)',1]].map(([key,label,fallback])=><label key={key}>{label}<input type="number" min={0} max={key==='basis'?100:100} value={d[String(key)]??fallback} onChange={e=>patch({[String(key)]:e.target.value===''?undefined:Math.max(0,Number(e.target.value))})}/></label>)}</div>
    <label>Alinhamento<WorkspaceSelect label="Alinhamento" value={d.align||'center'} onChange={value=>patch({align:value})} options={[["left","Esquerda"],["center","Centro"],["right","Direita"]].map(([value,label])=>({value,label}))}/></label>
    {([['backgroundColor','Fundo'],['borderColor','Cor da borda']] as const).map(([key,label])=><div className="ct-component-color" key={key}><span>{label}</span><ColorField className="h-7 w-8" label={label} value={d[key]||''} onChange={value=>patch({[key]:value})}/><button onClick={()=>patch({[key]:undefined})}>Herdar</button></div>)}
    <label>Sombra<WorkspaceSelect label="Sombra" value={d.componentShadow||'none'} onChange={value=>patch({componentShadow:value})} options={[["none","Sem sombra"],["small","Pequena"],["medium","Média"],["large","Grande"]].map(([value,label])=>({value,label}))}/></label>
    {['arguments','testimonials','checklist'].includes(layer.type)&&<><label>Proporção das imagens<WorkspaceSelect label="Proporção das imagens" value={d.imageRatio||'1 / 1'} onChange={value=>patch({imageRatio:value})} options={['1 / 1','16 / 9','4 / 3','9 / 16'].map(value=>({value,label:value}))}/></label><label className="ct-component-toggle"><input type="checkbox" checked={!!d.imageAfterText} onChange={e=>patch({imageAfterText:e.target.checked})}/>Texto antes da imagem</label></>}
  </fieldset>;
}

export function AudioUpload({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  const local=useContext(LocalDraftContext);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  return <label>Arquivo de áudio<input type="url" value={value} placeholder="https://…/audio.mp3" onChange={e=>onChange(e.target.value)}/>
    <input type="file" accept="audio/*" disabled={busy||local} onChange={async e=>{
      const file=e.target.files?.[0]; if(!file)return;
      setBusy(true);setError('');
      try { const body=new FormData();body.append('file',file);const response=await fetch('/api/upload',{method:'POST',body});const data=await response.json();if(!response.ok||!data.url)throw new Error(data.error||'Falha no envio');onChange(data.url); }
      catch(error){setError(error instanceof Error?error.message:'Falha no envio');}finally{setBusy(false);}
    }}/>{busy&&<small>Enviando…</small>}{local&&<small>Laboratório: use uma URL para testar sem enviar arquivos.</small>}{error&&<small role="alert">{error}</small>}
  </label>;
}

export default function CatalogFields({layer,onChange}:Props) {
  const c=layer.content;
  const patch=(values:Record<string,unknown>)=>onChange({...layer,content:{...c,...values}});
  const text=(key:string,label:string,multiline=false)=><label key={key}>{label}{multiline?<textarea rows={4} value={c[key]??''} onChange={e=>patch({[key]:e.target.value})}/>:<input value={c[key]??''} onChange={e=>patch({[key]:e.target.value})}/>}</label>;
  const check=(key:string,label:string)=><label key={key} className="ct-component-check"><input type="checkbox" checked={!!c[key]} onChange={e=>patch({[key]:e.target.checked})}/>{label}</label>;
  const number=(key:string,label:string)=><label key={key}>{label}<input type="number" step="any" value={c[key]??''} onChange={e=>patch({[key]:e.target.value===''?undefined:Number(e.target.value)})}/></label>;
  const select=(key:string,label:string,options:[string,string][],fallback='')=><label>{label}<WorkspaceSelect label={label} value={String(c[key]??fallback)} onChange={value=>patch({[key]:value,...(key==='type'?{mask:value==='phone'?'phone_br':undefined}: {})})} options={options.map(([value,label])=>({value,label}))}/></label>;
  const items=(c.items||[]) as ContentItem[];
  const updateItem=(index:number,values:Partial<ContentItem>)=>patch({items:items.map((item,i)=>i===index?{...item,...values}:item)});
  return <div className="ct-component-settings">
    {layer.type==='field'&&<>
      {select('type','Tipo do campo',[['text','Texto / nome'],['phone','Telefone'],['email','E-mail'],['number','Número'],['textarea','Texto longo'],['date','Data'],['height','Altura'],['weight','Peso']],'text')}
      {text('name','Nome da resposta (variável)')}{text('title','Rótulo')}{text('placeholder','Placeholder')}{text('description','Texto de ajuda')}{check('required','Preenchimento obrigatório')}
      {['number','height','weight'].includes(c.type || '')&&<><div className="ct-component-pair">{number('min','Mínimo')}{number('max','Máximo')}</div>{number('step','Incremento')}</>}
      {['height','weight'].includes(c.type || '')&&<>{select('inputStyle','Exibição da medida',[['ruler','Régua e campo'],['input','Somente campo']],'ruler')}{number('defaultValue','Posição inicial da régua')}</>}
      {c.type==='number'&&select('currency','Formato',[['','Número decimal'],['BRL','Real (R$)'],['USD','Dólar (US$)'],['EUR','Euro (€)']])}
      {c.type==='textarea'&&<>{number('rows','Linhas visíveis')}{number('maxLength','Limite de caracteres')}</>}
      {c.type==='date'&&<div className="ct-component-pair">{['minDate','maxDate'].map((key,i)=><label key={key}>{i?'Data máxima':'Data mínima'}<input type="date" value={c[key]||''} onChange={e=>patch({[key]:e.target.value})}/></label>)}</div>}
    </>}
    {layer.type==='options'&&<>
      {select('introductionType','Mídia da pergunta',[['text','Texto'],['video','Vídeo']],'text')}
      {c.introductionType==='video'&&<>{text('videoUrl','URL do vídeo (YouTube, Vimeo ou arquivo)')}{text('videoHtml','Código embed do vídeo',true)}{select('videoRatio','Proporção do vídeo',[['16 / 9','16:9'],['1 / 1','1:1'],['21 / 9','21:9'],['9 / 16','9:16'],['4 / 3','4:3'],['3 / 4','3:4']],'16 / 9')}<p>Use URL ou embed. O embed tem prioridade. Configure abaixo as respostas e seus destinos.</p></>}
    </>}
    {layer.type==='audio'&&<>{text('name','Nome de quem fala')}<label>Foto</label><ImageField value={c.avatar||''} onChange={value=>patch({avatar:value})}/><AudioUpload value={c.src||''} onChange={value=>patch({src:value})}/>{check('autoplay','Tentar reprodução automática')}{check('loop','Repetir áudio')}<p>A reprodução automática depende da permissão do navegador do visitante.</p></>}
    {layer.type==='html'&&<>{text('html',c.importedDesign?'HTML e CSS do design':'HTML, CSS e Script',true)}{number('height','Altura do conteúdo (px)')}{!c.importedDesign&&check('runScripts','Executar scripts no funil público')}<p>O conteúdo fica isolado em um quadro. Scripts não são executados no editor ou na prévia e não alteram a página do funil.</p></>}
    {layer.type==='price'&&<>{text('title','Título da oferta')}{text('description','Descrição')}{text('prefix','Antes do preço')}{text('price','Preço')}{text('suffix','Depois do preço')}{text('badge','Etiqueta')}{text('details','Detalhes da oferta',true)}{select('mode','Ação',[['illustrative','Ilustrativo'],['redirect','Redirecionar']],'illustrative')}{c.mode==='redirect'&&<>{text('destination','URL de destino')}{text('buttonLabel','Texto do botão')}{check('clickable','Toda a oferta é clicável')}</>}{check('checkbox','Permitir selecionar a oferta')}</>}
    {COLLECTION_COMPONENTS.includes(layer.type)&&<>
      {layer.type==='testimonials'&&select('layout','Formato',[['list','Lista'],['slider','Carrossel'],['grid','Grade']],'list')}
      {(layer.type==='arguments'||c.layout==='grid')&&select('columns','Colunas',[['1','1'],['2','2'],['3','3'],['4','4']],'2')}
      {layer.type==='faq'&&<>{check('firstOpen','Primeira pergunta aberta')}{check('allowMultiple','Permitir várias perguntas abertas')}</>}
      {items.map((item,index)=><fieldset key={item.id}><legend>Item {index+1}</legend>
        {(layer.type==='faq'||layer.type==='arguments')&&<label>{layer.type==='faq'?'Pergunta':'Título'}<input value={item.title||''} onChange={e=>updateItem(index,{title:e.target.value})}/></label>}
        {layer.type==='testimonials'&&<><label>Nome<input value={item.name||''} onChange={e=>updateItem(index,{name:e.target.value})}/></label><label>Cargo / rede social<input value={item.role||''} onChange={e=>updateItem(index,{role:e.target.value})}/></label><label>Estrelas<input type="number" min={0} max={5} value={item.rating??5} onChange={e=>updateItem(index,{rating:Math.max(0,Math.min(5,Number(e.target.value)))})}/></label></>}
        <label>{layer.type==='faq'?'Resposta':'Texto'}<textarea rows={3} value={item.text||''} onChange={e=>updateItem(index,{text:e.target.value})}/></label>
        {layer.type!=='faq'&&<><label>Imagem</label><ImageField value={item.image||''} onChange={value=>updateItem(index,{image:value})}/>{layer.type!=='testimonials'&&<label>Ícone / emoji<input value={item.icon||''} onChange={e=>updateItem(index,{icon:e.target.value})}/></label>}</>}
        <div className="ct-component-pair"><button disabled={index===0} onClick={()=>{const next=[...items];[next[index-1],next[index]]=[next[index],next[index-1]];patch({items:next});}}>↑ Subir</button><button disabled={index===items.length-1} onClick={()=>{const next=[...items];[next[index+1],next[index]]=[next[index],next[index+1]];patch({items:next});}}>↓ Descer</button></div><button onClick={()=>patch({items:items.filter((_,i)=>i!==index)})}>Excluir item</button>
      </fieldset>)}
      <button onClick={()=>patch({items:[...items,{id:crypto.randomUUID(),title:layer.type==='faq'?'Nova pergunta':'',text:'Novo item',...(layer.type==='testimonials'?{name:'Nome',rating:5}:{})}]})}>+ Adicionar item</button>
    </>}
  </div>;
}
