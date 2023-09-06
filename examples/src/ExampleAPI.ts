import * as cdk from 'aws-cdk-lib'

import { OpenAPIRestAPI, OpenAPIVerifiers, OpenAPIBasicModels } from '@connected-web/openapi-rest-api'

import { ExampleResources } from './Resources'
import { StatusEndpoint } from './endpoints/StatusEndpoint'
import { Construct } from 'constructs'

export interface IdentityConfig {
  verifiers: OpenAPIVerifiers
}

export interface StackParameters { hostedZoneDomain: string, serviceDataBucketName: string, identity: IdentityConfig }

export class ExampleAPIStack extends cdk.Stack {
  constructor (scope: Construct, id: string, props: cdk.StackProps, config: StackParameters) {
    super(scope, id, props)

    // Create shared resources
    const sharedResources = new ExampleResources(scope, this)

    // Create API Gateway
    const apiGateway = new OpenAPIRestAPI<ExampleResources>(this, 'Example API', {
      Description: 'Example API - https://github.com/connected-web/openapi-rest-api',
      SubDomain: 'example-api',
      HostedZoneDomain: config.hostedZoneDomain,
      Verifiers: config?.identity.verifiers ?? []
    }, sharedResources)

    // Kick of dependency injection for shared models and model factory
    OpenAPIBasicModels.setup(this, apiGateway.restApi)

    // Add endpoints to API
    apiGateway
      .addEndpoints([
        new StatusEndpoint()
      ])
      .report()
  }
}
