import { describe, it } from 'vitest'
import { expect } from 'chai'
import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { OpenAPIRestAPI } from '../../PackageIndex'

describe('HostedZoneId prop', () => {
  it('bakes the provided HostedZoneId into the ACM certificate DomainValidationOptions', () => {
    process.env.CREATE_CNAME_RECORD = 'true'
    const app = new cdk.App()
    const stack = new cdk.Stack(app, 'HostedZoneIdStack', {
      env: { account: '123456789012', region: 'eu-west-2' }
    })

    new OpenAPIRestAPI(stack, 'TestApi', {
      Description: 'HostedZoneId test API',
      SubDomain: 'test-api',
      HostedZoneDomain: 'example.com',
      HostedZoneId: 'ZEXAMPLEHOSTEDZONEID',
      Verifiers: []
    }, {})

    const template = Template.fromStack(stack)

    // The ACM certificate must use the supplied zone ID for DNS validation,
    // not a dummy value from a synth-time fromLookup call.
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainValidationOptions: [
        {
          DomainName: 'test-api.example.com',
          HostedZoneId: 'ZEXAMPLEHOSTEDZONEID'
        }
      ]
    })
  })

  it('uses a dummy lookup zone ID when HostedZoneId is omitted (fromLookup fallback)', () => {
    process.env.CREATE_CNAME_RECORD = 'true'
    const app = new cdk.App()
    const stack = new cdk.Stack(app, 'NoHostedZoneIdStack', {
      env: { account: '123456789012', region: 'eu-west-2' }
    })

    new OpenAPIRestAPI(stack, 'TestApi', {
      Description: 'No HostedZoneId test API',
      SubDomain: 'test-api',
      HostedZoneDomain: 'example.com',
      Verifiers: []
    }, {})

    const template = Template.fromStack(stack)

    // fromLookup at synth time with no context produces a dummy zone ID placeholder.
    // This confirms the lookup path is still active when HostedZoneId is omitted.
    const certs = template.findResources('AWS::CertificateManager::Certificate')
    const certValues = Object.values(certs)
    expect(certValues.length).to.equal(1)
    const domainValidationOptions = (certValues[0] as any).Properties?.DomainValidationOptions
    expect(domainValidationOptions).to.be.an('array').with.length(1)
    // The zone ID will be a CDK dummy value (not ZEXAMPLEHOSTEDZONEID) because fromLookup ran
    expect(domainValidationOptions[0].HostedZoneId).not.to.equal('ZEXAMPLEHOSTEDZONEID')
  })
})
