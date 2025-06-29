import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export interface NetworkConstructProps {
  appName: string;
}

export class NetworkConstruct extends Construct {
  public readonly vpc: ec2.IVpc;
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly ec2SecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkConstructProps) {
    super(scope, id);

    // Use existing default VPC
    this.vpc = ec2.Vpc.fromLookup(this, "DefaultVPC", {
      isDefault: true,
    });

    // Security Groups
    this.albSecurityGroup = new ec2.SecurityGroup(this, "ALBSecurityGroup", {
      vpc: this.vpc,
      description: "Security group for Application Load Balancer",
      allowAllOutbound: true,
    });

    // Allow HTTPS inbound to ALB
    this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "Allow HTTPS inbound");

    this.ec2SecurityGroup = new ec2.SecurityGroup(this, "EC2SecurityGroup", {
      vpc: this.vpc,
      description: "Security group for EC2 instances",
      allowAllOutbound: true,
    });

    // Allow traffic from ALB to EC2 instances on port 8080 (where Flask app runs)
    this.ec2SecurityGroup.addIngressRule(this.albSecurityGroup, ec2.Port.tcp(8080), "Allow HTTP from ALB to Flask app");
  }
}
