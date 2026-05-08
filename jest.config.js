/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  // Sadece saf logic dosyalarını test ediyoruz; React Native runtime gerektiren
  // testler için Jest preset'i ileride genişletilebilir (jest-expo gibi).
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/android/', '/ios/'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        // Test ortamı için izolasyon — Expo'nun strict ayarlarını runtime'a sokmadan
        target: 'es2020',
        module: 'commonjs',
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        isolatedModules: true,
      },
    }],
  },
}
