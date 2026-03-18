# S3 Setup – Manual (No AWS CLI Required)

Do everything in the AWS Console in your browser, then edit `.env` on EC2.

---

## Step 1: Create IAM Policy (2 min)

1. Open [IAM → Policies](https://console.aws.amazon.com/iam/home#/policies)
2. **Create policy** → **JSON** tab → paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
    "Resource": [
      "arn:aws:s3:::carveo-images-784038766425-us-east-2-an",
      "arn:aws:s3:::carveo-images-784038766425-us-east-2-an/*"
    ]
  }]
}
```

3. **Next** → Policy name: `CarveoS3Storage` → **Create policy**

---

## Step 2: Create IAM User + Access Keys (2 min)

1. [IAM → Users](https://console.aws.amazon.com/iam/home#/users) → **Create user**
2. User name: `carveo-storage` → **Next**
3. **Attach policies directly** → search `CarveoS3Storage` → select it → **Next** → **Create user**
4. Open user `carveo-storage` → **Security credentials** → **Create access key**
5. Use case: **Application running outside AWS** → **Next** → **Create access key**
6. **Copy Access Key ID and Secret Access Key** (secret shown only once – save it)

---

## Step 3: Configure CORS on Bucket (1 min)

1. [S3 → Buckets](https://s3.console.aws.amazon.com/s3/buckets) → open `carveo-images-784038766425-us-east-2-an`
2. **Permissions** → **Cross-origin resource sharing (CORS)** → **Edit** → paste:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": [
      "https://carveo.eu",
      "https://www.carveo.eu",
      "https://*.vercel.app",
      "http://localhost:3000"
    ],
    "ExposeHeaders": ["ETag"]
  }
]
```

3. **Save changes**

---

## Step 4: Add to EC2 .env

SSH to EC2 and edit `.env`:

```bash
ssh -i ~/.ssh/carveo-key.pem ubuntu@ec2-18-224-170-67.us-east-2.compute.amazonaws.com

nano /home/ubuntu/clean-publish/ai-backend/.env
```

Add at the end (replace with your real keys from Step 2):

```
# --- S3 Image Storage ---
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=AKIA...your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-2
S3_BUCKET=carveo-images-784038766425-us-east-2-an
```

Save: **Ctrl+O**, **Enter**, **Ctrl+X**

---

## Step 5: Restart Backend

```bash
sudo systemctl restart carveo-backend
```

---

## Step 6: Verify on EC2

SSH and run the diagnostic script:

```bash
ssh -i ~/.ssh/carveo-key.pem ubuntu@ec2-18-224-170-67.us-east-2.compute.amazonaws.com

cd /home/ubuntu/clean-publish && git pull
cd ai-backend && bash scripts/check_s3_env.sh
```

This checks if S3 vars are in `.env` and if the backend detects them. If vars are missing, add them (Step 4) and run:

```bash
sudo systemctl restart carveo-backend
```

## Test from your Mac

```bash
cd ai-backend
SMOKE_API_BASE=https://api.carveo.eu python scripts/test_s3_storage.py
```

Expected: `PASS: S3 storage integration successful`

---

## Done

Test: log in to Carveo, create a project, upload images. Check S3 bucket for `uploads/` folder.
