#!/bin/bash

# AfterInstall hook for CodeDeploy
# This script runs after the application files are installed

set -e

echo "=== Starting AfterInstall hook ==="
echo "Timestamp: $(date)"
echo "Current user: $(whoami)"
echo "Current directory: $(pwd)"

# Create app directory if it doesn't exist
echo "Creating app directory..."
mkdir -p /opt/app
echo "App directory created: $(ls -la /opt/app)"

# Set proper permissions for application files
echo "Setting file permissions..."
chown -R ec2-user:ec2-user /opt/app
chmod -R 755 /opt/app
echo "Permissions set: $(ls -la /opt/app)"

# Ensure uv is available in PATH
echo "Setting up uv environment..."
export PATH="$HOME/.cargo/bin:$PATH"
echo "export PATH=\"$HOME/.cargo/bin:$PATH\"" >> /etc/environment
echo "Current PATH: $PATH"

# Check if uv is available
if command -v uv &> /dev/null; then
    echo "uv is available: $(which uv)"
else
    echo "WARNING: uv is not available, will use pip"
fi

# Install Python dependencies using uv with fallback to pip
echo "Installing Python dependencies..."
cd /opt/app
echo "Current directory: $(pwd)"
echo "Files in current directory: $(ls -la)"

if [ -f "pyproject.toml" ]; then
    echo "pyproject.toml found"
    # Try uv first
    if command -v uv &> /dev/null; then
        echo "Using uv to install dependencies..."
        if uv sync --frozen; then
            echo "Dependencies installed successfully with uv"
        else
            echo "uv failed, falling back to pip..."
            pip3 install flask waitress
        fi
    else
        echo "uv not available, using pip..."
        pip3 install flask waitress
    fi
else
    echo "pyproject.toml not found, installing dependencies with pip"
    pip3 install flask waitress
fi

# Verify Python installation
echo "Verifying Python installation..."
python3 --version
pip3 list | grep -E "(flask|waitress)"

# Create systemd service file for Flask app with waitress
echo "Creating systemd service file..."
cat > /etc/systemd/system/flask-app.service << 'EOF'
[Unit]
Description=Flask Application with Waitress
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/app
Environment=PATH=/opt/app/.venv/bin:/usr/local/bin:/usr/bin:/bin
Environment=FLASK_APP=app.py
Environment=FLASK_ENV=production
Environment=INSTANCE_ID=${INSTANCE_ID}
Environment=AWS_REGION=${AWS_REGION}
ExecStart=/opt/app/.venv/bin/python app.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "Systemd service file created:"
cat /etc/systemd/system/flask-app.service

# Reload systemd daemon
echo "Reloading systemd daemon..."
systemctl daemon-reload

echo "=== AfterInstall hook completed successfully ===" 