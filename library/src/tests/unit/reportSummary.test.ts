import { describe, it, afterEach } from 'vitest'
import { expect } from 'chai'
import * as cdk from 'aws-cdk-lib'
import sinon from 'sinon'
import fs from 'fs'

import { OpenAPIRestAPI } from '../../PackageIndex'

const ENV_KEYS = [
  'CREATE_CNAME_RECORD',
  'OPENAPI_REST_API_REPORT_SUMMARY',
  'OPENAPI_REST_API_REPORT_OUTPUT_PATH',
  'OPENAPI_REST_API_REPORT_DISABLE_GITHUB_STEP_SUMMARY',
  'GITHUB_STEP_SUMMARY'
] as const

describe('OpenAPI report summary output', () => {
  afterEach(() => {
    sinon.restore()
    for (const key of ENV_KEYS) {
      delete process.env[key]
    }
  })

  it('writes a report document when OPENAPI_REST_API_REPORT_OUTPUT_PATH is set', () => {
    process.env.CREATE_CNAME_RECORD = 'false'
    process.env.OPENAPI_REST_API_REPORT_SUMMARY = 'true'
    process.env.OPENAPI_REST_API_REPORT_OUTPUT_PATH = '/tmp/openapi-summary.md'

    const writeFileSyncStub = sinon.stub(fs, 'writeFileSync')
    const app = new cdk.App()
    const stack = new cdk.Stack(app, 'ReportOutputPathStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    })

    const api = new OpenAPIRestAPI(stack, 'TestApi', {
      Description: 'Summary report test API',
      SubDomain: 'test-api',
      HostedZoneDomain: 'example.com',
      Verifiers: []
    }, {})

    api.report()

    expect(writeFileSyncStub.calledWithMatch('/tmp/openapi-summary.md', sinon.match.string)).to.equal(true)
  })

  it('deduplicates github step summary writes when report is emitted multiple times', () => {
    process.env.CREATE_CNAME_RECORD = 'false'
    process.env.OPENAPI_REST_API_REPORT_SUMMARY = 'true'
    process.env.GITHUB_STEP_SUMMARY = '/tmp/github-step-summary.md'

    let summaryFileContent = ''

    sinon.stub(fs, 'readFileSync').callsFake((path: fs.PathOrFileDescriptor, options?: any) => {
      if (path === '/tmp/github-step-summary.md') {
        return summaryFileContent
      }
      return ''
    })

    const writeFileSyncStub = sinon.stub(fs, 'writeFileSync').callsFake((path: fs.PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView) => {
      if (path === '/tmp/github-step-summary.md') {
        summaryFileContent += data.toString()
      }
    })

    const app = new cdk.App()
    const stack = new cdk.Stack(app, 'ReportSummaryDedupeStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    })

    const api = new OpenAPIRestAPI(stack, 'TestApi', {
      Description: 'Summary report test API',
      SubDomain: 'test-api',
      HostedZoneDomain: 'example.com',
      Verifiers: []
    }, {})

    api.report()
    api.report()

    expect(writeFileSyncStub.calledOnce).to.equal(true)
    expect(summaryFileContent).to.contain('# TestApi')
  })
})
