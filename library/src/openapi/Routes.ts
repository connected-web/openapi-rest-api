
import { Construct } from 'constructs'
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import { MethodResponse, IModel } from 'aws-cdk-lib/aws-apigateway'

/**
 * This is the interface that all routes must implement
 *
 * The route metadata is used by CDK to create the stack
 *
 * Why?
 *   Bringing all the route metadata into one place makes it easier to see the whole API at a glance
 *   Primarily it reduces the number of files you need to edit to add a new route
 *   Which means you can focus on the business logic of the route
 */
export abstract class OpenAPIRouteMetadata<R> {
  /**
   * Grant permissions to the endpoint to access resources
   * @param scope      Construct scope - use to create new resources such as policies
   * @param endpoint   Lambda endpoint - use to grant permissions to the route to access resources
   * @param resources  Resources object - use to access custom shared resources created by CDK
   */
  abstract grantPermissions (scope: Construct, endpoint: NodejsFunction, resources: R): void

  /**
   * The operationId is used to identify the endpoint in the OpenAPI spec
   */
  abstract get operationId (): string

  /**
   * The restSignature is used to create a path in API Gateway to map to your endpoint handler
   *
   * The format should always be '{httpMethod} {path}'
   *
   * Where
   *  - {httpMethod} is one of GET, POST, PUT, DELETE
   *  - {path} is a path that can contain path parameters
   *
   * Examples:
   *   return 'GET /status'
   *   return 'POST /users/{userId}/profile'
   *   return 'PUT  /profile/{profileId}'
   *   return 'DELETE /record/{recordId}'
   */
  public get restSignature (): string | undefined {
    return undefined
  }

  /**
   * The routeEntryPoint is used to configure the NodeJSFunction that will be created by CDK
   * It should be the path to the file that contains the handler function
   *
   * Recommend implementing this using by returning __filename in the extending class
   *
   * @returns string  The path to the file that contains the handler function
   */
  abstract get routeEntryPoint (): string

  /**
   * The lambdaConfig is used to configure the NodeJSFunction that will be created by CDK
   *
   * Example:
   * return {
   *   environment: {
   *     DEPLOYMENT_TIME: (new Date()).toISOString(),
   *     SERVICE_BUCKET_NAME: resources.serviceBucket.bucketName
   *   },
   *   handler: 'customHandlerName',
   *   timeout: cdk.Duration.seconds(30),
  *    memorySize: 512
   * }
   *
   * The lambda config can be an empty if you want to trust the defaults.
   */
  get lambdaConfig (): NodejsFunctionProps {
    return {}
  }

  /**
   * The requestParameters are used to configure the API Gateway method request parameters which will show up in the generated OpenAPI spec.
   *
   * The request parameters that API Gateway accepts.
   * Specify request parameters as key-value pairs (string-to-Boolean mapping), with a source as the key and a Boolean as the value.
   * The Boolean specifies whether a parameter is required.
   * A source must match the format method.request.location.name, where the location is querystring, path, or header, and name is a valid, unique parameter name
   *
   * Example:
   * return {
   *  'method.querystring.dateCode': true,
   *  'method.querystring.paginate': false
   * }
   *
   * This example defines two querystring parameters:
   * - dateCode which is required
   * - paginate which is optional
   */
  public get requestParameters (): { [parameterName: string]: boolean } | undefined {
    return undefined
  }

  /**
   * The methodRequestModels are used to configure the API Gateway method request models which will show up in the generated OpenAPI spec.
   *
   * A method request model is used to define the request body as a JSON Schema model for a given content type.
   *
   * Example:
   * return {
   *  'application/json': StoredProfile.model
   * }
   */
  public get methodRequestModels (): { [contentType: string]: IModel } | undefined {
    return undefined
  }

  /**
   * The methodResponses are used to configure the API Gateway method responses which will show up in the generated OpenAPI spec.
   *
   * A method response is used to define the response headers and JSON Schema models for a given status code.
   *
   * Example:
   *  return [{
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
   */
  abstract get methodResponses (): MethodResponse[] | undefined
}
