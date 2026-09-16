import { NextResponse } from "next/server";
import { setStaffSession, verifyStaffPassword } from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { password?: string; name?: string }
    | null;
  const password = body?.password ?? "";

  if (!verifyStaffPassword(password)) {
    return NextResponse.json({ success: false, message: "That password is not right." }, { status: 401 });
  }

  await setStaffSession(body?.name);
  return NextResponse.json({ success: true });
}
