import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as autoscaling from "aws-cdk-lib/aws-autoscaling";

export interface LoadbalancerConstructProps {
  appName: string;
  vpc: ec2.IVpc;
  albSecurityGroup: ec2.SecurityGroup;
  certificate: acm.Certificate;
  asg: autoscaling.AutoScalingGroup;
}

export class LoadbalancerConstruct extends Construct {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly targetGroup: elbv2.ApplicationTargetGroup;
  public readonly httpsListener: elbv2.ApplicationListener;

  constructor(scope: Construct, id: string, props: LoadbalancerConstructProps) {
    super(scope, id);

    // Application Load Balancer
    this.alb = new elbv2.ApplicationLoadBalancer(this, "ALB", {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
    });

    // HTTPS Listener
    this.httpsListener = this.alb.addListener("HTTPSListener", {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [props.certificate],
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: "text/plain",
        messageBody: "Not Found",
      }),
    });

    // Target Group
    this.targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
      vpc: props.vpc,
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
    props.asg.attachToApplicationTargetGroup(this.targetGroup);

    // Add listener rule
    this.httpsListener.addAction("DefaultAction", {
      priority: 100,
      conditions: [elbv2.ListenerCondition.pathPatterns(["/*"])],
      action: elbv2.ListenerAction.forward([this.targetGroup]),
    });
  }
}
