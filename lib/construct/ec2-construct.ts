import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";

export interface Ec2ConstructProps {
  appName: string;
  ec2Role: iam.Role;
  ec2SecurityGroup: ec2.SecurityGroup;
}

export class Ec2Construct extends Construct {
  public readonly launchTemplate: ec2.LaunchTemplate;

  constructor(scope: Construct, id: string, props: Ec2ConstructProps) {
    super(scope, id);

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
    this.launchTemplate = new ec2.LaunchTemplate(this, "LaunchTemplate", {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      userData,
      securityGroup: props.ec2SecurityGroup,
      role: props.ec2Role,
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
  }
}
