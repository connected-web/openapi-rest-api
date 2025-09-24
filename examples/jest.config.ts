import type { Config } from 'jest'

const config: Config = {
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', {
      jsc: {
        target: 'es2022'
      }
    }]
  },
  moduleNameMapper: {
    '^@connected-web/openapi-rest-api$': '<rootDir>../library/src/PackageIndex.ts'
  }
}

export default config
