#!/bin/bash

# ValidateService hook for CodeDeploy
# This script validates that the application is running correctly

set -e

echo "Starting ValidateService hook..."

# Check if Flask app is running
if ! systemctl is-active --quiet flask-app; then
    echo "ERROR: Flask application is not running."
    exit 1
fi

# Test the application endpoint
echo "Testing application endpoint..."
for i in {1..10}; do
    if curl -f -s http://localhost:8080/ > /dev/null; then
        echo "Application is responding correctly."
        break
    else
        echo "Attempt $i: Application not responding, waiting..."
        sleep 5
    fi
    
    if [ $i -eq 10 ]; then
        echo "ERROR: Application failed to respond after 10 attempts."
        exit 1
    fi
done

# Test the health endpoint
echo "Testing health endpoint..."
if curl -f -s http://localhost:8080/api/health | grep -q "healthy"; then
    echo "Health endpoint is working correctly."
else
    echo "ERROR: Health endpoint is not working as expected."
    exit 1
fi

echo "ValidateService hook completed successfully." 