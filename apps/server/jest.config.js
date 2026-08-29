module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  testPathIgnorePatterns: ['/tests/persistence/'],
  moduleFileExtensions: ['ts', 'js', 'json'],
};
