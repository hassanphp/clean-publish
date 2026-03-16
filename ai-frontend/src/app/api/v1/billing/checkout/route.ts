import { NextRequest, NextResponse } from "next/server";
import { fetchWithAuth } from "@/lib/apiProxy";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const res = await fetchWithAuth("/api/v1/billing/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json(data, { status: res.status });
  return NextResponse.json(data);
}
