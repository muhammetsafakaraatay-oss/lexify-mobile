module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
        jsx: 'react-native',
      },
    },
  },
  transformIgnorePatterns: [
    'node_modules/(?!(expo|@expo|react-native|@react-native)/)',
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
}
