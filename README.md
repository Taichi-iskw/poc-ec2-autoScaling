# EC2 Auto Scaling Infrastructure with CDK (Docker + ECR)

このプロジェクトは、AWS CDK TypeScript を使用して EC2 Auto Scaling インフラストラクチャを構築する POC です。Docker コンテナと ECR を使用したモダンなデプロイメント構成を採用しています。

## インフラ構成

### 主要コンポーネント

1. **VPC**

   - パブリック/プライベートサブネット分離
   - NAT Gateway（コスト最適化のため 1 つ）

2. **EC2 Auto Scaling Group**

   - 最小 2 台、最大 10 台のインスタンス
   - CPU 使用率 70%でスケールアウト
   - プライベートサブネットに配置
   - Docker コンテナでアプリケーション実行

3. **Application Load Balancer (ALB)**

   - HTTPS（443）のみ外部公開
   - ACM 証明書で SSL 化
   - ヘルスチェック設定済み

4. **Route 53**

   - ドメイン管理・DNS ルーティング
   - ALB へのエイリアスレコード

5. **ECR (Elastic Container Registry)**

   - Docker イメージの保存・管理
   - イメージスキャン有効
   - ライフサイクルポリシー（古いイメージの自動削除）

6. **Systems Manager (SSM)**

   - EC2 へのセッションマネージャー接続
   - SSM コマンドによるデプロイメント
   - パラメータ管理

7. **CloudWatch Logs**
   - EC2/ALB 等のログ出力
   - 1 ヶ月間保持

### アプリケーション技術スタック

- **Web Framework**: Flask 3.0.0+
- **WSGI Server**: Waitress 3.0.0+ (本番環境用)
- **Container**: Docker
- **Container Orchestration**: Docker Compose
- **Python Version**: 3.11+

**Docker の利点:**

- 環境の一貫性
- 簡単なスケーリング
- 高速なデプロイメント
- 依存関係の分離
- 本番環境との差異の最小化

### セキュリティ・権限

- **EC2 の IAM ロール**: ECR・SSM・CloudWatch Logs へのアクセス権限
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
- Docker（ローカル開発用）

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
│   ├── oidc-for-github.ts              # GitHub Actions OIDC設定
│   └── construct/                      # CDK Constructs
│       ├── ecr-construct.ts            # ECR Construct
│       ├── network-construct.ts        # VPC/Network Construct
│       ├── iam-construct.ts            # IAM Construct
│       ├── ec2-construct.ts            # EC2 Construct
│       ├── autoscaling-construct.ts    # Auto Scaling Construct
│       ├── loadbalancer-construct.ts   # ALB Construct
│       ├── dns-construct.ts            # Route 53 Construct
│       └── monitoring-construct.ts     # CloudWatch Construct
├── app/                                # アプリケーションコード
│   ├── app.py                          # Flask アプリケーション
│   ├── templates/                      # HTML テンプレート
│   ├── Dockerfile                      # Docker イメージ定義
│   ├── docker-compose.yml              # Docker Compose 設定
│   ├── requirements.txt                # Python 依存関係
│   └── .dockerignore                   # Docker 除外ファイル
├── scripts/                            # 各種スクリプト
│   ├── deploy.sh                       # ローカルデプロイスクリプト
│   ├── ec2-deploy.sh                   # EC2 デプロイスクリプト
│   └── tools/                          # 作業効率化スクリプト
│       ├── connect-to-asg.sh           # SSM接続スクリプト
│       ├── list-asg-instances.sh       # インスタンス一覧表示スクリプト
│       └── create-oidc-provider.sh     # OIDCプロバイダー作成補助
├── docs/
│   └── ssm-connection-guide.md         # SSM接続ガイド
├── .github/workflows/
│   └── deploy.yml                      # GitHub Actionsワークフロー
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
2. Docker イメージをビルド
3. ECR にイメージをプッシュ
4. SSM コマンドで Auto Scaling Group の各インスタンスにデプロイ
5. 各インスタンスで Docker コンテナを更新・再起動

## ローカル開発

### Docker での実行

```bash
# アプリケーションをビルド
cd app
docker build -t poc-app .

# Docker Compose で実行
docker-compose up -d

# アプリケーションにアクセス
curl http://localhost:8080/api/health
```

### 手動デプロイ

```bash
# 環境変数を設定
export APP_NAME="myapp"
export AWS_REGION="ap-northeast-1"
export ECR_REPOSITORY_URI="your-ecr-repository-uri"
export IMAGE_TAG="latest"

# デプロイスクリプトを実行
./scripts/deploy.sh
```

## トラブルシューティング

### よくある問題

1. **ECR ログインエラー**

   - EC2 インスタンスの IAM ロールに ECR 権限があることを確認
   - リージョンが正しく設定されていることを確認

2. **Docker コンテナが起動しない**

   - SSM でインスタンスに接続してログを確認
   - `docker logs <container-name>` でコンテナログを確認

3. **ヘルスチェックが失敗する**
   - アプリケーションが正しく起動していることを確認
   - ポート 8080 が正しく公開されていることを確認

### ログの確認

```bash
# EC2 インスタンスに接続
./scripts/connect-to-asg.sh

# Docker コンテナのログを確認
docker logs myapp-app

# アプリケーションログを確認
docker exec myapp-app tail -f /var/log/app.log
```

## ライセンス

MIT License
