import { IRestApi, JsonSchemaType, JsonSchemaVersion, Model } from 'aws-cdk-lib/aws-apigateway'
import { Construct } from 'constructs'
import { OpenAPIModelFactory } from './ModelFactory'

/**
 * OpenAPI Models are added directly to a RestAPI construct; and shared between endpoints.
 * These basic types cover most common types of JSON responses.
 * It's advised that you extend this and implement your own models to reflect your API.
 */
export default class OpenAPIBasicModels {
  public static modelFactory: OpenAPIModelFactory

  static setup (scope: Construct, restApi: IRestApi) {
    OpenAPIBasicModels.modelFactory = new OpenAPIModelFactory(scope, restApi)
  }

  static get BasicObjectModel (): Model {
    return OpenAPIBasicModels.modelFactory.create('BasicObject', {
      schema: JsonSchemaVersion.DRAFT7,
      title: 'Basic Object',
      description: 'A basic JSON object with key value pairs',
      type: JsonSchemaType.OBJECT,
      properties: {},
      additionalProperties: true
    })
  }

  static get BasicArrayModel (): Model {
    return OpenAPIBasicModels.modelFactory.create('BasicArray', {
      schema: JsonSchemaVersion.DRAFT7,
      title: 'Basic Array of Objects',
      type: JsonSchemaType.ARRAY,
      items: {
        type: JsonSchemaType.OBJECT,
        properties: {},
        additionalProperties: true
      }
    })
  }

  static get BasicStringArrayModel (): Model {
    return OpenAPIBasicModels.modelFactory.create('BasicStringArray', {
      schema: JsonSchemaVersion.DRAFT7,
      title: 'Basic Array of Strings',
      type: JsonSchemaType.ARRAY,
      items: {
        type: JsonSchemaType.STRING
      }
    })
  }
}
