# EC2 Auto Scaling Demo - Flask Application

このディレクトリには、EC2 Auto Scaling Group で動作する Flask アプリケーションが含まれています。

## アプリケーション構成

- **app.py**: メインの Flask アプリケーション
- **templates/index.html**: Web ページのテンプレート
- **pyproject.toml**: uv による依存関係管理

## エンドポイント

- `/`: メインページ（HTML）
- `/api/health`: ヘルスチェック（JSON）
- `/api/info`: アプリケーション情報（JSON）

## ローカル開発

### 前提条件

- Python 3.8 以上
- uv

### セットアップ

```bash
# 依存関係のインストール
uv sync

# アプリケーションの起動
uv run python app.py
```

### アクセス

- http://localhost:8080

## デプロイ

このアプリケーションは、GitHub Actions と CodeDeploy を使用して EC2 Auto Scaling Group に自動デプロイされます。

## 依存関係

- Flask 2.3.3 以上
- Gunicorn 21.2.0 以上
