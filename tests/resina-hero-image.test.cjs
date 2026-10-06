const test = require('node:test');
require.extensions['.css'] = (mod) => { mod.exports = { pulse: 'sonia-pulse' }; };
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return resolve.call(this, name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name, ...args);
};
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (mod, file) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 }, fileName: file,
  });
  mod._compile(outputText, file);
};
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const LayersRunner = require('../src/components/quiz/layers/LayersRunner.tsx').default;
const image = { id: 'mockup', type: 'image', content: { image: { src: 'https://example.test/mockup.webp' } }, design: { basis: 100, tag: 'GRÁTIS', selo: 'verificado', flutua: true, brilhos: true } };
function render(layers = [image]) {
  return renderToStaticMarkup(React.createElement(LayersRunner, {
    preview: true,
    funnel: { slug: 'generic-hero', name: 'Hero', settings: { engine: 'layers', design: { presetTelas: 'resina', themeColor: '#0284c7' } }, steps: [{ id: 'prep', type: 'layers', layers: [{ id: 'heading', type: 'text', content: { text: 'Título' } }, ...layers] }] },
  }));
}
test('hero do preset conserva proporção natural e design do bloco de imagem', () => {
  const html = render();
  assert.match(html, /height:auto/, 'mockup precisa preservar a proporção natural');
  assert.match(html, />GRÁTIS</);
  assert.match(html, />✓</);
  assert.match(html, /✨/);
  assert.doesNotMatch(html, /object-cover/, 'imagem avulsa não pode virar card recortado');
});
test('controles desligados removem efeitos sem perder largura configurada', () => {
  const html = render([{ ...image, design: { basis: 62, tag: '', selo: '', flutua: false, brilhos: false } }]);
  assert.match(html, /width:62%/);
  assert.match(html, /height:auto/);
  assert.doesNotMatch(html, />GRÁTIS<|>✓<|✨|⭐|💫/);
});
test('carrossel legado conserva moldura, URLs cruas e objetos, e navegação por dots', () => {
  const html = render([{ id: 'slides', type: 'carousel', content: { images: ['https://example.test/one.webp', { src: 'https://example.test/two.webp' }] } }]);
  assert.match(html, /aspect-ratio:4 \/ 5/);
  assert.match(html, /object-cover/);
  assert.match(html, /src="https:\/\/example.test\/one.webp"/);
  assert.match(html, /src="https:\/\/example.test\/two.webp"/);
  assert.match(html, /aria-label="Imagem 1"/);
  assert.match(html, /aria-label="Imagem 2"/);
});
test('múltiplas imagens avulsas conservam o carrossel legado', () => {
  const html = render([image, { ...image, id: 'second', content: { image: { src: 'https://example.test/second.webp' } } }]);
  assert.match(html, /object-cover/);
  assert.match(html, /aria-label="Imagem 2"/);
});
