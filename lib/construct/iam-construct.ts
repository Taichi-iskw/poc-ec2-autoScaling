import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";

export interface IamConstructProps {
  appName: string;
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

    // Add ECR permissions for pulling Docker images
    this.ec2Role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:DescribeRepositories",
          "ecr:ListImages",
        ],
        resources: ["*"],
      })
    );

    // Add CloudWatch Logs permissions
    this.ec2Role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"],
        resources: ["*"],
      })
    );

    // Add SSM permissions for deployment commands
    this.ec2Role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ssm:SendCommand", "ssm:GetCommandInvocation", "ssm:ListCommandInvocations"],
        resources: ["*"],
      })
    );

    // Instance Profile
    this.instanceProfile = new iam.CfnInstanceProfile(this, "EC2InstanceProfile", {
      roles: [this.ec2Role.roleName],
    });
  }
}
