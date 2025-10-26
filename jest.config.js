module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/main.ts',
    '!src/main.local.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.entity.ts',
    '!src/**/*.interface.ts',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/', '<rootDir>/test/'],
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)'
  ],
  moduleNameMapper: {
    '^uuid$': '<rootDir>/node_modules/uuid/dist/index.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/common/(.*)$': '<rootDir>/src/common/$1',
    '^@/modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@/config/(.*)$': '<rootDir>/src/config/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testTimeout: 30000,
};
