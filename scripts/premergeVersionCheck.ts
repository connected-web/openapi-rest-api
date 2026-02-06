import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import semver from 'semver'

type ReleasePayload = {
  tag_name?: string
}

const readJson = <T>(filePath: string): T => {
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

const cleanVersion = (value: string, label: string): string => {
  const cleaned = semver.clean(value)
  if (!cleaned) {
    throw new Error(`Invalid semver for ${label}: "${value}"`)
  }
  return cleaned
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

  const repoRoot = path.resolve(__dirname, '..')
  const rootPkg = readJson<{ version?: string }>(path.join(repoRoot, 'package.json'))
  const current = String(rootPkg.version ?? '').trim()
  if (!current) throw new Error('package.json version is missing')

  const latest = await getLatestReleaseTag(repo, token)
  const currentVersion = cleanVersion(current, 'package.json')
  const latestVersion = cleanVersion(latest, 'latest release tag')
  if (!semver.gt(currentVersion, latestVersion)) {
    throw new Error(`package.json version (${current}) must be greater than latest release (${latest})`)
  }
  console.log(`OK: package.json version (${current}) is greater than latest release (${latest})`)
}

void main()
