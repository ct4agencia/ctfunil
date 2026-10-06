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
