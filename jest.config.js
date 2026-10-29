export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['./tests/setupEnv.js'],
  verbose: true,
  testTimeout: 20000
};
