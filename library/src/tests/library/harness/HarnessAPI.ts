import * as cdk from 'aws-cdk-lib'
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'

import { Construct } from 'constructs'
import { OpenAPIRestAPI, OpenAPIVerifiers, OpenAPIBasicModels, OpenAPIFunction } from '../../../PackageIndex'

import { HarnessResources } from './Resources'
import { HarnessEndpoint } from './endpoints/HarnessEndpoint/metadata'

export interface IdentityConfig {
  Verifiers: OpenAPIVerifiers
}

export interface StackParameters {
  hostedZoneDomain: string
  serviceDataBucketName: string
  identity: IdentityConfig
  stageName: string
  additionalCorsHeaders: string[]
  customLambdaProps?: NodejsFunctionProps
}

export class HarnessAPIStack extends cdk.Stack {
  constructor (scope: Construct, id: string, props: cdk.StackProps, config: StackParameters) {
    super(scope, id, props)

    // Configure default Lambda properties
    if (config.customLambdaProps !== undefined) {
      OpenAPIFunction.applyDefaultProps(config.customLambdaProps)
    }

    // Create shared resources
    const sharedResources = new HarnessResources(scope, this)

    // Create API Gateway
    const apiGateway = new OpenAPIRestAPI<HarnessResources>(this, 'Harness API', {
      Description: 'Harness API - https://github.com/connected-web/openapi-rest-api',
      SubDomain: 'harness-api',
      HostedZoneDomain: config.hostedZoneDomain,
      Verifiers: config?.identity.Verifiers ?? [],
      StageName: config.stageName,
      AdditionalCORSHeaders: config.additionalCorsHeaders
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
