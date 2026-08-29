const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      '.expo-shared/**',
      'dist/**',
      'coverage/**',
      'android/**',
      'ios/**',
      'web-build/**',
      '.git/**',
    ],
  },
  expoConfig,
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tseslint,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: (filePath) => {
          if (filePath.startsWith('apps/')) {
            return './apps/mobile/tsconfig.json';
          }
          if (filePath.startsWith('packages/')) {
            return './packages/game-domain/tsconfig.json';
          }
          return './tsconfig.json';
        },
        tsconfigRootDir: process.cwd(),
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'import/order': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
]);
