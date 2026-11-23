import { parse } from 'acorn';
import { parse as parseJsx } from '@babel/parser';
import { parseDocument, DomUtils } from 'htmlparser2';
import type { AnyNode, Element } from 'domhandler';
import { createLayersFunnel, DEFAULT_CREATION } from '@/lib/quiz/creation';
import type { Funnel } from '@/lib/quiz/types';
import type { Layer, InleadStep } from '@/lib/quiz/layers/types';
import type { ProjectPage } from './project-attachment';

type Value = string | number | boolean | null | Value[] | { [key:string]:Value };
type Ast = {type:string; [key:string]:unknown};
const node=(value:unknown):Ast|undefined=>value && typeof value==='object' && 'type' in value ? value as Ast : undefined;
function literal(value:unknown, depth=0):Value|undefined {
  const n=node(value); if(!n || depth>12) return;
  if(n.type==='Literal' && (typeof n.value==='string'||typeof n.value==='number'||typeof n.value==='boolean'||n.value===null))return n.value as Value;
  if(n.type==='ConditionalExpression')return literal(n.alternate,depth+1);
  if(n.type==='ArrayExpression' && Array.isArray(n.elements))return n.elements.map(x=>literal(x,depth+1) ?? null);
  if(n.type==='ObjectExpression' && Array.isArray(n.properties)) {
    const result:{[key:string]:Value}={};
    for(const item of n.properties){const p=node(item), key=node(p?.key); if(p?.type!=='Property'||!key||p.computed)continue; const name=key.type==='Identifier'?key.name:key.value; const val=literal(p.value,depth+1); if(typeof name==='string'&&val!==undefined&&name!=='__proto__')result[name]=val;}
    return result;
  }
}
/** Extract literal render values only. Never execute code from an attachment. */
function dcValues(html:string):Record<string,Value> {
  const script=html.match(/<script\b[^>]*type=["']text\/x-dc["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if(!script)return {};
  try {
    const tree=parse(script,{ecmaVersion:'latest'}); let found:Record<string,Value>={};
    const walk=(current:unknown,inside=false):void=>{
      const n=node(current);if(!n)return;
      const key=node(n.key); const active=inside || n.type==='MethodDefinition'&&key?.name==='renderVals';
      if(active&&n.type==='ReturnStatement'){const result=literal(n.argument);if(result&&!Array.isArray(result)&&typeof result==='object')found=result;return;}
      for(const [k,v] of Object.entries(n)){if(k==='start'||k==='end')continue;if(Array.isArray(v))v.forEach(x=>walk(x,active));else if(typeof v==='object'&&v)walk(v,active);}
    };walk(tree);return found;
  } catch { return {}; }
}
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function substitute(s:string,vars:Record<string,Value>):string {
  return s.replace(/\{\{\s*([\w.]+)\s*\}\}/g,(_match,key:string)=>{
    let value:Value|undefined=vars; for(const part of key.split('.'))value=value && typeof value==='object'&&!Array.isArray(value)?value[part]:undefined;
    return typeof value==='string'||typeof value==='number'?String(value):'';
  });
}
function isElement(n:AnyNode):n is Element { return n.type==='tag'; }
const allowedInline=new Set(['strong','b','em','i','u','br','span']);
function inline(n:AnyNode,vars:Record<string,Value>):string {
  if(n.type==='text')return escape(substitute(n.data,vars));
  if(!isElement(n))return '';
  const tag=n.name.toLowerCase();if(['script','style','iframe','svg'].includes(tag))return '';
  if(tag==='br')return '<br>';
  const inner=n.children.map(child=>inline(child,vars)).join('');
  return allowedInline.has(tag)&&tag!=='span'?`<${tag}>${inner}</${tag}>`:inner;
}

/** Read the static JSX tree without running the project or its dependencies. */
function staticJsx(source:string):string {
  const tree=parseJsx(source,{sourceType:'unambiguous',plugins:['jsx','typescript']});
  let jsx:Ast|undefined;
  const find=(value:unknown):void=>{const n=node(value);if(!n||jsx)return;if(n.type==='ReturnStatement'&&['JSXElement','JSXFragment'].includes(node(n.argument)?.type||'')){jsx=node(n.argument);return;}if(n.type==='ArrowFunctionExpression'&&['JSXElement','JSXFragment'].includes(node(n.body)?.type||'')){jsx=node(n.body);return;}for(const [k,v] of Object.entries(n)){if(['loc','start','end','tokens','comments','extra'].includes(k))continue;if(Array.isArray(v))v.forEach(find);else if(typeof v==='object'&&v)find(v);}};
  const program=node(tree.program);const body=Array.isArray(program?.body)?program.body:[];
  const preferred=body.find(item=>node(item)?.type==='ExportDefaultDeclaration');
  if(preferred)find(preferred);if(!jsx)body.forEach(find);
  if(!jsx)throw new Error('Não encontramos uma estrutura JSX estática para importar.');
  const render=(value:unknown,depth=0):string=>{
    const n=node(value);if(!n||depth>80)return '';
    if(n.type==='JSXText')return escape(String(n.value||''));
    if(n.type==='JSXExpressionContainer'){const expression=node(n.expression);return expression?.type==='StringLiteral'||expression?.type==='NumericLiteral'?escape(String(expression.value)):'';}
    if(n.type==='JSXFragment')return Array.isArray(n.children)?n.children.map(child=>render(child,depth+1)).join(''):'';
    if(n.type!=='JSXElement')return '';
    const opening=node(n.openingElement), name=node(opening?.name),tag=typeof name?.name==='string'?name.name:'';
    const children=Array.isArray(n.children)?n.children.map(child=>render(child,depth+1)).join(''):'';
    if(!/^[a-z][a-z0-9-]*$/.test(tag))return children;
    if(['script','iframe','object','embed','style'].includes(tag))return '';
    const attrs:string[]=[];
    if(Array.isArray(opening?.attributes))for(const attribute of opening.attributes){const a=node(attribute),key=node(a?.name),val=node(a?.value);if(a?.type!=='JSXAttribute'||typeof key?.name!=='string'||!['href','src','alt','type','name','placeholder','required'].includes(key.name))continue;if(!val&&key.name==='required'){attrs.push('required');continue;}if(val?.type==='StringLiteral')attrs.push(`${key.name}="${escape(String(val.value))}"`);}
    return `<${tag}${attrs.length?' '+attrs.join(' '):''}>${children}</${tag}>`;
  };
  return `<body>${render(jsx)}</body>`;
}

export function convertProjectPage(page:ProjectPage, options?:{prefix?:string; destinations?:Record<string,string>;assets?:Record<string,string>}):{funnel:Funnel;warnings:string[]} {
  const isJsx=/\.[jt]sx$/i.test(page.path);
  const document=parseDocument(isJsx?staticJsx(page.html):page.html), vars=isJsx?{}:dcValues(page.html), warnings:string[]=[];
  const root=DomUtils.findOne(n=>isElement(n)&&n.name==='x-dc',document.children,true) || DomUtils.findOne(n=>isElement(n)&&n.name==='body',document.children,true) || document;
  const layers:Layer[]=[];let seq=0;let unresolved=false;
  const add=(type:Layer['type'],content:Layer['content'],design?:Layer['design'])=>{if(layers.length>=500)throw new Error('A página contém blocos demais para importar de uma vez.');layers.push({id:`${options?.prefix||'import'}-${++seq}`,type,content,design});};
  const visit=(n:AnyNode,scope:Record<string,Value>,depth=0):void=>{
    if(depth>80 || !isElement(n))return;
    const tag=n.name.toLowerCase(),a=n.attribs||{};
    if(['script','style','iframe','svg','noscript','helmet','head','template'].includes(tag))return;
    if(tag==='sc-for'){
      const key=(a.list||'').match(/^\s*\{\{\s*([\w.]+)\s*\}\}\s*$/)?.[1];const items=key?scope[key]:undefined;
      if(Array.isArray(items)&&/^[\w]+$/.test(a.as||''))for(const item of items.slice(0,100))n.children.forEach(child=>visit(child,{...scope,[a.as]:item},depth+1));else unresolved=true;
      return;
    }
    if(tag==='img') {let src=a.src||'';if(src&&!/^https?:\/\//i.test(src))try{const resolved=new URL(src,`https://ct-import.invalid/${page.path}`);src=resolved.origin==='https://ct-import.invalid'?options?.assets?.[decodeURIComponent(resolved.pathname.slice(1))]||'':'';}catch{src='';}if(src)add('image',{image:{src}});else if(a.src)unresolved=true;return;}
    if(tag==='a' || tag==='button') {
      const label=DomUtils.textContent(n).replace(/\s+/g,' ').trim();const href=a.href||'';
      let destination=/^https?:\/\//i.test(href)?href:'';
      if(!destination && href && !href.startsWith('#'))try{const resolved=new URL(href,`https://ct-import.invalid/${page.path}`);if(resolved.origin==='https://ct-import.invalid')destination=options?.destinations?.[decodeURIComponent(resolved.pathname.slice(1))]||'';}catch{unresolved=true;}
      if(label && destination) {add('button',{label:substitute(label,scope),destination,type:/^https?:/.test(destination)?'url':'step'});return;}
      if(tag==='button')unresolved=true;
    }
    if(['input','textarea','select'].includes(tag)) {const type=a.type||'text';if(['text','email','tel','number','textarea','date'].includes(type)||tag==='textarea')add('field',{name:a.name||`campo_${seq+1}`,type:tag==='textarea'?'textarea':type==='tel'?'phone':type,title:a.placeholder||a.name||'Campo',required:'required' in a});else unresolved=true;return;}
    if(['h1','h2','h3','h4','h5','h6','p','li'].includes(tag) || (['span','div'].includes(tag)&&!n.children.some(child=>isElement(child)&&!allowedInline.has(child.name)))) {
      const html=n.children.map(child=>inline(child,scope)).join('').trim();
      if(html.replace(/<[^>]*>/g,'').trim()){const safeTag=/^h[1-6]$/.test(tag)?tag:'p';const style=a.style||'';const color=style.match(/(?:^|;)\s*color\s*:\s*(#[\da-f]{3,8}|[a-z]+)\s*(?:;|$)/i)?.[1];const size=style.match(/(?:^|;)\s*font-size\s*:\s*(\d{1,2})px/i)?.[1];add('text',{text:`<${safeTag}${color?` style="color:${color}"`:''}>${html}</${safeTag}>`},size?{fontSize:Number(size)}:undefined);}return;
    }
    n.children.forEach(child=>visit(child,scope,depth+1));
  };
  root.children.forEach(child=>visit(child,vars));
  if(!layers.length)throw new Error('Não encontramos conteúdo compatível para criar blocos editáveis nesta página.');
  if(page.dynamic)warnings.push('Recursos dinâmicos e responsivos precisam de revisão. Dados literais foram convertidos sem executar scripts.');
  if(isJsx)warnings.push('A importação JSX inclui apenas marcação e textos estáticos. Componentes, lógica, estilos e dados dinâmicos precisam ser refeitos.');
  if(unresolved)warnings.push('Algumas imagens locais, controles ou repetições não puderam ser convertidos.');
  warnings.push('Confira layout, cores, links e comportamento antes de usar a página.');
  const funnel=createLayersFunnel({...DEFAULT_CREATION,name:page.title.slice(0,120)||'Página importada'},'importacao-local');
  funnel.steps=[{id:'inicio',title:'Página importada',layers} as InleadStep] as unknown as Funnel['steps'];
  return {funnel,warnings};
}

/** Import multiple HTML files as connected, independently editable stages. */
export function convertProjectPages(pages:ProjectPage[],assets?:Record<string,string>):{funnel:Funnel;warnings:string[]} {
  if(!pages.length || pages.length>30)throw new Error('Selecione de 1 a 30 páginas HTML.');
  const destinations=Object.fromEntries(pages.map((page,index)=>[page.path,`etapa-${index+1}`]));
  const converted=pages.map((page,index)=>convertProjectPage(page,{prefix:`pagina-${index+1}`,destinations,assets}));
  const funnel=converted[0].funnel;
  funnel.steps=converted.map((item,index)=>({...(item.funnel.steps[0] as unknown as InleadStep),id:`etapa-${index+1}`,title:pages[index].title.slice(0,120)||`Etapa ${index+1}`})) as unknown as Funnel['steps'];
  return {funnel,warnings:[...new Set(converted.flatMap(item=>item.warnings))]};
}
