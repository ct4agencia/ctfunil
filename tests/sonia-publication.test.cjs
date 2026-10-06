const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
test("release publica pelo resolver e /q existentes, sem lab, seed ou abertura de guard", () => {
  assert.equal(fs.existsSync(path.join(root, "src/app/lab/sonia")), false);
  assert.match(fs.readFileSync(path.join(root, "src/app/q/[slug]/page.tsx"), "utf8"), /resolveFunnel/);
  assert.match(fs.readFileSync(path.join(root, "src/lib/quiz/funnels-db.ts"), "utf8"), /from\("funnels"\)/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, "src/lib/quiz/registry.ts"), "utf8"), /sorteio-da-sonia|createSoniaDraft/);
  assert.match(fs.readFileSync(path.join(root, "src/app/builder/[slug]/actions.ts"), "utf8"), /await requireAdmin\(\)/);
});
test("factory adiciona somente sonia-pulse ao snapshot original, mantendo copy/destino", () => {
  const old = require.extensions[".ts"];
  require.extensions[".ts"] = (m, f) => m._compile(ts.transpile(fs.readFileSync(f, "utf8"), {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}), f);
  try {
    const {createSoniaDraft, SONIA_REDIRECT} = require("../src/lib/quiz/layers/sonia-draft.ts");
    const funnel = createSoniaDraft();
    const payload = JSON.parse(fs.readFileSync(path.join(root, "../quizfunnel-sonia-publication-preparation/funnel-publication-payload.json"), "utf8"));
    assert.equal(payload.slug, "sorteio-da-sonia");
    assert.equal(funnel.steps[0].layers[3].design.effect, "sonia-pulse");
    const withoutPulse = structuredClone(funnel);
    delete withoutPulse.steps[0].layers[3].design.effect;
    assert.deepEqual({...payload, slug:funnel.slug}, withoutPulse);
    assert.equal(payload.steps.length, 2);
    assert.equal(payload.settings.engine, "layers");
    assert.equal(payload.steps[1].layers[0].content.destination, SONIA_REDIRECT);
    assert.equal(SONIA_REDIRECT, "https://app.goredirect.com.br/fd61/selecione-seu-numero");
    for (const key of ["utmifyPixelId", "hotmartAccountId", "hotmartProductId", "webhooks", "domain"]) assert.equal(payload[key], undefined);
  } finally { require.extensions[".ts"] = old; }
});
