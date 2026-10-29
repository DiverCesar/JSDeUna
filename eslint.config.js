import js from '@eslint/js';
import globals from 'globals';
import pluginJest from 'eslint-plugin-jest';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off'
    }
  },
  {
    files: ['tests/**/*.js', 'tests/**/*.test.js'],
    plugins: {
      jest: pluginJest
    },
    languageOptions: {
      globals: {
        ...pluginJest.environments.globals.globals
      }
    },
    rules: {
      ...pluginJest.configs.recommended.rules
    }
  },
  {
    ignores: [
      'node_modules/**',
      '.scannerwork/**',
      'public/**',
      'coverage/**'
    ]
  }
];
