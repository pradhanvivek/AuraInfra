// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      // Treat mutations of React state, props, and hook values as correctness errors.
      'react-hooks/immutability': 'error',
      // Loading state in effect-triggered async fetches is intentional here.
      // Keep the React Compiler performance guidance visible without treating
      // it as a release-blocking correctness failure.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
