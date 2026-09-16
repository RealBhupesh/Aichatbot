import { NextResponse } from "next/server";
import { clearGuestSessionId } from "@/lib/guest-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearGuestSessionId();
  return NextResponse.json({ success: true, sessionId: null });
}
