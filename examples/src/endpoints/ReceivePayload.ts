import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult
} from 'aws-lambda/trigger/api-gateway-proxy'

import { Construct } from 'constructs'
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import { MethodResponse, IModel } from 'aws-cdk-lib/aws-apigateway'

import { OpenAPIRouteMetadata, OpenAPIHelpers, OpenAPIEnums } from '@connected-web/openapi-rest-api'
import { ExampleResources } from '../Resources'
import { ApiResponse, ApiResponseType } from '../models/ApiResponse'
import { ApiPayload, ApiPayloadType } from '../models/ApiPayload'

import S3 from 'aws-sdk/clients/s3'

const s3Client = new S3({
  region: process.env.AWS_REGION,
  maxRetries: 3
})

/* This handler is executed by AWS Lambda when the endpoint is invoked */
export async function handler (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParam = event.pathParameters?.pathParam ?? 'default'
  const colorParam = event.queryStringParameters?.color ?? 'white'

  let payload: ApiPayloadType
  try {
    payload = JSON.parse(event.body ?? '{}') as ApiPayloadType
    console.log('Received payload:', payload)
  } catch (ex) {
    const error = ex as Error
    const errorResponse: ApiResponseType = {
      statusCode: OpenAPIEnums.httpStatusCodes.clientError,
      message: `Unable to parse payload: ${error.message}`,
      type: 'error'
    }
    return OpenAPIHelpers.lambdaResponse(errorResponse.statusCode, JSON.stringify(errorResponse))
  }

  try {
    const payloadBody = JSON.stringify(payload)
    await s3Client.putObject({
      Bucket: process.env.SERVICE_DATA_BUCKET_NAME ?? '',
      Key: `${colorParam}/${pathParam}.json`,
      Body: payloadBody,
      ContentType: 'application/json'
    }).promise()
    console.log('S3 putObject result:', { pathParam, payloadBody: `${payloadBody.length} bytes` })
  } catch (ex) {
    const error = ex as Error
    const errorResponse: ApiResponseType = {
      statusCode: OpenAPIEnums.httpStatusCodes.serverError,
      message: `Unable to receive payload for (${pathParam}): ${error.message}`,
      type: 'error'
    }
    return OpenAPIHelpers.lambdaResponse(errorResponse.statusCode, JSON.stringify(errorResponse))
  }

  const apiResponse: ApiResponseType = {
    statusCode: OpenAPIEnums.httpStatusCodes.success,
    message: 'Received payload',
    type: 'success'
  }
  return OpenAPIHelpers.lambdaResponse(apiResponse.statusCode, JSON.stringify(apiResponse))
}

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
    return __filename
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
