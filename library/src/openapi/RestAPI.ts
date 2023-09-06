import { CfnOutput, Duration } from 'aws-cdk-lib'
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { RequestAuthorizer, LambdaIntegration, IdentitySource, RestApi, Cors, IResource, Resource } from 'aws-cdk-lib/aws-apigateway'
import { HttpMethod, IFunction, Runtime } from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'
import { CnameRecord, HostedZone } from 'aws-cdk-lib/aws-route53'
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager'

import OpenAPIEndpoint from './Endpoint'
import OpenAPIFunction from './Function'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import path from 'path'
import { OpenAPIRouteMetadata } from './Routes'
import fs from 'node:fs'

export interface OpenAPIRestAPIProps {
  Description: string
  SubDomain: string
  HostedZoneDomain: string
  Verifiers: Verifier[]
  AuthorizerPath?: string
  AuthorizerARN?: string
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

    let authLambda: IFunction
    if (props.AuthorizerARN !== undefined) {
      authLambda = NodejsFunction.fromFunctionArn(scope, 'ExistingAPIAuthorizer', props.AuthorizerARN)
    } else {
      authLambda = new NodejsFunction(scope, 'PrivateAPIAuthorizer', {
        memorySize: 256,
        timeout: Duration.seconds(5),
        runtime: Runtime.NODEJS_18_X,
        handler: 'handler',
        entry: path.join(__dirname, props.AuthorizerPath ?? './DefaultAuthorizer.ts'),
        bundling: {
          minify: true,
          externalModules: ['aws-sdk']
        },
        environment: {
          AUTH_VERIFIERS_JSON: JSON.stringify(props.Verifiers)
        }
      })
    }

    const requestAuthorizer = new RequestAuthorizer(this, 'PrivateApiRequestAuthorizer', {
      handler: authLambda,
      identitySources: [IdentitySource.header('Authorization')]
    })

    this.description = props.Description ?? 'No description provided'
    const api = new RestApi(this, id, {
      description: props.Description,
      deployOptions: {
        stageName: 'v1'
      },
      defaultMethodOptions: { authorizer: requestAuthorizer },
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowCredentials: true,
        allowHeaders: [
          'Authorization',
          'content-type'
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

  createEndpointFromMetadata (endpointMetaData: OpenAPIRouteMetadata<R>): OpenAPIEndpoint<OpenAPIFunction> {
    const supportedHttpMethods: { [key: string]: HttpMethod | undefined } = {
      GET: HttpMethod.GET,
      POST: HttpMethod.POST,
      PUT: HttpMethod.PUT,
      DELETE: HttpMethod.DELETE
    }

    const { restSignature } = endpointMetaData
    const [methodKey, path] = restSignature.split(' ')
    const method = supportedHttpMethods[methodKey]

    if (method === undefined) {
      throw new Error(`Unsupported HTTP method: ${methodKey}; supported keys are: ${Object.keys(supportedHttpMethods).join(', ')}`)
    }

    const oapiFunction = new OpenAPIFunction(endpointMetaData.operationId)
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

  addEndpoints (endpoints: Array<OpenAPIRouteMetadata<R>>): OpenAPIRestAPI<R> {
    endpoints.forEach(endpointMetaData => {
      try {
        const endpoint = this.createEndpointFromMetadata(endpointMetaData)
        this.addEndpoint(endpoint)
      } catch (ex) {
        const error = ex as Error
        console.error(`Unable to create endpoint for ${endpointMetaData.operationId} at ${endpointMetaData.restSignature}; Error: ${error.message}}`)
      }
    })
    return this
  }

  report (): void {
    console.log('OpenAPIRestAPI Routes:', Object.values(this.routeMap).map(route => route.path))

    // Update step summary
    if (process.env.GITHUB_STEP_SUMMARY !== undefined) {
      try {
        const summary = [
          `# ${this.restApi.restApiName}`,
          '',
          `${String(this.description ?? 'No description provided')}`,
          '',
          `Registered URL: https://${String(this.vanityDomain) ?? 'no-vanity-url-registered'}`,
          '',
          '## Endpoints',
          '',
          // Create a table from the endpoints array containing operationId, httpMethod, and path
          '| Operation ID | HTTP Method | Path |',
          '| --- | --- | --- |',
          ...this.endpoints.map(endpoint => `| ${endpoint.value?.operationId ?? 'undefined-operation-id'} | ${endpoint.httpMethod} | ${endpoint.path} |`),
          ''
        ]

        console.log('Markdown for Github job summary:\n\n', summary.join('\n'))

        fs.writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n'), { flag: 'a' })
      } catch (ex) {
        const error = ex as Error
        console.error('Unable to produce Github step summary:', error.message)
      }
    }
  }
}
