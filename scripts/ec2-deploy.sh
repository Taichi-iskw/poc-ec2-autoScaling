#!/bin/bash

set -e

# Configuration
APP_NAME=${APP_NAME:-"myapp"}
ECR_REPOSITORY_URI=$1
IMAGE_TAG=$2

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

# Check required parameters
if [ -z "$ECR_REPOSITORY_URI" ] || [ -z "$IMAGE_TAG" ]; then
    print_error "Usage: $0 <ECR_REPOSITORY_URI> <IMAGE_TAG>"
    exit 1
fi

print_status "Starting deployment for $APP_NAME"
print_status "ECR Repository: $ECR_REPOSITORY_URI"
print_status "Image Tag: $IMAGE_TAG"
print_status "Region: $AWS_REGION"

# Stop existing container
print_status "Stopping existing container..."
docker stop ${APP_NAME}-app || true
docker rm ${APP_NAME}-app || true

# Pull latest image
print_status "Pulling latest image from ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPOSITORY_URI
docker pull $ECR_REPOSITORY_URI:$IMAGE_TAG

# Start new container with environment variables
print_status "Starting new container..."
cd /opt/app
ECR_REPOSITORY_URI=$ECR_REPOSITORY_URI IMAGE_TAG=$IMAGE_TAG APP_NAME=$APP_NAME docker-compose up -d

# Wait for health check
print_status "Waiting for health check..."
sleep 10

# Verify deployment
print_status "Verifying deployment..."
if curl -f http://localhost:8080/api/health; then
    print_status "Deployment successful on $INSTANCE_ID"
else
    print_error "Deployment failed on $INSTANCE_ID"
    exit 1
fi 