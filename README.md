# EC2 Auto Scaling Infrastructure with CDK

このプロジェクトは、AWS CDK TypeScript を使用して EC2 Auto Scaling インフラストラクチャを構築する POC です。

## インフラ構成

### 主要コンポーネント

1. **VPC**

   - パブリック/プライベートサブネット分離
   - NAT Gateway（コスト最適化のため 1 つ）

2. **EC2 Auto Scaling Group**

   - 最小 2 台、最大 10 台のインスタンス
   - CPU 使用率 70%でスケールアウト
   - プライベートサブネットに配置

3. **Application Load Balancer (ALB)**

   - HTTPS（443）のみ外部公開
   - ACM 証明書で SSL 化
   - ヘルスチェック設定済み

4. **Route 53**

   - ドメイン管理・DNS ルーティング
   - ALB へのエイリアスレコード

5. **S3**

   - デプロイ用アーティファクト保存バケット
   - バージョニング有効
   - 30 日後に古いバージョンを削除

6. **CodeDeploy**

   - S3 のアーティファクトを EC2 Auto Scaling グループにデプロイ
   - ローリングアップデート対応
   - 自動ロールバック機能

7. **Systems Manager (SSM)**

   - EC2 へのセッションマネージャー接続
   - パラメータ管理

8. **CloudWatch Logs**
   - EC2/ALB 等のログ出力
   - 1 ヶ月間保持

### セキュリティ・権限

- **EC2 の IAM ロール**: S3・SSM・CloudWatch Logs へのアクセス権限
- **セキュリティグループ**:
  - EC2: ALB からのトラフィックのみ許可
  - ALB: 443（HTTPS）のみインバウンド許可
  - SSH は開放せず、SSM 経由でのみアクセス
- **GitHub Actions 用 OIDC ロール**: OIDC で GitHub Actions から AWS に安全にアクセス

## セットアップ手順

### 前提条件

- Node.js 18 以上
- AWS CLI 設定済み
- AWS CDK CLI インストール済み

### 1. 依存関係のインストール

```bash
npm install
```

### 2. CDK ブートストラップ（初回のみ）

```bash
cdk bootstrap
```

### 3. 環境変数の設定

`cdk.json`の context セクションで以下の値を設定：

```json
{
  "context": {
    "domainName": "your-domain.com",
    "appName": "your-app-name"
  }
}
```

### 4. インフラのデプロイ

```bash
# 差分確認
cdk diff

# デプロイ
cdk deploy --all
```

### 5. GitHub Actions 設定

1. GitHub リポジトリの Secrets に以下を追加：

   - `AWS_ROLE_ARN`: CDK デプロイ後に出力される GitHub Actions ロールの ARN

2. GitHub Actions ワークフローが自動的にデプロイを実行します。

## ファイル構成

```
├── bin/
│   └── poc-ec2-autoscaling.ts          # CDKアプリケーションエントリーポイント
├── lib/
│   ├── poc-ec2-autoscaling-stack.ts    # メインインフラスタック
│   └── github-actions-oidc-stack.ts    # GitHub Actions OIDCスタック
├── scripts/                            # 各種スクリプト
│   ├── codedeploy/                    # CodeDeploy用スクリプト
│   │   ├── before_install.sh
│   │   ├── after_install.sh
│   │   ├── start_application.sh
│   │   └── validate_service.sh
│   └── tools/                         # 作業効率化スクリプト
│       ├── connect-to-asg.sh          # SSM接続スクリプト
│       ├── list-asg-instances.sh      # インスタンス一覧表示スクリプト
│       └── create-oidc-provider.sh    # OIDCプロバイダー作成補助
├── docs/
│   └── ssm-connection-guide.md        # SSM接続ガイド
├── .github/workflows/
│   └── deploy.yml                      # GitHub Actionsワークフロー
├── appspec.yml                         # CodeDeploy設定
├── index.html                          # サンプルWebアプリケーション
├── package.json
├── tsconfig.json
├── cdk.json
└── README.md
```

## SSM Session Manager での接続

### 基本的な接続方法

Auto Scaling Group の EC2 インスタンスに SSM Session Manager で接続できます：

```bash
# インスタンス一覧を表示
./scripts/list-asg-instances.sh

# 最初のインスタンスに接続
./scripts/connect-to-asg.sh

# 特定のインスタンスに接続（インデックス指定）
./scripts/connect-to-asg.sh "ASG_NAME" 1
```

### 手動での接続

```bash
# Auto Scaling Group内のインスタンスIDを取得
INSTANCE_ID=$(aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "your-asg-name" \
  --query 'AutoScalingGroups[0].Instances[?LifecycleState==`InService`].InstanceId' \
  --output text | head -1)

# SSM Session Managerで接続
aws ssm start-session --target $INSTANCE_ID
```

### 接続の前提条件

- EC2 インスタンスに`AmazonSSMManagedInstanceCore`ポリシーが付与されている
- インスタンスがインターネットにアクセス可能（NAT Gateway または VPC エンドポイント）
- ユーザーに`ssm:StartSession`権限がある

詳細な接続方法は[SSM 接続ガイド](docs/ssm-connection-guide.md)を参照してください。

## デプロイメントフロー

1. **GitHub Actions**がコード変更を検知
2. アプリケーションをビルド・パッケージ化
3. S3 バケットにアーティファクトをアップロード
4. OIDC ロールで AWS に認証
5. CodeDeploy で EC2 Auto Scaling グループにデプロイ
6. デプロイメント検証

## 運用・監視

### CloudWatch Logs

- アプリケーションログ: `/aws/ec2/{appName}`
- ALB ログ: 自動的に有効化

### Auto Scaling

- CPU 使用率 70%でスケールアウト
- スケールイン/アウトのクールダウン時間設定済み

### セキュリティ

- SSH ポートは閉鎖
- SSM Session Manager 経由でのみ EC2 アクセス
- 最小権限の原則に従った IAM ロール

## コスト最適化

- NAT Gateway を 1 つに制限
- Auto Scaling でインスタンス数を動的調整
- S3 ライフサイクルルールで古いバージョンを自動削除

## トラブルシューティング

### よくある問題

1. **デプロイメント失敗**

   - CodeDeploy ログを確認
   - EC2 インスタンスのヘルスチェック状態を確認

2. **Auto Scaling が動作しない**

   - CloudWatch メトリクスを確認
   - Auto Scaling ポリシーの設定を確認

3. **SSL 証明書エラー**

   - ACM 証明書の検証状態を確認
   - Route 53 の設定を確認

4. **SSM 接続できない**
   - インスタンスの SSM エージェント状態を確認
   - IAM 権限を確認
   - ネットワーク設定（NAT Gateway/VPC エンドポイント）を確認

## ライセンス

MIT License
