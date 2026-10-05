const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function config(url, profile = 'production', authUrl) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../app.config.js'), 'utf8'), {
    module, URL, process: { env: { EAS_BUILD_PROFILE: profile, EXPO_PUBLIC_BACKEND_URL: url, EXPO_PUBLIC_AUTH_URL: authUrl } },
    require: () => require('../app.json'),
  });
  return module.exports();
}
test('store builds reject absent, malformed, insecure and unusable server origins', () => {
  for (const url of [undefined, '', 'https://', 'http://api.aurainfra.ai', 'https://localhost', 'https://127.0.0.1', 'https://api.example.test', 'https://api.aurainfra.ai/api', 'https://user:secret@api.aurainfra.ai', 'https://api.aurainfra.ai?token=secret', 'https://api.aurainfra.ai#fragment']) {
    assert.throws(() => config(url), /public HTTPS server origin/);
  }
  assert.equal(config('https://api.aurainfra.ai').extra.apiUrl, 'https://api.aurainfra.ai');
  assert.doesNotThrow(() => config('http://localhost:8000', 'development'));
});
test('store profile keeps AAB, incrementing versions and restricted photo/audio permissions', () => {
  const eas = require('../eas.json');
  const app = require('../app.json').expo;
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
  assert.equal(eas.build.production.autoIncrement, true);
  assert.equal(eas.cli.appVersionSource, 'remote');
  assert.equal(app.ios.usesAppleSignIn, true);
  for (const permission of ['READ_MEDIA_IMAGES', 'READ_EXTERNAL_STORAGE', 'RECORD_AUDIO']) {
    assert.ok(app.android.blockedPermissions.includes(`android.permission.${permission}`));
  }
});
test('production Babel removes diagnostic calls before Hermes while development retains them', () => {
  const babel = require('@babel/core'); const path = require('node:path');
  const source = 'console.log("private-diagnostic-marker", token); console.error(error); export const value = 1;';
  const options = { configFile: path.resolve(__dirname, '../babel.config.js'), filename: path.resolve(__dirname, 'diagnostic-fixture.js') };
  const production = babel.transformSync(source, { ...options, envName: 'production' }).code;
  const development = babel.transformSync(source, { ...options, envName: 'development' }).code;
  assert.doesNotMatch(production, /private-diagnostic-marker|console\.error/);
  assert.match(development, /private-diagnostic-marker/);
});

test('release repository ignores generated caches and credential files', () => {
  const rootIgnore = fs.readFileSync(require.resolve('../../.gitignore'), 'utf8');
  const frontendIgnore = fs.readFileSync(require.resolve('../.gitignore'), 'utf8');
  assert.match(frontendIgnore, /^\.metro-cache\/$/m);
  assert.match(rootIgnore, /^\.env$/m);
  assert.match(rootIgnore, /^\.env\.\*$/m);
  assert.match(rootIgnore, /^credentials\.json$/m);
  assert.match(rootIgnore, /^\*\.key$/m);
});

test('store builds reject unsafe OAuth provider overrides', () => {
  for (const authUrl of ['http://auth.aurainfra.ai', 'https://localhost', 'https://auth.example.test', 'https://auth.aurainfra.ai/path', 'https://user:secret@auth.aurainfra.ai']) {
    assert.throws(() => config('https://api.aurainfra.ai', 'production', authUrl), /EXPO_PUBLIC_AUTH_URL/);
  }
  assert.doesNotThrow(() => config('https://api.aurainfra.ai', 'production', 'https://auth.emergentagent.com'));
});

test('store identifiers and reviewer-facing policy pages stay release-ready', () => {
  const app = require('../app.json').expo;
  assert.equal(app.ios.bundleIdentifier, 'com.aurainfra.ai');
  assert.equal(app.android.package, 'com.aurainfra.ai');
  assert.equal(app.scheme, 'aurainfra');
  assert.equal(app.owner, 'pradhan.vivek');
  assert.equal(app.extra?.eas?.projectId, 'dca69d50-2def-48d0-8e38-c50d1db0b456');
  for (const file of ['privacy-policy.html', 'account-deletion.html', 'community-standards.html']) {
    assert.ok(fs.existsSync(require.resolve(`../../website/public/${file}`)), `${file} must ship with the website`);
  }
});
