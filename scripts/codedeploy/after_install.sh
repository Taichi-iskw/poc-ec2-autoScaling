#!/bin/bash

# AfterInstall hook for CodeDeploy
# This script runs after the application files are installed

set -e

echo "Starting AfterInstall hook..."

# Create app directory if it doesn't exist
mkdir -p /opt/app

# Set proper permissions for application files
echo "Setting file permissions..."
chown -R ec2-user:ec2-user /opt/app
chmod -R 755 /opt/app

# Install uv if not already installed
if ! command -v uv &> /dev/null; then
    echo "Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    source /home/ec2-user/.cargo/env
fi

# Install Python dependencies using uv
echo "Installing Python dependencies with uv..."
cd /opt/app
if [ -f "pyproject.toml" ]; then
    # Use uv to install dependencies
    uv sync --frozen
fi

# Create systemd service file for Flask app
echo "Creating systemd service file..."
cat > /etc/systemd/system/flask-app.service << 'EOF'
[Unit]
Description=Flask Application
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/app
Environment=PATH=/opt/app/.venv/bin:/usr/local/bin:/usr/bin:/bin
Environment=FLASK_APP=app.py
Environment=FLASK_ENV=production
ExecStart=/opt/app/.venv/bin/gunicorn --bind 0.0.0.0:8080 app:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd daemon
systemctl daemon-reload

echo "AfterInstall hook completed successfully." 