import { hasLiveLlm } from "@/lib/ai";
import { runAgentStream } from "@/lib/agent-stream";
import {
  handleChatAction,
  persistChatTurn,
  prepareRequestWithSession,
} from "@/lib/chat-actions";
import { processChatRequest, processValidationError } from "@/lib/chat";
import { readGuestSessionId, setGuestSessionId } from "@/lib/guest-session";
import { logger } from "@/lib/logger";
import { chatRequestSchema } from "@/lib/schemas";
import { createEventStream } from "@/lib/stream-events";
import { getOrCreateSession, readSession } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    logger.warn("chat.stream_malformed_json");
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

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    const { status, payload } = processValidationError(parsed.error);
    return Response.json(payload, { status });
  }

  const shouldUseJson =
    parsed.data.action ||
    parsed.data.source === "availability_form" ||
    !hasLiveLlm() ||
    process.env.AGENT_MODE === "false" ||
    process.env.STREAM_MODE === "false";

  if (shouldUseJson) {
    const sessionId = await readGuestSessionId();
    const { status, payload } = await processChatRequest(body, { sessionId });
    if (payload.sessionId) {
      await setGuestSessionId(payload.sessionId);
    }
    return Response.json(payload, { status });
  }

  const session = getOrCreateSession(await readGuestSessionId());
  const now = new Date();
  const prepared = prepareRequestWithSession(parsed.data, session.id, now);
  const activeSession = prepared.session ?? session;
  const hydratedRequest = prepared.request;
  const liveSession = readSession(activeSession.id) ?? activeSession;

  if (liveSession.mode === "staff") {
    const { status, payload } = await processChatRequest(body, { sessionId: activeSession.id });
    if (payload.sessionId) {
      await setGuestSessionId(payload.sessionId);
    }
    return Response.json(payload, { status });
  }

  const actionResponse = handleChatAction(hydratedRequest, activeSession, now);
  if (actionResponse) {
    const payload = {
      ...actionResponse,
      sessionId: activeSession.id,
    };
    persistChatTurn(activeSession.id, hydratedRequest, payload);
    await setGuestSessionId(activeSession.id);
    return Response.json(payload, { status: 200 });
  }

  const stream = createEventStream(async (emit) => {
    try {
      const payload = await runAgentStream({
        request: hydratedRequest,
        session: readSession(activeSession.id) ?? activeSession,
        now,
        sessionId: activeSession.id,
        onEvent: emit,
      });
      persistChatTurn(activeSession.id, hydratedRequest, payload);
    } catch {
      emit({
        type: "error",
        message: "I'm having trouble generating a response right now. Please try again.",
      });
    }
  });

  await setGuestSessionId(session.id);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
