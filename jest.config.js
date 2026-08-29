module.exports = {
  preset: '@react-native/jest-preset',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts?(x)'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
