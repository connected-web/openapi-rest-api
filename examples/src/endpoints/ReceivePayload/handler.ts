import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult
} from 'aws-lambda/trigger/api-gateway-proxy'

import { ApiResponseType } from '../../models/ApiResponseTypes'
import { ApiPayloadType } from '../../models/ApiPayloadTypes'

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { httpStatusCodes, lambdaResponse } from '../../helpers/Response'

const region = process.env.AWS_REGION ?? ''
const isValidRegion = (value: string): boolean => {
  // Basic allowlist pattern for AWS regions (e.g., us-east-1, eu-west-2).
  return /^[a-z]{2,3}-[a-z0-9-]+-\d+$/.test(value)
}

if (!isValidRegion(region)) {
  throw new Error(`Invalid AWS region: "${String(region)}"`)
}

const s3Client = new S3Client({
  region,
  maxAttempts: 3
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
      statusCode: httpStatusCodes.clientError,
      message: `Unable to parse payload: ${error.message}`,
      type: 'error'
    }
    return lambdaResponse(errorResponse.statusCode, JSON.stringify(errorResponse))
  }

  try {
    const payloadBody = JSON.stringify(payload)
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.SERVICE_DATA_BUCKET_NAME ?? '',
      Key: `${colorParam}/${pathParam}.json`,
      Body: payloadBody,
      ContentType: 'application/json'
    }))
    console.log('S3 putObject result:', { pathParam, payloadBody: `${payloadBody.length} bytes` })
  } catch (ex) {
    const error = ex as Error
    const errorResponse: ApiResponseType = {
      statusCode: httpStatusCodes.serverError,
      message: `Unable to receive payload for (${pathParam}): ${error.message}`,
      type: 'error'
    }
    return lambdaResponse(errorResponse.statusCode, JSON.stringify(errorResponse))
  }

  const apiResponse: ApiResponseType = {
    statusCode: httpStatusCodes.success,
    message: 'Received payload',
    type: 'success'
  }
  return lambdaResponse(apiResponse.statusCode, JSON.stringify(apiResponse))
}
