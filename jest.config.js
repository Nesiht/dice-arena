module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts?(x)'],
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  collectCoverageFrom: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}', '!**/*.d.ts'],
};
