const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');

function harness(platform = 'android', userId = 'user-a') {
  const storage = new Map(); const requests = []; let redirected = ''; let callback = 'success';
  const Platform = { OS: platform };
  const mocks = {
    'react-native-get-random-values': {}, 'react-native': { Platform },
    'expo-web-browser': { openAuthSessionAsync: async (url, redirect) => {
      redirected = url;
      return callback === 'cancel' ? { type: 'cancel' } : { type: 'success', url: `${redirect}#session_id=provider-session` };
    } },
    'expo-apple-authentication': {
      AppleAuthenticationScope: { EMAIL: 0 },
      signInAsync: async () => ({ identityToken: 'signed-apple-token', authorizationCode: 'one-time-code' }),
    },
    axios: { post: async (url, data, options) => {
      requests.push({ url, data, options });
      return { data: url.endsWith('/challenge') ? { nonce: 'server-nonce' } : { access_token: 'app-jwt', user_id: userId, username: 'user' } };
    } },
    '../utils/secureAuthStorage': { secureAuthStorage: {
      getItem: async key => storage.get(key) || null,
      setItem: async (key, value) => storage.set(key, value),
      removeItem: async key => storage.delete(key),
    } },
    './config': { requireApiUrl: () => 'https://api.example.test' },
  };
  const source = fs.readFileSync(require.resolve('../services/socialAuth.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: name => {
    if (!(name in mocks)) throw new Error(`Unexpected module ${name}`);
    return mocks[name];
  }, crypto: webcrypto, Uint8Array, URL, URLSearchParams, Date, process: { env: {} },
  window: { location: { origin: 'https://app.example.test', assign: url => { redirected = url; } } }, });
  return { api: exports, storage, requests, redirect: () => redirected, cancel: () => { callback = 'cancel'; } };
}
function pending(h, values = {}) {
  h.storage.set('oauth_pending', JSON.stringify({ state: 'expected-state', createdAt: Date.now(), purpose: 'login', ...values }));
}

test('native Google callback uses the declared aurainfra scheme and issues an app-token exchange', async () => {
  const h = harness();
  const auth = await h.api.signInGoogle();
  assert.equal(auth.access_token, 'app-jwt');
  const redirect = new URL(h.redirect()).searchParams.get('redirect');
  assert.match(redirect, /^aurainfra:\/\/auth\/login\?oauth_state=/);
  assert.equal(h.requests[0].options.headers['X-Session-ID'], 'provider-session');
  assert.equal(h.storage.has('oauth_pending'), false);
});
test('web sign-in saves state before redirecting', async () => {
  const h = harness('web');
  assert.equal(await h.api.signInGoogle(), null);
  const redirect = new URL(h.redirect()).searchParams.get('redirect');
  const state = new URL(redirect).searchParams.get('oauth_state');
  assert.equal(JSON.parse(h.storage.get('oauth_pending')).state, state);
  assert.match(redirect, /^https:\/\/app.example.test\/auth\/login/);
  assert.equal(h.requests.length, 0);
});
test('a callback without a locally initiated sign-in is rejected', async () => {
  const h = harness();
  await assert.rejects(h.api.finishGoogleCallback('aurainfra://auth/login#session_id=attacker-session'));
  assert.equal(h.requests.length, 0);
});
test('a mismatched OAuth state never reaches the token exchange', async () => {
  const h = harness(); pending(h);
  await assert.rejects(h.api.finishGoogleCallback('aurainfra://auth/login?oauth_state=attacker-state#session_id=attacker-session'));
  assert.equal(h.requests.length, 0);
});
test('an expired callback is rejected without sending provider credentials', async () => {
  const h = harness(); pending(h, { createdAt: Date.now() - 360000 });
  await assert.rejects(h.api.finishGoogleCallback('aurainfra://auth/login?oauth_state=expected-state#session_id=old-session'));
  assert.equal(h.requests.length, 0);
});
test('valid fragment callbacks are exchanged once', async () => {
  const h = harness(); pending(h);
  const url = 'aurainfra://auth/login?oauth_state=expected-state#session_id=verified-session';
  const result = await h.api.finishGoogleCallback(url);
  assert.equal(result.auth.user_id, 'user-a');
  await assert.rejects(h.api.finishGoogleCallback(url));
  assert.equal(h.requests.length, 1);
});
test('deletion reauthentication rejects a different Google identity', async () => {
  const h = harness('android', 'other-account');
  await assert.rejects(h.api.signInGoogle('original-account'), /same account/);
  assert.equal(h.storage.has('token'), false);
});
test('cancelling a native provider flow removes its pending state', async () => {
  const h = harness(); h.cancel();
  assert.equal(await h.api.signInGoogle(), null);
  assert.equal(h.storage.has('oauth_pending'), false);
  assert.equal(h.requests.length, 0);
});
test('Apple login submits the server challenge, signed identity, and authorization code', async () => {
  const h = harness('ios');
  await h.api.signInApple();
  assert.equal(h.requests[1].data.nonce, 'server-nonce');
  assert.equal(h.requests[1].data.identity_token, 'signed-apple-token');
  assert.equal(h.requests[1].data.authorization_code, 'one-time-code');
});
test('deletion reauthentication rejects a different Apple identity', async () => {
  const h = harness('ios', 'other-account');
  await assert.rejects(h.api.signInApple('original-account'), /same account/);
});
test('cold-start query callbacks validate the stored request and exchange an app token', async () => {
  const h = harness(); pending(h);
  const { auth } = await h.api.finishGoogleCallback('aurainfra://auth/login?oauth_state=expected-state&session_id=cold-start-session');
  assert.equal(auth.access_token, 'app-jwt');
  assert.equal(h.requests[0].options.headers['X-Session-ID'], 'cold-start-session');
  assert.equal(h.storage.has('oauth_pending'), false);
});
test('a completed or cancelled native flow releases callback ownership', async () => {
  const h = harness();
  assert.equal(h.api.isNativeGoogleAuthActive(), false);
  await h.api.signInGoogle(); assert.equal(h.api.isNativeGoogleAuthActive(), false);
  h.cancel(); await h.api.signInGoogle(); assert.equal(h.api.isNativeGoogleAuthActive(), false);
});
