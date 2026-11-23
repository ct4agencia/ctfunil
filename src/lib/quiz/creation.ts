import type { Funnel } from './types';
import type { InleadStep, Layer } from './layers/types';
import { catalogLayer } from './layers/catalog';
import { FUNNEL_FONTS } from './layers/design';

export const CREATION_TEMPLATES = [
  { id:'blank', name:'Em branco', description:'Uma etapa livre para montar do seu jeito.' },
  { id:'quiz', name:'Quiz com caminhos', description:'Pergunta, respostas com destinos e captura de contato.' },
  { id:'capture', name:'Captura de leads', description:'Apresentação, nome, e-mail e confirmação.' },
  { id:'offer', name:'Apresentação de oferta', description:'Benefícios, depoimentos, preço e perguntas frequentes.' },
] as const;
export type CreationTemplate = typeof CREATION_TEMPLATES[number]['id'];
export interface CreationInput {
  name: string;
  template: CreationTemplate;
  logo?: string;
  backgroundColor: string;
  themeColor: string;
  titleColor: string;
  contentColor: string;
  titleFont: string;
  contentFont: string;
  objective: string;
  tone: string;
}
export const DEFAULT_CREATION: CreationInput = { name:'',template:'blank',backgroundColor:'#ffffff',themeColor:'#1d4f88',titleColor:'#181819',contentColor:'#414144',titleFont:'Arial',contentFont:'Arial',objective:'Capturar leads',tone:'Amigável' };
export function creationError(input: CreationInput): string | undefined {
  if(!input || typeof input.name!=='string' || !input.name.trim() || input.name.length>120) return 'Informe um nome de até 120 caracteres.';
  if(!CREATION_TEMPLATES.some(t=>t.id===input.template))return 'Escolha uma estrutura válida.';
  if([input.backgroundColor,input.themeColor,input.titleColor,input.contentColor].some(c=>!/^#[\da-f]{6}$/i.test(c)))return 'Confira as cores da identidade visual.';
  if(!FUNNEL_FONTS.some(f=>f===input.titleFont)||!FUNNEL_FONTS.some(f=>f===input.contentFont))return 'Escolha uma fonte do catálogo.';
  if(input.logo && !/^(https?:\/\/|\/(?!\/))/i.test(input.logo))return 'Use uma URL válida para o logo.';
}
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));

/** All creation paths use this factory. Existing funnels keep their saved structure. */
export function createLayersFunnel(input:CreationInput,slug:string):Funnel {
  const error=creationError(input);if(error)throw new Error(error);
  let sequence=0;
  const id=()=>`layer-${++sequence}`;
  const text=(value:string):Layer=>({id:id(),type:'text',content:{text:value}});
  const button=(label:string,destination='next'):Layer=>({id:id(),type:'button',content:{label,type:'next',destination}});
  const field=(type:string,name:string,title:string):Layer=>({id:id(),type:'field',content:{type,name,title,required:true}});
  const stage=(id:string,title:string,layers:Layer[]):InleadStep=>({id,title,layers});
  const logo:Layer[]=input.logo?[{id:id(),type:'image',content:{image:{src:input.logo}},design:{basis:40}}]:[];
  const welcome=text(`<h1>${escapeHtml(input.name.trim())}</h1><p>Personalize esta apresentação para o seu público.</p>`);
  const done=stage('conclusao','Confirmação',[text('<h1>Recebemos sua resposta!</h1><p>Obrigado por participar.</p>')]);
  let steps:InleadStep[];
  if(input.template==='quiz')steps=[
    stage('inicio','Boas-vindas',[...logo,welcome,button('Começar')]),
    stage('pergunta','Seu objetivo',[text('<h2>O que você procura?</h2>'),{id:id(),type:'options',content:{required:true,options:[{id:'saber-mais',label:'Quero saber mais',destination:'detalhes'},{id:'contato',label:'Quero conversar',destination:'captura'}]}}]),
    stage('detalhes','Mais informações',[text('<h2>Conheça os benefícios</h2>'),catalogLayer('arguments',id())!,button('Quero receber mais informações','captura')]),
    stage('captura','Seus dados',[field('text','nome','Seu nome'),field('email','email','Seu e-mail'),button('Enviar','conclusao')]),done,
  ];
  else if(input.template==='capture')steps=[stage('inicio','Seus dados',[...logo,welcome,field('text','nome','Seu nome'),field('email','email','Seu e-mail'),button('Enviar','conclusao')]),done];
  else if(input.template==='offer')steps=[stage('inicio','Sua oferta',[...logo,welcome,...['arguments','testimonials','price','faq'].map(type=>catalogLayer(type,id())!)])];
  else steps=[stage('inicio','Primeira etapa',[...logo,welcome])];
  return {slug,name:input.name.trim(),logo:input.logo,paletteId:'ct4',steps:steps as unknown as Funnel['steps'],settings:{engine:'layers',objective:input.objective,tone:input.tone,design:{backgroundColor:input.backgroundColor,themeColor:input.themeColor,titleColor:input.titleColor,contentColor:input.contentColor,featuredFont:input.titleFont,contentFont:input.contentFont,container:'max-w-[30rem]',gap:'1.25',rounded:'rounded-xl',elementSize:'52px'}}};
}
