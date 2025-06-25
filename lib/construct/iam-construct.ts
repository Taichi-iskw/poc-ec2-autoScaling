import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";

export interface IamConstructProps {
  appName: string;
  deploymentBucket: s3.Bucket;
}

export class IamConstruct extends Construct {
  public readonly ec2Role: iam.Role;
  public readonly instanceProfile: iam.CfnInstanceProfile;

  constructor(scope: Construct, id: string, props: IamConstructProps) {
    super(scope, id);

    // IAM Role for EC2 instances
    this.ec2Role = new iam.Role(this, "EC2Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy"),
      ],
    });

    // Add custom policies for S3, SSM, and CloudWatch Logs
    this.ec2Role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:GetObject", "s3:ListBucket"],
        resources: [props.deploymentBucket.bucketArn, `${props.deploymentBucket.bucketArn}/*`],
      })
    );

    this.ec2Role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"],
        resources: ["*"],
      })
    );

    // Instance Profile
    this.instanceProfile = new iam.CfnInstanceProfile(this, "EC2InstanceProfile", {
      roles: [this.ec2Role.roleName],
    });
  }
}
