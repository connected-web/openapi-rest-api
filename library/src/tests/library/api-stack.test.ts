import { describe, it, beforeAll } from '@jest/globals'

import * as cdk from 'aws-cdk-lib'
import { Duration } from 'aws-cdk-lib'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { Template } from 'aws-cdk-lib/assertions'
import { HarnessAPIStack } from './harness/HarnessAPI'

import fs from 'fs'

function getTemplate (): Template {
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
      Verifiers: []
    },
    stageName: '2024-02-14',
    additionalCorsHeaders: [
      'x-continuation-token'
    ]
  })
  const template = Template.fromStack(stack)
  fs.writeFileSync('src/tests/template.json', JSON.stringify(template, null, 2))
  return template
}

function getTemplateWithCustomHeaderAuthorizerProps (): Template {
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
      Verifiers: [],
      HeaderAuthorizer: {
        requiredHeadersWithAllowedValues: {
          'x-api-key': ['1234567890']
        },
        requiredHeadersRegexValues: {
          'x-request-id': '^[a-f0-9]{32}$'
        },
        disallowedHeaders: ['x-disallowed-header'],
        disallowedHeaderRegexes: ['^x-regex-.*$']
      }
    },
    stageName: '2024-02-14',
    additionalCorsHeaders: [
      'x-continuation-token'
    ]
  })
  const template = Template.fromStack(stack)
  fs.writeFileSync('src/tests/template-with-custom-header-authorizer.json', JSON.stringify(template, null, 2))
  return template
}

function getTemplateWithCustomLambdaProps (): Template {
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
      Verifiers: []
    },
    stageName: '2024-02-14',
    additionalCorsHeaders: [
      'x-continuation-token'
    ],
    customLambdaProps: {
      memorySize: 1024,
      timeout: Duration.seconds(30),
      runtime: Runtime.NODEJS_LATEST,
      handler: 'index.handler',
      bundling: {
        minify: true,
        nodeModules: ['aws-sdk']
      }
    }
  })
  const template = Template.fromStack(stack)
  fs.writeFileSync('src/tests/template-with-custom-props.json', JSON.stringify(template, null, 2))
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
      StageName: '2024-02-14'
    })
  })

  it('Creates a AWS ApiGateway with default CORS options applied', () => {
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      Integration: {
        IntegrationResponses: [
          {
            ResponseParameters: {
              'method.response.header.Access-Control-Allow-Headers': "'Authorization,content-type,x-continuation-token'",
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

  it('Creates NodejsFunction with default props', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      MemorySize: 512,
      Runtime: 'nodejs22.x',
      Timeout: 25
    })
  })
})

describe('REST API using Harness as Test Bed with custom Header Authorizer props', () => {
  let template: Template

  beforeAll(() => {
    template = getTemplateWithCustomHeaderAuthorizerProps()
  })

  it('Creates PrivateHeaderAPIAuthorizer Lambda with expected environment variables', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          REQUIRED_HEADERS_WITH_ALLOWED_VALUES_JSON: '{"x-api-key":["1234567890"]}',
          REQUIRED_HEADERS_REGEX_VALUES_JSON: '{"x-request-id":"^[a-f0-9]{32}$"}',
          DISALLOWED_HEADERS_JSON: '["x-disallowed-header"]',
          DISALLOWED_HEADER_REGEXES_JSON: '["^x-regex-.*$"]'
        }
      }
    })
  })

  it('Creates PrivateHeaderAPIAuthorizer Lambda with default runtime/handler/memory', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Runtime: 'nodejs22.x',
      MemorySize: 768,
      Timeout: 5
    })
  })
})

describe('REST API using Harness as Test Bed with custom Lambda props', () => {
  let template: Template

  beforeAll(() => {
    template = getTemplateWithCustomLambdaProps()
  })

  it('Creates NodejsFunction with customised props', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      MemorySize: 1024,
      Runtime: 'nodejs22.x',
      Timeout: 30
    })
  })
})
