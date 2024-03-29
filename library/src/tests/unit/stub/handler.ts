import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

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

export async function handler (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const statusInfo = process.env.STATUS_INFO ?? JSON.stringify({ message: 'No STATUS_INFO found on env' })
  return lambdaResponse(200, statusInfo)
}
