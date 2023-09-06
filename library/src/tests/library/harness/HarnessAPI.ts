import * as cdk from 'aws-cdk-lib'

import { Construct } from 'constructs'
import { OpenAPIRestAPI, OpenAPIVerifiers, OpenAPIBasicModels } from '../../../PackageIndex'

import { HarnessResources } from './Resources'
import { HarnessEndpoint } from './endpoints/HarnessEndpoint'

export interface IdentityConfig {
  verifiers: OpenAPIVerifiers
}

export interface StackParameters { hostedZoneDomain: string, serviceDataBucketName: string, identity: IdentityConfig }

export class HarnessAPIStack extends cdk.Stack {
  constructor (scope: Construct, id: string, props: cdk.StackProps, config: StackParameters) {
    super(scope, id, props)

    // Create shared resources
    const sharedResources = new HarnessResources(scope, this)

    // Create API Gateway
    const apiGateway = new OpenAPIRestAPI<HarnessResources>(this, 'Harness API', {
      Description: 'Harness API - https://github.com/connected-web/openapi-rest-api',
      SubDomain: 'harness-api',
      HostedZoneDomain: config.hostedZoneDomain,
      Verifiers: config?.identity.verifiers ?? []
    }, sharedResources)

    // Kick of dependency injection for shared models and model factory
    OpenAPIBasicModels.setup(this, apiGateway.restApi)

    // Add endpoints to API
    apiGateway
      .addEndpoints([
        new HarnessEndpoint()
      ])
      .report()
  }
}
