import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult
} from 'aws-lambda/trigger/api-gateway-proxy'

import { Construct } from 'constructs'
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import { MethodResponse, IModel } from 'aws-cdk-lib/aws-apigateway'

import { Resources } from '../Resources'

import { httpStatusCodes, lambdaResponse } from '../../../library/src/openapi/Response'
import { OpenAPIRouteMetadata } from '../../../library/src/openapi/Routes'
import StatusResponse from '../models/StatusResponse'

/* This handler is executed by AWS Lambda when the endpoint is invoked */
export async function handler (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const statusInfo = process.env.STATUS_INFO ?? JSON.stringify({ message: 'No STATUS_INFO found on env' })
  return lambdaResponse(httpStatusCodes.success, statusInfo)
}

/* This section is for route metadata used by CDK to create the stack that will host your endpoint */
export class StatusEndpoint extends OpenAPIRouteMetadata<Resources> {

  grantPermissions (scope: Construct, endpoint: NodejsFunction, resources: Resources): void {
    const serviceBucket = resources.serviceBucket
    serviceBucket.grantRead(endpoint)
  }

  get operationId(): string {
    return 'getStatus'
  }

  get restSignature(): string {
    return 'GET /status'
  }

  get routeEntryPoint(): string {
    return __filename
  }

  get lambdaConfig(): NodejsFunctionProps {
    return {
      environment: {
        STATUS_INFO: JSON.stringify({
          deploymentTime: process.env.USE_MOCK_TIME ?? new Date()
        })
      }
    }
  }

  get methodResponses(): MethodResponse[] {
    return [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Content-Type': true,
        'method.response.header.Access-Control-Allow-Origin': true,
        'method.response.header.Access-Control-Allow-Credentials': true
      },
      responseModels: {
        'application/json': StatusResponse.model
      }
    }]
  }

  get methodRequestModels(): { [param: string]: IModel } | undefined {
    return
  }

  get requestParameters(): { [param: string]: boolean } | undefined {
    return
  }
}
