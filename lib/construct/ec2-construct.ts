import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as fs from "fs";
import * as path from "path";

export interface Ec2ConstructProps {
  appName: string;
  ec2Role: iam.Role;
  ec2SecurityGroup: ec2.SecurityGroup;
}

export class Ec2Construct extends Construct {
  public readonly launchTemplate: ec2.LaunchTemplate;

  constructor(scope: Construct, id: string, props: Ec2ConstructProps) {
    super(scope, id);

    // Read docker-compose.yml content
    const dockerComposePath = path.join(__dirname, "../../app/docker-compose.yml");
    const dockerComposeContent = fs.readFileSync(dockerComposePath, "utf8");

    // Read deploy script content
    const deployScriptPath = path.join(__dirname, "../../scripts/ec2-deploy.sh");
    const deployScriptContent = fs.readFileSync(deployScriptPath, "utf8");

    // User Data script for EC2 instances with Docker
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      "#!/bin/bash",
      "set -e",
      "exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1",
      "echo 'Starting user data script...'",
      "",
      "# System updates and basic packages",
      "yum update -y",
      "yum install -y docker git curl wget",
      "",
      "# Start and enable Docker service",
      "systemctl start docker",
      "systemctl enable docker",
      "",
      "# Install docker-compose",
      'curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose',
      "chmod +x /usr/local/bin/docker-compose",
      "",
      "# Add ec2-user to docker group",
      "usermod -a -G docker ec2-user",
      "sudo chmod 666 /var/run/docker.sock",
      "",
      "# Set instance metadata",
      "export INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)",
      "export AWS_REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)",
      "echo 'export INSTANCE_ID=$INSTANCE_ID' >> /home/ec2-user/.bashrc",
      "echo 'export AWS_REGION=$AWS_REGION' >> /home/ec2-user/.bashrc",
      "echo 'export INSTANCE_ID=$INSTANCE_ID' >> /etc/environment",
      "echo 'export AWS_REGION=$AWS_REGION' >> /etc/environment",
      "",
      "# Create app directory",
      "mkdir -p /opt/app",
      "chown ec2-user:ec2-user /opt/app",
      "",
      "# Create docker-compose.yml from template",
      `cat > /opt/app/docker-compose.yml << 'EOF'`,
      dockerComposeContent,
      "EOF",
      "",
      "# Create deploy script from template",
      `cat > /opt/app/deploy.sh << 'DEPLOY_EOF'`,
      deployScriptContent,
      "DEPLOY_EOF",
      "chmod +x /opt/app/deploy.sh",
      "",
      "# Final status check",
      "echo 'User data script completed successfully'",
      "echo 'Docker status:'",
      "systemctl status docker --no-pager",
      "echo 'Instance ID: $INSTANCE_ID'",
      "echo 'Region: $AWS_REGION'"
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
