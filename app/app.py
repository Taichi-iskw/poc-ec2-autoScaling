from flask import Flask, render_template, jsonify
import os
from datetime import datetime

app = Flask(__name__, template_folder="templates")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/health")
def health():
    return jsonify(
        {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "instance_id": os.environ.get("INSTANCE_ID", "unknown"),
            "region": os.environ.get("AWS_REGION", "unknown"),
        }
    )


@app.route("/api/info")
def info():
    return jsonify(
        {
            "app_name": "EC2 Auto Scaling Demo",
            "version": "1.0.0",
            "description": "Flask application running on EC2 Auto Scaling Group",
            "features": [
                "Auto Scaling",
                "Load Balancer",
                "CodeDeploy",
                "GitHub Actions CI/CD",
            ],
        }
    )


if __name__ == "__main__":
    # Use waitress for production deployment
    from waitress import serve

    print("Starting Flask application with Waitress server...")
    print(f"Instance ID: {os.environ.get('INSTANCE_ID', 'unknown')}")
    print(f"AWS Region: {os.environ.get('AWS_REGION', 'unknown')}")
    serve(app, host="0.0.0.0", port=8080, threads=4)
