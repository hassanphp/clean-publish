# V11 Pipeline – Full Flow Trace

This document traces the complete V11 flow from frontend to backend to confirm everything is correctly wired.

---

## 1. Frontend: CreateToolFlow

| Step | Location | Value |
|------|----------|-------|
| Pipeline version state | `CreateToolFlow.tsx:140` | `useState<"11">("11")` – hardcoded to V11 |
| Preview mode | `CreateToolFlow.tsx:579` | Checkbox in studio view, passed to payload |
| Studio selection | `CreateStudioPicker` | User selects from 17 presets |
| Studio fetch | `getStudioBase64(selectedStudio)` | Fetches `/studios/studio-X.png` → base64 |
| Payload | `CreateToolFlow.tsx:353-361` | `pipeline_version`, `preview`, `studio_reference_image`, `images`, etc. |

**Payload sent:**
```json
{
  "images": ["data:image/...", ...],
  "pipeline_version": "11",
  "preview": true|false,
  "studio_reference_image": "data:image/png;base64,...",
  "project_id": 123,  // if project
  "dealer_id": 1,     // if dealer selected
  "branding_options": {...}  // if session branding
}
```

---

## 2. Frontend: processBatch API

| Step | Location | Value |
|------|----------|-------|
| API URL | `lib/api.ts:50` | `processBatchApi("/process-batch")` = `""` + `/api/v1/process-batch` |
| In browser | `PROCESS_BATCH_BASE = ""` | Same-origin → Next.js |
| Request | `lib/api.ts:139-144` | `fetch(url, { method: "POST", body: JSON.stringify(params), credentials: "include" })` |

---

## 3. Next.js: process-batch Route

| Step | Location | Value |
|------|----------|-------|
| Route | `app/api/v1/process-batch/route.ts` | Handles POST `/api/v1/process-batch` |
| Body | Line 14 | `await request.text()` – raw JSON, forwarded as-is |
| Auth | Line 25-27 | `getAccessToken()` → `Authorization: Bearer <token>` |
| Backend | Line 29 | `fetch(BACKEND/api/v1/process-batch, { body })` |

**Result:** Full payload (including `pipeline_version`, `studio_reference_image`, `preview`) is forwarded to FastAPI.

---

## 4. Backend: process_batch Handler

| Step | Location | Value |
|------|----------|-------|
| Schema | `schemas.py:52-58` | `ProcessBatchRequest` has `pipeline_version` default `"11"`, `preview` default `False` |
| Validation | `schemas.py:68-78` | V6/V7/V11 require `studio_reference_image` or `studio_reference_data_uri` |
| Extraction | `main.py:243-244` | `pipeline_version = getattr(request, "pipeline_version", "11") or "11"` |
| Studio | `main.py:239-244` | `studio_b64 = request.studio_reference_data_uri or request.studio_reference_image` |
| Studio analysis | `main.py:247-249` | `analyze_studio_image(studio_b64, force_openai=(pipeline_version == "11"))` |
| Initial state | `main.py:286-298` | `pipeline_version`, `studio_reference_b64`, `preview` passed to graph |

---

## 5. Backend: LangGraph Pipeline

| Node | Purpose |
|------|---------|
| **classify** | `gemini_classifier_node` – metadata extraction (view_category, etc.) |
| **prompt** | `dynamic_prompt_node` – builds V11 prompts per view type |
| **execute** | `vertex_execution_node_async` – calls `_edit_image_openai_gpt` for V11 |

### Metadata (classify node)
- `nodes.py:377-379`: `pipeline_version = state.get("pipeline_version", "1")`, `use_openai = pipeline_version == "11"`
- V11 uses OpenAI for metadata classification (`_classify_single_image_openai`)

### V11 Prompts (prompt node)
- `nodes.py:505-544`: V11-specific prompts for interior, exterior, detail
- Uses `target_studio_description` from studio analysis
- Includes `branding_instruction` when dealer branding enabled

### V11 Edit (execute node)
- `nodes.py:1330-1331`: `studio_b64 = state.get("studio_reference_b64")`, `pipeline_version = state.get("pipeline_version", "1")`
- `nodes.py:1345-1349`: V11 requires `OPENAI_API_KEY` and `studio_b64`
- `nodes.py:1414-1416`: `_get_edit_fn` returns `lambda pl: _edit_image_openai_gpt(pl, studio_b64)` for V11

---

## 6. Backend: _edit_image_openai_gpt (V11)

| Step | Location | Value |
|------|----------|-------|
| Inputs | `nodes.py:1002-1010` | Car bytes, studio bytes from payload/state |
| Preview downscale | `nodes.py:1019-1036` | If `payload.get("preview")`: downscale car + studio to 1024px |
| Images sent | `nodes.py:1038-1047` | `[(car_bytes, "car.jpg"), (studio_bytes, "studio.jpg")]` + optional logo |
| Model | `nodes.py:1058` | `client.images.edit(..., model=OPENAI_GPT_IMAGE_MODEL)` |
| Model env | `nodes.py:984` | `OPENAI_GPT_IMAGE_MODEL = os.getenv("OPENAI_GPT_IMAGE_MODEL", "gpt-image-1.5")` |

---

## 7. Post-Processing: Logo Overlay

| Step | Location | Value |
|------|----------|-------|
| Logo corner | `main.py:347-350` | Applied for all pipeline versions when `logo_corner_enabled` |
| License plate / 3D wall | `main.py:351-354` | **Skipped for V11** – V11 does these in-prompt via GPT |

---

## 8. Regenerate (Results Grid)

| Step | Location | Value |
|------|----------|-------|
| pipelineVersion | `ResultsGrid.tsx:30` | Default `"11"` |
| canRegenerate | `ResultsGrid.tsx:110` | Requires `["1","2","3","4","10","11"].includes(pipelineVersion)` |
| Regenerate params | `ResultsGrid.tsx:120-126` | `pipeline_version`, `studio_reference_data_uri` passed |
| Backend | `main.py:485-490` | V11 requires `studio_reference_data_uri` for regeneration |

---

## Summary: V11 Flow Checklist

| Item | Status |
|------|--------|
| Frontend sends `pipeline_version: "11"` | ✅ |
| Frontend sends `studio_reference_image` (selected studio) | ✅ |
| Frontend sends `preview` (checkbox state) | ✅ |
| Next.js proxy forwards full body | ✅ |
| Backend defaults to V11 | ✅ |
| Backend validates studio required for V11 | ✅ |
| Studio analysis uses OpenAI when V11 | ✅ |
| Graph receives `pipeline_version`, `studio_reference_b64`, `preview` | ✅ |
| Metadata uses OpenAI when V11 | ✅ |
| V11 prompts built in dynamic_prompt_node | ✅ |
| V11 edit uses `_edit_image_openai_gpt` with studio | ✅ |
| Preview mode downscales before GPT call | ✅ |
| Regenerate supports V11 with studio_reference_data_uri | ✅ |

---

## Potential Issues to Verify

1. **Studio URL in production**: `getStudioBase64` uses `window.location.origin + studio.thumbnail`. On Vercel (e.g. carveo.eu), origin is correct. Studio images must be in `public/studios/`.

2. **OPENAI_API_KEY**: Must be set on EC2 backend for V11 to work.

3. **Preview mode**: When enabled, images are downscaled to 1024px – lower cost, lower quality. Disable for full quality.

4. **Regenerate**: Requires `studioReferenceDataUri` to be passed from CreateToolFlow. It is set from `studioReferenceDataUri` state, which is populated from `setStudioReferenceDataUri(studioB64)` in `handleUploadComplete`. ✅
