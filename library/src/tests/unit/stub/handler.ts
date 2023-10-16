import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { OpenAPIEnums, OpenAPIHelpers } from '../../../PackageIndex'

export async function handler (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const statusInfo = process.env.STATUS_INFO ?? JSON.stringify({ message: 'No STATUS_INFO found on env' })
  return OpenAPIHelpers.lambdaResponse(OpenAPIEnums.httpStatusCodes.success, statusInfo)
}
