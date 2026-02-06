import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node'
  },
  resolve: {
    alias: {
      '@connected-web/openapi-rest-api': path.resolve(__dirname, '../library/src/PackageIndex.ts')
    }
  }
})
