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

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "")
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
