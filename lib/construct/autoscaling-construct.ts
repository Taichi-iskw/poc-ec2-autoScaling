import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as autoscaling from "aws-cdk-lib/aws-autoscaling";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as ssm from "aws-cdk-lib/aws-ssm";

export interface AutoscalingConstructProps {
  appName: string;
  vpc: ec2.IVpc;
  launchTemplate: ec2.LaunchTemplate;
}

export class AutoscalingConstruct extends Construct {
  public readonly asg: autoscaling.AutoScalingGroup;

  constructor(scope: Construct, id: string, props: AutoscalingConstructProps) {
    super(scope, id);

    // Auto Scaling Group
    this.asg = new autoscaling.AutoScalingGroup(this, "ASG", {
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      launchTemplate: props.launchTemplate,
      minCapacity: 1,
      maxCapacity: 2,
      desiredCapacity: 1,
      healthCheck: autoscaling.HealthCheck.elb({
        grace: cdk.Duration.seconds(300),
      }),
      cooldown: cdk.Duration.seconds(300),
      terminationPolicies: [autoscaling.TerminationPolicy.OLDEST_INSTANCE],
    });

    // Set removal policy to destroy resources when stack is deleted
    this.asg.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // Store Auto Scaling Group name in SSM Parameter Store
    new ssm.StringParameter(this, "ASGNameParameter", {
      parameterName: `/${props.appName}/auto-scaling-group-name`,
      stringValue: this.asg.autoScalingGroupName,
      description: "Auto Scaling Group name for deployment",
    });

    // Auto Scaling policies
    const scaleUpPolicy = new autoscaling.TargetTrackingScalingPolicy(this, "ScaleUpPolicy", {
      autoScalingGroup: this.asg,
      customMetric: new cloudwatch.Metric({
        namespace: "AWS/EC2",
        metricName: "CPUUtilization",
        statistic: "Average",
        period: cdk.Duration.minutes(1),
      }),
      targetValue: 70,
    });

    const scaleDownPolicy = new autoscaling.TargetTrackingScalingPolicy(this, "ScaleDownPolicy", {
      autoScalingGroup: this.asg,
      customMetric: new cloudwatch.Metric({
        namespace: "AWS/EC2",
        metricName: "CPUUtilization",
        statistic: "Average",
        period: cdk.Duration.minutes(5),
      }),
      targetValue: 30,
    });
  }
}
