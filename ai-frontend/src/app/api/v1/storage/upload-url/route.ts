import { NextRequest, NextResponse } from "next/server";
import { fetchWithAuth } from "@/lib/apiProxy";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  const content_type = searchParams.get("content_type") || "image/jpeg";
  if (!filename) {
    return NextResponse.json({ detail: "filename required" }, { status: 400 });
  }
  const qs = new URLSearchParams({ filename, content_type }).toString();
  const res = await fetchWithAuth(`/api/v1/storage/upload-url?${qs}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json(data, { status: res.status });
  return NextResponse.json(data);
}
