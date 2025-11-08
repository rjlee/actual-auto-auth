import js from '@eslint/js';
import globals from 'globals';
import prettierPlugin from 'eslint-plugin-prettier';

const baseConfig = js.configs.recommended;
const baseLanguageOptions = baseConfig.languageOptions ?? {};

export default [
  {
    ignores: ['node_modules/', 'coverage/', 'dist/'],
  },
  {
    ...baseConfig,
    files: ['**/*.js'],
    languageOptions: {
      ...baseLanguageOptions,
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...baseLanguageOptions.globals,
        ...globals.node,
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      ...baseConfig.rules,
      'prettier/prettier': 'error',
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ...baseLanguageOptions,
      globals: {
        ...baseLanguageOptions.globals,
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },
];
