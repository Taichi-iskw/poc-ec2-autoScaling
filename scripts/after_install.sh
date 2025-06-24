#!/bin/bash

# AfterInstall hook for CodeDeploy
# This script runs after the application files are installed

set -e

echo "Starting AfterInstall hook..."

# Set proper permissions for web files
echo "Setting file permissions..."
chown -R apache:apache /var/www/html
chmod -R 755 /var/www/html

# Create necessary directories if they don't exist
mkdir -p /var/log/application
chown apache:apache /var/log/application

# Configure Apache if needed
if [ ! -f /etc/httpd/conf.d/app.conf ]; then
    echo "Creating Apache configuration..."
    cat > /etc/httpd/conf.d/app.conf << 'EOF'
<VirtualHost *:80>
    DocumentRoot /var/www/html
    ServerName localhost
    
    <Directory /var/www/html>
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog /var/log/application/error.log
    CustomLog /var/log/application/access.log combined
</VirtualHost>
EOF
fi

echo "AfterInstall hook completed successfully." 