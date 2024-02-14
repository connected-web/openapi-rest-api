import { Construct } from 'constructs'
import path from 'path'
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import { MethodResponse, IModel } from 'aws-cdk-lib/aws-apigateway'

import { OpenAPIRouteMetadata } from '@connected-web/openapi-rest-api'
import { ExampleResources } from '../../Resources'
import { ApiResponse } from '../../models/ApiResponse'
import { ApiPayload } from '../../models/ApiPayload'

/* This section is for route metadata used by CDK to create the stack that will host your endpoint */
export class ReceivePayloadEndpoint extends OpenAPIRouteMetadata<ExampleResources> {
  resources: ExampleResources

  constructor (sharedResources: ExampleResources) {
    super()
    this.resources = sharedResources
  }

  grantPermissions (scope: Construct, endpoint: NodejsFunction, resources: ExampleResources): void {
    const serviceBucket = resources.serviceDataBucket
    serviceBucket.grantRead(endpoint)
  }

  get operationId (): string {
    return 'storePayload'
  }

  get restSignature (): string {
    return 'PUT /receive-payload/{pathParam}'
  }

  get routeEntryPoint (): string {
    return path.join(__dirname, 'handler.ts')
  }

  get lambdaConfig (): NodejsFunctionProps {
    return {
      environment: {
        STATUS_INFO: JSON.stringify({
          deploymentTime: process.env.USE_MOCK_TIME ?? new Date()
        }),
        SERVICE_DATA_BUCKET_NAME: this.resources.serviceDataBucket.bucketName
      }
    }
  }

  get methodResponses (): MethodResponse[] {
    return [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Content-Type': true,
        'method.response.header.Access-Control-Allow-Origin': true,
        'method.response.header.Access-Control-Allow-Credentials': true
      },
      responseModels: {
        'application/json': ApiResponse.model
      }
    }]
  }

  get methodRequestModels (): { [param: string]: IModel } | undefined {
    return {
      'application/json': ApiPayload.model
    }
  }

  get requestParameters (): { [param: string]: boolean } | undefined {
    return {
      'method.request.path.pathParam': true,
      'method.request.querystring.color': false
    }
  }
}
