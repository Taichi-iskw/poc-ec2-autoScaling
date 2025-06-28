#!/bin/bash

# BeforeInstall hook for CodeDeploy
# This script runs before the application files are installed

set -e

echo "=== Starting BeforeInstall hook ==="
echo "Timestamp: $(date)"
echo "Current user: $(whoami)"
echo "Current directory: $(pwd)"
echo "Environment variables:"
env | sort

# Check if Flask app is running
if systemctl is-active --quiet flask-app; then
    echo "Stopping Flask application..."
    systemctl stop flask-app
    echo "Flask application stopped successfully"
else
    echo "Flask application is not running (this is normal for first deployment)"
fi

# Check CodeDeploy agent status
echo "=== CodeDeploy Agent Status ==="
if systemctl is-active --quiet codedeploy-agent; then
    echo "CodeDeploy agent is running"
else
    echo "WARNING: CodeDeploy agent is not running"
    systemctl status codedeploy-agent || true
fi

# Backup current application files if they exist
if [ -d "/opt/app" ]; then
    echo "Backing up current application files..."
    tar -czf /tmp/app-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /opt/app .
    echo "Backup completed: /tmp/app-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
else
    echo "No existing application directory found"
fi

# Clean up old application files
echo "Cleaning up old application files..."
rm -rf /opt/app/*
echo "Cleanup completed"

echo "=== BeforeInstall hook completed successfully ===" 