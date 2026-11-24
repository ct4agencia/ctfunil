"use client";
/* eslint-disable @next/next/no-img-element -- Builder accepts arbitrary public asset URLs. */

import { useState, type CSSProperties } from 'react';
import type { Layer } from '@/lib/quiz/layers/types';
import type { LayersCtx } from './blocks';
import { fieldKey, safeMediaUrl, type ContentItem } from '@/lib/quiz/layers/catalog';
import './catalog.css';

export function AdvancedField({layer,ctx}:{layer:Layer;ctx:LayersCtx}) {
  const c=layer.content, key=fieldKey(layer), id=`field-${layer.id}`;
  const measurement=c.type==='height'||c.type==='weight';
  const [imperial,setImperial]=useState(false);
  const value=ctx.fields[key] ?? '';
  const number=Number(value === '' ? c.defaultValue ?? (c.type==='height'?170:70) : value);
  const factor=c.type==='height'?2.54:1/2.2046226218;
  const shown=imperial?Math.round(number/factor*10)/10:number;
  const unit=measurement?(c.type==='height'?(imperial?'pol':'cm'):(imperial?'lb':'kg')):c.unit;
  const update=(raw:string)=>{ctx.setField(key,raw);if(key==='nome')ctx.setName(raw);};
  const label=String(c.label||c.title||layer.title||'Campo');
  const common={id,'aria-label':label,value,required:!!c.required,placeholder:c.placeholder,maxLength:c.maxLength?Number(c.maxLength):undefined,onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>update(e.target.value)};
  return <div className="ct-public-field" style={{color:layer.design?.color||ctx.design.contentColor||'#222621',width:`${Math.max(20,Math.min(100,Number(layer.design?.basis)||100))}%`,marginLeft:layer.design?.align==='left'?0:'auto',marginRight:layer.design?.align==='right'?0:'auto','--field-background':layer.design?.backgroundColor||'#fff','--field-border':layer.design?.borderColor||'#cfd4cc','--field-padding':`${layer.design?.padding??12}px`,'--funnel-accent':ctx.design.themeColor||'#1d4f88'} as CSSProperties}>
    <label htmlFor={id}>{label}{c.required?' *':''}</label>
    {measurement ? <>
      <div className="ct-measure-units"><button type="button" aria-pressed={!imperial} onClick={()=>setImperial(false)}>{c.type==='height'?'cm':'kg'}</button><button type="button" aria-pressed={imperial} onClick={()=>setImperial(true)}>{c.type==='height'?'pol':'lb'}</button></div>
      <div className="ct-measure-value"><input id={id} aria-label={label} type="number" min={imperial?Number(c.min)/factor:c.min} max={imperial?Number(c.max)/factor:c.max} step={imperial ? 0.1 : c.step||1} value={value!==''?shown:''} placeholder={String(shown)} onChange={e=>update(e.target.value?String(Math.round(Number(e.target.value)*(imperial?factor:1)*100)/100):'')} /><span>{unit}</span></div>
      {c.inputStyle!=='input' && <input aria-label={`Régua de ${label}`} type="range" min={c.min??0} max={c.max??250} step={c.step||1} value={number} onChange={e=>update(e.target.value)} />}
      <p>{value?`Selecionado: ${number} ${c.type==='height'?'cm':'kg'}`:'Ajuste a medida para responder.'}</p>
    </> : c.type==='textarea' ? <textarea {...common} rows={Math.max(2,Number(c.rows)||4)}/> : <input {...common} type={['email','number','date'].includes(c.type||'')?c.type:'text'} inputMode={c.type==='number'?'decimal':c.type==='email'?'email':'text'} min={c.type==='date'?c.minDate:c.min} max={c.type==='date'?c.maxDate:c.max} step={c.step||'any'}/>}
    {c.description && <p>{c.description}</p>}
    {c.type==='number' && value && c.currency && <output>{new Intl.NumberFormat('pt-BR',{style:'currency',currency:c.currency}).format(Number(value)||0)}</output>}
  </div>;
}

export function HtmlWidget({html,height=240,runScripts=false,title='Conteúdo personalizado',preview=false,importedDesign=false,importedRoot}:{html:string;height?:number;runScripts?:boolean;title?:string;preview?:boolean;importedDesign?:boolean;importedRoot?: Record<string, string>}) {
  // Isolated origin: custom styles/scripts work without changing the editor or accessing its session.
  if (importedDesign) {
    const attributes = Object.entries(importedRoot ?? {})
      .filter(([name, value]) => /^(?:class|id|lang|dir|style|data-[a-z0-9_-]+)$/.test(name) && typeof value === "string")
      .map(([name, value]) => ` ${name}="${value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}"`)
      .join("");
    const header = `<!doctype html><html${attributes}><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'"><style>body{margin:0}</style></head>`;
    return <iframe title={title} srcDoc={header + html + "</html>"} sandbox="" referrerPolicy="no-referrer"
      style={{ width: "100%", height: Math.max(320, Math.min(2000, Number(height) || 844)), border: 0 }} />;
  }
  return <iframe title={title} srcDoc={`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial,sans-serif;overflow-wrap:anywhere}img,video,iframe{max-width:100%}</style></head><body>${html}</body></html>`}
    sandbox={runScripts&&!preview?'allow-scripts allow-forms allow-popups':'allow-forms'} referrerPolicy="no-referrer" style={{width:'100%',height:Math.max(80,Math.min(2000,Number(height)||240)),border:0}} />;
}

export function VideoIntroduction({layer,ctx}:{layer:Layer;ctx:LayersCtx}) {
  const c=layer.content;
  if(c.videoHtml) return <div style={{aspectRatio:c.videoRatio||'16 / 9',marginBottom:16}}><iframe title="Vídeo da pergunta" srcDoc={c.videoHtml} sandbox={ctx.preview?'':'allow-scripts allow-presentation'} allow="fullscreen; autoplay; encrypted-media" style={{width:'100%',height:'100%',border:0}}/></div>;
  const src=safeMediaUrl(c.videoUrl);
  if(!src) return <p className="ct-media-empty">Adicione o vídeo da pergunta.</p>;
  let embed:string|undefined;
  try {const url=new URL(src);if(['youtube.com','www.youtube.com','youtu.be'].includes(url.hostname)){const id=url.hostname==='youtu.be'?url.pathname.slice(1):url.searchParams.get('v');if(id&&/^[\w-]+$/.test(id))embed=`https://www.youtube-nocookie.com/embed/${id}`;}else if(url.hostname==='vimeo.com'&&/^\/\d+$/.test(url.pathname))embed=`https://player.vimeo.com/video${url.pathname}`;}catch{}
  return embed?<iframe title="Vídeo da pergunta" src={embed} allow="fullscreen; encrypted-media" style={{width:'100%',aspectRatio:c.videoRatio||'16 / 9',border:0,marginBottom:16}}/>:<video src={src} controls playsInline preload="metadata" style={{width:'100%',aspectRatio:c.videoRatio||'16 / 9',marginBottom:16}}/>;
}

export default function CatalogBlock({layer,ctx}:{layer:Layer;ctx:LayersCtx}) {
  const c=layer.content,d=layer.design||{};
  const [slide,setSlide]=useState(0),[selected,setSelected]=useState(!!ctx.fields?.[c.id||layer.id]);
  const items=(c.items||[]) as ContentItem[];
  const [open,setOpen]=useState<string[]>(c.firstOpen&&items[0]?[items[0].id]:[]);
  const style={ '--catalog-background':d.backgroundColor||'transparent','--catalog-border':d.borderColor||'color-mix(in srgb, var(--catalog-text) 20%, transparent)','--catalog-border-width':`${d.borderWidth??1}px`, '--catalog-accent':ctx.design.themeColor||'#1d4f88', '--catalog-text':d.color||d.textColor||ctx.design.contentColor||'#222621', '--catalog-radius':`${d.cornerRadius??12}px`, '--catalog-padding':`${d.padding??16}px`, '--catalog-gap':`${d.optionGap??12}px`, '--catalog-mobile-cols':Math.min(2,Math.max(1,Number(c.columns)||1)), '--catalog-cols':Math.min(4,Math.max(1,Number(c.columns)||1)), width:`${Math.min(200,Math.max(20,Number(d.basis)||100))}%`, marginLeft:d.align==='left'?0:'auto',marginRight:d.align==='right'?0:'auto' } as CSSProperties;
  if(layer.type==='html') return <div className="ct-catalog ct-catalog-html" style={style}><HtmlWidget html={String(c.html||'')} height={c.height} importedDesign={c.importedDesign} importedRoot={c.importedRoot} runScripts={c.runScripts} preview={ctx.preview} title={layer.title||'HTML personalizado'}/></div>;
  if(layer.type==='audio') return <div className="ct-catalog ct-audio-card" style={style}>{safeMediaUrl(c.avatar)&&<img src={c.avatar} alt=""/>}<div><strong>{c.name||'Áudio'}</strong>{safeMediaUrl(c.src)?<audio controls src={c.src} preload="metadata" autoPlay={!!c.autoplay&&!ctx.preview} loop={!!c.loop}/>:<p>Adicione um arquivo ou URL de áudio.</p>}</div></div>;
  if(layer.type==='faq') return <div className="ct-catalog" style={style}>{items.map(item=><div className="ct-faq-item" key={item.id}><h3><button type="button" aria-expanded={open.includes(item.id)} aria-controls={`faq-${layer.id}-${item.id}`} onClick={()=>setOpen(previous=>previous.includes(item.id)?previous.filter(id=>id!==item.id):c.allowMultiple?[...previous,item.id]:[item.id])}>{item.title||'Pergunta'}<span aria-hidden>{open.includes(item.id)?'−':'+'}</span></button></h3><div id={`faq-${layer.id}-${item.id}`} hidden={!open.includes(item.id)} className="ct-faq-answer">{item.text}</div></div>)}</div>;
  if(layer.type==='price') {
    const destination=/^https?:\/\//i.test(c.destination||'')?c.destination:undefined;
    const choose=()=>{if(c.mode==='redirect'&&destination)ctx.continueFrom?.({...layer,type:'button'},destination);};
    return <div className="ct-catalog ct-price" style={style} onClick={c.clickable?choose:undefined}>{c.badge&&<span className="ct-price-badge">{c.badge}</span>}{c.checkbox&&<label onClick={e=>e.stopPropagation()}><input type="checkbox" checked={selected} onChange={()=>{setSelected(!selected);ctx.setField(c.id||layer.id,selected?'':String(c.price||''));ctx.trackAnswer(layer.id,String(c.title||'Oferta'),selected?'':String(c.price||''));}}/>Selecionar oferta</label>}<h3>{c.title}</h3><p>{c.description}</p><p>{c.prefix}</p><strong className="ct-price-value">{c.price}</strong><p>{c.suffix}</p><div className="ct-price-details">{c.details}</div>{c.mode==='redirect'&&<button type="button" className="ct-catalog-cta" onClick={e=>{e.stopPropagation();choose();}} disabled={!destination}>{c.buttonLabel||'Escolher oferta'}</button>}</div>;
  }
  const shown=layer.type==='testimonials'&&c.layout==='slider'?items.slice(Math.min(slide,Math.max(0,items.length-1)),Math.min(slide,Math.max(0,items.length-1))+1):items;
  return <div className="ct-catalog" style={style}><div className={layer.type==='arguments'||c.layout==='grid'?'ct-catalog-grid':'ct-catalog-list'}>{shown.map(item=><article className={`ct-catalog-item ct-catalog-${layer.type}`} key={item.id}>
    {safeMediaUrl(item.image)&&<img src={item.image} alt={item.name||item.title||''} style={{aspectRatio:d.imageRatio||'1 / 1',order:d.imageAfterText?2:undefined}}/>}
    {item.icon&&<span className="ct-catalog-icon" aria-hidden>{item.icon}</span>}
    <div>{item.title&&<h3>{item.title}</h3>}{item.name&&<strong>{item.name}</strong>}{item.role&&<p className="ct-catalog-role">{item.role}</p>}{layer.type==='testimonials'&&<div aria-label={`${item.rating??5} de 5 estrelas`} className="ct-catalog-stars">{'★'.repeat(Math.max(0,Math.min(5,Math.round(item.rating??5))))}</div>}<p>{item.text}</p></div>
  </article>)}</div>{layer.type==='testimonials'&&c.layout==='slider'&&items.length>1&&<nav className="ct-carousel-nav" aria-label="Depoimentos"><button onClick={()=>setSlide((slide-1+items.length)%items.length)} aria-label="Depoimento anterior">←</button><span>{Math.min(slide+1,items.length)} / {items.length}</span><button onClick={()=>setSlide((slide+1)%items.length)} aria-label="Próximo depoimento">→</button></nav>}</div>;
}
