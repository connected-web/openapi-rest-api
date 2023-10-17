import { expect, describe, it, beforeAll } from '@jest/globals'

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
    expect(() => api.addEndpoints({ 'GET /test': endpoint })).not.toThrow()
    const mostRecent = api.endpoints[api.endpoints.length - 1]
    expect(mostRecent.value.operationId).toEqual('getTest')
  })

  it('should generate IDs for PUT paths', () => {
    const endpoint = new StubEndpoint()
    expect(() => api.addEndpoints({ 'PUT /test': endpoint })).not.toThrow()
    const mostRecent = api.endpoints[api.endpoints.length - 1]
    expect(mostRecent.value.operationId).toEqual('putTest')
  })

  it('should generate IDs for POST paths', () => {
    const endpoint = new StubEndpoint()
    expect(() => api.addEndpoints({ 'POST /test': endpoint })).not.toThrow()
    const mostRecent = api.endpoints[api.endpoints.length - 1]
    expect(mostRecent.value.operationId).toEqual('postTest')
  })

  it('should generate IDs for DELETE paths', () => {
    const endpoint = new StubEndpoint()
    expect(() => api.addEndpoints({ 'DELETE /test': endpoint })).not.toThrow()
    const mostRecent = api.endpoints[api.endpoints.length - 1]
    expect(mostRecent.value.operationId).toEqual('deleteTest')
  })

  it('should generate IDs for complex paths with parameters', () => {
    const endpoint = new StubEndpoint()
    expect(() => api.addEndpoints({ 'GET /user/{userId}/history/{versionId}': endpoint })).not.toThrow()
    const mostRecent = api.endpoints[api.endpoints.length - 1]
    expect(mostRecent.value.operationId).toEqual('getUserIdHistoryVersionId')
  })

  it('should generate IDs for complex paths with hyphens', () => {
    const endpoint = new StubEndpoint()
    expect(() => api.addEndpoints({ 'PUT /user-elaborate-data/create': endpoint })).not.toThrow()
    const mostRecent = api.endpoints[api.endpoints.length - 1]
    expect(mostRecent.value.operationId).toEqual('putUserElaborateDataCreate')
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
    expect(actual.split('\n')).toEqual(expected)
  })
})
