import { listEscalations, resolveEscalation } from "@/lib/escalations";
import { isStaffSession } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isStaffSession())) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  return Response.json({
    tickets: listEscalations("open"),
  });
}

export async function PATCH(request: Request) {
  if (!(await isStaffSession())) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  let body: { ticketId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.ticketId) {
    return Response.json({ message: "ticketId is required." }, { status: 400 });
  }

  const ticket = resolveEscalation(body.ticketId);
  if (!ticket) {
    return Response.json({ message: "Ticket not found." }, { status: 404 });
  }

  return Response.json({ ticket });
}
