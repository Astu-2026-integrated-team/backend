const tseslint = require('typescript-eslint');
const eslint = require('@eslint/js');

module.exports = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    }
  },
  {
    files: ['tests/**/*.ts', 'tests/**/*.js'],
    rules: {
      'no-console': 'off',
    }
  }
);
