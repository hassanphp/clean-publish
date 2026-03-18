#!/bin/bash
# Run ON EC2 to verify S3 env vars. SSH first, then:
#   cd /home/ubuntu/clean-publish/ai-backend && bash scripts/check_s3_env.sh

set -e
cd "$(dirname "$0")/.."
ENV_FILE=".env"

echo "=== S3 Config Check (EC2) ==="
echo ""

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env not found at $(pwd)/$ENV_FILE"
  exit 1
fi

echo "1. Checking .env for S3 vars (values hidden):"
for var in STORAGE_PROVIDER S3_BUCKET AWS_REGION AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY; do
  val=$(grep -E "^${var}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
  if [ -n "$val" ]; then
    echo "   $var = [SET, ${#val} chars]"
  else
    echo "   $var = [MISSING]"
  fi
done

echo ""
echo "2. Testing Python storage detection:"
python3 << 'PYEOF'
import os
import sys
sys.path.insert(0, os.getcwd())
from dotenv import load_dotenv
load_dotenv()
from app.utils.object_storage import _detect_provider, generate_presigned_upload_url

p = _detect_provider()
print(f"   _detect_provider() = '{p}'")
if p:
    url = generate_presigned_upload_url("uploads/test.jpg")
    print(f"   generate_presigned_upload_url() = {'OK' if url else 'None'}")
else:
    print("   Provider not detected - check STORAGE_PROVIDER=s3 and S3_BUCKET")
PYEOF

echo ""
echo "3. If provider is empty, ensure .env has:"
echo "   STORAGE_PROVIDER=s3"
echo "   AWS_ACCESS_KEY_ID=..."
echo "   AWS_SECRET_ACCESS_KEY=..."
echo "   AWS_REGION=us-east-2"
echo "   S3_BUCKET=carveo-images-784038766425-us-east-2-an"
echo ""
echo "4. After fixing: sudo systemctl restart carveo-backend"
