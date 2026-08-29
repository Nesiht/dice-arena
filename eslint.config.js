const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');
const path = require('path');

module.exports = defineConfig([
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      '.expo-shared/**',
      'dist/**',
      '**/dist/**',
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
          const normalizedPath = filePath.replaceAll('\\', '/');

          if (normalizedPath.includes('/apps/mobile/')) {
            return path.join(process.cwd(), 'apps/mobile/tsconfig.json');
          }
          if (normalizedPath.includes('/apps/server/')) {
            return path.join(process.cwd(), 'apps/server/tsconfig.json');
          }
          if (normalizedPath.includes('/packages/game-domain/')) {
            return path.join(process.cwd(), 'packages/game-domain/tsconfig.json');
          }
          return path.join(process.cwd(), 'tsconfig.json');
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
