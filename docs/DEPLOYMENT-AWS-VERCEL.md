# Deploy: Backend on AWS EC2, Frontend on Vercel

## Backend workload summary

- **FastAPI** + LangGraph, SSE streaming, async job processing (V6/V7 webhooks).
- **Memory-heavy:** Base64 images in memory, OpenCV/PIL (numpy), multiple images per batch.
- **CPU:** Image resize/crop (OpenCV), studio analysis (OpenAI), external APIs (Replicate, Fal, Vertex).
- **External:** Redis (job pub/sub), DB (SQLite or Postgres), optional GCS.

---

## EC2 instance recommendation (production-safe)

| Traffic / users      | Instance type   | vCPU | RAM  | Use when                          |
|----------------------|-----------------|------|------|-----------------------------------|
| **Low (1–5 concurrent)** | **t3.medium**   | 2    | 4 GB | MVP, demos, light production       |
| **Recommended**      | **t3.large**    | 2    | 8 GB | Stable production, 5–15 concurrent |
| **Higher**            | **t3.xlarge**   | 4    | 16 GB| 15+ concurrent, heavy batches     |

**Recommendation: start with t3.large** so the app doesn’t OOM or CPU-starve under normal production load. Move to t3.xlarge if you see high CPU or memory in CloudWatch.

- **Why not t3.micro/small:** Too little RAM for multiple in-flight image batches (base64 + OpenCV); risk of OOM and crashes.
- **t3.large:** Enough headroom for several concurrent `/api/v1/process-batch` streams and async jobs without breaking.
- **Burstable (t3):** Good cost/performance; if you need sustained high CPU, consider **c6i.large** (compute-optimized) or **m6i.large** (balanced).

---

## Production run on EC2 (don’t use single uvicorn)

Single process is a single point of failure and uses only one CPU. Use **Gunicorn + Uvicorn workers**:

```bash
# Install
pip install gunicorn

# Run (adjust workers to 2 x num_cores; for t3.large, 2–4 workers)
gunicorn app.main:app -w 2 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 --timeout 300
```

- **-w 2:** 2 worker processes (use 2–4 for t3.large; don’t exceed ~2x vCPUs with this I/O-heavy app).
- **--timeout 300:** Long-running SSE and image processing (increase if batches are very large).

Optional env (e.g. in `.env` or systemd):

```bash
export WEB_CONCURRENCY=2   # same as -w if you use Gunicorn’s default
```

---

## EC2 setup checklist

1. **AMI:** Amazon Linux 2023 or Ubuntu 22.04.
2. **Security group:** Inbound 80 (HTTP), 443 (HTTPS), 22 (SSH); restrict 22 to your IP.
3. **Put backend behind HTTPS:** Use **Application Load Balancer (ALB)** + ACM certificate, or Nginx/Caddy on the instance with Let’s Encrypt. ALB is preferred so the app only sees HTTP from the ALB.
4. **Redis:** Use **ElastiCache for Redis** (single node is enough to start) or install Redis on the same EC2 for dev/low cost (not ideal for scaling).
5. **Database:** Prefer **RDS (Postgres)** for production; set `DATABASE_URL`. SQLite on EC2 is possible but not recommended for concurrent writes.
6. **Env vars on EC2:** `OPENAI_API_KEY`, `DATABASE_URL`, `REDIS_URL`, `SERVER_BASE_URL` (your backend base URL for webhooks), optional `GCS_BUCKET` / GCP creds.

---

## Domain: api.carveo.eu (GoDaddy DNS)

1. **Log in to GoDaddy:** [godaddy.com](https://www.godaddy.com) → My Products → DNS (for carveo.eu or the domain that will host api.carveo.eu).
2. **Add A record:**
   - **Type:** A  
   - **Name:** `api` (subdomain; full name will be api.carveo.eu)  
   - **Value:** Your EC2 public IP (e.g. `18.224.170.67`)  
   - **TTL:** 600 (or default)  
   - Save.
3. **Wait for DNS:** 5–30 minutes (up to 48 hours in rare cases). Check with `dig api.carveo.eu` or [dnschecker.org](https://dnschecker.org).
4. **HTTPS on EC2:** After the A record resolves, run the Nginx + Let's Encrypt script on the server (see **Scripts** below) so `https://api.carveo.eu` works.
5. **Frontend:** Set `NEXT_PUBLIC_API_URL=https://api.carveo.eu` in Vercel.

---

## Scripts (run on EC2)

- **Deploy backend:** From your Mac:  
  `ssh -i ~/.ssh/carveo-key.pem ubuntu@ec2-18-224-170-67.us-east-2.compute.amazonaws.com 'bash -s' < scripts/ec2-deploy.sh`  
  Then on EC2 edit `/home/ubuntu/clean-publish/ai-backend/.env` with your keys and run `sudo systemctl restart carveo-backend`.
- **Nginx + SSL for api.carveo.eu:** After DNS points to the EC2 IP:  
  Copy `scripts/ec2-nginx-ssl.sh` to the server and run with `sudo bash ec2-nginx-ssl.sh`, or pipe via SSH.

---

## Vercel (frontend)

1. **Connect repo:** Import the repo; set root to **ai-frontend** (or use a monorepo config).
2. **Env var:** In Vercel project → Settings → Environment Variables, add:  
   `NEXT_PUBLIC_API_URL` = `https://api.carveo.eu`  
   (Required so the frontend calls the remote backend.)
3. **Local:** `ai-frontend/.env.example` and `.env.local` are set to `https://api.carveo.eu`; `npm run dev` uses the remote API.
4. **CORS:** Backend allows `https://api.carveo.eu`, `https://carveo.eu`, `https://www.carveo.eu` and your Vercel origin; add more in `_cors_origins` in `ai-backend/app/main.py` if needed.

---

## Cost (rough, us-east-1)

| Item        | Option              | Approx monthly |
|------------|---------------------|----------------|
| EC2        | t3.large on-demand  | ~\$60          |
| EC2        | t3.large 1-yr reserved | ~\$35–40    |
| ALB        | 1 ALB               | ~\$20          |
| RDS        | db.t3.micro Postgres| ~\$15          |
| ElastiCache| cache.t3.micro Redis| ~\$12          |
| Vercel     | Pro if needed       | ~\$20          |

Backend-only (EC2 + ALB + RDS + Redis) ≈ **\$100–110/mo**; reduce with reserved instances and single-AZ RDS/Redis if acceptable.

---

## Summary

- **EC2:** Use **t3.large** (2 vCPU, 8 GB RAM) so the backend doesn’t break under normal production load; run with **Gunicorn + Uvicorn workers** (e.g. 2–4 workers) and a 300s timeout.
- **Frontend:** Deploy on **Vercel** with `NEXT_PUBLIC_API_URL` pointing at your HTTPS backend. Backend CORS allows `*.vercel.app` and carveo.eu.

---

## Deployment checklist (continue after backend is live)

1. **Backend (EC2)** – Done: api.carveo.eu, Postgres, Redis, HTTPS, admin user seeded.
2. **Frontend (Vercel)**  
   - Import repo, set root to **ai-frontend**.  
   - Add env: **NEXT_PUBLIC_API_URL** = `https://api.carveo.eu`.  
   - Deploy. CORS allows any `https://*.vercel.app` origin.
3. **Login** – Use seeded admin: **dealer@domain.com** / **Admin@321** (100 credits).
4. **Custom domain (optional)** – In Vercel, add carveo.eu or www.carveo.eu and point DNS as instructed.
5. **413 Payload Too Large** – Nginx on EC2 is set to `client_max_body_size 100M` so process-batch with multiple base64 images succeeds. If you still see 413 with many large images, increase it in `/etc/nginx/sites-available/carveo-api` and `sudo systemctl reload nginx`.

6. **API keys on EC2** – Required to fix **"Incorrect API key provided"** / fallback metadata errors. On the server edit `/home/ubuntu/clean-publish/ai-backend/.env` and set:
   - **OPENAI_API_KEY** – Your real key from [platform.openai.com](https://platform.openai.com/account/api-keys) (used for image metadata and V11 pipeline). The placeholder `your-openai-key` will cause 401 errors.
   - **REPLICATE_API_TOKEN**, **FAL_KEY** – For image editing if you use those providers.
   Then run: `sudo systemctl restart carveo-backend`.
