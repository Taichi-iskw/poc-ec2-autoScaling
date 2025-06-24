#!/bin/bash

# BeforeInstall hook for CodeDeploy
# This script runs before the application files are installed

set -e

echo "Starting BeforeInstall hook..."

# Stop the web server if it's running
if systemctl is-active --quiet httpd; then
    echo "Stopping Apache HTTP Server..."
    systemctl stop httpd
fi

# Backup current application files if they exist
if [ -d "/var/www/html" ]; then
    echo "Backing up current application files..."
    tar -czf /tmp/app-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /var/www/html .
fi

# Clean up old application files
echo "Cleaning up old application files..."
rm -rf /var/www/html/*

echo "BeforeInstall hook completed successfully." 