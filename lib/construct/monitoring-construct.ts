import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as s3 from "aws-cdk-lib/aws-s3";

export interface MonitoringConstructProps {
  appName: string;
  domainName: string;
  deploymentBucket: s3.Bucket;
}

export class MonitoringConstruct extends Construct {
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: MonitoringConstructProps) {
    super(scope, id);

    // CloudWatch Log Group
    this.logGroup = new logs.LogGroup(this, "ApplicationLogGroup", {
      logGroupName: `/aws/ec2/${props.appName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // SSM Parameter for domain name
    new ssm.StringParameter(this, "DomainNameParameter", {
      parameterName: `/${props.appName}/domain-name`,
      stringValue: props.domainName,
      description: "Domain name for the application",
    });

    // SSM Parameter for deployment bucket name
    new ssm.StringParameter(this, "DeploymentBucketParameter", {
      parameterName: `/${props.appName}/deployment-bucket`,
      stringValue: props.deploymentBucket.bucketName,
      description: "S3 bucket name for deployment artifacts",
    });
  }
}
