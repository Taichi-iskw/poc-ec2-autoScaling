# SSM Session Manager で Auto Scaling Group の EC2 インスタンスに接続する方法

## 概要

このドキュメントでは、Auto Scaling Group で管理されている EC2 インスタンスに SSM Session Manager を使用して接続する方法を説明します。

## 前提条件

- AWS CLI がインストールされている
- 適切な IAM 権限がある
- EC2 インスタンスに SSM エージェントがインストールされている（Amazon Linux 2 ではデフォルトでインストール済み）

## 接続方法

### 1. インスタンス ID の取得

まず、Auto Scaling Group 内のインスタンス ID を取得します：

```bash
# Auto Scaling Group名を指定してインスタンスIDを取得
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "poc-ec2-autoscaling-AutoscalingConstruct-ASG-XXXXXXXXX" \
  --query 'AutoScalingGroups[0].Instances[?LifecycleState==`InService`].InstanceId' \
  --output text
```

### 2. SSM Session Manager で接続

取得したインスタンス ID を使用して SSM Session Manager で接続します：

```bash
# 特定のインスタンスに接続
aws ssm start-session --target i-1234567890abcdef0

# または、インスタンスIDを変数に格納して接続
INSTANCE_ID=$(aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "poc-ec2-autoscaling-AutoscalingConstruct-ASG-XXXXXXXXX" \
  --query 'AutoScalingGroups[0].Instances[?LifecycleState==`InService`].InstanceId' \
  --output text | head -1)

aws ssm start-session --target $INSTANCE_ID
```

### 3. 複数インスタンスがある場合の対処法

Auto Scaling Group に複数のインスタンスがある場合：

```bash
# すべてのインスタンスIDを取得
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "poc-ec2-autoscaling-AutoscalingConstruct-ASG-XXXXXXXXX" \
  --query 'AutoScalingGroups[0].Instances[?LifecycleState==`InService`].InstanceId' \
  --output table

# 特定のインスタンスを選択して接続
aws ssm start-session --target i-1234567890abcdef0
```

## 便利なスクリプト

### インスタンス一覧表示スクリプト

```bash
#!/bin/bash
# list-asg-instances.sh

ASG_NAME="poc-ec2-autoscaling-AutoscalingConstruct-ASG-XXXXXXXXX"

echo "Auto Scaling Group: $ASG_NAME"
echo "========================"

aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "$ASG_NAME" \
  --query 'AutoScalingGroups[0].Instances[?LifecycleState==`InService`].[InstanceId,HealthStatus,LaunchTemplate.Version]' \
  --output table
```

### 自動接続スクリプト

```bash
#!/bin/bash
# connect-to-asg.sh

ASG_NAME="poc-ec2-autoscaling-AutoscalingConstruct-ASG-XXXXXXXXX"

# 最初のインスタンスに接続
INSTANCE_ID=$(aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "$ASG_NAME" \
  --query 'AutoScalingGroups[0].Instances[?LifecycleState==`InService`].InstanceId' \
  --output text | head -1)

if [ -n "$INSTANCE_ID" ]; then
  echo "Connecting to instance: $INSTANCE_ID"
  aws ssm start-session --target "$INSTANCE_ID"
else
  echo "No running instances found in Auto Scaling Group"
  exit 1
fi
```

## トラブルシューティング

### よくある問題と解決方法

1. **SSM エージェントが起動していない**

   ```bash
   # インスタンス内でSSMエージェントの状態を確認
   sudo systemctl status amazon-ssm-agent

   # SSMエージェントを起動
   sudo systemctl start amazon-ssm-agent
   sudo systemctl enable amazon-ssm-agent
   ```

2. **IAM 権限が不足している**

   - EC2 インスタンスに`AmazonSSMManagedInstanceCore`ポリシーが付与されていることを確認
   - ユーザーに`ssm:StartSession`権限があることを確認

3. **インスタンスがプライベートサブネットにある場合**
   - NAT Gateway または VPC エンドポイントが設定されていることを確認
   - セキュリティグループで SSM 通信が許可されていることを確認

### 接続テスト

```bash
# インスタンスのSSM接続状態を確認
aws ssm describe-instance-information \
  --query 'InstanceInformationList[?PingStatus==`Online`].[InstanceId,PlatformType,PlatformName]' \
  --output table
```

## セキュリティのベストプラクティス

1. **最小権限の原則**: 必要最小限の IAM 権限のみを付与
2. **セッションログ**: 重要な操作はログに記録
3. **定期的な監査**: 接続ログを定期的に確認
4. **多要素認証**: 可能な場合は MFA を有効化

## 参考リンク

- [AWS Systems Manager Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html)
- [SSM Session Manager のベストプラクティス](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-best-practices.html)
