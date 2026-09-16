import { handbackConversation } from "@/lib/staff-console";
import { isStaffSession, readStaffName } from "@/lib/staff-auth";

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
  const assignedTo = await readStaffName();
  const session = await handbackConversation(id, assignedTo);
  if (!session) {
    return Response.json({ message: "Conversation not found." }, { status: 404 });
  }

  return Response.json({ session });
}
