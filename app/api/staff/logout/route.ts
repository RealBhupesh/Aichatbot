import { NextResponse } from "next/server";
import { clearStaffSession } from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function POST() {
  await clearStaffSession();
  return NextResponse.json({ success: true });
}
