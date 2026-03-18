#!/bin/bash
# Apply S3 env block to EC2 .env. Run on EC2.
# Usage: bash ec2-s3-env-apply.sh < s3-env-block.txt
# Or after scp s3-env-block.txt to EC2: bash ec2-s3-env-apply.sh < s3-env-block.txt

set -e
ENV_FILE="${ENV_FILE:-/home/ubuntu/clean-publish/ai-backend/.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env not found at $ENV_FILE"
  exit 1
fi

# Remove existing S3 block
if grep -q "STORAGE_PROVIDER=s3" "$ENV_FILE" 2>/dev/null; then
  sed -i.bak '/# --- S3 Image Storage ---/,/^S3_BUCKET=/d' "$ENV_FILE" 2>/dev/null || true
fi

# Append from stdin (s3-env-block.txt from aws-s3-setup.py)
cat >> "$ENV_FILE"
echo "Added S3 config to $ENV_FILE"
echo "Run: sudo systemctl restart carveo-backend"
