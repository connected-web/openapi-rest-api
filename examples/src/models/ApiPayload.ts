import { IModel, JsonSchemaType, JsonSchemaVersion } from 'aws-cdk-lib/aws-apigateway'
import { OpenAPIBasicModels } from '@connected-web/openapi-rest-api'

/**
 * ApiPayload
 *
 * This is a basic request model for the API to demonstrate how to create a request model.
 *
 * @returns ApiPayload
 */
export class ApiPayload extends OpenAPIBasicModels {
  static get model (): IModel {
    return OpenAPIBasicModels.modelFactory?.create('ApiPayload', {
      schema: JsonSchemaVersion.DRAFT7,
      title: 'Basic API Payload',
      type: JsonSchemaType.OBJECT,
      properties: {
        operationId: {
          type: JsonSchemaType.INTEGER,
          description: 'The HTTP status code of the response'
        },
        payload: {
          type: JsonSchemaType.OBJECT,
          description: 'The data payload of the request'
        }
      },
      required: ['operationId', 'payload']
    }) as IModel
  }
}
