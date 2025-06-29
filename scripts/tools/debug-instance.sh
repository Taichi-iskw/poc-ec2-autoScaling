#!/bin/bash

# Debug script for EC2 instances in Auto Scaling Group
# This script helps troubleshoot issues with Docker containers and applications

set -e

# Configuration
APP_NAME=${APP_NAME:-"myapp"}
AWS_REGION=${AWS_REGION:-"ap-northeast-1"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get instance information
get_instance_info() {
    local instance_id=$1
    
    print_header "Instance Information"
    echo "Instance ID: $instance_id"
    echo "Region: $AWS_REGION"
    echo "App Name: $APP_NAME"
    
    # Get instance details from AWS
    if command_exists aws; then
        echo ""
        print_header "AWS Instance Details"
        aws ec2 describe-instances \
            --instance-ids "$instance_id" \
            --region "$AWS_REGION" \
            --query 'Reservations[0].Instances[0].[InstanceId,InstanceType,State.Name,LaunchTime,PublicIpAddress,PrivateIpAddress]' \
            --output table
    fi
}

# Function to check system resources
check_system_resources() {
    print_header "System Resources"
    
    echo "CPU Usage:"
    top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1
    
    echo ""
    echo "Memory Usage:"
    free -h
    
    echo ""
    echo "Disk Usage:"
    df -h
    
    echo ""
    echo "Load Average:"
    uptime
}

# Function to check Docker status
check_docker_status() {
    print_header "Docker Status"
    
    if ! command_exists docker; then
        print_error "Docker is not installed"
        return 1
    fi
    
    echo "Docker Version:"
    docker --version
    
    echo ""
    echo "Docker Service Status:"
    systemctl status docker --no-pager || print_warning "Could not get Docker service status"
    
    echo ""
    echo "Docker Images:"
    docker images
    
    echo ""
    echo "Docker Containers:"
    docker ps -a
    
    echo ""
    echo "Docker System Info:"
    docker system df
}

# Function to check application status
check_application_status() {
    print_header "Application Status"
    
    # Check if application container is running
    if docker ps | grep -q "${APP_NAME}-app"; then
        print_success "Application container is running"
        
        echo ""
        echo "Container Details:"
        docker ps | grep "${APP_NAME}-app"
        
        echo ""
        echo "Container Logs (last 50 lines):"
        docker logs --tail 50 "${APP_NAME}-app"
        
        echo ""
        echo "Container Resource Usage:"
        docker stats --no-stream "${APP_NAME}-app"
        
    else
        print_error "Application container is not running"
        
        echo ""
        echo "All containers:"
        docker ps -a
    fi
}

# Function to check network connectivity
check_network_connectivity() {
    print_header "Network Connectivity"
    
    echo "Network Interfaces:"
    ip addr show
    
    echo ""
    echo "Routing Table:"
    ip route show
    
    echo ""
    echo "DNS Resolution:"
    cat /etc/resolv.conf
    
    echo ""
    echo "Test Internet Connectivity:"
    if curl -s --connect-timeout 5 https://www.google.com > /dev/null; then
        print_success "Internet connectivity is working"
    else
        print_error "Internet connectivity failed"
    fi
    
    echo ""
    echo "Test ECR Connectivity:"
    if aws ecr get-login-password --region "$AWS_REGION" > /dev/null 2>&1; then
        print_success "ECR connectivity is working"
    else
        print_error "ECR connectivity failed"
    fi
}

# Function to check application health
check_application_health() {
    print_header "Application Health Check"
    
    # Check if application is responding
    if curl -f http://localhost:8080/api/health > /dev/null 2>&1; then
        print_success "Application health check passed"
        
        echo ""
        echo "Health Check Response:"
        curl -s http://localhost:8080/api/health | jq . 2>/dev/null || curl -s http://localhost:8080/api/health
        
    else
        print_error "Application health check failed"
        
        echo ""
        echo "Trying to get more details:"
        curl -v http://localhost:8080/api/health || echo "Connection refused"
    fi
}

# Function to check logs
check_logs() {
    print_header "System Logs"
    
    echo "Docker Service Logs (last 20 lines):"
    journalctl -u docker --no-pager -n 20 || echo "Could not get Docker service logs"
    
    echo ""
    echo "User Data Script Logs:"
    if [ -f /var/log/user-data.log ]; then
        tail -20 /var/log/user-data.log
    else
        echo "User data log not found"
    fi
    
    echo ""
    echo "System Messages (last 20 lines):"
    journalctl --no-pager -n 20
}

# Function to check IAM role and permissions
check_iam_permissions() {
    print_header "IAM Role and Permissions"
    
    echo "Instance Metadata:"
    curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/ || echo "No IAM role attached"
    
    echo ""
    echo "Test ECR Permissions:"
    if aws ecr describe-repositories --region "$AWS_REGION" > /dev/null 2>&1; then
        print_success "ECR permissions are working"
    else
        print_error "ECR permissions failed"
    fi
    
    echo ""
    echo "Test SSM Permissions:"
    if aws ssm describe-instance-information --region "$AWS_REGION" > /dev/null 2>&1; then
        print_success "SSM permissions are working"
    else
        print_error "SSM permissions failed"
    fi
}

# Main function
main() {
    local instance_id=${1:-$(curl -s http://169.254.169.254/latest/meta-data/instance-id)}
    
    if [ -z "$instance_id" ]; then
        print_error "No instance ID provided and could not get from metadata"
        exit 1
    fi
    
    echo "Starting debug session for instance: $instance_id"
    echo "=================================================="
    
    get_instance_info "$instance_id"
    echo ""
    
    check_system_resources
    echo ""
    
    check_docker_status
    echo ""
    
    check_application_status
    echo ""
    
    check_network_connectivity
    echo ""
    
    check_application_health
    echo ""
    
    check_iam_permissions
    echo ""
    
    check_logs
    echo ""
    
    print_header "Debug Summary"
    print_success "Debug session completed for instance: $instance_id"
    echo ""
    echo "If you found issues, please check:"
    echo "1. Docker service status"
    echo "2. Application container logs"
    echo "3. Network connectivity"
    echo "4. IAM permissions"
    echo "5. System resources"
}

# Run main function with all arguments
main "$@" 