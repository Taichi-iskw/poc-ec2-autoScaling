#!/bin/bash

# BeforeInstall hook for CodeDeploy
# This script runs before the application files are installed

set -e

echo "Starting BeforeInstall hook..."

# Stop the Flask application if it's running
if systemctl is-active --quiet flask-app; then
    echo "Stopping Flask application..."
    systemctl stop flask-app
fi

# Backup current application files if they exist
if [ -d "/opt/app" ]; then
    echo "Backing up current application files..."
    tar -czf /tmp/app-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /opt/app .
fi

# Clean up old application files
echo "Cleaning up old application files..."
rm -rf /opt/app/*

echo "BeforeInstall hook completed successfully." 