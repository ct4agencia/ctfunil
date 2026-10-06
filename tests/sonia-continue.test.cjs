const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function compile(file,imports={}){const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const m={exports:{}};new Function('require','module','exports',code)(id=>id in imports?imports[id]:require(id),m,m.exports);return m.exports;}
const sonia=compile('src/lib/quiz/layers/sonia.ts');
const noop=()=>{};const Component=compile('src/components/quiz/layers/SoniaNumbers.tsx',{react:{useRef:v=>({current:v}),useId:()=>1,useEffect:noop},'next/font/google':{Cormorant_Garamond:()=>({variable:''}),DM_Sans:()=>({variable:''})},'@/lib/quiz/layers/sonia':sonia,'./SoniaNumbers.module.css':{goldButton:'gold-button',continueEffect:'continue-effect'}}).default;
function nodes(tree,p){if(!tree)return [];if(Array.isArray(tree))return tree.flatMap(n=>nodes(n,p));if(typeof tree!=='object')return [];return [...(p(tree)?[tree]:[]),...nodes(tree.props?.children,p)];}
function buttons(state,config={}){return nodes(Component({config,state:{...sonia.initialSoniaState,...state},setState:noop,preview:false,destination:'https://app.goredirect.com.br/fd61/selecione-seu-numero',navigate:noop,trackSelection:noop}),n=>n.type==='button');}
const effect=b=>/continue-effect/.test(b.props.className||'') && /fx-shine/.test(b.props.className||'') && /fx-pulse/.test(b.props.className||'');
test('enabled stage2 main and chosen-number modal Continuar shine and pulse, disabled Continue never animates',()=>{
 const disabled=buttons({}).find(b=>b.props.children==='Continuar');assert.equal(disabled.props.disabled,true);assert.equal(effect(disabled),false);
 const enabled=buttons({selected:true,modal:'x'}).filter(b=>b.props.children==='Continuar');assert.equal(enabled.length,2);assert.ok(enabled.every(effect),'both enabled Continuar CTAs must shine and pulse');
 const invalid=buttons({selected:true},{numeroX:0}).find(b=>b.props.children==='Continuar');assert.equal(invalid.props.disabled,true);assert.equal(effect(invalid),false);
});
test('effect is absent from number cells, Y back action and generic Confirmar número',()=>{
 assert.ok(buttons({selected:true,modal:'x'}).filter(b=>b.props['data-number']).every(b=>!effect(b)));
 assert.equal(effect(buttons({modal:'y'}).find(b=>b.props.children==='Voltar aos números')),false);
 assert.equal(effect(buttons({selected:true,screen:'confirm'}).find(b=>b.props.children==='Confirmar número')),false);
});
test('continue-specific reduced-motion disables pseudo shine without changing global CTA stylesheet',()=>{
 const css=fs.readFileSync(path.join(root,'src/components/quiz/layers/SoniaNumbers.module.css'),'utf8');
 assert.match(css,/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.continueEffect::after[\s\S]*animation:\s*none\s*!important/);
 assert.match(css,/\.continueEffect::after[\s\S]*display:\s*none\s*!important/);
});
