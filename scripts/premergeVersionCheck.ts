import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import semver from 'semver'

type ReleasePayload = {
  tag_name?: string
}

type PullRequestFilePayload = {
  filename?: string
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

const githubGet = async <T>(pathName: string, token: string): Promise<T> => {
  return await new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: 'api.github.com',
        path: pathName,
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
          if ((res.statusCode ?? 500) >= 300) {
            reject(new Error(`GitHub API error: ${res.statusCode ?? 'unknown'} ${data}`))
            return
          }

          try {
            resolve(JSON.parse(data) as T)
          } catch (error) {
            reject(error)
          }
        })
      }
    )

    request.on('error', (err) => {
      reject(err)
    })
    request.end()
  })
}

const getLatestReleaseTag = async (repo: string, token: string): Promise<string> => {
  const payload = await githubGet<ReleasePayload>(`/repos/${repo}/releases/latest`, token)
  const tag = String(payload.tag_name ?? '').trim()
  if (!tag) {
    throw new Error('Latest release tag not found')
  }
  return tag.replace(/^v/, '')
}

const getPullRequestNumber = (): number | undefined => {
  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!eventPath || !fs.existsSync(eventPath)) {
    return undefined
  }

  const eventPayload = readJson<{ pull_request?: { number?: number } }>(eventPath)
  const prNumber = eventPayload.pull_request?.number
  return typeof prNumber === 'number' ? prNumber : undefined
}

const getPullRequestFiles = async (repo: string, prNumber: number, token: string): Promise<string[]> => {
  const files: string[] = []
  let page = 1

  while (true) {
    const payload = await githubGet<PullRequestFilePayload[]>(`/repos/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`, token)
    if (!Array.isArray(payload) || payload.length === 0) {
      break
    }

    for (const file of payload) {
      const filename = String(file.filename ?? '').trim()
      if (filename) {
        files.push(filename)
      }
    }

    if (payload.length < 100) {
      break
    }
    page += 1
  }

  return files
}

const requiresVersionBump = (changedFiles: string[]): boolean => {
  return changedFiles.some((file) => file === 'package.json' || file === 'package-lock.json' || file.startsWith('library/'))
}

const main = async (): Promise<void> => {
  const repo = process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_TOKEN
  if (!repo) throw new Error('GITHUB_REPOSITORY not set')
  if (!token) throw new Error('GITHUB_TOKEN not set')

  const prNumber = getPullRequestNumber()
  if (prNumber) {
    const changedFiles = await getPullRequestFiles(repo, prNumber, token)
    if (!requiresVersionBump(changedFiles)) {
      console.log(`OK: skipping version bump check for PR #${prNumber}; no publishable package files changed`)
      return
    }
  }

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
