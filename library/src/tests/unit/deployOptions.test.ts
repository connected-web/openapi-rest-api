import { describe, it } from 'vitest'
import { expect } from 'chai'
import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { OpenAPIRestAPI } from '../../PackageIndex'
import { writeNormalizedTemplate } from '../templateOutput'

describe('DeployOptions passthrough', () => {
  it('passes deploy stage variables through to API Gateway stage', () => {
    process.env.CREATE_CNAME_RECORD = 'false'
    const app = new cdk.App()
    const stack = new cdk.Stack(app, 'DeployOptionsStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    })

    new OpenAPIRestAPI(stack, 'TestApi', {
      Description: 'Deploy options test API',
      SubDomain: 'test-api',
      HostedZoneDomain: 'example.com',
      Verifiers: [],
      DeployOptions: {
        variables: {
          foo: 'bar'
        }
      }
    }, {})

    const template = Template.fromStack(stack)
    writeNormalizedTemplate('src/tests/template-with-deploy-options.json', template)

    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      Variables: {
        foo: 'bar'
      }
    })
  })

  it('keeps StageName precedence even if stageName is forced into DeployOptions at runtime', () => {
    process.env.CREATE_CNAME_RECORD = 'false'
    const app = new cdk.App()
    const stack = new cdk.Stack(app, 'DeployOptionsStageNamePrecedenceStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    })

    new OpenAPIRestAPI(stack, 'TestApi', {
      Description: 'Deploy options stage name precedence test API',
      SubDomain: 'test-api',
      HostedZoneDomain: 'example.com',
      Verifiers: [],
      StageName: 'explicit-stage',
      DeployOptions: {
        stageName: 'should-not-win'
      } as any
    }, {})

    const template = Template.fromStack(stack)
    const stages = template.findResources('AWS::ApiGateway::Stage')
    const stage = Object.values(stages)[0] as { Properties?: { StageName?: string } }

    expect(stage.Properties?.StageName).to.equal('explicit-stage')
  })
})
