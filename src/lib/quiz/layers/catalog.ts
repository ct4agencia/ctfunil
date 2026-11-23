import type { Layer } from './types';

export const NEW_COMPONENTS = ['number','textarea','date','height','weight','videoanswer','audio','arguments','testimonials','faq','price','checklist','html'] as const;
export const COLLECTION_COMPONENTS = ['arguments','testimonials','faq','checklist'];
export interface ContentItem { id: string; title?: string; text?: string; image?: string; icon?: string; name?: string; role?: string; rating?: number }

export function catalogLayer(type: string, id: string): Layer | undefined {
  const fieldNames: Record<string,string> = { number:'Número',textarea:'Sua mensagem',date:'Data',height:'Altura',weight:'Peso' };
  if (type in fieldNames) return { id,type:'field',title:fieldNames[type],content:{ id,name:`${type}_${id}`,type,title:fieldNames[type],required:false,placeholder:type==='textarea'?'Escreva aqui…':'',...(type==='height'?{min:80,max:230,step:1,defaultValue:170,unit:'cm',inputStyle:'ruler'}:type==='weight'?{min:30,max:250,step:.1,defaultValue:70,unit:'kg',inputStyle:'ruler'}:{})} };
  if (type==='videoanswer') return { id,type:'options',title:'Vídeo Resposta',content:{id,introductionType:'video',videoUrl:'',videoHtml:'',videoRatio:'16 / 9',required:true,options:[{id:`${id}-a`,label:'Primeira resposta',destination:'next'},{id:`${id}-b`,label:'Segunda resposta',destination:'next'}]} };
  if (type==='audio') return {id,type,content:{id,src:'',name:'Áudio',avatar:'',autoplay:false,loop:false}};
  if (type==='arguments') return {id,type,content:{id,columns:2,items:[{id:`id-${id}-1`,title:'Seu diferencial',text:'Explique o benefício para o visitante.',icon:'✓'}]}};
  if (type==='testimonials') return {id,type,content:{id,layout:'list',columns:2,items:[{id:`id-${id}-1`,name:'Nome do cliente',role:'Cliente',text:'Insira um depoimento autorizado do seu cliente.',rating:5}]}};
  if (type==='faq') return {id,type,content:{id,firstOpen:true,allowMultiple:false,items:[{id:`id-${id}-1`,title:'Como funciona?',text:'Descreva aqui a resposta.'}]}};
  if (type==='checklist') return {id,type,content:{id,items:[{id:`id-${id}-1`,text:'Descreva o primeiro item.',icon:'✓'}]}};
  if (type==='price') return {id,type,content:{id,title:'Sua oferta',description:'Descreva o que está incluído.',prefix:'',price:'R$ 97,00',suffix:'à vista',badge:'',details:'',mode:'illustrative',destination:'',clickable:false,checkbox:false}};
  if (type==='html') return {id,type,content:{id,html:'<div>Seu conteúdo HTML</div>',height:240,runScripts:false}};
}

export function fieldKey(layer: Layer): string { return layer.content.name || layer.content.id || layer.id; }
export function fieldError(layer: Layer, value: string): string | undefined {
  const c=layer.content;
  const label=String(c.label || c.title || layer.title || 'Campo');
  if (!value.trim()) return c.required ? `Preencha ${label}.` : undefined;
  if (c.type==='email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `Confira ${label}.`;
  if ((c.type === 'phone' || c.mask === 'phone_br') && value.replace(/\D/g, '').length < 10) return `Confira ${label}.`;
  if (['number','height','weight'].includes(c.type || '')) {
    const number=Number(value);
    if (!Number.isFinite(number)) return `${label}: informe um número válido.`;
    if (c.min != null && number<Number(c.min)) return `${label}: mínimo ${c.min}.`;
    if (c.max != null && number>Number(c.max)) return `${label}: máximo ${c.max}.`;
  }
  if(c.type==='date') {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)!==value) return `${label}: data inválida.`;
    if(c.minDate && value<c.minDate || c.maxDate && value>c.maxDate) return `${label}: data fora do intervalo permitido.`;
  }
  if(c.maxLength && value.length>Number(c.maxLength)) return `${label}: limite de ${c.maxLength} caracteres.`;
}

export function safeMediaUrl(value?: string): string | undefined {
  const url=(value || '').trim();
  return /^(https?:\/\/|\/(?!\/)|blob:)/i.test(url) ? url : undefined;
}
