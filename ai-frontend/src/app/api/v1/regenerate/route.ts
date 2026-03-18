/**
 * Proxy for regenerate endpoint - forwards to FastAPI with JWT when available.
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchWithAuth } from "@/lib/apiProxy";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const res = await fetchWithAuth("/api/v1/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body || "{}",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : "Backend unavailable" },
      { status: 503 }
    );
  }
}
