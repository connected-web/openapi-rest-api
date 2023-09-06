
import { Construct } from 'constructs'
import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'

export class HarnessResources {
  scope: Construct
  stack: cdk.Stack

  constructor (scope: Construct, stack: cdk.Stack) {
    this.scope = scope
    this.stack = stack
  }

  get serviceBucket (): s3.Bucket {
    const serviceBucketName = process.env.SERVICE_BUCKET_NAME ?? 'test-api-service-data-bucket'
    return new s3.Bucket(this.stack, 'ServiceDataBucket', {
      bucketName: serviceBucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      versioned: true
    })
  }
}
