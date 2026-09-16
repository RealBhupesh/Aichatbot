import { getConversation } from "@/lib/staff-console";
import { isStaffSession } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  if (!(await isStaffSession())) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const conversation = getConversation(id);
  if (!conversation) {
    return Response.json({ message: "Conversation not found." }, { status: 404 });
  }

  return Response.json(conversation);
}
