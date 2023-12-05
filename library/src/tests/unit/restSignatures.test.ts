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
  get operationId (): string { return 'stub' }
  get routeEntryPoint (): string { return path.join(__dirname, 'stub/handler.ts') }
  get methodResponses (): any[] { return [] }
}

class StubGetEndpoint extends StubEndpoint {
  get operationId (): string { return 'getStub' }
}

class StubPatchEndpoint extends StubEndpoint {
  get operationId (): string { return 'patchStub' }
}

class StubPutEndpoint extends StubEndpoint {
  get operationId (): string { return 'putStub' }
}

class StubPostEndpoint extends StubEndpoint {
  get operationId (): string { return 'postStub' }
}

class StubDeleteEndpoint extends StubEndpoint {
  get operationId (): string { return 'deleteStub' }
}

class StubEndpointWithRestSignature extends StubEndpoint {
  get operationId (): string { return 'listStubs' }
  get restSignature (): string { return 'GET /test/list' }
}

describe('Rest Signatures', () => {
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

  it('should process GET paths', () => {
    const endpoint = new StubGetEndpoint()
    expect(() => api.addEndpoints({ 'GET /test': endpoint })).not.toThrow()
  })

  it('should process PATCH paths', () => {
    const endpoint = new StubPatchEndpoint()
    expect(() => api.addEndpoints({ 'PATCH /test': endpoint })).not.toThrow()
  })

  it('should process PUT paths', () => {
    const endpoint = new StubPutEndpoint()
    expect(() => api.addEndpoints({ 'PUT /test': endpoint })).not.toThrow()
  })

  it('should process POST paths', () => {
    const endpoint = new StubPostEndpoint()
    expect(() => api.addEndpoints({ 'POST /test': endpoint })).not.toThrow()
  })

  it('should process DELETE paths', () => {
    const endpoint = new StubDeleteEndpoint()
    expect(() => api.addEndpoints({ 'DELETE /test': endpoint })).not.toThrow()
  })

  it('should throw an error for unsupported HTTP methods', () => {
    const endpoint = new StubEndpoint()
    expect(() => api.addEndpoints({ 'TEAPOT /test': endpoint })).toThrowError('Unsupported HTTP method: TEAPOT; supported keys are: GET, PATCH, POST, PUT, DELETE')
  })

  it('should throw an error when an invalid path signature is supplied', () => {
    const endpoint = new StubEndpoint()
    expect(() => api.addEndpoints({ 'not-a-valid-signature': endpoint })).toThrowError('Invalid path from rest signature: undefined, expected a path in the form METHOD /path, e.g. GET /status')
  })

  it('should throw an error when no rest signature is provided', () => {
    const endpoint = new StubEndpoint()
    expect(() => api.addEndpoints([endpoint])).toThrowError('Unable to create endpoint; neither a restSignature nor pathOverride were supplied - all routes must declare a path in the form METHOD /path, e.g. GET /status')
  })

  it('should throw an error when different rest signature is provided', () => {
    const endpoint = new StubEndpointWithRestSignature()
    expect(() => api.addEndpoints({ 'GET /different/stub': endpoint })).toThrowError('Unable to create endpoint; both a restSignature and pathOverride were supplied, but they do not match: GET /test/list !== GET /different/stub')
  })

  it('should process paths when the path override duplicates base metadata exactly', () => {
    const endpoint = new StubEndpointWithRestSignature()
    expect(() => api.addEndpoints({ 'GET /test/list': endpoint })).not.toThrow()
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
      '| GET | /test | getStub |',
      '| PATCH | /test | patchStub |',
      '| PUT | /test | putStub |',
      '| POST | /test | postStub |',
      '| DELETE | /test | deleteStub |',
      '| GET | /test/list | listStubs |',
      ''
    ]
    expect(actual.split('\n')).toEqual(expected)
  })
})
