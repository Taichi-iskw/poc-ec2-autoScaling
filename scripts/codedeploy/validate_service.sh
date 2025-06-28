#!/bin/bash

# ValidateService hook for CodeDeploy
# This script validates that the application is running correctly

set -e

echo "Starting ValidateService hook..."

# Check if Flask app is running
if ! systemctl is-active --quiet flask-app; then
    echo "ERROR: Flask application is not running."
    echo "Checking service status:"
    systemctl status flask-app --no-pager -l
    echo "Checking service logs:"
    journalctl -u flask-app --no-pager -l -n 50
    exit 1
fi

echo "Flask application is running. Checking service logs:"
journalctl -u flask-app --no-pager -l -n 10

# Test the application endpoint
echo "Testing application endpoint..."
for i in {1..15}; do
    echo "Attempt $i: Testing http://localhost:8080/"
    if curl -f -s http://localhost:8080/ > /dev/null; then
        echo "Application is responding correctly."
        break
    else
        echo "Attempt $i: Application not responding, waiting..."
        sleep 3
    fi
    
    if [ $i -eq 15 ]; then
        echo "ERROR: Application failed to respond after 15 attempts."
        echo "Checking service status:"
        systemctl status flask-app --no-pager -l
        echo "Checking service logs:"
        journalctl -u flask-app --no-pager -l -n 50
        exit 1
    fi
done

# Test the health endpoint
echo "Testing health endpoint..."
for i in {1..5}; do
    echo "Attempt $i: Testing http://localhost:8080/api/health"
    response=$(curl -f -s http://localhost:8080/api/health)
    if echo "$response" | grep -q "healthy"; then
        echo "Health endpoint is working correctly."
        echo "Health response: $response"
        break
    else
        echo "Attempt $i: Health endpoint not working as expected."
        echo "Response: $response"
        sleep 2
    fi
    
    if [ $i -eq 5 ]; then
        echo "ERROR: Health endpoint failed after 5 attempts."
        exit 1
    fi
done

echo "ValidateService hook completed successfully." 