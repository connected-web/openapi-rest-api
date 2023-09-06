export default {
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)?$': 'ts-jest'
  },
  moduleNameMapper: {
    '^@connected-web/openapi-rest-api$': '<rootDir>../library/src/PackageIndex.ts'
  }
}
