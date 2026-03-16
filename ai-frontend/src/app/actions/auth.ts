"use server";

import { cookies } from "next/headers";

const FASTAPI_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

function parseErrorDetail(data: unknown, fallback = "Request failed"): string {
  if (!data || typeof data !== "object") return fallback;
  const d = data as { detail?: string | { msg?: string }[] };
  if (typeof d.detail === "string") return d.detail;
  if (Array.isArray(d.detail) && d.detail[0]?.msg) return d.detail[0].msg;
  return fallback;
}

export async function loginAction(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${FASTAPI_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json().catch(() => ({}))) as { access_token?: string; detail?: unknown };
    if (!res.ok) {
      return { ok: false, error: parseErrorDetail(data, "Login failed") };
    }
    const token = data.access_token;
    if (!token) return { ok: false, error: "No token received" };

    const cookieStore = await cookies();
    const isProd = process.env.NODE_ENV === "production";
    cookieStore.set("access_token", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Login failed";
    return {
      ok: false,
      error: msg.includes("fetch") || msg.includes("Failed to fetch")
        ? "Cannot reach the server. Make sure the backend is running."
        : msg,
    };
  }
}

export async function registerAction(
  email: string,
  password: string,
  name?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${FASTAPI_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: name || undefined }),
    });
    const data = (await res.json().catch(() => ({}))) as { access_token?: string; detail?: unknown };
    if (!res.ok) {
      return { ok: false, error: parseErrorDetail(data, "Registration failed") };
    }
    const token = data.access_token;
    if (!token) return { ok: false, error: "No token received" };

    const cookieStore = await cookies();
    const isProd = process.env.NODE_ENV === "production";
    cookieStore.set("access_token", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Registration failed";
    return {
      ok: false,
      error: msg.includes("fetch") || msg.includes("Failed to fetch")
        ? "Cannot reach the server. Make sure the backend is running."
        : msg,
    };
  }
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("access_token");
}
