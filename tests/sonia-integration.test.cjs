const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function compile(relative, imports = {}) {
  const filename = path.join(root, relative);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)((id) => id in imports ? imports[id] : require(id), module, module.exports);
  return module.exports;
}
const sonia = compile('src/lib/quiz/layers/sonia.ts');
test('preview externo padrão segue bloqueado; opt-in local continua direto, somente após Continuar', () => {
  const original=global.requestAnimationFrame; global.requestAnimationFrame=()=>0;
  try {
    for(const allowed of [false,true]) {
      const h=componentHarness({preview:true,destination:'https://app.goredirect.com.br/fd61/selecione-seu-numero',allowExternalNavigation:allowed});
      h.find(h.render(),n=>n.props?.['data-number']==='42').props.onClick();
      assert.equal(h.navigations,0,'escolher X nunca navega');
      const next=h.find(h.render(),n=>n.type==='button' && n.props.children==='Continuar');
      next.props.onClick(); next.props.onClick();
      assert.equal(h.navigations,allowed?1:0);
      assert.equal(h.state.screen,allowed?'select':'confirm');
    }
  } finally {global.requestAnimationFrame=original;}
});

const draft = compile('src/lib/quiz/layers/sonia-draft.ts', { './sonia': sonia });
const graph = compile('src/components/builder/flow/graph.ts', { '@/lib/quiz/layers/sonia': sonia });

test('rota local: production e Host remoto dão notFound mesmo com opt-in', async () => {
  const oldEnv=process.env.NODE_ENV;
  let host='127.0.0.1:4317';
  const Page=compile('src/app/lab/sonia/page.tsx',{
    'next/headers':{headers:async()=>({get:()=>host})},
    'next/navigation':{notFound:()=>{throw new Error('notFound');}},
    './SoniaLab':{__esModule:true,default:()=>null},
  }).default;
  try {
    process.env.NODE_ENV='production';
    await assert.rejects(()=>Page({searchParams:Promise.resolve({mode:'redirect'})}),/notFound/);
    process.env.NODE_ENV='development';host='example.invalid';
    await assert.rejects(()=>Page({searchParams:Promise.resolve({mode:'redirect'})}),/notFound/);
    host='127.0.0.1:4317';
    const tree=await Page({searchParams:Promise.resolve({mode:'redirect'})});
    assert.equal(tree.props.realRedirect,true);assert.equal(tree.props.view,'flow');
  } finally {if(oldEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldEnv;}
});

test('Runner real: opt-in restrito a dev/loopback/lab; URL Sônia exata e rastreio comum preservado', () => {
  const source=fs.readFileSync(path.join(root,'src/components/quiz/layers/LayersRunner.tsx'),'utf8');
  const oldWindow=global.window, oldEnv=process.env.NODE_ENV;
  const noop=()=>null;
  const stub=new Proxy({__esModule:true,default:noop},{get:(o,k)=>k in o?o[k]:noop});
  const imports=Object.fromEntries([...source.matchAll(/from "([^"]+)"/g)].map(m=>[m[1],stub]));
  let events=0, cursor=0; const slots=[];
  Object.assign(imports,{
    react:{useState:v=>{const i=cursor++; if(!(i in slots))slots[i]=v;return [slots[i],u=>{slots[i]=typeof u==='function'?u(slots[i]):u;}];},useEffect:noop,useMemo:fn=>fn(),useRef:v=>({current:v})},
    'next/dynamic':{__esModule:true,default:()=>noop},
    '@/lib/quiz/layers/sonia':sonia,
    '@/lib/quiz/layers/sonia-draft':draft,
    '@/lib/quiz/track':{trackAnswer:()=>events++,trackStep:()=>events++},
    '@/lib/quiz/rastreio':{comRastreio:url=>url+'?existing-tracking=preserved'},
    'motion/react':{AnimatePresence:noop,motion:{div:noop}},
    './blocks':{LayersEditContext:{Provider:noop},Block:noop},
  });
  const Runner=compile('src/components/quiz/layers/LayersRunner.tsx',imports).default;
  function find(tree,predicate){if(!tree)return null;if(Array.isArray(tree)){for(const t of tree){const n=find(t,predicate);if(n)return n;}return null;}if(typeof tree!=='object')return null;return predicate(tree)?tree:find(tree.props?.children,predicate);}
  const dest=draft.SONIA_REDIRECT;
  try {
    for(const [env,host,pathName,preview,allowed] of [
      ['development','127.0.0.1','/lab/sonia',true,true],
      ['production','127.0.0.1','/lab/sonia',true,false],
      ['development','example.invalid','/lab/sonia',true,false],
      ['development','127.0.0.1','/builder/other',true,false],
      ['production','127.0.0.1','/q/other',false,false],
    ]) {
      process.env.NODE_ENV=env; const navigation=[];
      global.window={location:{hostname:host,pathname:pathName,assign:url=>navigation.push(url)}};
      const f=draft.createSoniaDraft();
      f.steps[1].layers.push({id:'sibling',type:'button',content:{label:'Irmão',destination:dest}});
      slots.length=0; cursor=0;
      const props={funnel:f,startIndex:1,preview,localPreviewRedirect:dest};
      const tree=Runner(props);
      const sibling=find(tree,n=>n.props?.ctx);
      sibling.props.ctx.navigate(dest);
      assert.deepEqual(navigation,preview?[]:[dest+'?existing-tracking=preserved'],'navigate compartilhado nunca herda opt-in');
      navigation.length=0;
      const hero=find(tree,n=>n.props?.trackSelection);
      assert.equal(hero.props.allowExternalNavigation,allowed);
      hero.props.navigate(dest);
      assert.deepEqual(navigation,[],'callback exclusivo também bloqueia antes da seleção');
      hero.props.setState({...sonia.initialSoniaState,selected:true}); cursor=0;
      const selectedHero=find(Runner(props),n=>n.props?.trackSelection);
      selectedHero.props.navigate(dest);
      assert.deepEqual(navigation,allowed || !preview?[dest]:[]);
      navigation.length=0;
      if(preview && allowed){
        global.window.location.pathname='/builder/other';
        selectedHero.props.navigate(dest);
        assert.deepEqual(navigation,[],'callback revalida pathname no momento da continuação');
        global.window.location.pathname=pathName;
      }
      selectedHero.props.navigate('https://example.invalid/not-allowed');
      assert.deepEqual(navigation,preview?[]:['https://example.invalid/not-allowed']);
      if(preview){
        cursor=0;
        const denied=find(Runner({...props,localPreviewRedirect:'https://example.invalid/not-allowed'}),n=>n.props?.trackSelection);
        assert.equal(denied.props.allowExternalNavigation,false,'prop não amplia allowlist literal');
        denied.props.navigate('https://example.invalid/not-allowed');
        assert.deepEqual(navigation,[]);
      }
      hero.props.trackSelection('42');
    }
    assert.equal(events,1,'preview continua sem registrar respostas');
    process.env.NODE_ENV='production';const navigation=[];
    global.window={location:{hostname:'127.0.0.1',pathname:'/q/common',assign:url=>navigation.push(url)}};
    const f=draft.createSoniaDraft(); f.steps=[{id:'ordinary',title:'Comum',layers:[{id:'ordinary-button',type:'button',content:{label:'Comum',destination:dest}}]}];
    const tree=Runner({funnel:f,preview:false});
    find(tree,n=>n.props?.ctx).props.ctx.navigate(dest);
    assert.deepEqual(navigation,[dest+'?existing-tracking=preserved']);
  } finally {global.window=oldWindow; if(oldEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldEnv;}
});

test('template Sônia v2 tem exatamente duas lâminas, copy literal e destino aprovado', () => {
  const f = draft.createSoniaDraft();
  assert.equal(f.name, 'Sorteio da Sônia');
  assert.equal(f.settings.engine, 'layers');
  assert.equal(f.steps.length, 2);
  assert.equal(draft.SONIA_DRAFT_KEY, 'quizfunel:sonia:local-draft:v2');
  const first = f.steps[0];
  const text = first.layers.filter(l => l.type === 'text').map(l => l.content.text.replace(/<[^>]*>/g, ''));
  assert.deepEqual(text, ['hoje, às 18:00, vou selecionar 5 mulheres AO VIVO que vão receber uma MEGA surpresa', 'Pra poder ser uma das selecionadas, clique agora em “CONFIRMAR”! Boa sorte!!!']);
  assert.equal(first.layers.find(l => l.type === 'image').content.image.src, '/sorteio-da-sonia/logo-sorteio-da-sonia.png');
  assert.equal(first.layers.find(l => l.type === 'button').content.label, 'CONFIRMAR');
  assert.equal(first.layers.find(l => l.type === 'button').content.destination, f.steps[1].id);
  assert.equal(JSON.stringify(f).includes('pendente'), false);
  assert.equal(f.steps[1].layers[0].type, 'sonia-numbers');
  assert.deepEqual(f.steps[1].layers[0].content, {numeroX:42,numeroY:17,destination:'https://app.goredirect.com.br/fd61/selecione-seu-numero'});
  const registry = fs.readFileSync(path.join(root, 'src/lib/quiz/registry.ts'), 'utf8');
  assert.equal(registry.includes('sonia-draft'), false);
});

test('mapa não inventa saída para Sônia sem destino / mostra destination configurado', () => {
  const f=draft.createSoniaDraft();
  const selection=f.steps[1];
  delete selection.layers[0].content.destination;
  assert.deepEqual(graph.flowExits(selection), [], 'Sônia pendente não navega automaticamente');
  const nodes=graph.buildNodes([...f.steps,{id:'after', title:'Depois',layers:[]}]);
  assert.equal(nodes[1].proxima, undefined, 'Mapa não deve sugerir sequência inexistente no runtime');
  selection.layers[0].content.destination='sonia-convite';
  assert.equal(graph.flowExits(selection)[0].dest, 'sonia-convite');
});

// Isolated handler test of actual compiled component. Hooks are mocked only to
// call closures without a DOM framework; focus/dialog proven separately in Edge.
function componentHarness({preview=false, destination=null, selected=false, allowExternalNavigation=false}={}) {
  const refs=[]; let cursor=0;
  const hooks={useRef(value){return refs[cursor++] ||= {current:value};},useId(){return 'test-id';},useEffect(){}};
  const fonts={Cormorant_Garamond:()=>({variable:''}),DM_Sans:()=>({variable:''})};
  const Component=compile('src/components/quiz/layers/SoniaNumbers.tsx',{
    react:hooks,'next/font/google':fonts,'@/lib/quiz/layers/sonia':sonia,'./SoniaNumbers.module.css':{},
  }).default;
  let state={...sonia.initialSoniaState,selected}; let events=0,navigations=0;
  function render() {
    cursor=0;
    return Component({config:{},state,setState(u){state=typeof u==='function'?u(state):u;},preview,destination,allowExternalNavigation,navigate(){navigations++;},trackSelection(){events++;}});
  }
  function find(tree,predicate) {
    if (!tree) return null;
    if(Array.isArray(tree)){for(const n of tree){const r=find(n,predicate);if(r)return r;}return null;}
    if(typeof tree!=='object')return null;
    if(predicate(tree))return tree;
    return find(tree.props?.children,predicate);
  }
  return {render,find,get state(){return state;},get events(){return events;},get navigations(){return navigations;}};
}

test('runtime handlers: double click X em mesmo tick registra uma única resposta', () => {
  const h=componentHarness(); const tree=h.render(); const x=h.find(tree,n=>n.props?.['data-number']==='42');
  x.props.onClick(); x.props.onClick();
  assert.equal(h.events,1); assert.equal(h.state.selected,true); assert.equal(h.state.modal,'x');
});

test('runtime sem destino impede confirmar; destino interno não duplica navegação', () => {
  const original=global.requestAnimationFrame; global.requestAnimationFrame=()=>0;
  try {
    const h=componentHarness({selected:true});
    h.find(h.render(),n=>n.type==='button' && n.props.children==='Continuar').props.onClick();
    assert.equal(h.state.screen,'confirm');
    const confirm=h.find(h.render(),n=>n.type==='button' && n.props.children==='Confirmar número');
    assert.equal(confirm.props.disabled,true);
    confirm.props.onClick();
    assert.equal(h.state.confirmed,false); assert.equal(h.navigations,0);
    const h2=componentHarness({selected:true,destination:'another'});
    const next=h2.find(h2.render(),n=>n.type==='button' && n.props.children==='Continuar');
    next.props.onClick(); next.props.onClick();
    assert.equal(h2.navigations,1);
  } finally {global.requestAnimationFrame=original;}
});
