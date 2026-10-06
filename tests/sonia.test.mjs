import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const load = async () => {
 const source=fs.readFileSync(new URL('../src/lib/quiz/layers/sonia.ts',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const mod={exports:{}};new Function('module','exports',js)(mod,mod.exports);return mod.exports;
};

test('configuração aceita defaults e rejeita X/Y inválidos sem corrigir silenciosamente', async () => {
  const { soniaConfigError } = await load();
  assert.equal(soniaConfigError({}), null);
  assert.equal(soniaConfigError({ numeroX: 1, numeroY: 60 }), null);
  for (const c of [{ numeroX: 17, numeroY: 17 }, { numeroX: 0 }, { numeroY: 61 }, { numeroX: 3.5 }, { numeroX: '42' }, { numeroY: NaN }]) {
    assert.ok(soniaConfigError(c), JSON.stringify(c));
  }
});

test('grade 01..60; Y bloqueia, X direto seleciona, bloqueados e duplicatas não mudam estado', async () => {
  const { initialSoniaState, soniaCells, pickSonia } = await load();
  assert.equal(typeof soniaCells, 'function', 'Grade e transições ausentes');
  const c = {};
  const s = initialSoniaState;
  const cells = soniaCells(c, s);
  assert.equal(cells.length, 60);
  assert.deepEqual(cells.map(n => n.label), Array.from({length: 60}, (_, i) => String(i + 1).padStart(2, '0')));
  assert.deepEqual(cells.filter(n => n.status === 'available').map(n => n.number), [17, 42]);
  assert.equal(pickSonia(c, s, 1), s);
  const y = pickSonia(c, s, 17);
  assert.equal(y.yBlocked, true);
  assert.equal(y.selected, false);
  assert.equal(y.modal, 'y');
  assert.equal(pickSonia(c, y, 42), y);
  assert.equal(pickSonia(c, {...y, modal: null}, 17).modal, null);
  assert.equal(soniaCells(c, {...y, modal: null})[16].status, 'locked');
  const x = pickSonia(c, s, 42);
  assert.equal(x.selected, true);
  assert.equal(x.yBlocked, false, 'X não exige Y');
  assert.equal(x.modal, 'x');
  assert.equal(pickSonia(c, x, 42), x);
  assert.equal(soniaCells(c, {...x, modal: null})[41].status, 'selected');
  const custom = {numeroX: 2, numeroY: 59};
  assert.deepEqual(soniaCells(custom, s).filter(n => n.status === 'available').map(n => n.number), [2, 59]);
});

test('destino deve existir; nextStep e próxima explícita usam engine; runtime sem destino bloqueia', async () => {
  const { soniaDestination } = await load();
  assert.equal(typeof soniaDestination, 'function', 'Guarda de destino ausente');
  const steps = [{id:'a'}, {id:'b', nextStep:'a'}];
  assert.equal(soniaDestination(undefined, steps, 0), null);
  assert.equal(soniaDestination('next', steps, 0), 'next');
  assert.equal(soniaDestination(undefined, steps, 1), 'next');
  assert.equal(soniaDestination('a', steps, 1), 'a');
  assert.equal(soniaDestination('b', steps, 1), null);
  assert.equal(soniaDestination('missing', steps, 1), null);
  assert.equal(soniaDestination('javascript:alert(1)', steps, 1), null);
  assert.equal(soniaDestination('https://example.com/next', steps, 1), 'https://example.com/next');
  assert.equal(soniaDestination('https://', steps, 1), null);
  assert.equal(soniaDestination('next', [{id:'a'}], 0), null);
});

test('configuração limite 60/1 mantém somente esses disponíveis', async()=>{
 const {soniaCells,initialSoniaState}=await load();
 assert.deepEqual(soniaCells({numeroX:60,numeroY:1},initialSoniaState).filter(c=>c.status==='available').map(c=>c.label),['01','60']);
});
test('configuração inválida trava todas as células e não muta a seleção',async()=>{
 const {soniaCells,pickSonia,initialSoniaState}=await load();
 const c={numeroX:17,numeroY:17};assert.ok(soniaCells(c,initialSoniaState).every(n=>n.status==='locked'));assert.equal(pickSonia(c,initialSoniaState,17),initialSoniaState);
});
test('confirmed screen rejects further picks and blocked Y does not become available again',async()=>{
 const {soniaCells,pickSonia,initialSoniaState}=await load();
 const confirmed={...initialSoniaState,selected:true,screen:'confirm',confirmed:true};assert.equal(pickSonia({},confirmed,17),confirmed);
 assert.equal(soniaCells({}, {...initialSoniaState,yBlocked:true})[16].status,'locked');
});
test('destination refuses self-loop/missing nextStep and maintains exact URL without normalization',async()=>{
 const {soniaDestination}=await load();
 for(const nextStep of ['self','missing'])assert.equal(soniaDestination(undefined,[{id:'self',nextStep}],0),null);
 const dest='https://app.goredirect.com.br/fd61/selecione-seu-numero';assert.equal(soniaDestination(dest,[{id:'self'}],0),dest);
});
