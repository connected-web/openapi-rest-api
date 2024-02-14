import { describe, it, beforeAll } from '@jest/globals'

import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { HarnessAPIStack } from './harness/HarnessAPI'

import fs from 'node:fs'

const getTemplate = (): Template => {
  const app = new cdk.App()
  const stack = new HarnessAPIStack(app, 'MyTestStack', {
    env: {
      account: '1234567890',
      region: 'eu-west-2'
    }
  },
  {
    hostedZoneDomain: 'dummy.domain.name',
    serviceDataBucketName: 'test-stack-stub-bucket-name',
    identity: {
      verifiers: []
    }
  })
  const template = Template.fromStack(stack)
  fs.writeFileSync('src/tests/template.json', JSON.stringify(template, null, 2))
  return template
}

describe('REST API using Harness as Test Bed', () => {
  let template: Template

  beforeAll(() => {
    template = getTemplate()
  })

  it('Creates an AWS ApiGateway RestApi with the correct title and description', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Description: 'Harness API - https://github.com/connected-web/openapi-rest-api',
      Name: 'Harness API'
    })
  })

  it('Creates a AWS ApiGateway Method with the operationId - getStatus', () => {
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      OperationName: 'getStatus'
    })
  })

  it('Creates a AWS ApiGateway with the v1 stage as default', () => {
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      StageName: 'v1'
    })
  })

  it('Creates a AWS ApiGateway with default CORS options applied', () => {
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      Integration: {
        IntegrationResponses: [
          {
            ResponseParameters: {
              'method.response.header.Access-Control-Allow-Headers': "'Authorization,content-type'",
              'method.response.header.Access-Control-Allow-Origin': "'*'",
              'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE,PATCH,HEAD'",
              'method.response.header.Access-Control-Allow-Credentials': "'true'"
            },
            StatusCode: '204'
          }
        ]
      }
    })
  })
})
