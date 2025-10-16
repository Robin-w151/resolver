import js from '@eslint/js';
import ts from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['tests/**/*.type-spec.ts'],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  prettier,
];
