import { NextResponse } from "next/server";
import { z } from "zod";
import { getOperationalRooms, readOperations, writeOperations } from "@/lib/operations";
import { isStaffSession } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roomOpsSchema = z.object({
  inventory: z.number().int().min(0).max(200),
  pricePerNight: z.number().int().min(0).max(1_000_000),
  closed: z.boolean(),
  blackouts: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60),
});

const patchSchema = z.object({
  hotelClosedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60),
  rooms: z.record(z.string(), roomOpsSchema),
});

export async function GET() {
  if (!(await isStaffSession())) {
    return NextResponse.json({ success: false, message: "Please sign in." }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    operations: readOperations(),
    rooms: getOperationalRooms(),
  });
}

export async function PUT(request: Request) {
  if (!(await isStaffSession())) {
    return NextResponse.json({ success: false, message: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message || "Invalid operations payload." },
      { status: 400 },
    );
  }

  writeOperations(parsed.data);
  return NextResponse.json({
    success: true,
    operations: readOperations(),
    rooms: getOperationalRooms(),
  });
}
