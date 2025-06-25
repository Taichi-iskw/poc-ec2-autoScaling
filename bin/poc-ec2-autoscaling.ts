#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { PocEc2AutoScalingStack } from "../lib/poc-ec2-autoscaling-stack";

const app = new cdk.App();

// Main infrastructure stack (including OIDC)
new PocEc2AutoScalingStack(app, "PocEc2AutoScalingStack", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
