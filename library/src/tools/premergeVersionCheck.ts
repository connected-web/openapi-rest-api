import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'

type ReleasePayload = {
  tag_name?: string
}

const readJson = <T>(filePath: string): T => {
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

const parseVersionParts = (version: string): number[] => {
  return version
    .replace(/^v/, '')
    .split('.')
    .map((part) => Number(part))
}

const compareVersions = (a: number[], b: number[]): number => {
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    if (av > bv) return 1
    if (av < bv) return -1
  }
  return 0
}

const getLatestReleaseTag = async (repo: string, token: string): Promise<string> => {
  return await new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: 'api.github.com',
        path: `/repos/${repo}/releases/latest`,
        headers: {
          'User-Agent': 'version-check',
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github+json'
        }
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += String(chunk)
        })
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`GitHub API error: ${res.statusCode ?? 'unknown'} ${data}`))
            return
          }
          const payload = JSON.parse(data) as ReleasePayload
          const tag = String(payload.tag_name ?? '').trim()
          if (!tag) {
            reject(new Error('Latest release tag not found'))
            return
          }
          resolve(tag.replace(/^v/, ''))
        })
      }
    )

    request.on('error', (err) => {
      reject(err)
    })
    request.end()
  })
}

const main = async (): Promise<void> => {
  const repo = process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_TOKEN
  if (!repo) throw new Error('GITHUB_REPOSITORY not set')
  if (!token) throw new Error('GITHUB_TOKEN not set')

  const repoRoot = path.resolve(__dirname, '../../../..')
  const rootPkg = readJson<{ version?: string }>(path.join(repoRoot, 'package.json'))
  const current = String(rootPkg.version ?? '').trim()
  if (!current) throw new Error('package.json version is missing')

  const latest = await getLatestReleaseTag(repo, token)
  const result = compareVersions(parseVersionParts(current), parseVersionParts(latest))
  if (result <= 0) {
    throw new Error(`package.json version (${current}) must be greater than latest release (${latest})`)
  }
  console.log(`OK: package.json version (${current}) is greater than latest release (${latest})`)
}

void main()
