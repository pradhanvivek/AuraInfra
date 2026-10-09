const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function harness() {
  let token = 'account-a'; let cursor = 0; let effects = []; let listener; let tick; const slots = []; const requests = [];
  const changed = (a, b) => !a || a.length !== b.length || a.some((v, i) => v !== b[i]);
  const React = {
    createContext: () => ({ Provider: 'Provider' }), createElement: (type, props) => ({ type, props }),
    useContext: () => {},
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef: initial => { const i = cursor++; return slots[i] ||= { current: initial }; },
    useCallback: (fn, deps) => { const i = cursor++; if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect: (fn, deps) => { const i = cursor++; if (!slots[i] || changed(slots[i].deps, deps)) { const old = slots[i]; slots[i] = { deps }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  const flags = {};
  const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(compile('utils/moduleFlags.ts'), { exports: flags });
  const mocks = { react: React, 'react-native': { AppState: { currentState: 'active', addEventListener: (_, fn) => { listener = fn; return { remove() {} }; } } },
    axios: { get: (url, config) => { const request = deferred(); requests.push({ ...request, config }); return request.promise; } },
    './AuthContext': { useAuth: () => ({ token }) }, '../services/config': { API_URL: 'https://api.example.test' }, '../utils/moduleFlags': flags };
  const out = {};
  vm.runInNewContext(compile('contexts/FeatureFlagsContext.tsx'), { exports: out, React, require: name => mocks[name], setInterval: fn => { tick = fn; return 1; }, clearInterval() {} });
  function render() { cursor = 0; const state = out.FeatureFlagsProvider({ children: null }).props.value; const pending = effects; effects = []; pending.forEach(fn => fn()); return state; }
  return { render, requests, setToken: value => { token = value; }, foreground: () => listener('active'), poll: () => tick() };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('flags refresh on foreground and interval; a failed refresh blocks content', async () => {
  const h = harness(); assert.equal(h.render().loading, true);
  h.requests[0].resolve({ data: { community: true, assets: true } }); await flush();
  assert.equal(h.render().flags.community, true);
  h.foreground(); h.requests[1].resolve({ data: { community: false, assets: true } }); await flush();
  assert.equal(h.render().flags.community, false);
  h.poll(); h.requests[2].reject(new Error('offline')); await flush();
  assert.equal(h.render().error, true); assert.equal(h.render().flags.assets, false);
});
test('late responses from another account never replace current flags', async () => {
  const h = harness(); h.render();
  h.setToken('account-b'); assert.equal(h.render().flags.assets, false);
  h.requests[1].resolve({ data: { community: false, assets: true } }); await flush();
  h.requests[0].resolve({ data: { community: true, assets: false } }); await flush();
  assert.equal(h.render().flags.assets, true); assert.equal(h.render().flags.community, false);
});
test('a stale response after logout cannot enable modules', async () => {
  const h = harness(); h.render(); h.setToken(null); h.render();
  h.requests[0].resolve({ data: { community: true, assets: true } }); await flush();
  assert.equal(h.render().flags.assets, false); assert.equal(h.render().loading, false);
});
