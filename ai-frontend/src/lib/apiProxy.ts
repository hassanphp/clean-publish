/**
 * Helper to proxy requests to FastAPI with JWT from cookie.
 */

import { cookies } from "next/headers";

const FASTAPI_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("access_token")?.value ?? null;
}

export async function fetchWithAuth(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const token = await getAccessToken();
  const url = `${FASTAPI_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", headers.get("Content-Type") || "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}
