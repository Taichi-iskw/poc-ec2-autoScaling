#!/bin/bash

# GitHub Actions OIDC Provider 作成スクリプト
# 使用方法: ./scripts/create-oidc-provider.sh

set -e

echo "Creating GitHub Actions OIDC Provider..."

# OIDCプロバイダーが既に存在するかチェック
if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):oidc-provider/token.actions.githubusercontent.com" >/dev/null 2>&1; then
    echo "OIDC Provider already exists. Skipping creation."
else
    echo "Creating new OIDC Provider..."
    
    # GitHub Actions OIDCプロバイダーを作成
    aws iam create-open-id-connect-provider \
        --url "https://token.actions.githubusercontent.com" \
        --client-id-list "sts.amazonaws.com" \
        --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1"
    
    echo "OIDC Provider created successfully!"
fi

echo "OIDC Provider ARN: arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):oidc-provider/token.actions.githubusercontent.com" 