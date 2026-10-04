const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function harness() {
  const slots = []; let cursor = 0; let effects = [];
  const storage = new Map(); const calls = []; const handlers = []; let loginResponse; let pauseToken;
  const changed = (a, b) => !a || a.length !== b.length || a.some((v, i) => v !== b[i]);
  const React = {
    createContext: () => ({ Provider: 'Provider' }), createElement: (type, props) => ({ type, props }),
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef: initial => { const i = cursor++; return slots[i] ||= { current: initial }; },
    useCallback: (fn, deps) => { const i = cursor++; if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect: (fn, deps) => { const i = cursor++; if (!slots[i] || changed(slots[i].deps, deps)) { const old = slots[i]; slots[i] = { deps }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  const secureAuthStorage = {
    getItem: async key => storage.get(key) || null,
    setItem: async (key, value) => { if (key === 'token' && pauseToken) await pauseToken.promise; storage.set(key, value); },
    removeItem: async key => storage.delete(key),
    multiRemove: async keys => keys.forEach(key => storage.delete(key)),
  };
  const axios = {
    get: async () => ({ data: { id: 'a', username: 'account-a' } }),
    post: async (url, data) => { calls.push({ url, data }); if (url.endsWith('/login')) return loginResponse ? loginResponse.promise : { data: { access_token: 'token-a', user_id: 'a', username: 'account-a' } }; return { data: {} }; },
    interceptors: { response: { use: (success, failure) => { handlers.push(failure); return handlers.length; }, eject: () => {} } },
  };
  const mocks = { react: React, axios, '../utils/secureAuthStorage': { secureAuthStorage }, '../services/config': { requireApiUrl: () => 'https://api.example.test' }, '@react-native-async-storage/async-storage': { multiRemove: async () => {} } };
  const compiled = ts.transpileModule(fs.readFileSync(require.resolve('../contexts/AuthContext.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: name => { if (!(name in mocks)) throw new Error(`Unexpected module ${name}`); return mocks[name]; } });
  const render = () => { cursor = 0; const context = exports.AuthProvider({ children: null }).props.value; const pending = effects; effects = []; pending.forEach(fn => fn()); return context; };
  return { render, storage, calls, handlers, delayLogin: () => loginResponse = deferred(), delayToken: () => pauseToken = deferred() };
}
test('a completed login stores matching credentials and logout clears them', async () => {
  const h = harness(); await h.render().login('a', 'password');
  assert.equal(h.render().token, 'token-a');
  assert.equal(h.storage.get('userId'), 'a');
  await h.render().logout();
  assert.equal(h.render().token, null); assert.equal(h.storage.size, 0);
  assert.ok(h.calls.some(call => call.url.endsWith('/logout')));
});
test('a delayed login cannot restore an account after logout', async () => {
  const h = harness(); const delayed = h.delayLogin();
  const login = h.render().login('a', 'password');
  await h.render().logout();
  delayed.resolve({ data: { access_token: 'late-token', user_id: 'a', username: 'account-a' } });
  await assert.rejects(login, /cancelled/);
  assert.equal(h.render().token, null); assert.equal(h.storage.size, 0);
});
test('logout waits for an interrupted credential write and then removes every credential', async () => {
  const h = harness(); const write = h.delayToken();
  const login = h.render().login('a', 'password');
  const rejected = assert.rejects(login, /cancelled/);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.storage.get('userId'), 'a'); assert.equal(h.storage.has('token'), false);
  const logout = h.render().logout();
  write.resolve();
  await Promise.all([rejected, logout]);
  assert.equal(h.render().token, null); assert.equal(h.storage.size, 0);
});

test('a late unauthorized response from an old session cannot sign out a new account', async () => {
  const h = harness(); await h.render().login('a', 'password'); h.render();
  const oldHandler = h.handlers.at(-1);
  await h.render().logout();
  const response = h.delayLogin(); const login = h.render().login('b', 'password');
  response.resolve({ data: { access_token: 'token-b', user_id: 'b', username: 'account-b' } });
  await login; h.render();
  await assert.rejects(oldHandler({ response: { status: 401 }, config: { url: 'https://api.example.test/api/auth/profile', headers: { Authorization: 'Bearer token-a' } } }));
  assert.equal(h.render().token, 'token-b'); assert.equal(h.storage.get('userId'), 'b');
});
