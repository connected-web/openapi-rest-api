import { CfnOutput, Duration } from 'aws-cdk-lib'
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { RequestAuthorizer, LambdaIntegration, IdentitySource, RestApi, Cors, IResource, Resource, MethodOptions } from 'aws-cdk-lib/aws-apigateway'
import { HttpMethod, IFunction, Runtime } from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'
import { CnameRecord, HostedZone } from 'aws-cdk-lib/aws-route53'
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager'

import OpenAPIEndpoint from './Endpoint'
import OpenAPIFunction from './Function'
import { generateOperationId } from './Operations'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import path from 'path'
import { OpenAPIRouteMetadata } from './Routes'
import fs from 'fs'

export interface OpenAPIHeaderAuthorizerProps {
  /**
   * A list of headers that are expected by API Gateway to cache the authorizer response.
   *
   * If not provided; will default to the keys from requiredHeadersWithAllowedValues, if any.
   */
  authorizationHeaders?: string[]
  /**
   * A map of required headers and their allowed values. If a header is required but not present, or if its value is not in the allowed list, the request will be denied.
   */
  requiredHeadersWithAllowedValues?: { [header: string]: string[] }
  /**
   * A map of required headers and their regex values. If a header is required but not present, or if its value does not match the regex, the request will be denied.
   */
  requiredHeadersRegexValues?: { [header: string]: string }
  /**
   * A list of headers that must not be present in the request. If any of these headers are present, the request will be denied.
   */
  disallowedHeaders?: string[]
  /**
   * A list of regexes for headers that must not be present in the request. If any header matches any of these regexes, the request will be denied.
   */
  disallowedHeaderRegexes?: string[]
}

export interface OpenAPIRestAPIProps {
  /**
   * A description of the API, which will appear in the API Gateway console.
   */
  Description: string
  /**
   * The subdomain of the hosted zone in Route53 where the CNAME record for the API will be associated.
   */
  SubDomain: string
  /**
   * The domain of the hosted zone in Route53 where the CNAME record for the API will be created.
   */
  HostedZoneDomain: string
  /**
   * If provided, the API will create an AWS Cognito-based authorizer, configured with these verifiers.
   */
  Verifiers: Verifier[]
  /**
   * If provided, the API will create a custom authorizer Lambda function, located at this path.
   */
  AuthorizerPath?: string
  /**
   * If provided, the API will use an existing authorizer Lambda function, identified by its ARN.
   */
  AuthorizerARN?: string
  /**
   * If provided, the API will create a header-based authorizer, which checks for the presence and values of specified headers.
   */
  HeaderAuthorizer?: OpenAPIHeaderAuthorizerProps
  /**
   * If provided, the API will use this stage name instead of the default 'v1'.
   */
  StageName?: string
  /**
   * Additional headers to include in CORS responses.
   */
  AdditionalCORSHeaders?: string[]
}

export interface Verifier {
  name: string
  userPoolId: string // "us-east-1_123456789",
  tokenUse: 'id' | 'access' // "access",
  clientId: string // "abcd1234ghij5678klmn9012",
  oauthUrl: string // "https://connected-web.auth.us-east-1.amazoncognito.com"
}

/**
 * OpenAPIRestAPI
 *
 * A composite object for a RestApi, its endpoints, and its execution role, for use with an OpenAPI compliant REST API.
 *
 * Type <R> is the custom resources object supplied to endpoints; it can be any type you define.
 * Use this custom type to pass constructs, or other resources, to your endpoints as a method of dependency injection.
 *
 * @param scope Construct scope for this construct
 * @param id Unique identifier for this construct
 * @param props OpenAPIRestAPIProps object containing the description, subdomain, hosted zone domain, and verifiers for this API
 *
 * @returns OpenAPIRestAPI
 *
 * @example
 * ```typescript
 * import { Construct } from 'constructs'
 * import { OpenAPIRestAPI } from 'cdk-openapi'
 *
 * export default class ExampleAPI extends Construct {
 *  constructor (scope: Construct, id: string) {
 *   super(scope, id)
 *
 *  const api = new OpenAPIRestAPI(this, 'ExampleAPI', {
 *    Description: 'Example API - created via AWS CDK',
 *    SubDomain: 'my-api',
 *    HostedZoneDomain: 'example.com',
 *    Verifiers: [{
 *      name: 'ExampleCognitoUserPool',
 *      userPoolId: 'us-east-1_123456789',
 *    }]
 * })
 */
export default class OpenAPIRestAPI<R> extends Construct {
  restApi: RestApi
  description?: string
  endpoints: Array<OpenAPIEndpoint<OpenAPIFunction>>
  executionRole: Role
  cnameRecord?: CnameRecord
  vanityDomain?: string
  sharedResources: R
  private readonly routeMap: { [param: string]: IResource }

  constructor (scope: Construct, id: string, props: OpenAPIRestAPIProps, sharedResources: R) {
    super(scope, id)
    this.restApi = this.createRestApi(scope, id, props)
    this.sharedResources = sharedResources
    this.endpoints = []
    this.executionRole = this.createExecutionRole(this)

    if (process.env.CREATE_CNAME_RECORD === 'true') {
      this.cnameRecord = this.createVanityUrl(scope, props)

      // Create stack output
      const cfnOutput = new CfnOutput(this, 'ApiUrl', {
        value: `https://${String(this.vanityDomain)}`,
        description: 'The registered URL of the API'
      })
      console.log('Registered URL of the API:', cfnOutput.value)
    }

    this.routeMap = {
      '/': this.restApi.root
    }
  }

  private createRestApi (scope: Construct, id: string, props: OpenAPIRestAPIProps): RestApi {
    if (props.AuthorizerARN !== undefined && props.AuthorizerPath !== undefined) {
      throw new Error('OpenAPIRestAPI: AuthorizerARN and AuthorizerPath are mutually exclusive; please specify only one.')
    }

    if (props.Verifiers.length > 0 && props.AuthorizerARN !== undefined) {
      throw new Error('OpenAPIRestAPI: AuthorizerARN and configurable Verifiers are mutually exclusive; please exclude Verifiers from your config or switch to the default authorizer by clearing the AuthorizerARN property.')
    }

    if (props.Verifiers.length > 0 && props.HeaderAuthorizer !== undefined) {
      throw new Error('OpenAPIRestAPI: HeaderAuthorizer and configurable Verifiers are mutually exclusive; please exclude Verifiers from your config or switch to the header authorizer by clearing the HeaderAuthorizer property.')
    }

    let authLambda: IFunction | undefined
    const defaultMethodOptions: MethodOptions | any = {}

    if (props.AuthorizerARN !== undefined) {
      authLambda = NodejsFunction.fromFunctionArn(scope, 'ExistingAPIAuthorizer', props.AuthorizerARN)
    } else if (props.Verifiers.length > 0) {
      const tsPath = path.join(__dirname, props.AuthorizerPath ?? './AWSCognitoAuthorizer.ts')
      const entryFilePath = (fs.existsSync(tsPath)) ? tsPath : tsPath.replace('.ts', '.js')
      if (!fs.existsSync(entryFilePath)) {
        throw new Error(`OpenAPIRestAPI: Unable to find authorizer file at ${String(entryFilePath)}`)
      }

      authLambda = new NodejsFunction(scope, 'PrivateAPIAuthorizer', {
        memorySize: 768,
        timeout: Duration.seconds(5),
        runtime: Runtime.NODEJS_LATEST,
        handler: 'handler',
        entry: entryFilePath,
        bundling: {
          minify: true,
          externalModules: ['aws-sdk']
        },
        environment: {
          AUTH_VERIFIERS_JSON: JSON.stringify(props.Verifiers)
        }
      })

      defaultMethodOptions.authorizer = new RequestAuthorizer(this, 'PrivateApiRequestAuthorizer', {
        handler: authLambda,
        identitySources: [IdentitySource.header('Authorization')]
      })
    } else if (props.HeaderAuthorizer !== undefined) {
      const tsPath = path.join(__dirname, props.AuthorizerPath ?? './HeaderAuthorizer.ts')
      const entryFilePath = (fs.existsSync(tsPath)) ? tsPath : tsPath.replace('.ts', '.js')
      if (!fs.existsSync(entryFilePath)) {
        throw new Error(`OpenAPIRestAPI: Unable to find authorizer file at ${String(entryFilePath)}`)
      }

      authLambda = new NodejsFunction(scope, 'PrivateHeaderAPIAuthorizer', {
        memorySize: 768,
        timeout: Duration.seconds(5),
        runtime: Runtime.NODEJS_LATEST,
        handler: 'handler',
        entry: entryFilePath,
        bundling: {
          minify: true,
          externalModules: ['aws-sdk']
        },
        environment: {
          REQUIRED_HEADERS_WITH_ALLOWED_VALUES_JSON: JSON.stringify(props.HeaderAuthorizer.requiredHeadersWithAllowedValues ?? {}),
          REQUIRED_HEADERS_REGEX_VALUES_JSON: JSON.stringify(props.HeaderAuthorizer.requiredHeadersRegexValues ?? {}),
          DISALLOWED_HEADERS_JSON: JSON.stringify(props.HeaderAuthorizer.disallowedHeaders ?? []),
          DISALLOWED_HEADER_REGEXES_JSON: JSON.stringify(props.HeaderAuthorizer.disallowedHeaderRegexes ?? [])
        }
      })

      const configuredAuthHeaders = (props.HeaderAuthorizer.authorizationHeaders ?? []).map(h => h.toLowerCase())
      const fallbackHeaders = Object.keys(props.HeaderAuthorizer.requiredHeadersWithAllowedValues ?? {}).map(h => h.toLowerCase())

      if (configuredAuthHeaders.length === 0 && fallbackHeaders.length === 0) {
        throw new Error('OpenAPIRestAPI: HeaderAuthorizer requires at least one of authorizationHeaders or requiredHeadersWithAllowedValues to be set with at least one header.')
      }

      const expectedHeaders = configuredAuthHeaders.length > 0 ? configuredAuthHeaders : fallbackHeaders

      defaultMethodOptions.authorizer = new RequestAuthorizer(this, 'PrivateApiRequestAuthorizer', {
        handler: authLambda,
        identitySources: expectedHeaders.map(headerKey => IdentitySource.header(headerKey)),
        resultsCacheTtl: Duration.seconds(0) // Disable caching for header-based authorizer
      })
    }

    const additionalCorsHeaders = props.AdditionalCORSHeaders ?? []

    this.description = props.Description ?? 'No description provided'
    const api = new RestApi(this, id, {
      description: props.Description,
      deployOptions: {
        stageName: props.StageName ?? 'v1'
      },
      defaultMethodOptions,
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowCredentials: true,
        allowHeaders: [
          'Authorization',
          'content-type',
          ...additionalCorsHeaders
        ]
      }
    })

    return api
  }

  private createExecutionRole (scope: Construct): Role {
    const executionRole = new Role(scope, 'ApiExecutionRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com')
    })

    return executionRole
  }

  private createVanityUrl (scope: Construct, props: OpenAPIRestAPIProps): CnameRecord {
    const vanityDomain = `${props.SubDomain}.${props.HostedZoneDomain}`
    const hostedZone = HostedZone.fromLookup(scope, 'HostedZone', {
      domainName: props.HostedZoneDomain
    })

    const cert = new Certificate(this, vanityDomain, {
      domainName: vanityDomain,
      validation: CertificateValidation.fromDns(hostedZone)
    })

    const domain = this.restApi.addDomainName(`${props.SubDomain}-domain-name`, {
      domainName: vanityDomain,
      certificate: cert
    })

    const cnameRecord = new CnameRecord(this, 'cname-record', {
      domainName: domain.domainNameAliasDomainName,
      zone: hostedZone,
      recordName: vanityDomain,
      ttl: Duration.minutes(5)
    })
    this.vanityDomain = vanityDomain
    return cnameRecord
  }

  private makeRouteResource (routeMap: { [param: string]: IResource }, path: string): Resource {
    const pathParts = path.split('/').filter(n => n)
    const pathLeaf = pathParts.pop()
    const pathBranch = '/' + pathParts.join('/')

    if (pathLeaf !== null && pathLeaf !== undefined) {
      const parent: IResource = routeMap[pathBranch] ?? this.makeRouteResource(routeMap, pathBranch)
      const resource = parent.addResource(pathLeaf)
      routeMap[path] = resource
      return resource
    } else {
      throw new Error(`Unable to make route resource; unexpectedly short path: ${path}`)
    }
  }

  get (path: string, lambda: OpenAPIFunction): OpenAPIRestAPI<R> {
    const endpoint = new OpenAPIEndpoint(HttpMethod.GET, path, lambda)
    return this.addEndpoint(endpoint)
  }

  patch (path: string, lambda: OpenAPIFunction): OpenAPIRestAPI<R> {
    const endpoint = new OpenAPIEndpoint(HttpMethod.PATCH, path, lambda)
    return this.addEndpoint(endpoint)
  }

  post (path: string, lambda: OpenAPIFunction): OpenAPIRestAPI<R> {
    const endpoint = new OpenAPIEndpoint(HttpMethod.POST, path, lambda)
    return this.addEndpoint(endpoint)
  }

  put (path: string, lambda: OpenAPIFunction): OpenAPIRestAPI<R> {
    const endpoint = new OpenAPIEndpoint(HttpMethod.PUT, path, lambda)
    return this.addEndpoint(endpoint)
  }

  delete (path: string, lambda: OpenAPIFunction): OpenAPIRestAPI<R> {
    const endpoint = new OpenAPIEndpoint(HttpMethod.DELETE, path, lambda)
    return this.addEndpoint(endpoint)
  }

  private addEndpoint (endpoint: OpenAPIEndpoint<OpenAPIFunction>): OpenAPIRestAPI<R> {
    const { endpoints, routeMap, executionRole } = this
    endpoints.push(endpoint)

    executionRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      resources: [endpoint.value?.lambda?.functionArn ?? 'undefined-endpoint-arn'],
      actions: ['lambda:InvokeFunction']
    }))

    const routeResource = routeMap[endpoint.path] ?? this.makeRouteResource(routeMap, endpoint.path)
    if (endpoint.value.lambda !== undefined) {
      routeResource.addMethod(
        endpoint.httpMethod,
        new LambdaIntegration(endpoint.value.lambda, {
          proxy: true,
          credentialsRole: executionRole
        }),
        endpoint.value.methodOptions
      )
    } else {
      console.warn('OpenAPIRestAPI: Supplied endpoint does not have a lambda associated; skipping value:', endpoint.httpMethod, endpoint.path)
    }

    return this
  }

  private createEndpointFromMetadata (endpointMetaData: OpenAPIRouteMetadata<R>, pathOverride?: string): OpenAPIEndpoint<OpenAPIFunction> {
    const supportedHttpMethods: { [key: string]: HttpMethod | undefined } = {
      GET: HttpMethod.GET,
      PATCH: HttpMethod.PATCH,
      POST: HttpMethod.POST,
      PUT: HttpMethod.PUT,
      DELETE: HttpMethod.DELETE
    }

    const { restSignature } = endpointMetaData

    if (pathOverride === undefined && restSignature === undefined) {
      throw new Error('Unable to create endpoint; neither a restSignature nor pathOverride were supplied - all routes must declare a path in the form METHOD /path, e.g. GET /status')
    }

    if (pathOverride !== undefined && restSignature !== undefined && pathOverride !== restSignature) {
      throw new Error(`Unable to create endpoint; both a restSignature and pathOverride were supplied, but they do not match: ${restSignature} !== ${pathOverride}`)
    }

    const [methodKey, path] = typeof pathOverride === 'string' ? String(pathOverride).split(' ') : String(restSignature).split(' ')
    const method = supportedHttpMethods[methodKey]

    if (path === undefined || path === '') {
      throw new Error(`Invalid path from rest signature: ${path}, expected a path in the form METHOD /path, e.g. GET /status`)
    }

    if (method === undefined) {
      throw new Error(`Unsupported HTTP method: ${methodKey}; supported keys are: ${Object.keys(supportedHttpMethods).join(', ')}`)
    }

    endpointMetaData.restSignatureOverride = `${methodKey} ${path}`
    const operationId = endpointMetaData.operationId ?? generateOperationId(endpointMetaData.restSignatureOverride)

    const oapiFunction = new OpenAPIFunction(operationId)
    const lambda = oapiFunction.createNodeJSLambda(this, endpointMetaData.routeEntryPoint, endpointMetaData.lambdaConfig)
    endpointMetaData.grantPermissions(this, lambda, this.sharedResources)
    const endpoint = new OpenAPIEndpoint<OpenAPIFunction>(method, path, oapiFunction)

    endpointMetaData.methodResponses?.forEach(methodResponse => {
      endpoint.value.addMethodResponse(methodResponse)
    })

    if (endpointMetaData.methodRequestModels !== undefined) {
      Object.entries(endpointMetaData.methodRequestModels).forEach(([contentTypeKey, requestModel]) => {
        endpoint.value.addRequestModel(requestModel, contentTypeKey)
      })
    }

    if (endpointMetaData.requestParameters !== undefined) {
      Object.entries(endpointMetaData.requestParameters).forEach(([parameter, required]) => {
        endpoint.value.addRequestParameter(parameter, required)
      })
    }

    return endpoint
  }

  addEndpoints (endpoints: Array<OpenAPIRouteMetadata<R>> | { [key: string]: OpenAPIRouteMetadata<R> }): OpenAPIRestAPI<R> {
    if (Array.isArray(endpoints)) {
      return this.addEndpointsArray(endpoints)
    } else {
      return this.addEndpointsObject(endpoints)
    }
  }

  private addEndpointsArray (endpoints: Array<OpenAPIRouteMetadata<R>>): OpenAPIRestAPI<R> {
    endpoints.forEach(endpointMetaData => {
      const endpoint = this.createEndpointFromMetadata(endpointMetaData)
      this.addEndpoint(endpoint)
    })
    return this
  }

  private addEndpointsObject (endpoints: { [key: string]: OpenAPIRouteMetadata<R> }): OpenAPIRestAPI<R> {
    Object.entries(endpoints).forEach(([restSignature, endpointMetaData]) => {
      const endpoint = this.createEndpointFromMetadata(endpointMetaData, restSignature)
      this.addEndpoint(endpoint)
    })
    return this
  }

  generateReportMarkdown (): string {
    const summary = [
      `# ${this.restApi.restApiName}`,
      '',
      `${String(this.description ?? 'No description provided')}`,
      '',
      `Registered URL: https://${this.vanityDomain ?? 'no-vanity-url-registered'}`,
      '',
      '## Endpoints',
      '',
      // Create a table from the endpoints array containing operationId, httpMethod, and path
      '| HTTP Method | Path | Operation ID |',
      '| --- | --- | --- |',
      ...this.endpoints.map(endpoint => `| ${endpoint.httpMethod} | ${endpoint.path} | ${endpoint.value?.operationId ?? 'undefined-operation-id'} |`),
      ''
    ]
    return summary.join('\n')
  }

  report (): void {
    console.log('OpenAPIRestAPI Routes:', Object.values(this.routeMap).map(route => route.path))

    // Update step summary
    if (process.env.GITHUB_STEP_SUMMARY !== undefined && process.env.OPENAPI_REST_API_REPORT_SUMMARY !== undefined) {
      try {
        const markdownSummary = this.generateReportMarkdown()

        console.log('Markdown for Github job summary:\n\n', markdownSummary)

        fs.writeFileSync(process.env.GITHUB_STEP_SUMMARY, markdownSummary, { flag: 'a' })
      } catch (ex) {
        const error = ex as Error
        console.error('Unable to produce Github step summary:', error.message)
      }
    }
  }
}
