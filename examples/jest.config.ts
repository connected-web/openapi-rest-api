import type { Config } from 'jest'

const config: Config = {
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx)?$': 'ts-jest'
  },
  moduleNameMapper: {
    '^@connected-web/openapi-rest-api$': '<rootDir>../library/src/PackageIndex.ts'
  }
}

export default config
