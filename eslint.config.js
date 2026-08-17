// ESLint flat config, ported from Cinema Roll's eslint.config.js.
//
// Replaces the old eslintrc (`eslintConfig` in package.json) which ran
// through @vue/cli-plugin-eslint — that plugin is ESLint-8-only. Lint now
// runs eslint directly (see `lint`/`lint:fix` scripts). The previous
// `@vue/eslint-config-standard` is dropped: it's unmaintained and
// eslintrc-only. The correctness rules worth keeping are re-declared below.

const js = require('@eslint/js');
const vue = require('eslint-plugin-vue');
const promise = require('eslint-plugin-promise');
const globals = require('globals');

module.exports = [
  {
    // Build output, dependency trees, and the generated service worker are
    // not linted.
    ignores: [
      'dist/**',
      'node_modules/**',
      '.history/**',
      'public/**',
      'src/registerServiceWorker.js',
    ],
  },

  js.configs.recommended,
  ...vue.configs['flat/essential'], // flat configs default to Vue 3
  promise.configs['flat/recommended'],

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // --- carried over from the old eslintrc ---
      'vue/no-unused-components': 'off',
      'vue/multi-word-component-names': 'off',
      'no-trailing-spaces': 'warn',
      'eol-last': 'off',
      quotes: ['off', 'double'],
      semi: 'off',
      'comma-dangle': 'off',
      'space-before-function-paren': 'warn',
      indent: ['warn', 2, { SwitchCase: 1 }],
      'no-undef': 'warn',
      'padded-blocks': ['warn', 'never'],
      'object-curly-spacing': ['warn', 'always'],
      'array-bracket-spacing': ['warn', 'never'],
      'no-unused-vars': 'warn',
      'no-empty': 'warn',
      'prefer-const': 'warn',
      'no-multiple-empty-lines': 'warn',
      'no-useless-return': 'off',
      'no-debugger': 'warn',
      'space-infix-ops': 'warn',
      'space-before-blocks': 'warn',
      'no-unreachable': 'warn',
      'no-constant-condition': 'warn',

      // --- high-value correctness rules preserved from `standard` ---
      eqeqeq: ['warn', 'smart'],
      'no-var': 'warn',
      'brace-style': ['warn', '1tbs', { allowSingleLine: true }],
    },
  },

  {
    // Vitest test files: allow the globals exposed by `globals: true` in
    // vitest.config.js.
    files: ['src/test/**/*.{js,mjs,vue}'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        test: 'readonly',
      },
    },
  },
];
