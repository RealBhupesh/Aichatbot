import { processChatRequest } from "@/lib/chat";
import { readGuestSessionId, setGuestSessionId } from "@/lib/guest-session";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    logger.warn("chat.malformed_json");
    return Response.json(
      {
        success: false,
        type: "error",
        intent: "validation",
        message: "Please send a JSON body with a message.",
        availabilityRequired: false,
        missingFields: [],
        rooms: [],
        images: [],
        actions: [],
        suggestions: [],
        data: null,
      },
      { status: 400 },
    );
  }

  const sessionId = await readGuestSessionId();
  const { status, payload } = await processChatRequest(body, { sessionId });

  if (payload.sessionId) {
    await setGuestSessionId(payload.sessionId);
  }

  return Response.json(payload, { status });
}
