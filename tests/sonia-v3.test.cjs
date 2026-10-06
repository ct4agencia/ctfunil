const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function compile(file,imports={}){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',code)(id=>id in imports?imports[id]:require(id),module,module.exports);
  return module.exports;
}
function find(tree,predicate){
  if(!tree)return null;
  if(Array.isArray(tree)){for(const child of tree){const found=find(child,predicate);if(found)return found;}return null;}
  if(typeof tree!=='object')return null;
  return predicate(tree)?tree:find(tree.props?.children,predicate);
}
function blocksHarness(){
  const noop=()=>null;
  const source=fs.readFileSync(path.join(root,'src/components/quiz/layers/blocks.tsx'),'utf8');
  const stub=new Proxy({__esModule:true,default:noop},{get:(o,k)=>k in o?o[k]:noop});
  const imports=Object.fromEntries([...source.matchAll(/from "([^"]+)"/g)].map(m=>[m[1],stub]));
  imports.react={createContext:require('react').createContext,useContext:()=>null,useState:v=>[v,noop],useEffect:noop,useRef:v=>({current:v})};
  imports['motion/react']={motion:new Proxy({},{get:(_,k)=>String(k)}),AnimatePresence:noop};
  imports['next/dynamic']={__esModule:true,default:()=>noop};
  imports['./SoniaNumbers.module.css']={__esModule:true,default:{pulse:'sonia-pulse'}};
  imports['@/lib/tracking']=compile('src/lib/tracking.ts',{'@/lib/supabase/client':{createClient:noop}});
  return compile('src/components/quiz/layers/blocks.tsx',imports);
}
test('ButtonBlock real: fbq memória zero no preview; InitiateCheckout preservado fora preview, sem pixel real',()=>{
  const before=global.window;
  const events=[];global.window={fbq:(...args)=>events.push(args)};
  try{
    const {Block}=blocksHarness();
    for(const preview of [true,false])for(const image of [false,true]){
      events.length=0;const navigations=[];
      const layer={id:'button',type:'button',content:{label:'Comum',destination:'https://app.goredirect.com.br/fd61/selecione-seu-numero',...(image?{imageSrc:'/fixture.png'}:{})}};
      const ctx={design:{},preview,navigate:dest=>navigations.push(dest)};
      const outer=find(Block({layer,ctx,question:''}),n=>n.type?.name==='ButtonBlock'); const block=outer.type(outer.props);
      const clicked=find(block.type(block.props),n=>n.props?.onClick);
      clicked.props.onClick();
      assert.deepEqual(events,preview?[]:[['track','InitiateCheckout',{}]],'preview não chama fbq nem com destino aprovado');
      assert.deepEqual(navigations,[layer.content.destination],'guard de pixel não altera delegação ao runner');
    }
    events.length=0;
    const layer={id:'internal',type:'button',content:{label:'Interno',destination:'next'}};
    const outer=find(Block({layer,ctx:{design:{},preview:false,navigate:()=>{}},question:''}),n=>n.type?.name==='ButtonBlock'); const block=outer.type(outer.props);
    find(block.type(block.props),n=>n.props?.onClick).props.onClick();
    assert.deepEqual(events,[],'botão interno não inventa InitiateCheckout');
  }finally{global.window=before;}
});

test('CTA Sônia usa pulse dos números no wrapper sem mudar label/destino/efeitos comuns',()=>{
  const {Block}=blocksHarness();
  for(const [effect,expected] of [['sonia-pulse','sonia-pulse'],['pulse','fx-pulse'],['shine-pulse','fx-pulse'],['none','']]){
    const navigations=[];
    const layer={id:'sonia-confirmar',type:'button',design:{effect},content:{label:'CONFIRMAR',destination:'sonia-selecao'}};
    const ctx={design:{rounded:'rounded-2xl'},navigate:dest=>navigations.push(dest)};
    const outer=find(Block({layer,ctx,question:''}),n=>n.type?.name==='ButtonBlock'); const block=outer.type(outer.props);
    const wrapper=block.type(block.props),button=find(wrapper,n=>n.type==='button');
    assert.equal(wrapper.props.className.includes('sonia-pulse'),expected==='sonia-pulse');
    assert.equal(wrapper.props.className.includes('fx-pulse'),expected==='fx-pulse');
    assert.equal(button.props.className.includes('sonia-pulse'),false,'motion transform pertence ao botão, pulse ao wrapper');
    assert.equal(find(button,n=>n.type==='span').props.children,'CONFIRMAR');
    button.props.onClick();assert.deepEqual(navigations,['sonia-selecao']);
  }
});

const sonia=compile('src/lib/quiz/layers/sonia.ts');
const graph=compile('src/components/builder/flow/graph.ts',{'@/lib/quiz/layers/sonia':sonia});
test('grafo Sônia: nextStep não sequencial corresponde runtime sem edge posicional extra',()=>{
  const steps=[{id:'convite',layers:[]},{id:'selecao',nextStep:'convite',layers:[{id:'numbers',type:'sonia-numbers',content:{}}]},{id:'depois',layers:[]}];
  assert.equal(sonia.soniaDestination(undefined,steps,1),'next');
  const nodes=graph.buildNodes(steps);
  assert.equal(nodes[1].proxima,'convite');
  assert.deepEqual(graph.buildEdges(steps,nodes).filter(e=>e.from==='selecao').map(e=>e.to),['convite'],'não inventar saída para próxima física');
});
test('grafo Sônia: precedência/validação de destino, disabled e próximo configurado; contratos comuns intactos',()=>{
  for(const [destination,nextStep,expected] of [
    ['next','convite',['convite']],['next',undefined,['depois']],
    [undefined,'missing',[]],[undefined,'selecao',[]],[undefined,'off',[]],
    ['missing',undefined,[]],['selecao',undefined,[]],['off',undefined,[]],
    ['convite','depois',['convite']],['https://example.invalid/','convite',[null]],
    [undefined,undefined,[]],['https://',undefined,[]],
  ]){
    const steps=[{id:'convite',layers:[]},{id:'selecao',nextStep,layers:[{id:'numbers',type:'sonia-numbers',content:{destination}}]},{id:'off',disabled:true,layers:[]},{id:'depois',layers:[]}];
    const nodes=graph.buildNodes(steps);
    assert.deepEqual(graph.buildEdges(steps,nodes).filter(e=>e.from==='selecao').map(e=>e.to),expected,JSON.stringify({destination,nextStep}));
  }
  const ordinary=[{id:'a',layers:[{id:'bt',type:'button',content:{destination:'missing'}}]},{id:'off',disabled:true,layers:[]},{id:'b',layers:[]}];
  assert.equal(graph.resolveDest(ordinary,0,'missing').to,'b','contrato fallback botão comum preservado');
  assert.deepEqual(graph.buildEdges(ordinary,graph.buildNodes(ordinary)).filter(e=>e.from==='a').map(e=>e.to),['b']);
  assert.equal(graph.flowExits({id:'multiple',layers:[{id:'options',type:'options',content:{multiple:true,options:[{id:'o',destination:'elsewhere'}]}}]})[0].dest,'next');
});
