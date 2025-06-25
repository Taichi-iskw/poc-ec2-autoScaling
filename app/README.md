# EC2 Auto Scaling Demo Application

This is a Flask application designed to run on EC2 Auto Scaling Group with CodeDeploy.

## Features

- **Health Check Endpoint**: `/api/health` - Returns instance information and health status
- **Info Endpoint**: `/api/info` - Returns application information
- **Web Interface**: `/` - Simple web page showing application status

## Technology Stack

- **Framework**: Flask 2.3.3+
- **WSGI Server**: Waitress 2.1.2+ (Production-ready WSGI server)
- **Package Manager**: uv (Fast Python package manager)
- **Python Version**: 3.8+

## Development

### Local Development

```bash
# Install dependencies
uv sync

# Run development server
uv run python app.py
```

### Production Deployment

The application is configured to use **Waitress** as the WSGI server in production:

- **Waitress**: Pure Python WSGI server, production-ready
- **Threads**: 4 worker threads
- **Port**: 8080
- **Host**: 0.0.0.0 (all interfaces)

### Why Waitress?

- **Pure Python**: No external dependencies, easier deployment
- **Production Ready**: Stable and reliable for production workloads
- **Cross Platform**: Works on Windows, Linux, and macOS
- **Simple Configuration**: Minimal configuration required
- **Good Performance**: Suitable for moderate traffic loads

## Deployment

The application is automatically deployed using:

1. **CodeDeploy**: Handles application deployment to EC2 instances
2. **Systemd Service**: Manages application lifecycle
3. **Auto Scaling**: Automatically scales based on CPU usage

## Environment Variables

- `INSTANCE_ID`: EC2 instance ID (automatically set)
- `AWS_REGION`: AWS region (automatically set)
- `FLASK_ENV`: Set to 'production' in deployment

## API Endpoints

### Health Check

```
GET /api/health
```

Response:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00",
  "instance_id": "i-1234567890abcdef0",
  "region": "us-east-1"
}
```

### Application Info

```
GET /api/info
```

Response:

```json
{
  "app_name": "EC2 Auto Scaling Demo",
  "version": "1.0.0",
  "description": "Flask application running on EC2 Auto Scaling Group",
  "features": ["Auto Scaling", "Load Balancer", "CodeDeploy", "GitHub Actions CI/CD"]
}
```
