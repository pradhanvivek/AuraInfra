const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const out = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('utils/moduleFlags.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: out });
const { enabledHome, routeModule, parseModuleFlags } = out;
test('all four flag combinations select a valid home', () => {
  assert.equal(enabledHome({ community: true, assets: true }), '/(tabs)');
  assert.equal(enabledHome({ community: true, assets: false }), '/(tabs)');
  assert.equal(enabledHome({ community: false, assets: true }), '/(tabs)/assets');
  assert.equal(enabledHome({ community: false, assets: false }), null);
});
test('configuration rejects strings, missing flags and null', () => {
  for (const value of [null, {}, { community: 'false', assets: true }, { community: true }]) assert.throws(() => parseModuleFlags(value));
  assert.equal(parseModuleFlags({ community: false, assets: true }).community, false);
});
test('deep links are classified while account and module recovery remain available', () => {
  for (const route of ['visitors', 'complaints', 'sops', 'community-membership', 'hoa-maintenance']) assert.equal(routeModule([route]), 'community');
  for (const route of ['scan-asset', 'properties', 'property-documents', 'property-tools', 'vehicles']) assert.equal(routeModule([route]), 'assets');
  assert.equal(routeModule(['(tabs)']), 'community');
  assert.equal(routeModule(['(tabs)', 'assets']), 'assets');
  for (const segments of [['(tabs)', 'profile'], ['(tabs)', 'notifications'], ['app-modules'], ['auth', 'login']]) assert.equal(routeModule(segments), null);
});
