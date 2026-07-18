import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort';
import globals from 'globals';

export default defineConfig(
  globalIgnores(['**/build/**', '**/dist/**']),
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    plugins: {
      'simple-import-sort': simpleImportSortPlugin,
    },
    rules: {
      'no-console': ['error', { allow: ['error'] }],
      'prefer-const': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['**/*.{test,spec}.{js,mjs,cjs}'],
    extends: [vitest.configs.recommended],
  },
  {
    files: ['*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  eslintConfigPrettier
);
