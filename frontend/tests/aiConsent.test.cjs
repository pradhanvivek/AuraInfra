const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function harness() {
  const calls = [];
  const mocks = { './config': { API_URL: 'https://api.example.test' }, axios: {
    get: async (...args) => { calls.push(['get', ...args]); return { data: {} }; },
    post: async (...args) => { calls.push(['post', ...args]); return { data: {} }; },
  } };
  const source = fs.readFileSync(require.resolve('../services/aiConsent.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: name => mocks[name] });
  return { api: exports, calls };
}
test('concurrent AI uploads share one explicit consent decision for the same session', async () => {
  const { api, calls } = harness(); let prompts = 0;
  api.setAIConsentPrompt(async token => { assert.equal(token, 'account-a'); prompts++; return true; });
  await Promise.all([api.ensureAIConsent('account-a'), api.ensureAIConsent('account-a')]);
  assert.equal(prompts, 1);
  assert.equal(calls.filter(c => c[0] === 'post').length, 1);
});
test('declining consent sends no acceptance and the next attempt can prompt again', async () => {
  const { api, calls } = harness();
  api.setAIConsentPrompt(async () => false);
  await assert.rejects(api.ensureAIConsent('account-a'), /cancelled/);
  assert.equal(calls.filter(c => c[0] === 'post').length, 0);
  api.setAIConsentPrompt(async () => true);
  await api.ensureAIConsent('account-a');
  assert.equal(calls.filter(c => c[0] === 'post').length, 1);
});
test('an old account request cannot reuse another account consent prompt', async () => {
  const { api, calls } = harness();
  api.setAIConsentPrompt(async token => token === 'account-b');
  const results = await Promise.allSettled([api.ensureAIConsent('account-a'), api.ensureAIConsent('account-b')]);
  assert.equal(results[0].status, 'rejected'); assert.equal(results[1].status, 'fulfilled');
  const accepted = calls.filter(c => c[0] === 'post');
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0][3].headers.Authorization, 'Bearer account-b');
});
