export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['./tests/setupEnv.cjs'],
  verbose: true,
  testTimeout: 20000
};
