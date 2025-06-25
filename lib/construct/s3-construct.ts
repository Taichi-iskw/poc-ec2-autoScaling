import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";

export interface S3ConstructProps {
  appName: string;
  account: string;
  region: string;
}

export class S3Construct extends Construct {
  public readonly deploymentBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: S3ConstructProps) {
    super(scope, id);

    // S3 bucket for deployment artifacts
    this.deploymentBucket = new s3.Bucket(this, "DeploymentBucket", {
      bucketName: `${props.appName}-deployment-${props.account}-${props.region}`,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          id: "DeleteOldVersions",
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
    });
  }
}
