import { expect } from 'chai'
import fs from 'node:fs'
import path from 'node:path'

const readVersion = (filePath: string): string => {
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw).version
}

describe('Version consistency', () => {
  it('keeps workspace package versions aligned', () => {
    const repoRoot = path.resolve(__dirname, '../../../../')
    const rootVersion = readVersion(path.join(repoRoot, 'package.json'))
    const libraryVersion = readVersion(path.join(repoRoot, 'library', 'package.json'))
    const examplesVersion = readVersion(path.join(repoRoot, 'examples', 'package.json'))

    expect(libraryVersion, 'library/package.json version').to.equal(rootVersion)
    expect(examplesVersion, 'examples/package.json version').to.equal(rootVersion)
  })
})
