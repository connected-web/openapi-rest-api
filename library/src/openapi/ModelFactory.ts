import { Construct } from 'constructs'
import { IRestApi, JsonSchema, Model } from 'aws-cdk-lib/aws-apigateway'

export class OpenAPIModelFactory {
  protected readonly scope: Construct
  public readonly restApi: IRestApi
  protected readonly modelCache: { [schemaId: string]: Model } = {}

  constructor (scope: Construct, restApi: IRestApi) {
    this.scope = scope
    this.restApi = restApi
  }

  create (schemaId: string, schema: JsonSchema): Model {
    if (this.modelCache[schemaId] === undefined) {
      const modelName = `${schemaId}Model`

      if (schemaId.includes('Model')) {
        throw new Error(`Required to avoid the use of Model in schemaId; model name will be suffixed with Model: ${schemaId} becomes ${modelName}`)
      }

      this.modelCache[schemaId] = new Model(this.scope, modelName, {
        restApi: this.restApi,
        contentType: 'application/json',
        modelName,
        schema
      })
    }

    return this.modelCache[schemaId]
  }
}
