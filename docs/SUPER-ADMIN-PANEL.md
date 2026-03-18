# Super Admin Panel

Internal panel for running tests, tracking feedback, and exporting datasets from daily processing data.

## Access

- **URL**: Deploy ai-admin (e.g. `https://clean-publish-koxl.vercel.app` or run locally)
- **Auth**: Login with an email in `SUPERADMIN_EMAILS` (comma-separated in backend `.env`)
- **Default**: `dealer@domain.com` / `Admin@321` (from seed)

### 403 Forbidden on feature-flags

If you get **403** after login, add your email to `SUPERADMIN_EMAILS` on the backend server:

```bash
# On EC2, edit the backend .env:
echo "SUPERADMIN_EMAILS=dealer@domain.com,you@example.com" >> /home/ubuntu/clean-publish/ai-backend/.env
# Then restart:
sudo systemctl restart carveo-backend
```

Or set in your deployment environment (Vercel, etc.) if the backend reads from there.

## Features

### 1. Tests
- **Process batch**: Select studio + car images, run V11/V6/V7 with preview toggle
- **Feature flags**: Toggle `enforce_4_3`, `center_on_turntable`, `color_lock_strict`
- **Smoke test**: Shows CLI instructions for running `smoke_v11.py`, `test_2_images_v11.py`, etc.

### 2. Feedback
- Add internal feedback (title, content, category: quality/bug/feature/dataset)
- No AI needed – team can share notes and track issues
- Resolve/archive feedback items

### 3. Dataset
- **Stats**: Count of completed JobImages in last N days
- **Export**: Download JSON manifest with original + processed URL pairs
- Data comes from `job_images` table (populated when users process images with projects)

## Backend Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/admin/feature-flags` | GET | List flags |
| `/api/v1/admin/feature-flags` | PUT | Set flag |
| `/api/v1/admin/feedback` | GET | List feedback |
| `/api/v1/admin/feedback` | POST | Create feedback |
| `/api/v1/admin/feedback/{id}` | PATCH | Update feedback |
| `/api/v1/admin/dataset/stats` | GET | Dataset stats (days param) |
| `/api/v1/admin/dataset/export` | GET | Download manifest |
| `/api/v1/admin/smoke-test` | GET | Smoke test instructions |

## Dataset Export Format

```json
{
  "dataset": [
    {
      "id": 1,
      "project_id": 1,
      "image_index": 0,
      "original_url": "https://...",
      "processed_url": "https://...",
      "metadata": "{...}",
      "created_at": "2025-03-18T..."
    }
  ],
  "exported_at": "2025-03-18T...",
  "days": 7
}
```

Use for: quality audits, model fine-tuning, A/B testing, training data.
