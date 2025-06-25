#!/bin/bash

# Auto Scaling Group の EC2 インスタンスに SSM Session Manager で接続するスクリプト
# 使用方法: ./connect-to-asg.sh [ASG_NAME] [INSTANCE_INDEX]

set -e

# デフォルトのAuto Scaling Group名（実際の環境に合わせて変更）
DEFAULT_ASG_NAME="poc-ec2-autoscaling-AutoscalingConstruct-ASG-XXXXXXXXX"

# 引数からAuto Scaling Group名を取得、なければデフォルトを使用
ASG_NAME=${1:-$DEFAULT_ASG_NAME}
INSTANCE_INDEX=${2:-0}  # デフォルトは最初のインスタンス

echo "Auto Scaling Group: $ASG_NAME"
echo "Target instance index: $INSTANCE_INDEX"
echo "================================"

# Auto Scaling Groupの存在確認
ASG_EXISTS=$(aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "$ASG_NAME" \
  --query 'AutoScalingGroups[0].AutoScalingGroupName' \
  --output text 2>/dev/null || echo "")

if [ -z "$ASG_EXISTS" ]; then
  echo "❌ Error: Auto Scaling Group '$ASG_NAME' not found"
  echo ""
  echo "Available Auto Scaling Groups:"
  aws autoscaling describe-auto-scaling-groups \
    --query 'AutoScalingGroups[].AutoScalingGroupName' \
    --output table
  exit 1
fi

# インスタンス一覧を取得
echo "📋 Available instances:"
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "$ASG_NAME" \
  --query 'AutoScalingGroups[0].Instances[?LifecycleState==`InService`].[InstanceId,HealthStatus,LaunchTemplate.Version]' \
  --output table

# 指定されたインデックスのインスタンスIDを取得
INSTANCE_ID=$(aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "$ASG_NAME" \
  --query "AutoScalingGroups[0].Instances[?LifecycleState==\`InService\`].InstanceId" \
  --output text | tr '\t' '\n' | sed -n "$((INSTANCE_INDEX + 1))p")

if [ -z "$INSTANCE_ID" ]; then
  echo "❌ Error: No instance found at index $INSTANCE_INDEX"
  echo "Available instances:"
  aws autoscaling describe-auto-scaling-groups \
    --auto-scaling-group-names "$ASG_NAME" \
    --query 'AutoScalingGroups[0].Instances[?LifecycleState==`InService`].InstanceId' \
    --output table
  exit 1
fi

echo ""
echo "🔗 Connecting to instance: $INSTANCE_ID"
echo "Press Ctrl+C to exit the session"
echo "================================"

# SSM Session Managerで接続
aws ssm start-session --target "$INSTANCE_ID" 