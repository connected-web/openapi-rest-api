import { describe, it, beforeAll } from 'vitest'

import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { ExampleAPIStack } from '../ExampleAPI'

import fs from 'fs'

const getTemplate = (): Template => {
  const app = new cdk.App()
  const stack = new ExampleAPIStack(app, 'MyTestStack', {
    env: {
      account: '1234567890',
      region: 'eu-west-2'
    }
  },
  {
    hostedZoneDomain: 'dummy.domain.name',
    serviceDataBucketName: 'test-stack-stub-bucket-name',
    identity: {
      Verifiers: []
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
      Description: 'Example API - https://github.com/connected-web/openapi-rest-api',
      Name: 'Example API'
    })
  })

  it('Creates a AWS ApiGateway Method with the operationId - getStatus', () => {
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      OperationName: 'getStatus'
    })
  })
})
