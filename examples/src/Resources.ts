
import { Construct } from 'constructs'
import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'

/**
 * The resources class can have any signature you want, and can be used to share resources between endpoints.
 *
 * Initialise this pass it into new OpenAPIRestAPI<ExampleResources>(scope, config, exampleResources) as the template type,
 * and as the third argument, and then access it from your endpoints by implementing the grantPermissions(scope, endpoint, resources) method.
 *
 * Because this stack is pure CDK, you can use any CDK constructs you want here.
 */
export class ExampleResources {
  scope: Construct
  stack: cdk.Stack

  serviceBucket: s3.Bucket

  constructor (scope: Construct, stack: cdk.Stack) {
    this.scope = scope
    this.stack = stack

    const serviceBucketName = process.env.SERVICE_BUCKET_NAME ?? 'test-api-service-data-bucket'
    this.serviceBucket = new s3.Bucket(this.stack, 'ExampleServiceBucket', {
      bucketName: serviceBucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      versioned: true
    })
  }
}
