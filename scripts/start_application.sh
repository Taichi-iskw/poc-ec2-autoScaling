#!/bin/bash

# ApplicationStart hook for CodeDeploy
# This script runs to start the application

set -e

echo "Starting ApplicationStart hook..."

# Start Apache HTTP Server
echo "Starting Apache HTTP Server..."
systemctl start httpd
systemctl enable httpd

# Verify the service is running
if systemctl is-active --quiet httpd; then
    echo "Apache HTTP Server started successfully."
else
    echo "Failed to start Apache HTTP Server."
    exit 1
fi

# Wait a moment for the service to fully start
sleep 5

echo "ApplicationStart hook completed successfully." 