# GoDaddy: Point api.carveo.eu to Your EC2

## 1. Get your EC2 public IP

Your EC2 hostname is: `ec2-18-224-170-67.us-east-2.compute.amazonaws.com`  
So the **public IP** is: **18.224.170.67** (use this in GoDaddy).

If the instance ever changes, get the new IP from AWS EC2 console → Instances → select instance → Public IPv4 address.

---

## 2. In GoDaddy

1. Go to [godaddy.com](https://www.godaddy.com) and sign in.
2. **My Products** → find the domain **carveo.eu** (or the parent domain you use for api.carveo.eu).
3. Click **DNS** (or **Manage DNS**) for that domain.
4. Click **Add** (or **Add Record**).
5. Add an **A** record:
   - **Type:** A  
   - **Name:** `api`  
     (This creates **api.carveo.eu**. If your domain is different, e.g. carveo.com, use `api` and you’ll get api.carveo.com.)
   - **Value:** `18.224.170.67`  
   - **TTL:** 600 (or leave default)  
   - **Proxy:** Off (no orange cloud) if you want traffic to hit your EC2 directly.
6. Save.

---

## 3. Wait for DNS

- Propagation usually **5–30 minutes**, sometimes up to 48 hours.
- Check: run `dig api.carveo.eu` or use [dnschecker.org](https://dnschecker.org) for api.carveo.eu.
- When the A record shows **18.224.170.67**, continue.

---

## 4. EC2 security group

On the EC2 instance, open:

- **Port 80** (HTTP) – for Let’s Encrypt and redirect to HTTPS.
- **Port 443** (HTTPS) – for API traffic.

In AWS: EC2 → Security Groups → select the group attached to your instance → Edit inbound rules → Add:

- Type: HTTP, Port: 80, Source: 0.0.0.0/0  
- Type: HTTPS, Port: 443, Source: 0.0.0.0/0  

Save.

---

## 5. HTTPS on EC2 (Nginx + Let’s Encrypt)

After **api.carveo.eu** resolves to **18.224.170.67** and ports 80/443 are open, run on your Mac:

```bash
cd /Users/hassanchauffeur/clean-publish
scp -i ~/.ssh/carveo-key.pem scripts/ec2-nginx-ssl.sh ubuntu@ec2-18-224-170-67.us-east-2.compute.amazonaws.com:~/
ssh -i ~/.ssh/carveo-key.pem ubuntu@ec2-18-224-170-67.us-east-2.compute.amazonaws.com 'sudo bash ~/ec2-nginx-ssl.sh'
```

Or pipe the script:

```bash
ssh -i ~/.ssh/carveo-key.pem ubuntu@ec2-18-224-170-67.us-east-2.compute.amazonaws.com 'bash -s' < scripts/ec2-nginx-ssl.sh
```

(You may need to run the script with `sudo` on the server if it prompts.)

After this, **https://api.carveo.eu/health** should return `{"status":"ok"}`.

---

## 6. Frontend (Vercel)

Set in Vercel:

- **NEXT_PUBLIC_API_URL** = `https://api.carveo.eu`

Then your frontend will call the API at api.carveo.eu.
