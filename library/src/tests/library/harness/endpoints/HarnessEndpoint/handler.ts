import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult
} from 'aws-lambda/trigger/api-gateway-proxy'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, content-type',
  'Access-Control-Allow-Methods': '*'
}

function lambdaResponse (statusCode: number, body: string = ''): APIGatewayProxyResult {
  return {
    statusCode,
    body,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders
    }
  }
}

/* This handler is executed by AWS Lambda when the endpoint is invoked */
export async function handler (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const statusInfo = process.env.STATUS_INFO ?? JSON.stringify({ message: 'No STATUS_INFO found on env' })
  return lambdaResponse(200, statusInfo)
}
