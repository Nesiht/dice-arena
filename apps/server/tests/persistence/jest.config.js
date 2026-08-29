module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/persistence/**/*.test.ts'],
  transform: { '^.+\\.ts$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30000,
};
