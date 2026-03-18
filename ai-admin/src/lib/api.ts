// Minimal API client for admin panel (no proxy)

export type SSELogEvent = { event: "log"; data: { message: string } }
export type SSEResultEvent = { event: "result"; data: ProcessedResult }
export type SSECompleteEvent = {
  event: "complete"
  data: { status: "completed" | "failed"; error?: string; target_studio_description?: string }
}
export type SSEErrorEvent = { event: "error"; data: { message: string } }
export type SSEEvent = SSELogEvent | SSEResultEvent | SSECompleteEvent | SSEErrorEvent

export interface ModelInfo { provider: string; model: string }
export interface ProcessedResult {
  index: number
  original_b64: string
  processed_b64: string
  metadata: {
    view_category: string
    components: string[]
    existing_lighting: string
    dominant_color: string
    suggested_edit_mode: string
  }
  error_message?: string | null
  model_info?: ModelInfo | null
}

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "")
const api = (path: string) => `${API_BASE}/api/v1${path}`

export interface ProcessBatchParams {
  images: string[]
  target_studio_description?: string
  studio_reference_image?: string
  studio_reference_data_uri?: string
  pipeline_version?: "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "10" | "11"
  preview?: boolean
  dealer_id?: number
  project_id?: number
}

export async function processBatch(
  params: ProcessBatchParams,
  token: string,
  callbacks: {
    onLog?: (m: string) => void
    onResult?: (r: ProcessedResult) => void
    onComplete?: (d: SSECompleteEvent["data"]) => void
    onError?: (m: string) => void
  }
): Promise<void> {
  const res = await fetch(api("/process-batch"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  const contentType = res.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const { job_id } = (await res.json()) as { job_id: string }
    const es = new EventSource(api(`/jobs/${job_id}/stream`))
    wireES(es, callbacks)
    return
  }
  const reader = res.body?.getReader()
  if (!reader) throw new Error("No response body")
  const decoder = new TextDecoder()
  let buffer = ""
  let currentEvent = ""
  let currentData = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (line.startsWith("event:")) currentEvent = line.slice(6).trim()
      else if (line.startsWith("data:")) currentData = line.slice(5).trim()
      else if (line === "" && currentEvent && currentData) {
        parseAndEmit(currentEvent, currentData, callbacks)
        currentEvent = ""
        currentData = ""
      }
    }
  }
}

function wireES(
  es: EventSource,
  callbacks: { onLog?: (m: string) => void; onResult?: (r: ProcessedResult) => void; onComplete?: (d: SSECompleteEvent["data"]) => void; onError?: (m: string) => void }
) {
  es.addEventListener("log", (ev: MessageEvent) => {
    try { callbacks.onLog?.(JSON.parse(ev.data).message ?? "") } catch {}
  })
  es.addEventListener("result", (ev: MessageEvent) => {
    try { callbacks.onResult?.(JSON.parse(ev.data)) } catch {}
  })
  es.addEventListener("complete", (ev: MessageEvent) => {
    try { callbacks.onComplete?.(JSON.parse(ev.data)) } catch { callbacks.onComplete?.({ status: "completed" }) }
    es.close()
  })
  es.onerror = () => { callbacks.onError?.("Stream error") ; es.close() }
}

function parseAndEmit(
  event: string,
  dataStr: string,
  callbacks: { onLog?: (m: string) => void; onResult?: (r: ProcessedResult) => void; onComplete?: (d: SSECompleteEvent["data"]) => void; onError?: (m: string) => void }
) {
  try {
    const data = JSON.parse(dataStr)
    if (event === "log") callbacks.onLog?.(data.message ?? "")
    else if (event === "result") callbacks.onResult?.(data as ProcessedResult)
    else if (event === "complete") callbacks.onComplete?.((data as SSECompleteEvent["data"]) ?? { status: "completed" })
    else if (event === "error") callbacks.onError?.(String(data.message ?? data))
  } catch (e) {
    if (event === "complete" || event === "result") callbacks.onError?.("Failed to parse event data")
  }
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(api("/auth/login"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })
  if (!res.ok) throw new Error("Login failed")
  const data = await res.json()
  return data.access_token as string
}

// --- Admin endpoints ---

async function parseError(res: Response, prefix: string): Promise<never> {
  const data = await res.json().catch(() => ({}))
  const detail = (data as { detail?: string }).detail
  throw new Error(detail || `${prefix}: ${res.status}`)
}

export async function adminGetFlags(token: string): Promise<Record<string, string | null>> {
  const res = await fetch(api("/admin/feature-flags"), { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) await parseError(res, "adminGetFlags")
  return res.json()
}

export async function adminSetFlag(token: string, key: string, value: string): Promise<void> {
  const res = await fetch(api("/admin/feature-flags"), {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ key, value }),
  })
  if (!res.ok) throw new Error(`adminSetFlag: ${res.status}`)
}

// --- Feedback ---
export interface FeedbackItem {
  id: number
  title: string
  content: string
  category: string | null
  status: string
  created_by: string | null
  created_at: string | null
}

export async function adminListFeedback(token: string, status?: string, category?: string): Promise<FeedbackItem[]> {
  const params = new URLSearchParams()
  if (status) params.set("status", status)
  if (category) params.set("category", category)
  const res = await fetch(api(`/admin/feedback?${params}`), { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`adminListFeedback: ${res.status}`)
  return res.json()
}

export async function adminCreateFeedback(token: string, title: string, content: string, category?: string): Promise<{ id: number }> {
  const res = await fetch(api("/admin/feedback"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title, content, category }),
  })
  if (!res.ok) throw new Error(`adminCreateFeedback: ${res.status}`)
  return res.json()
}

export async function adminUpdateFeedback(token: string, id: number, updates: { title?: string; content?: string; status?: string }): Promise<void> {
  const res = await fetch(api(`/admin/feedback/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error(`adminUpdateFeedback: ${res.status}`)
}

// --- Dataset ---
export async function adminDatasetStats(token: string, days?: number): Promise<{ last_n_days: number; count: number; total_completed: number }> {
  const params = days ? `?days=${days}` : ""
  const res = await fetch(api(`/admin/dataset/stats${params}`), { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`adminDatasetStats: ${res.status}`)
  return res.json()
}

export async function adminDownloadDataset(token: string, days?: number): Promise<Blob> {
  const params = days ? `?days=${days}` : "?days=7"
  const res = await fetch(api(`/admin/dataset/export${params}`), { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`adminDownloadDataset: ${res.status}`)
  return res.blob()
}

// --- Smoke test ---
export async function adminSmokeTest(token: string): Promise<{ message: string; scripts: string[] }> {
  const res = await fetch(api("/admin/smoke-test"), { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`adminSmokeTest: ${res.status}`)
  return res.json()
}
