import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'packages/*/dist/**',
      'coverage/**',
      'client/public/**',
      '*.tgz',
      'package-lock.json',
      'pnpm-lock.yaml',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs', 'packages/**/*.ts', 'tests/**/*.ts', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['client/**/*.ts', 'client/**/*.tsx'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['packages/cli/src/**/*.ts', 'packages/core/src/**/*.ts'],
    rules: { 'no-control-regex': 'off' },
  },
  {
    files: ['client/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
