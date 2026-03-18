# Storage & Branding – Enterprise Guide

## Image Storage: AWS S3 vs Cloudflare R2 vs GCS

| Provider | Storage/GB | Egress/GB | Best for |
|----------|------------|-----------|----------|
| **Cloudflare R2** | $0.015 | **$0 (free)** | High traffic, image-heavy workloads |
| **AWS S3** | $0.023 | $0.09 after 100GB | AWS-native, compliance |
| **GCS** | ~$0.02 | ~$0.12 | GCP-native |

**Recommendation:** Use **Cloudflare R2** for image storage – zero egress, S3-compatible API, fast global CDN. For 1TB storage + 10TB egress: R2 ≈ $15/mo vs S3 ≈ $923/mo.

### Env vars (R2 / S3)

```
# R2 (recommended)
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=carveo-images
R2_PUBLIC_URL=https://pub-xxx.r2.dev  # optional custom domain

# Or AWS S3
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET=carveo-images
```

---

## Competitor Features (Phyron, Impel, Dealer Image Pro)

- **AI-guided capture** – angle guidance, crop detection
- **Vehicle queue** – track inventory, progress across locations
- **VIN scanner** – quick vehicle identification
- **Custom branding** – templates, logo placement, license plate
- **Integrations** – DMS, publishing platforms
- **Studio-quality output** – automated background replacement

Carveo aligns with these: studio replacement, branding (corner, 3D wall, license plate), project/order management.

---

## Branding Persistence

- **Dealer preferences** (DB): `logo_corner_enabled`, `logo_3d_wall_enabled`, `license_plate_enabled`, `logo_corner_position`
- **Dealer assets** (DB): `logo`, `studio`, `license_plate` – stored as `data_b64` or `file_path` (S3/R2 URL)
- **Create flow**: Loads dealer branding when `dealer_id` is set; falls back to `localStorage` for session overrides
- **CRUD**: Full CRUD for preferences, assets (create, read, update, delete)
