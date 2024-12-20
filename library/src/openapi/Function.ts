import { Duration } from 'aws-cdk-lib'
import { IModel, MethodOptions, MethodResponse } from 'aws-cdk-lib/aws-apigateway'
import { Function, Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'

/**
 * Because naming AWS resources consistently is important.
 *
 * @param text  the string to capitalize
 * @returns the capitalized string
 */
function uppercaseFirstLetter (text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * OpenAPIFunction
 *
 * A composite object for an operationId, a Lambda function, its requestModels, and any methodResponses, for use with an OpenAPI compliant REST API.
 */
export default class OpenAPIFunction {
  private readonly _operationId: string
  private readonly _requestModels: { [param: string]: IModel }
  private readonly _methodResponses: MethodResponse[]
  private readonly _requestParameters: { [param: string]: boolean }
  private _lambda?: Function

  static defaultProps: NodejsFunctionProps = {
    memorySize: 512,
    timeout: Duration.seconds(25),
    runtime: Runtime.NODEJS_22_X,
    handler: 'handler',
    bundling: {
      minify: true,
      nodeModules: ['aws-sdk']
    }
  }

  /**
   * Apply default NodejsFunctionProps to the global class used when creating a new NodejsFunction.
   *
   * Alternatively, you can supply additionalProps when calling createNodeJSLambda to override these defaults.
   *
   * @param props
   * @returns NodejsFunctionProps
   */
  static applyDefaultProps (props: NodejsFunctionProps): NodejsFunctionProps {
    const newProps = Object.assign({}, OpenAPIFunction.defaultProps, props)
    OpenAPIFunction.defaultProps = newProps
    return newProps
  }

  /**
   * OpenAPI Spec : operationId
   * The id MUST be unique among all operations described in the API.
   * The operationId value is case-sensitive.
   * Tools and libraries MAY use the operationId to uniquely identify an operation, therefore, it is RECOMMENDED to follow common programming naming conventions.
   * See: https://spec.openapis.org/oas/latest.html
   *
   * @param operationId unique string used to identify the operation
   */
  constructor (operationId: string) {
    this._operationId = operationId
    this._requestModels = {}
    this._methodResponses = []
    this._requestParameters = {}
  }

  set lambda (value) {
    this._lambda = value
  }

  get lambda (): NodejsFunction | undefined {
    return this._lambda
  }

  /**
   * Create a NodeJS Lambda function for this operationId.
   *
   * @param scope Construct scope for this construct
   * @param routeEntryPoint the path to the entry point for this Lambda function
   *
   * Note: side effect - also sets this._lambda to the created Lambda construct
   *
   * @returns NodejsFunction  the created Lambda construct
   */
  createNodeJSLambda (scope: Construct, routeEntryPoint: string, additionalProps?: NodejsFunctionProps): NodejsFunction {
    const { operationId: operationName } = this

    const finalProps = Object.assign({}, OpenAPIFunction.defaultProps, { entry: routeEntryPoint }, additionalProps ?? {})
    const lambda = new NodejsFunction(scope, uppercaseFirstLetter(operationName), finalProps)
    this._lambda = lambda
    return lambda
  }

  addMethodResponse (methodResponse: MethodResponse): OpenAPIFunction {
    this._methodResponses.push(methodResponse)
    return this
  }

  get methodResponses (): MethodResponse[] {
    return this._methodResponses
  }

  addRequestModel (responseModel: IModel, contentTypeKey: string = 'application/json'): OpenAPIFunction {
    this._requestModels[contentTypeKey] = responseModel
    return this
  }

  get requestModels (): { [param: string]: IModel } {
    return this._requestModels
  }

  addRequestParameter (parameter: string, required: boolean = true): OpenAPIFunction {
    this._requestParameters[parameter] = required
    return this
  }

  get requestParameters (): { [param: string]: boolean } {
    return this._requestParameters
  }

  get operationId (): string {
    return this._operationId
  }

  get methodOptions (): MethodOptions {
    const optionalRequestModel: { requestModels?: { [param: string]: IModel } } = {}
    if (Object.keys(this.requestModels).length > 0) {
      optionalRequestModel.requestModels = this.requestModels
    }
    const optionalRequestParameters: { requestParameters?: { [param: string]: boolean } } = {}
    if (Object.keys(this.requestParameters).length > 0) {
      optionalRequestParameters.requestParameters = this.requestParameters
    }
    return {
      operationName: this.operationId,
      methodResponses: this.methodResponses,
      ...optionalRequestModel,
      ...optionalRequestParameters
    }
  }
}
