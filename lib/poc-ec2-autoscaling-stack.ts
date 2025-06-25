import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as autoscaling from "aws-cdk-lib/aws-autoscaling";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as codedeploy from "aws-cdk-lib/aws-codedeploy";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { createGithubOidcRole } from "./oidc-for-github";

export class PocEc2AutoScalingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Environment variables (should be moved to .env file in production)
    const domainName = this.node.tryGetContext("domainName") || "example.com";
    const appName = this.node.tryGetContext("appName") || "myapp";

    // Use existing default VPC
    const vpc = ec2.Vpc.fromLookup(this, "DefaultVPC", {
      isDefault: true,
    });

    // S3 bucket for deployment artifacts
    const deploymentBucket = new s3.Bucket(this, "DeploymentBucket", {
      bucketName: `${appName}-deployment-${this.account}-${this.region}`,
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

    // ACM Certificate for HTTPS
    const certificate = new acm.Certificate(this, "Certificate", {
      domainName: domainName,
      subjectAlternativeNames: [`*.${domainName}`],
      validation: acm.CertificateValidation.fromDns(),
    });

    // Security Groups
    const albSecurityGroup = new ec2.SecurityGroup(this, "ALBSecurityGroup", {
      vpc,
      description: "Security group for Application Load Balancer",
      allowAllOutbound: true,
    });

    // Allow HTTPS inbound to ALB
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "Allow HTTPS inbound");

    const ec2SecurityGroup = new ec2.SecurityGroup(this, "EC2SecurityGroup", {
      vpc,
      description: "Security group for EC2 instances",
      allowAllOutbound: true,
    });

    // Allow traffic from ALB to EC2 instances
    ec2SecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(80), "Allow HTTP from ALB");

    // IAM Role for EC2 instances
    const ec2Role = new iam.Role(this, "EC2Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy"),
      ],
    });

    // Add custom policies for S3, SSM, and CloudWatch Logs
    ec2Role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:GetObject", "s3:ListBucket"],
        resources: [deploymentBucket.bucketArn, `${deploymentBucket.bucketArn}/*`],
      })
    );

    ec2Role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"],
        resources: ["*"],
      })
    );

    // Instance Profile
    const instanceProfile = new iam.CfnInstanceProfile(this, "EC2InstanceProfile", {
      roles: [ec2Role.roleName],
    });

    // User Data script for EC2 instances
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      "#!/bin/bash",
      "yum update -y",
      "yum install -y python3 python3-pip git curl",
      "pip3 install --upgrade pip",
      // Install uv
      "curl -LsSf https://astral.sh/uv/install.sh | sh",
      "source /home/ec2-user/.cargo/env",
      // Install CodeDeploy agent
      "yum install -y ruby wget",
      "wget https://aws-codedeploy-${AWS::Region}.s3.${AWS::Region}.amazonaws.com/latest/install",
      "chmod +x ./install",
      "./install auto",
      "systemctl start codedeploy-agent",
      "systemctl enable codedeploy-agent",
      // Set instance metadata
      "export INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)",
      "export AWS_REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)",
      "echo 'export INSTANCE_ID=$INSTANCE_ID' >> /home/ec2-user/.bashrc",
      "echo 'export AWS_REGION=$AWS_REGION' >> /home/ec2-user/.bashrc",
      "echo 'source /home/ec2-user/.cargo/env' >> /home/ec2-user/.bashrc"
    );

    // Launch Template
    const launchTemplate = new ec2.LaunchTemplate(this, "LaunchTemplate", {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      userData,
      securityGroup: ec2SecurityGroup,
      role: ec2Role,
      blockDevices: [
        {
          deviceName: "/dev/xvda",
          volume: ec2.BlockDeviceVolume.ebs(20, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });

    // Auto Scaling Group
    const asg = new autoscaling.AutoScalingGroup(this, "ASG", {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      launchTemplate,
      minCapacity: 1,
      maxCapacity: 2,
      desiredCapacity: 1,
      healthCheck: autoscaling.HealthCheck.elb({
        grace: cdk.Duration.seconds(300),
      }),
      cooldown: cdk.Duration.seconds(300),
    });

    // Auto Scaling policies
    const scaleUpPolicy = new autoscaling.TargetTrackingScalingPolicy(this, "ScaleUpPolicy", {
      autoScalingGroup: asg,
      customMetric: new cloudwatch.Metric({
        namespace: "AWS/EC2",
        metricName: "CPUUtilization",
        statistic: "Average",
        period: cdk.Duration.minutes(1),
      }),
      targetValue: 70,
    });

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, "ALB", {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
    });

    // HTTPS Listener
    const httpsListener = alb.addListener("HTTPSListener", {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [certificate],
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: "text/plain",
        messageBody: "Not Found",
      }),
    });

    // Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
      vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        path: "/",
        healthyHttpCodes: "200",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    // Attach ASG to Target Group
    asg.attachToApplicationTargetGroup(targetGroup);

    // Add listener rule
    httpsListener.addAction("DefaultAction", {
      priority: 100,
      conditions: [elbv2.ListenerCondition.pathPatterns(["/*"])],
      action: elbv2.ListenerAction.forward([targetGroup]),
    });

    // Route 53 Hosted Zone (assuming it exists)
    const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: domainName,
    });

    // Route 53 A Record
    new route53.ARecord(this, "AliasRecord", {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(alb)),
      recordName: appName,
    });

    // CodeDeploy Application
    const codeDeployApp = new codedeploy.ServerApplication(this, "CodeDeployApp", {
      applicationName: `${appName}-app`,
    });

    // CodeDeploy Deployment Group
    const deploymentGroup = new codedeploy.ServerDeploymentGroup(this, "CodeDeployDeploymentGroup", {
      application: codeDeployApp,
      deploymentGroupName: `${appName}-deployment-group`,
      autoScalingGroups: [asg],
      autoRollback: {
        failedDeployment: true,
        stoppedDeployment: true,
      },
    });

    // CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, "ApplicationLogGroup", {
      logGroupName: `/aws/ec2/${appName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // SSM Parameter for domain name
    new ssm.StringParameter(this, "DomainNameParameter", {
      parameterName: `/${appName}/domain-name`,
      stringValue: domainName,
      description: "Domain name for the application",
    });

    // SSM Parameter for deployment bucket name
    new ssm.StringParameter(this, "DeploymentBucketParameter", {
      parameterName: `/${appName}/deployment-bucket`,
      stringValue: deploymentBucket.bucketName,
      description: "S3 bucket name for deployment artifacts",
    });

    // ===== OIDC Configuration (統合版) =====
    const githubOwner = this.node.tryGetContext("githubOwner") || "your-username";
    const githubActionsRole = createGithubOidcRole(this, {
      githubOwner,
      appName,
      deploymentBucket,
      codeDeployApp,
      logGroup,
      region: this.region,
      account: this.account,
    });

    // Outputs
    new cdk.CfnOutput(this, "ALBDNSName", {
      value: alb.loadBalancerDnsName,
      description: "DNS name of the Application Load Balancer",
    });

    new cdk.CfnOutput(this, "DeploymentBucketName", {
      value: deploymentBucket.bucketName,
      description: "Name of the S3 bucket for deployment artifacts",
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
