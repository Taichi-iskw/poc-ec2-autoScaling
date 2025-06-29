import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as logs from "aws-cdk-lib/aws-logs";

interface OidcForGithubProps {
  githubOwner: string;
  appName: string;
  ecrRepository: ecr.IRepository;
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
        "token.actions.githubusercontent.com:sub": `repo:${props.githubOwner}/poc-ec2-autoScaling:*`,
        // "token.actions.githubusercontent.com:sub": `repo:${props.githubOwner}/${props.appName}:*`,
      },
    }),
    description: `Role for GitHub Actions to deploy ${props.appName} application`,
  });

  // Policy for ECR access
  githubActionsRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["ecr:GetAuthorizationToken"],
      resources: ["*"],
    })
  );

  // Policy for ECR repository access
  githubActionsRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeRepositories",
        "ecr:ListImages",
        "ecr:TagResource",
      ],
      resources: [props.ecrRepository.repositoryArn, `${props.ecrRepository.repositoryArn}/*`],
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

  // Policy for SSM SendCommand (for deployment)
  githubActionsRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "ssm:SendCommand",
        "ssm:GetCommandInvocation",
        "ssm:ListCommandInvocations",
        "ssm:DescribeInstanceInformation",
        "ssm:ListInstances",
      ],
      resources: ["*"],
    })
  );

  // Policy for Auto Scaling Group access
  githubActionsRole.addToPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["autoscaling:DescribeAutoScalingGroups", "autoscaling:DescribeAutoScalingInstances"],
      resources: ["*"],
    })
  );

  return githubActionsRole;
}
