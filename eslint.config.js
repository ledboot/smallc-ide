const {dirname} = require('path');
const {FlatCompat} = require('@eslint/eslintrc');

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

let customConfig = [];
let hasIgnoresFile = false;
try {
  require.resolve('./eslint.ignores.js');
  hasIgnoresFile = true;
} catch {
  // eslint.ignores.js doesn't exist
}

if (hasIgnoresFile) {
  const ignores = require('./eslint.ignores.js');
  customConfig = [{ignores}];
}

module.exports = [
  ...customConfig,
  ...require('gts'),
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {argsIgnorePattern: '^_'}],
      'no-unused-vars': 'off',
      eqeqeq: 'off',
      'no-useless-escape': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
];
