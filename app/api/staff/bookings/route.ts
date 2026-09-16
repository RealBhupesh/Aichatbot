import { listHolds, listPendingStaffBookings } from "@/lib/bookings";
import { isStaffSession } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isStaffSession())) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  return Response.json({
    pending: listPendingStaffBookings(),
    holds: listHolds(),
  });
}
