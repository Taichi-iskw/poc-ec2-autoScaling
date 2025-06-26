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
  codeDeployDeploymentGroup: codedeploy.IServerDeploymentGroup;
  logGroup: logs.ILogGroup;
  region: string;
  account: string;
}

export function createGithubOidcRole(scope: Construct, props: OidcForGithubProps): iam.Role {
  // Reference existing OIDC Identity Provider for GitHub Actions
  const githubOidcProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
    scope,
    "GitHubOidcProvider",
    `arn:aws:iam::${props.account}:oidc-provider/token.actions.githubusercontent.com`
  );

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
        "codedeploy:ListApplications",
        "codedeploy:ListDeploymentGroups",
        "codedeploy:ListDeploymentConfigs",
        "codedeploy:GetDeploymentTarget",
        "codedeploy:ListDeploymentTargets",
      ],
      resources: [
        props.codeDeployApp.applicationArn,
        `${props.codeDeployApp.applicationArn}/*`,
        props.codeDeployDeploymentGroup.deploymentGroupArn,
        `${props.codeDeployDeploymentGroup.deploymentGroupArn}/*`,
        `arn:aws:codedeploy:${props.region}:${props.account}:deploymentconfig:*`,
        `arn:aws:codedeploy:${props.region}:${props.account}:application:*`,
        `arn:aws:codedeploy:${props.region}:${props.account}:deploymentgroup:*`,
      ],
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
