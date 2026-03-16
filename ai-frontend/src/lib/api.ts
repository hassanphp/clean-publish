/**
 * Process batch API - SSE stream consumer using fetch + getReader()
 */

// Backend URL for most endpoints (analyze-images, regenerate, jobs)
const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "")
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

// process-batch goes through Next.js proxy (JWT cookie + proxy) - use same-origin
const PROCESS_BATCH_BASE = typeof window !== "undefined" ? "" : "http://localhost:3000";

export type SSELogEvent = { event: "log"; data: { message: string } };
export type SSEResultEvent = { event: "result"; data: ProcessedResult };
export type SSECompleteEvent = {
  event: "complete";
  data: {
    status: "completed" | "failed";
    results?: ProcessedResult[];
    error?: string;
    target_studio_description?: string;
  };
};
export type SSEErrorEvent = { event: "error"; data: { message: string } };

export type SSEEvent = SSELogEvent | SSEResultEvent | SSECompleteEvent | SSEErrorEvent;

export interface ModelInfo {
  provider: string;
  model: string;
}

export interface ProcessedResult {
  index: number;
  original_b64: string;
  processed_b64: string;
  metadata: {
    view_category: string;
    components: string[];
    existing_lighting: string;
    dominant_color: string;
    suggested_edit_mode: string;
  };
  error_message?: string | null;
  model_info?: ModelInfo | null;
}

const api = (path: string) => `${API_BASE || ""}/api/v1${path}`;
const processBatchApi = (path: string) => `${PROCESS_BATCH_BASE || ""}/api/v1${path}`;

/** Remove model/provider names from logs and errors shown to users. */
function sanitizeLog(msg: string): string {
  if (!msg || typeof msg !== "string") return msg;
  let s = msg;
  const replacements: [string, string][] = [
    ["gpt-image-1-mini", ""], ["gpt-image-1.5", ""], ["gpt-image-1", ""],
    ["gpt-4o-mini", ""], ["gpt-4o", ""],
    ["flux-2-flex", ""], ["flux-2-pro", ""], ["reve/edit", ""],
    ["imagen-3", ""], ["Imagen", ""],
    ["Fal.ai", ""], ["fal.ai", ""], ["fal-ai", ""], ["Fal ", " "],
    ["Replicate", "Service"], ["FLUX", ""], ["Vertex", "Service"],
    ["OpenAI", "Service"], ["openai", "service"],
  ];
  for (const [old, replacement] of replacements) {
    s = s.replaceAll(old, replacement);
  }
  return s.replace(/\s+/g, " ").trim() || "Processing failed";
}

export interface RegenerateParams {
  original_b64: string;
  metadata: ProcessedResult["metadata"];
  pipeline_version: string;
  target_studio_description: string;
  model: "fal" | "replicate" | "vertex";
  studio_reference_data_uri?: string;
}

export async function regenerateImage(
  params: RegenerateParams
): Promise<{ processed_b64: string; model_info?: ModelInfo | null }> {
  const res = await fetch(api("/regenerate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || `Regenerate failed: ${res.status}`);
  }
  return res.json();
}

export async function analyzeImages(
  images: string[]
): Promise<{ index: number; metadata: { view_category: string } }[]> {
  const res = await fetch(api("/analyze-images"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images }),
  });
  if (!res.ok) throw new Error(`Analyze failed: ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

export interface ProcessBatchParams {
  images: string[];
  target_studio_description?: string;
  studio_reference_image?: string;
  studio_reference_data_uri?: string;
  pipeline_version?: "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "10" | "11";
  project_id?: number;
  dealer_id?: number;
  branding_options?: {
    logo_b64?: string;
    logo_corner_enabled?: boolean;
    logo_corner_position?: "left" | "right";
    license_plate_enabled?: boolean;
    logo_3d_wall_enabled?: boolean;
  };
}

export async function processBatch(
  params: ProcessBatchParams,
  callbacks: {
    onLog?: (message: string) => void;
    onResult?: (result: ProcessedResult) => void;
    onComplete?: (data: SSECompleteEvent["data"]) => void;
    onError?: (message: string) => void;
  }
): Promise<void> {
  const res = await fetch(processBatchApi("/process-batch"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const { job_id } = (await res.json()) as { job_id: string };
    return consumeJobStream(job_id, callbacks);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  let currentData = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        currentData = line.slice(5).trim();
      } else if (line === "" && currentEvent && currentData) {
        parseAndEmit(currentEvent, currentData, callbacks);
        currentEvent = "";
        currentData = "";
      }
    }
  }

  if (buffer.trim()) {
    const lines = buffer.split("\n");
    let lastEvent = "";
    let lastData = "";
    for (const line of lines) {
      if (line.startsWith("event:")) lastEvent = line.slice(6).trim();
      else if (line.startsWith("data:")) lastData = line.slice(5).trim();
      else if (line === "" && lastEvent && lastData) {
        parseAndEmit(lastEvent, lastData, callbacks);
        lastEvent = "";
        lastData = "";
      }
    }
    if (lastEvent && lastData) parseAndEmit(lastEvent, lastData, callbacks);
  }
}

function consumeJobStream(
  jobId: string,
  callbacks: {
    onLog?: (message: string) => void;
    onResult?: (result: ProcessedResult) => void;
    onComplete?: (data: SSECompleteEvent["data"]) => void;
    onError?: (message: string) => void;
  }
): Promise<void> {
  return new Promise((resolve) => {
    const url = api(`/jobs/${jobId}/stream`);
    const es = new EventSource(url);

    const handleResult = (data: unknown) => {
      const r = data as ProcessedResult;
      if (r && typeof r.index === "number" && "processed_b64" in r) {
        if (r.error_message) r.error_message = sanitizeLog(r.error_message);
        callbacks.onResult?.(r);
      }
    };

    const handleComplete = (data: unknown) => {
      try {
        const d = (data as SSECompleteEvent["data"]) ?? { status: "completed" };
        if (d.error) d.error = sanitizeLog(d.error);
        callbacks.onComplete?.(d);
      } catch {
        callbacks.onComplete?.({ status: "completed" });
      }
      es.close();
      resolve();
    };

    es.addEventListener("log", (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        callbacks.onLog?.(sanitizeLog(data.message ?? ""));
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("result", (ev: MessageEvent) => {
      try {
        handleResult(JSON.parse(ev.data));
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("complete", (ev: MessageEvent) => {
      try {
        handleComplete(JSON.parse(ev.data));
      } catch {
        handleComplete({ status: "completed" });
      }
    });

    // Fallback: some proxies strip event types, events may arrive as "message"
    es.onmessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        if (data && typeof data.index === "number" && "processed_b64" in data) {
          handleResult(data);
        } else if (data && (data.status === "completed" || data.status === "failed")) {
          handleComplete(data);
        }
      } catch {
        /* ignore */
      }
    };

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) return;
      callbacks.onError?.("Stream connection lost");
      es.close();
      resolve();
    };
  });
}

function parseAndEmit(
  event: string,
  dataStr: string,
  callbacks: {
    onLog?: (m: string) => void;
    onResult?: (r: ProcessedResult) => void;
    onComplete?: (d: SSECompleteEvent["data"]) => void;
    onError?: (m: string) => void;
  }
) {
  try {
    const data = JSON.parse(dataStr);
    if (event === "log") callbacks.onLog?.(sanitizeLog(data.message ?? ""));
    else if (event === "result") {
      const r = data as ProcessedResult;
      if (r?.error_message) r.error_message = sanitizeLog(r.error_message);
      callbacks.onResult?.(r);
    }
    else if (event === "complete") {
      const d = data as SSECompleteEvent["data"];
      if (d?.error) d.error = sanitizeLog(d.error);
      callbacks.onComplete?.(d ?? { status: "completed" });
    } else if (event === "error") callbacks.onError?.(sanitizeLog(data.message ?? String(data)));
  } catch (e) {
    if (event === "complete" || event === "result") {
      console.error("[SSE] Failed to parse event:", event, (e as Error).message, "Data length:", dataStr?.length);
      callbacks.onError?.("Failed to parse results. The response may be too large.");
    }
  }
}
