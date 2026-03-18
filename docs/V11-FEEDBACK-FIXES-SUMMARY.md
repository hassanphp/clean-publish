# V11 Feedback Fixes – Summary

## What Was Fixed (All Feedback Addressed)

### 1. **Classification (ANALYSIS_PROMPT)**
- Stricter rules: door panel = interior, trunk/boot = interior, center console = interior, door sill = detail
- Added: "NEVER classify an interior shot as exterior. NEVER classify a trunk interior as anything that would show dashboard/steering wheel."

### 2. **Interior Prompts**
- Trunk/boot: "replace only the background behind the trunk"
- Door panel/center console: "replace only what is visible through windows or behind the subject"
- Explicit: "Do NOT replace a trunk shot with dashboard/steering wheel. Do NOT replace a door panel with a different interior view."

### 3. **Exterior Prompts**
- Metallic/glossy: "Preserve EXACT metallic/glossy paint finish. Do NOT flatten to matte."
- Centering: "Center the car on the turntable/platform if present" (via `center_on_turntable` flag)
- Negative prompt: added "matte, flat, dull paint"

### 4. **Exterior: Artificial Glow / Lighting Mismatch (Mar 2025)**
- Added: "Remove reflections on hood and body from the original environment - the car should match the new studio lighting."
- Added: "Do NOT add exaggerated glow, halos, or artificial circular floor rings - keep floor natural and subtle."
- Addresses: Bright circular floor ring looking artificial; car reflections not matching new studio.

### 5. **Detail Prompts**
- Interior details (door sill, center console, trunk): "replace ONLY the background behind the subject. Do NOT replace the subject with a different scene."
- "Do NOT add steering wheel, dashboard, or cabin if not in original."
- "Output must stay 4:3."

### 6. **4:3 Aspect Ratio**
- Now enforced for **exterior, interior, and detail** (previously only exterior + interior).

---

## BISMILLAH vs clean-publish

The old BISMILLAH V11 had **shorter** prompts (no explicit "do not zoom out", "4:3", "do not hallucinate"). The new frontend integration did not change the backend logic; the clean-publish backend already had stricter prompts from a previous iteration. The fixes above further tighten:

- Classification (prevents interior→exterior, trunk→dashboard)
- Interior/trunk/detail-specific instructions
- Metallic preservation and centering

---

## Cost Reduction (Already in Production)

| Mechanism | Effect |
|-----------|--------|
| **Redis cache** | Studio analysis + metadata classification cached by image hash. Same image = no duplicate OpenAI calls. |
| **Preview mode** | `preview: true` downscales inputs to 1024px before GPT Image 1.5. Lower cost, lower quality. |

---

## Deployment Status

- **Code:** Pushed to `main` (commits `6e97e90`, `5f7f52a`)
- **EC2:** `git pull` + `systemctl restart carveo-backend` completed. Service reported `active (running)`.
- **API:** If you see 502, check Nginx→backend connectivity and backend logs: `sudo journalctl -u carveo-backend -n 50`

---

## 2-Image Test

Run when the API is up:

```bash
cd ai-backend
SMOKE_API_BASE=https://api.carveo.eu python scripts/test_2_images_v11.py
```

Requires demo images in `ai-frontend/public/demo/` (e.g. `exterior-before.jpg`, `interior-before.avif`) or `ai-frontend/image.JPEG` as fallback.
