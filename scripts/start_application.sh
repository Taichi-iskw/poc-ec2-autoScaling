#!/bin/bash

# ApplicationStart hook for CodeDeploy
# This script runs to start the application

set -e

echo "Starting ApplicationStart hook..."

# Start Flask application
echo "Starting Flask application..."
systemctl start flask-app
systemctl enable flask-app

# Verify the service is running
if systemctl is-active --quiet flask-app; then
    echo "Flask application started successfully."
else
    echo "Failed to start Flask application."
    exit 1
fi

# Wait a moment for the service to fully start
sleep 5

echo "ApplicationStart hook completed successfully." 