/**
 * Proxy for process-batch that streams SSE correctly.
 * Forwards to FastAPI. Auth/credits handled by FastAPI when implemented.
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchWithAuth } from "@/lib/apiProxy";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  const body = await request.text();
  let payload: { images?: string[] };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const imageCount = payload.images?.length ?? 0;
  if (imageCount <= 0) {
    return NextResponse.json({ error: "No images provided" }, { status: 400 });
  }

  const { getAccessToken } = await import("@/lib/apiProxy");
  const resolvedToken = await getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (resolvedToken) headers["Authorization"] = `Bearer ${resolvedToken}`;

  const res = await fetch(`${BACKEND.replace(/\/$/, "")}/api/v1/process-batch`, {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(err, { status: res.status });
  }

  return new Response(res.body, {
    status: res.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
