import { NextRequest, NextResponse } from "next/server";
import { fetchWithAuth } from "@/lib/apiProxy";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const res = await fetchWithAuth("/api/v1/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      let detail = "Checkout failed";
      if (typeof data?.detail === "string") detail = data.detail;
      else if (Array.isArray(data?.detail) && data.detail[0]?.msg) detail = data.detail[0].msg;
      else if (data?.detail && typeof data.detail === "object") detail = JSON.stringify(data.detail);
      return NextResponse.json({ detail }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : "Backend unavailable" },
      { status: 503 }
    );
  }
}
