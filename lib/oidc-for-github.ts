import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as codedeploy from "aws-cdk-lib/aws-codedeploy";
import * as logs from "aws-cdk-lib/aws-logs";

interface OidcForGithubProps {
  githubOwner: string;
  appName: string;
  deploymentBucket: s3.IBucket;
  codeDeployApp: codedeploy.IServerApplication;
  logGroup: logs.ILogGroup;
  region: string;
  account: string;
}

export function createGithubOidcRole(scope: Construct, props: OidcForGithubProps): iam.Role {
  // OIDC Identity Provider for GitHub Actions
  const githubOidcProvider = new iam.OpenIdConnectProvider(scope, "GitHubOidcProvider", {
    url: "https://token.actions.githubusercontent.com",
    clientIds: ["sts.amazonaws.com"],
    thumbprints: [
      "6938fd4d98bab03faadb97b34396831e3780aea1", // GitHub Actions thumbprint
    ],
  });

  // IAM Role for GitHub Actions
  const githubActionsRole = new iam.Role(scope, "GitHubActionsRole", {
    assumedBy: new iam.WebIdentityPrincipal(githubOidcProvider.openIdConnectProviderArn, {
      StringEquals: {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
      },
      StringLike: {
        // 特定のリポジトリのみに制限
        "token.actions.githubusercontent.com:sub": `repo:${props.githubOwner}/${props.appName}:*`,
      },
    }),
    description: `Role for GitHub Actions to deploy ${props.appName} application`,
  });

  // Policy for S3 access (deployment artifacts)
  githubActionsRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
      resources: [props.deploymentBucket.bucketArn, `${props.deploymentBucket.bucketArn}/*`],
    })
  );

  // Policy for CodeDeploy access
  githubActionsRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "codedeploy:GetApplication",
        "codedeploy:GetDeployment",
        "codedeploy:GetDeploymentConfig",
        "codedeploy:RegisterApplicationRevision",
        "codedeploy:CreateDeployment",
        "codedeploy:StopDeployment",
        "codedeploy:GetDeploymentGroup",
        "codedeploy:ListDeployments",
      ],
      resources: [props.codeDeployApp.applicationArn, `${props.codeDeployApp.applicationArn}/*`],
    })
  );

  // Policy for CloudWatch Logs
  githubActionsRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"],
      resources: [props.logGroup.logGroupArn, `${props.logGroup.logGroupArn}:*`],
    })
  );

  // Policy for SSM Parameter Store
  githubActionsRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["ssm:GetParameter", "ssm:GetParameters", "ssm:PutParameter", "ssm:DeleteParameter"],
      resources: [`arn:aws:ssm:${props.region}:${props.account}:parameter/${props.appName}/*`],
    })
  );

  return githubActionsRole;
}
