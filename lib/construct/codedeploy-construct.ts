import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as codedeploy from "aws-cdk-lib/aws-codedeploy";
import * as autoscaling from "aws-cdk-lib/aws-autoscaling";

export interface CodedeployConstructProps {
  appName: string;
  asg: autoscaling.AutoScalingGroup;
}

export class CodedeployConstruct extends Construct {
  public readonly codeDeployApp: codedeploy.ServerApplication;
  public readonly deploymentGroup: codedeploy.ServerDeploymentGroup;

  constructor(scope: Construct, id: string, props: CodedeployConstructProps) {
    super(scope, id);

    // CodeDeploy Application
    this.codeDeployApp = new codedeploy.ServerApplication(this, "CodeDeployApp", {
      applicationName: `${props.appName}-app`,
    });

    // CodeDeploy Deployment Group
    this.deploymentGroup = new codedeploy.ServerDeploymentGroup(this, "CodeDeployDeploymentGroup", {
      application: this.codeDeployApp,
      deploymentGroupName: `${props.appName}-deployment-group`,
      autoScalingGroups: [props.asg],
      autoRollback: {
        failedDeployment: true,
        stoppedDeployment: true,
      },
    });
  }
}
