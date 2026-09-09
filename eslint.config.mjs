import js from '@eslint/js';
import globals from 'globals';
import stylistic from '@stylistic/eslint-plugin';

export default [
  {ignores: ['node_modules/**', 'dist/**', '.cache/**', '.yarn/**']},
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {ecmaVersion: 'latest', globals: globals.node},
    plugins: {'@stylistic': stylistic},
    rules: {
      '@stylistic/indent': ['error', 2, {SwitchCase: 1}],
      '@stylistic/quotes': ['error', 'single', {avoidEscape: true}],
      '@stylistic/semi': ['error', 'always'],
      'no-unused-vars': ['error', {argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_'}]
    }
  },
  {files: ['src/**/*.js'], languageOptions: {globals: {...Object.fromEntries(Object.keys(globals.node).map(key => [key, 'off'])), ...globals.browser}}},
  {files: ['tests/browser/**/*.mjs'], languageOptions: {globals: globals.browser}}
];
