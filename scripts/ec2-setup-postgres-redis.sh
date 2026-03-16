#!/bin/bash
# Run on EC2 (as root or with sudo) to install Postgres + Redis, create DB, and write .env
set -e

APP_DIR=/home/ubuntu/clean-publish/ai-backend
ENV_FILE=$APP_DIR/.env

# 1. Install PostgreSQL and Redis
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq postgresql postgresql-contrib redis-server

# 2. Start and enable services
systemctl start redis-server 2>/dev/null || service redis-server start
systemctl enable redis-server 2>/dev/null || true
systemctl start postgresql 2>/dev/null || service postgresql start
systemctl enable postgresql 2>/dev/null || true

# 3. Create Postgres user and database (run as postgres user)
DB_NAME=carveo
DB_USER=carveo
# Alphanumeric password safe for connection URLs
DB_PASS="${CARVEO_DB_PASSWORD:-$(openssl rand -hex 16)}"

sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null || true

# 4. Write .env (use existing values from current .env if present)
REDIS_URL="redis://localhost:6379"
SERVER_BASE_URL="https://api.carveo.eu"
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

# Read existing API keys from .env if present (grep to avoid sourcing)
get_var() { grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | head -1 || echo ""; }
[ -f "$ENV_FILE" ] && {
  OPENAI_KEY=$(get_var OPENAI_API_KEY)
  REPLICATE_TOKEN=$(get_var REPLICATE_API_TOKEN)
  FAL_KEY=$(get_var FAL_KEY)
} || { OPENAI_KEY=""; REPLICATE_TOKEN=""; FAL_KEY=""; }

cat > "$ENV_FILE" << ENVEOF
DATABASE_URL=$DATABASE_URL
REDIS_URL=$REDIS_URL
SERVER_BASE_URL=$SERVER_BASE_URL
METADATA_PROVIDER=openai
OPENAI_API_KEY=${OPENAI_KEY:-your-openai-key}
OPENAI_METADATA_MODEL=gpt-4o-mini
IMAGE_EDIT_PROVIDER=replicate
REPLICATE_API_TOKEN=${REPLICATE_TOKEN:-your-replicate-token}
FAL_KEY=${FAL_KEY:-your-fal-key}
ENVEOF

chown ubuntu:ubuntu "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "DB_PASSWORD=$DB_PASS"
echo "DATABASE_URL=$DATABASE_URL"
echo "REDIS_URL=$REDIS_URL"
echo ".env written"
