import { expect } from 'chai'
import { describe, it, beforeAll } from 'vitest'

import path from 'path'
import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { OpenAPIRestAPI, OpenAPIRouteMetadata } from '../../PackageIndex'

class StubResources {
  bucket: any
}

class StubEndpoint extends OpenAPIRouteMetadata<StubResources> {
  grantPermissions (scope: Construct, endpoint: any, resources: StubResources): void {}
  get routeEntryPoint (): string { return path.join(__dirname, 'stub/handler.ts') }
  get methodResponses (): any[] { return [] }
}

describe('Generated Operation IDs', () => {
  let api: OpenAPIRestAPI<StubResources>
  beforeAll(() => {
    process.env.CREATE_CNAME_RECORD = 'true'
    const app = new cdk.App()
    const stack = new cdk.Stack(app, 'MyTestStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    })
    const sharedResources = new StubResources()
    api = new OpenAPIRestAPI<StubResources>(stack, 'stub-app', {
      Description: 'Stub API for testing Rest Signatures',
      SubDomain: 'rest-signatures',
      HostedZoneDomain: 'stub.test',
      Verifiers: []
    }, sharedResources)
  })

  it('should generate IDs for GET paths', () => {
    const endpoint = new StubEndpoint()
    expect(() => api.addEndpoints({ 'GET /test': endpoint })).not.to.throw()
    const mostRecent = api.endpoints[api.endpoints.length - 1]
    expect(mostRecent.value.operationId).to.equal('getTest')
  })

  it('should generate IDs for PUT paths', () => {
    const endpoint = new StubEndpoint()
    expect(() => api.addEndpoints({ 'PUT /test': endpoint })).not.to.throw()
    const mostRecent = api.endpoints[api.endpoints.length - 1]
    expect(mostRecent.value.operationId).to.equal('putTest')
  })

  it('should generate IDs for POST paths', () => {
    const endpoint = new StubEndpoint()
    expect(() => api.addEndpoints({ 'POST /test': endpoint })).not.to.throw()
    const mostRecent = api.endpoints[api.endpoints.length - 1]
    expect(mostRecent.value.operationId).to.equal('postTest')
  })

  it('should generate IDs for DELETE paths', () => {
    const endpoint = new StubEndpoint()
    expect(() => api.addEndpoints({ 'DELETE /test': endpoint })).not.to.throw()
    const mostRecent = api.endpoints[api.endpoints.length - 1]
    expect(mostRecent.value.operationId).to.equal('deleteTest')
  })

  it('should generate IDs for complex paths with parameters', () => {
    const endpoint = new StubEndpoint()
    expect(() => api.addEndpoints({ 'GET /user/{userId}/history/{versionId}': endpoint })).not.to.throw()
    const mostRecent = api.endpoints[api.endpoints.length - 1]
    expect(mostRecent.value.operationId).to.equal('getUserIdHistoryVersionId')
  })

  it('should generate IDs for complex paths with hyphens', () => {
    const endpoint = new StubEndpoint()
    expect(() => api.addEndpoints({ 'PUT /user-elaborate-data/create': endpoint })).not.to.throw()
    const mostRecent = api.endpoints[api.endpoints.length - 1]
    expect(mostRecent.value.operationId).to.equal('putUserElaborateDataCreate')
  })

  it('should generate a report in markdown format', () => {
    const actual = api.generateReportMarkdown()
    const expected = [
      '# stub-app',
      '',
      'Stub API for testing Rest Signatures',
      '',
      'Registered URL: https://rest-signatures.stub.test',
      '',
      '## Endpoints',
      '',
      '| HTTP Method | Path | Operation ID |',
      '| --- | --- | --- |',
      '| GET | /test | getTest |',
      '| PUT | /test | putTest |',
      '| POST | /test | postTest |',
      '| DELETE | /test | deleteTest |',
      '| GET | /user/{userId}/history/{versionId} | getUserIdHistoryVersionId |',
      '| PUT | /user-elaborate-data/create | putUserElaborateDataCreate |',
      ''
    ]
    expect(actual.split('\n')).to.deep.equal(expected)
  })
})
