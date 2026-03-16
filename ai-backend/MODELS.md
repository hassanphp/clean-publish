# Models Used

## Image Editing (Enhancement)

| Provider | Model | Env Var | Default |
|----------|-------|---------|---------|
| **Replicate** | `reve/edit` or `reve/edit-fast` | `REPLICATE_EDIT_MODEL` | `reve/edit-fast` |

**Current config** (from `.env`): `REPLICATE_EDIT_MODEL=reve/edit`

- **reve/edit-fast**: Faster, good for simple edits
- **reve/edit**: Higher quality, better for complex edits (interior, detail, consistency)

Set in `.env`:
```
REPLICATE_EDIT_MODEL=reve/edit
# or
REPLICATE_EDIT_MODEL=reve/edit-fast
```

## Classification (Metadata)

| Provider | Model | Env Var |
|----------|-------|---------|
| **Vertex AI** or **Google AI Studio** | `gemini-2.0-flash` | `GEMINI_MODEL` |

Set `GEMINI_PROVIDER=vertex` (GCP) or `GEMINI_PROVIDER=google_ai` (API key).

## Image Edit Provider

| Value | Description |
|-------|-------------|
| `replicate` | Replicate API (reve/edit) - no GCP quota, pay-per-use |
| `vertex` | Vertex Imagen - requires GCP quota |

Set `IMAGE_EDIT_PROVIDER=replicate` in `.env`.

## Pipeline Versions

| Version | Description |
|---------|-------------|
| V1 | Reve for all; standard prompts |
| V2 | Reve for all; refined prompts (inner fender, softer shadows) |
| V3 | Reve for exterior/interior; remove_bg for detail shots |
| V4 | Reve for all; feedback-tuned: no hallucinations, strict color preservation, reflection removal, natural studio realism |
| V5 | Reserved |
| V6 | **Fal.ai FLUX** multi-image reference; native studio adoption. Requires studio reference. |
| V7 | **Replicate Flux 2 Pro** multi-image reference; studio adoption. Requires studio reference. |
| V8 | **Vertex Imagen** safe queue; throttled to ~15 RPM to avoid 429. Requires GCP. |

### V6 (Fal.ai FLUX)

- **Model:** `fal-ai/flux-2-flex/edit` (configurable via `FAL_FLUX_EDIT_MODEL`)
- **Auth:** `FAL_KEY` from https://fal.ai/dashboard/keys
- **Input:** Car image + studio reference image → FLUX adopts studio environment
- **Pricing:** ~$0.050/MP (flux-2-flex)

### Replicate rate limits

- **Accounts with <$5 credit:** 6 requests/min, burst of 1 (sequential only)
- **Accounts with ≥$5 credit:** Higher limits, parallel processing possible

Processing is sequential to avoid 429 throttling on free/low-credit accounts.

### V7 (Replicate Studio)

- **Model:** `black-forest-labs/flux-2-pro` (configurable via `REPLICATE_STUDIO_MODEL`)
- **Auth:** `REPLICATE_API_TOKEN`
- **Input:** Car image + studio reference image → adopts studio lighting/reflections
- **Requires:** Studio reference (preset or upload)

### V8 (Vertex Safe Queue)

- **Model:** Vertex Imagen (`VERTEX_IMAGEN_MODEL`)
- **Auth:** GCP (`GOOGLE_CLOUD_PROJECT_ID`)
- **Throttle:** Global lock + 3.5s sleep between requests (~15 RPM max)
- **Use case:** Large batches (e.g. 30 images) without hitting 429 quota

## Webhook Mode (V6/V7)

When `SERVER_BASE_URL` is set, V6 and V7 use asynchronous webhooks instead of synchronous polling:

1. **Submit:** `POST /api/v1/process-batch` returns `{ "job_id": "uuid" }` immediately
2. **Stream:** Client connects to `GET /api/v1/jobs/{job_id}/stream` via EventSource
3. **Webhooks:** Fal/Replicate POST to `/api/v1/webhooks/fal` and `/api/v1/webhooks/replicate` on completion
4. **Redis:** Webhook handlers publish to `job_updates:{job_id}`; SSE endpoint subscribes and streams to client

**Required env:**
- `SERVER_BASE_URL` – public URL (e.g. `https://your-app.ngrok.io`) so Fal/Replicate can reach webhooks
- `REDIS_URL` – Redis for Pub/Sub (defaults to `redis://localhost:6379`). Required for live stream updates.

**Local testing:** Use ngrok to expose your backend, then set `SERVER_BASE_URL=https://xxx.ngrok.io`
