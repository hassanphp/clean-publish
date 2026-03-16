#!/bin/bash
# Run this script ON the EC2 instance (ubuntu) to deploy the backend.
# Usage: from your Mac, after cloning repo on EC2:
#   ssh -i ~/.ssh/carveo-key.pem ubuntu@<EC2_HOST> 'bash -s' < scripts/ec2-deploy.sh
# Or SSH in and run: curl -sL <raw-url> | bash
# Or copy script to EC2 and run: bash ec2-deploy.sh

set -e
export DEBIAN_FRONTEND=noninteractive

APP_USER=ubuntu
APP_DIR=/home/ubuntu/clean-publish
BACKEND_DIR=$APP_DIR/ai-backend
VENV=$BACKEND_DIR/venv
SERVICE_NAME=carveo-backend

echo "==> Updating system and installing dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq python3-pip python3-venv python3-dev git build-essential libgl1 libglib2.0-0

echo "==> Cloning or pulling repo..."
if [ ! -d "$APP_DIR" ]; then
  git clone https://github.com/hassanphp/clean-publish.git "$APP_DIR"
else
  cd "$APP_DIR" && git pull origin main && cd -
fi

echo "==> Setting up Python venv and installing packages..."
cd "$BACKEND_DIR"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
pip install gunicorn -q

echo "==> Creating .env if missing..."
if [ ! -f "$BACKEND_DIR/.env" ]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  echo "    EDIT $BACKEND_DIR/.env with your OPENAI_API_KEY, DATABASE_URL, REDIS_URL, SERVER_BASE_URL, etc."
fi

echo "==> Running migrations (if DATABASE_URL set)..."
source "$BACKEND_DIR/.env" 2>/dev/null || true
if [ -n "$DATABASE_URL" ] && [ "$DATABASE_URL" != "sqlite:///./app.db" ]; then
  alembic upgrade head 2>/dev/null || true
else
  alembic upgrade head 2>/dev/null || true
fi

echo "==> Installing systemd service..."
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=Carveo FastAPI Backend
After=network.target

[Service]
Type=notify
User=ubuntu
Group=ubuntu
WorkingDirectory=$BACKEND_DIR
Environment=PATH=$VENV/bin
EnvironmentFile=$BACKEND_DIR/.env
ExecStart=$VENV/bin/gunicorn app.main:app -w 2 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000 --timeout 300
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME

echo "==> Backend service status:"
sudo systemctl status $SERVICE_NAME --no-pager || true
echo ""
echo "Backend is listening on 127.0.0.1:8000. Configure Nginx as reverse proxy for api.carveo.eu (see docs/DEPLOYMENT-AWS-VERCEL.md)."
