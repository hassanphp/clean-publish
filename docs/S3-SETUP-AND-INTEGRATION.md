# AWS S3 Setup and Integration – Full Instructions

Complete guide to create an S3 bucket and integrate it with Carveo for image storage.

---

## Quick Start (Automated)

If you have AWS credentials configured:

```bash
cd clean-publish
pip install boto3
python3 scripts/aws-s3-setup.py
```

The script creates IAM policy, user, access keys, and CORS. Copy the output to EC2 `.env` and restart. See [S3-ONE-COMMAND-SETUP.md](S3-ONE-COMMAND-SETUP.md).

---

## Part 1: Create S3 Bucket in AWS

### Step 1.1: Sign in to AWS Console

1. Go to [https://console.aws.amazon.com](https://console.aws.amazon.com)
2. Sign in with your AWS account

### Step 1.2: Create the bucket

1. Open **S3** from the services menu
2. Click **Create bucket**
3. **Bucket name:** `carveo-images-784038766425-us-east-2-an` (your bucket)
4. **AWS Region:** `us-east-2` (Ohio) – same as your EC2 for best performance
5. **Object Ownership:** ACLs disabled (recommended)
6. **Block Public Access:** Keep **all four** checkboxes enabled (bucket stays private; presigned URLs handle access)
7. **Bucket Versioning:** Disabled (unless you need it)
8. **Default encryption:** Optional (SSE-S3 is fine)
9. Click **Create bucket**

---

## Part 2: Create IAM User and Policy

### Step 2.1: Create IAM policy

1. Go to **IAM** → **Policies** → **Create policy**
2. Open the **JSON** tab and paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CarveoS3Storage",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::carveo-images-784038766425-us-east-2-an",
        "arn:aws:s3:::carveo-images-784038766425-us-east-2-an/*"
      ]
    }
  ]
}
```

(Bucket: carveo-images-784038766425-us-east-2-an)

3. Click **Next**
4. **Policy name:** `CarveoS3Storage`
5. Click **Create policy**

### Step 2.2: Create IAM user

1. Go to **IAM** → **Users** → **Create user**
2. **User name:** `carveo-storage`
3. Click **Next**
4. **Permissions:** Attach policies directly
5. Search for `CarveoS3Storage`, select it
6. Click **Next** → **Create user**

### Step 2.3: Create access keys

1. Open the user `carveo-storage`
2. Go to **Security credentials**
3. **Access keys** → **Create access key**
4. Use case: **Application running outside AWS**
5. Click **Next** → **Create access key**
6. Copy **Access key ID** and **Secret access key** (secret is shown only once; store it securely)

---

## Part 3: Configure CORS (for browser uploads)

1. In **S3**, open your bucket `carveo-images-784038766425-us-east-2-an`
2. Go to **Permissions**
3. **Cross-origin resource sharing (CORS)** → **Edit**
4. Paste:

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

Adjust `AllowedOrigins` to your frontend domains (Vercel, custom domain, localhost).

5. Click **Save changes**

---

## Part 4: Configure Carveo Backend on EC2

### Step 4.1: SSH into EC2

```bash
ssh -i ~/.ssh/carveo-key.pem ubuntu@ec2-18-224-170-67.us-east-2.compute.amazonaws.com
```

(Use your key path and hostname.)

### Step 4.2: Edit .env

```bash
nano /home/ubuntu/clean-publish/ai-backend/.env
```

Add or update:

```bash
# --- S3 Image Storage ---
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-2
S3_BUCKET=carveo-images-784038766425-us-east-2-an
```

Replace:

- `AKIA...` with your Access Key ID
- `your_secret_key_here` with your Secret Access Key
- `us-east-2` with your bucket region
- `carveo-images-784038766425-us-east-2-an` is your bucket

Save and exit (Ctrl+O, Enter, Ctrl+X).

### Step 4.3: Ensure boto3 is installed

```bash
cd /home/ubuntu/clean-publish/ai-backend
pip install boto3
```

(Or `pip install -r requirements.txt` if boto3 is listed.)

### Step 4.4: Restart the backend

```bash
sudo systemctl restart carveo-backend
```

### Step 4.5: Verify backend is running

```bash
sudo systemctl status carveo-backend
```

---

## Part 5: Verify Integration

### 5.1: Check upload-url endpoint

When logged in, the frontend calls `/api/v1/storage/upload-url`. If S3 is configured:

- Response includes `upload_url` (presigned PUT) and `object_url` (e.g. `s3://carveo-images-784038766425-us-east-2-an/uploads/xxx.jpg`)

### 5.2: Test upload flow

1. Log in to Carveo frontend
2. Create a new project
3. Upload one or more images
4. If S3 works: uploads go to S3; `object_url` is sent to `process-batch`
5. If S3 fails or is not configured: frontend falls back to base64

### 5.3: Check S3 bucket

1. AWS Console → S3 → `carveo-images-784038766425-us-east-2-an`
2. You should see objects under `uploads/` after successful uploads

---

## Part 6: Troubleshooting

| Issue | Possible cause | Fix |
|-------|----------------|-----|
| 503 on `/upload-url` | S3 not configured | Set `STORAGE_PROVIDER=s3` and all AWS_* vars |
| CORS error in browser | CORS not set on bucket | Add CORS config (Part 3) with your frontend origin |
| Access Denied | Wrong credentials or policy | Check IAM policy, access keys, bucket name |
| Images not processing | Backend can't fetch from S3 | Ensure `generate_signed_read_url` works; check backend logs |

### Check backend logs

```bash
sudo journalctl -u carveo-backend -n 100 -f
```

---

## Quick Reference

| Variable | Example |
|----------|---------|
| `STORAGE_PROVIDER` | `s3` |
| `AWS_ACCESS_KEY_ID` | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | `wJalrXUtnFEMI/K7MDENG/...` |
| `AWS_REGION` | `us-east-2` |
| `S3_BUCKET` | `carveo-images-784038766425-us-east-2-an` |

---

## Flow Summary

1. **Frontend** (logged-in user) → `GET /api/v1/storage/upload-url?filename=uploads/uuid_0.jpg`
2. **Backend** → Returns `upload_url` (presigned PUT) and `object_url` (s3://bucket/key)
3. **Frontend** → PUTs file directly to S3 using `upload_url`
4. **Frontend** → Sends `object_url` to `POST /api/v1/process-batch` in `images` array
5. **Backend** → Generates signed read URL, fetches image from S3 when processing
