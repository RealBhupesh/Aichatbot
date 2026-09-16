import { confirmGuestBooking } from "@/lib/staff-console";
import { isStaffSession } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  if (!(await isStaffSession())) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = confirmGuestBooking(id);
  if (result.status === "error") {
    return Response.json({ message: result.message }, { status: 409 });
  }

  return Response.json({ hold: result.hold, message: result.message });
}
