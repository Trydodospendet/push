// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Project rule (CLAUDE.md, section 4): no `any`.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    ignores: ['dist/*', '.expo/*', 'supabase/*'],
  },
]);
