import { NextResponse } from "next/server";
import { fetchWithAuth } from "@/lib/apiProxy";

export async function GET() {
  try {
    const res = await fetchWithAuth("/api/v1/auth/me");
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { detail: "Invalid response from server" };
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : "Backend unavailable" },
      { status: 503 }
    );
  }
}
