#!/bin/bash

# ValidateService hook for CodeDeploy
# This script validates that the application is running correctly

set -e

echo "Starting ValidateService hook..."

# Check if Apache is running
if ! systemctl is-active --quiet httpd; then
    echo "ERROR: Apache HTTP Server is not running."
    exit 1
fi

# Test the application endpoint
echo "Testing application endpoint..."
for i in {1..10}; do
    if curl -f -s http://localhost/ > /dev/null; then
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

# Check if the application is serving the expected content
if curl -s http://localhost/ | grep -q "Hello from EC2 Auto Scaling Group"; then
    echo "Application content is correct."
else
    echo "ERROR: Application content is not as expected."
    exit 1
fi

echo "ValidateService hook completed successfully." 