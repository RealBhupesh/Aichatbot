import { sendStaffReply } from "@/lib/staff-console";
import { isStaffSession, readStaffName } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  if (!(await isStaffSession())) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const content = body.content?.trim() ?? "";
  if (!content) {
    return Response.json({ message: "Message content is required." }, { status: 400 });
  }

  const assignedTo = await readStaffName();
  const session = await sendStaffReply(id, content, assignedTo);
  if (!session) {
    return Response.json({ message: "Conversation not found." }, { status: 404 });
  }

  return Response.json({ session });
}
