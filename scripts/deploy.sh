#!/bin/bash

set -e

# Configuration
APP_NAME=${APP_NAME:-"myapp"}
ECR_REPOSITORY_URI=${ECR_REPOSITORY_URI}
IMAGE_TAG=${IMAGE_TAG:-"latest"}

# Extract region from ECR repository URI
AWS_REGION=$(echo $ECR_REPOSITORY_URI | sed 's/.*\.dkr\.ecr\.\([^\.]*\)\.amazonaws\.com.*/\1/')

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check required environment variables
if [ -z "$ECR_REPOSITORY_URI" ]; then
    print_error "ECR_REPOSITORY_URI environment variable is required"
    exit 1
fi

print_status "Starting deployment for $APP_NAME"
print_status "ECR Repository: $ECR_REPOSITORY_URI"
print_status "Image Tag: $IMAGE_TAG"
print_status "Region: $AWS_REGION"

# Get ECR login token
print_status "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPOSITORY_URI

# Build and push Docker image
print_status "Building Docker image..."
docker build -t $ECR_REPOSITORY_URI:$IMAGE_TAG ./app

print_status "Pushing Docker image to ECR..."
docker push $ECR_REPOSITORY_URI:$IMAGE_TAG

# Get Auto Scaling Group instances
print_status "Getting Auto Scaling Group instances..."
ASG_INSTANCES=$(aws autoscaling describe-auto-scaling-groups \
    --auto-scaling-group-names $APP_NAME-asg \
    --region $AWS_REGION \
    --query 'AutoScalingGroups[0].Instances[?LifecycleState==`InService`].InstanceId' \
    --output text)

if [ -z "$ASG_INSTANCES" ]; then
    print_error "No instances found in Auto Scaling Group"
    exit 1
fi

print_status "Found instances: $ASG_INSTANCES"

# Deploy to each instance using SSM
for INSTANCE_ID in $ASG_INSTANCES; do
    print_status "Deploying to instance: $INSTANCE_ID"
    
    # Send command to instance using the deploy script
    COMMAND_ID=$(aws ssm send-command \
        --instance-ids $INSTANCE_ID \
        --document-name "AWS-RunShellScript" \
        --parameters "commands=['bash /opt/app/deploy.sh $ECR_REPOSITORY_URI $IMAGE_TAG']" \
        --region $AWS_REGION \
        --query 'Command.CommandId' \
        --output text)

    print_status "Command sent to $INSTANCE_ID with ID: $COMMAND_ID"
    
    # Wait for command completion
    print_status "Waiting for deployment to complete..."
    aws ssm wait command-executed \
        --command-id $COMMAND_ID \
        --instance-id $INSTANCE_ID \
        --region $AWS_REGION

    # Get command output
    OUTPUT=$(aws ssm get-command-invocation \
        --command-id $COMMAND_ID \
        --instance-id $INSTANCE_ID \
        --region $AWS_REGION)

    STATUS=$(echo $OUTPUT | jq -r '.Status')
    
    if [ "$STATUS" = "Success" ]; then
        print_status "Deployment successful on $INSTANCE_ID"
    else
        print_error "Deployment failed on $INSTANCE_ID"
        echo $OUTPUT | jq -r '.StandardErrorContent'
        exit 1
    fi
done

print_status "Deployment completed successfully!" 