/**
 * Credits - placeholder until FastAPI has credits on User.
 * Returns 0 for now.
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ credits: 0 });
}
