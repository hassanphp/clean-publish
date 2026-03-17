#!/bin/bash
# Run ON EC2 after DNS for api.carveo.eu points to this server.
# Sets up Nginx reverse proxy and Let's Encrypt SSL.
# Usage: ssh ... 'bash -s' < scripts/ec2-nginx-ssl.sh
# Or: sudo bash ec2-nginx-ssl.sh

set -e
DOMAIN=api.carveo.eu

echo "==> Installing Nginx and Certbot..."
sudo apt-get update -qq
sudo apt-get install -y -qq nginx certbot python3-certbot-nginx

echo "==> Configuring Nginx for $DOMAIN (HTTP first for cert issuance)..."
sudo tee /etc/nginx/sites-available/carveo-api > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 100M;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        client_max_body_size 100M;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/carveo-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "==> Obtaining SSL certificate (ensure $DOMAIN A record points to this server)..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email || true

echo "==> Done. Test: https://$DOMAIN/health"
sudo systemctl status nginx --no-pager || true
