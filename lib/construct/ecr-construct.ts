import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";

export interface EcrConstructProps {
  appName: string;
}

export class EcrConstruct extends Construct {
  public readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string, props: EcrConstructProps) {
    super(scope, id);

    // Create ECR repository
    this.repository = new ecr.Repository(this, "Repository", {
      repositoryName: `${props.appName}-app`,
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteImages: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          rulePriority: 2,
          description: "Keep only 10 images",
        },
      ],
    });

    // Add lifecycle policy to clean up untagged images
    this.repository.addLifecycleRule({
      tagStatus: ecr.TagStatus.UNTAGGED,
      maxImageCount: 1,
      rulePriority: 1,
      description: "Delete untagged images",
    });
  }
}
