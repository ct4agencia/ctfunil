const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function compile(file,imports={}) {
 const source=fs.readFileSync(path.join(root,file),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const m={exports:{}};new Function('require','module','exports',code)(id=>id in imports?imports[id]:require(id),m,m.exports);return m.exports;
}
function find(t,p) {if(!t)return null;if(Array.isArray(t)){for(const c of t){const f=find(c,p);if(f)return f;}return null;}if(typeof t!=='object')return null;return p(t)?t:find(t.props?.children,p);}
function runnerHarness(preview=false){
 const noop=()=>null;const stub=new Proxy({__esModule:true,default:noop},{get:(o,k)=>k in o?o[k]:noop});
 const source=fs.readFileSync(path.join(root,'src/components/quiz/layers/LayersRunner.tsx'),'utf8');
 const imports=Object.fromEntries([...source.matchAll(/from "([^"]+)"/g)].map(m=>[m[1],stub]));
 let cursor=0;const slots=[],navigation=[],events=[];
 imports.react={useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return [slots[i],u=>slots[i]=typeof u==='function'?u(slots[i]):u];},useEffect:noop,useMemo:f=>f(),useRef:v=>({current:v})};
 imports['next/dynamic']={__esModule:true,default:()=>noop};
 if(fs.existsSync(path.join(root,'src/lib/quiz/layers/sonia.ts')))imports['@/lib/quiz/layers/sonia']=compile('src/lib/quiz/layers/sonia.ts');
 imports['@/lib/quiz/track']={trackAnswer:(...a)=>events.push(a),trackStep:noop};
 imports['@/lib/quiz/rastreio']={comRastreio:u=>u+'?existing-tracking=preserved'};
 imports['motion/react']={AnimatePresence:noop,motion:{div:noop}};
 imports['./blocks']={LayersEditContext:{Provider:noop},Block:noop};
 const Runner=compile('src/components/quiz/layers/LayersRunner.tsx',imports).default;
 const dest='https://app.goredirect.com.br/fd61/selecione-seu-numero';
 const f={slug:'live1',steps:[{id:'sonia-selecao',layers:[{id:'sonia-numeros',type:'sonia-numbers',content:{numeroX:42,numeroY:17,destination:dest}},{id:'sibling',type:'button',content:{destination:dest}}]}],settings:{}};
 return {dest,navigation,events,render(){cursor=0;return Runner({funnel:f,preview});}};
}
test('live1 renders real SoniaNumbers hero from persisted sonia-numbers, selection gates exact redirect, preview guards and sibling tracking preserved',()=>{
 const before=global.window;
 try {for(const preview of [false,true]){
 const h=runnerHarness(preview);global.window={location:{assign:u=>h.navigation.push(u)}};
 let tree=h.render();let hero=find(tree,n=>typeof n.props?.trackSelection==='function');
 assert.ok(hero,'sonia-numbers must render the dedicated numbers runtime, not an empty unsupported Block');
 assert.equal(hero.props.config.numeroX,42);assert.equal(hero.props.config.numeroY,17);
 hero.props.navigate(h.dest);assert.deepEqual(h.navigation,[],'cannot redirect before selection');
 hero.props.setState({...hero.props.state,selected:true});tree=h.render();hero=find(tree,n=>n.props?.trackSelection);
 hero.props.navigate(h.dest);assert.deepEqual(h.navigation,preview?[]:[h.dest]);
 h.navigation.length=0;find(tree,n=>n.props?.ctx).props.ctx.navigate(h.dest);
 assert.deepEqual(h.navigation,preview?[]:[h.dest+'?existing-tracking=preserved']);
 hero.props.trackSelection('42');assert.equal(h.events.length,preview?0:1);
 }}finally{global.window=before;}
});
