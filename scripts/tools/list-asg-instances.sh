#!/bin/bash

# Auto Scaling Group のインスタンス一覧を表示するスクリプト
# 使用方法: ./list-asg-instances.sh [ASG_NAME]

set -e

# デフォルトのAuto Scaling Group名（実際の環境に合わせて変更）
DEFAULT_ASG_NAME="poc-ec2-autoscaling-AutoscalingConstruct-ASG-XXXXXXXXX"

# 引数からAuto Scaling Group名を取得、なければデフォルトを使用
ASG_NAME=${1:-$DEFAULT_ASG_NAME}

echo "🔍 Auto Scaling Group Information"
echo "=================================="
echo "Name: $ASG_NAME"
echo ""

# Auto Scaling Groupの基本情報を取得
ASG_INFO=$(aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "$ASG_NAME" \
  --query 'AutoScalingGroups[0]' \
  --output json 2>/dev/null || echo "")

if [ -z "$ASG_INFO" ]; then
  echo "❌ Error: Auto Scaling Group '$ASG_NAME' not found"
  echo ""
  echo "Available Auto Scaling Groups:"
  aws autoscaling describe-auto-scaling-groups \
    --query 'AutoScalingGroups[].AutoScalingGroupName' \
    --output table
  exit 1
fi

# 基本情報を表示
echo "📊 Basic Information:"
echo "Min Capacity: $(echo "$ASG_INFO" | jq -r '.MinSize')"
echo "Max Capacity: $(echo "$ASG_INFO" | jq -r '.MaxSize')"
echo "Desired Capacity: $(echo "$ASG_INFO" | jq -r '.DesiredCapacity')"
echo "Current Capacity: $(echo "$ASG_INFO" | jq -r '.Instances | length')"
echo ""

# インスタンス一覧を表示
echo "🖥️  Instance Details:"
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "$ASG_NAME" \
  --query 'AutoScalingGroups[0].Instances[?LifecycleState==`InService`].[InstanceId,HealthStatus,LaunchTemplate.Version,AvailabilityZone]' \
  --output table

echo ""
echo "📋 All Instances (including terminating):"
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "$ASG_NAME" \
  --query 'AutoScalingGroups[0].Instances.[InstanceId,LifecycleState,HealthStatus,LaunchTemplate.Version]' \
  --output table

# SSM接続可能なインスタンスを確認
echo ""
echo "🔗 SSM Connection Status:"
SSM_INSTANCES=$(aws ssm describe-instance-information \
  --query 'InstanceInformationList[?PingStatus==`Online`].InstanceId' \
  --output text 2>/dev/null || echo "")

if [ -n "$SSM_INSTANCES" ]; then
  echo "SSM Online instances:"
  for instance in $SSM_INSTANCES; do
    echo "  ✅ $instance"
  done
else
  echo "  ❌ No SSM online instances found"
fi

echo ""
echo "💡 Quick Connect Commands:"
echo "To connect to the first instance:"
echo "  aws ssm start-session --target \$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names \"$ASG_NAME\" --query 'AutoScalingGroups[0].Instances[?LifecycleState==\`InService\`].InstanceId' --output text | head -1)"
echo ""
echo "Or use the connect script:"
echo "  ./connect-to-asg.sh \"$ASG_NAME\" 0" 