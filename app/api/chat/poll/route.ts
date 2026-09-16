import { readGuestSessionId } from "@/lib/guest-session";
import { readSession } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessionId = await readGuestSessionId();
  if (!sessionId) {
    return Response.json({
      mode: "ai",
      messages: [],
      sessionId: null,
      assignedTo: null,
    });
  }

  const session = readSession(sessionId);
  if (!session) {
    return Response.json({
      mode: "ai",
      messages: [],
      sessionId,
      assignedTo: null,
    });
  }

  const url = new URL(request.url);
  const after = url.searchParams.get("after");
  const messages = after
    ? session.messages.filter((message) => message.at > after)
    : session.messages;

  return Response.json({
    mode: session.mode ?? "ai",
    messages,
    sessionId: session.id,
    assignedTo: session.assignedTo,
  });
}
