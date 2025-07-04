import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { createGithubOidcRole } from "./oidc-for-github";
import {
  EcrConstruct,
  NetworkConstruct,
  IamConstruct,
  Ec2Construct,
  AutoscalingConstruct,
  LoadbalancerConstruct,
  DnsConstruct,
  MonitoringConstruct,
} from "./construct";

export class PocEc2AutoScalingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Environment variables (should be moved to .env file in production)
    const domainName = this.node.tryGetContext("domainName") || "example.com";
    const appName = this.node.tryGetContext("appName") || "myapp";

    // Create ECR construct
    const ecrConstruct = new EcrConstruct(this, "EcrConstruct", {
      appName,
    });

    // Create Network construct
    const networkConstruct = new NetworkConstruct(this, "NetworkConstruct", {
      appName,
    });

    // Create IAM construct
    const iamConstruct = new IamConstruct(this, "IamConstruct", {
      appName,
    });

    // Create EC2 construct
    const ec2Construct = new Ec2Construct(this, "Ec2Construct", {
      appName,
      ec2Role: iamConstruct.ec2Role,
      ec2SecurityGroup: networkConstruct.ec2SecurityGroup,
    });

    // Create Auto Scaling construct
    const autoscalingConstruct = new AutoscalingConstruct(this, "AutoscalingConstruct", {
      appName,
      vpc: networkConstruct.vpc,
      launchTemplate: ec2Construct.launchTemplate,
    });

    // Create DNS construct (certificate needs to be created before ALB)
    const dnsConstruct = new DnsConstruct(this, "DnsConstruct", {
      appName,
      domainName,
    });

    // Create Load Balancer construct
    const loadbalancerConstruct = new LoadbalancerConstruct(this, "LoadbalancerConstruct", {
      appName,
      vpc: networkConstruct.vpc,
      albSecurityGroup: networkConstruct.albSecurityGroup,
      certificate: dnsConstruct.certificate,
      asg: autoscalingConstruct.asg,
    });

    // Create Route 53 A Record after ALB is created
    const aliasRecord = dnsConstruct.createAliasRecord(loadbalancerConstruct.alb);

    // Create Monitoring construct
    const monitoringConstruct = new MonitoringConstruct(this, "MonitoringConstruct", {
      appName,
      domainName,
      ecrRepository: ecrConstruct.repository,
    });

    // ===== OIDC Configuration (統合版) =====
    const githubOwner = this.node.tryGetContext("githubOwner") || "your-username";
    const githubActionsRole = createGithubOidcRole(this, {
      githubOwner,
      appName,
      ecrRepository: ecrConstruct.repository,
      logGroup: monitoringConstruct.logGroup,
      region: this.region,
      account: this.account,
    });

    // Outputs
    new cdk.CfnOutput(this, "ALBDNSName", {
      value: loadbalancerConstruct.alb.loadBalancerDnsName,
      description: "DNS name of the Application Load Balancer",
    });

    new cdk.CfnOutput(this, "ECRRepositoryUri", {
      value: ecrConstruct.repository.repositoryUri,
      description: "URI of the ECR repository",
    });

    new cdk.CfnOutput(this, "ApplicationURL", {
      value: `https://${appName}.${domainName}`,
      description: "URL of the application",
    });

    new cdk.CfnOutput(this, "GitHubActionsRoleArn", {
      value: githubActionsRole.roleArn,
      description: "ARN of the GitHub Actions IAM role",
    });
  }
}
