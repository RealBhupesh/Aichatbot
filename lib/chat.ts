import {
  breakfastAnswer,
  greetingAnswer,
  groundedMessage,
  missingAvailabilityPrompt,
  roomsForGuestCountAnswer,
  unsupportedAnswer,
} from "@/lib/answers";
import { checkAvailability as defaultCheckAvailability } from "@/lib/availability";
import {
  availabilitySearchToChatResponse,
  missingStayFields,
  searchAvailability,
  type AvailabilityFn,
} from "@/lib/availability-search";
import { runAgentTurn } from "@/lib/agent";
import { interpretGuestMessage as defaultInterpret, hasLiveLlm, llmRuntime } from "@/lib/ai";
import { AssistantModelError } from "@/lib/ai";
import { logger } from "@/lib/logger";
import { filterAnswerImages, imagesForAnswer } from "@/lib/media";
import {
  buildCatalogRooms,
  looksLikeRoomCatalogRequest,
  roomCatalogIntro,
} from "@/lib/room-catalog";
import { extractRoomPreference, type RoomPreference } from "@/lib/dates";
import {
  chatRequestSchema,
  type AssistantUnderstanding,
  type ChatRequest,
  type ChatResponse,
  type Intent,
} from "@/lib/schemas";
import {
  asIsoDate,
  addDays,
  extractMaxBudget,
  extractNightCount,
  inferStayFromMessage,
  parseIsoDate,
  shouldDefaultStay,
  toIsoDate,
  utcToday,
} from "@/lib/dates";
import {
  handleChatAction,
  persistChatTurn,
  prepareRequestWithSession,
} from "@/lib/chat-actions";
import { getOrCreateSession, readSession } from "@/lib/sessions";
import { attachFollowUpSuggestions } from "@/lib/follow-up-suggestions";
import { resolveFollowUpIntent, isGreeting } from "@/lib/interpreter";

export type InterpretFn = typeof defaultInterpret;

export type ChatDependencies = {
  interpretGuestMessage: InterpretFn;
  checkAvailability: AvailabilityFn;
  now: Date;
  sessionId?: string | null;
  persistSession?: boolean;
};

const defaultDependencies: ChatDependencies = {
  interpretGuestMessage: defaultInterpret,
  checkAvailability: defaultCheckAvailability,
  now: new Date(),
};

const AI_FAILURE_MESSAGE =
  "I'm having trouble generating a response right now. Please try again.";
const AVAILABILITY_FAILURE_MESSAGE =
  "I couldn't check room availability right now. Please try again shortly.";
const VALIDATION_FALLBACK =
  "I couldn't read that request. Please try again with a shorter message.";

function emptyResponse(
  partial: Omit<
    ChatResponse,
    | "rooms"
    | "missingFields"
    | "availabilityRequired"
    | "data"
    | "images"
    | "actions"
    | "suggestions"
    | "mode"
  > &
    Partial<
      Pick<
        ChatResponse,
        | "rooms"
        | "missingFields"
        | "availabilityRequired"
        | "data"
        | "images"
        | "actions"
        | "suggestions"
        | "mode"
      >
    >,
): ChatResponse {
  return {
    rooms: [],
    images: [],
    missingFields: [],
    availabilityRequired: false,
    actions: [],
    suggestions: [],
    data: null,
    ...partial,
  };
}

function finalizeResponse(
  request: ChatRequest,
  payload: ChatResponse,
  sessionId: string | null,
  persistSession: boolean,
) {
  const withSession = attachFollowUpSuggestions({
    ...payload,
    sessionId: sessionId ?? payload.sessionId,
  });

  if (persistSession && sessionId) {
    persistChatTurn(sessionId, request, withSession);
  }

  return withSession;
}

function stayFromHistory(
  history: ChatRequest["history"],
  now: Date,
): { checkIn: string | null; checkOut: string | null; guests: number | null } {
  const text = history
    .slice(-6)
    .map((item) => item.content)
    .join("\n");
  const inferred = inferStayFromMessage(text, now);
  return {
    checkIn: inferred.checkIn,
    checkOut: inferred.checkOut,
    guests: inferred.guests,
  };
}

function mergeStay(
  fromClient: ChatRequest["availability"],
  fromModel: AssistantUnderstanding["availability"],
  message: string,
  now: Date,
  history: ChatRequest["history"] = [],
) {
  const inferred = inferStayFromMessage(message, now);
  const fromHistory = stayFromHistory(history, now);
  let checkIn = asIsoDate(
    fromClient?.checkIn || fromModel.checkIn || inferred.checkIn || fromHistory.checkIn,
    now,
  );
  let checkOut = asIsoDate(
    fromClient?.checkOut || fromModel.checkOut || inferred.checkOut || fromHistory.checkOut,
    now,
  );
  const guests =
    typeof fromClient?.guests === "number"
      ? fromClient.guests
      : typeof fromModel.guests === "number"
        ? fromModel.guests
        : inferred.guests ?? fromHistory.guests;

  if (checkIn && !checkOut) {
    const start = parseIsoDate(checkIn);
    const nights = extractNightCount(message) ?? 1;
    if (start) {
      checkOut = toIsoDate(addDays(start, nights));
    }
  }

  let resolvedGuests = guests;
  if (typeof resolvedGuests !== "number" && shouldDefaultStay(message)) {
    resolvedGuests = 2;
  }

  if (!checkIn && shouldDefaultStay(message)) {
    checkIn = toIsoDate(addDays(utcToday(now), 1));
    checkOut = toIsoDate(addDays(utcToday(now), 2));
  }

  return {
    checkIn,
    checkOut,
    guests: resolvedGuests,
    maxBudget: extractMaxBudget(message) ?? inferred.maxBudget,
  };
}

function looksLikeAvailability(message: string, source: ChatRequest["source"]) {
  if (source === "availability_form") {
    return true;
  }

  if (/what time is check-?in|check-?in time|check-?out time/i.test(message)) {
    return false;
  }

  return /available|availability|any rooms|vacanc|this weekend|next weekend|book a room|book the |book me|reserve|cheapest room|wanna check in|want to check in|checking in|need a room|get me a room|i want a room|wanna book|check.*rooms?|rooms? under|under\s+\d|below\s+\d|less than|budget|within.*budget/i.test(
    message,
  );
}

export function processValidationError(error: unknown): {
  status: number;
  payload: ChatResponse;
} {
  if (error && typeof error === "object" && "issues" in error) {
    logger.warn("chat.validation_failed");
    const issues = (error as { issues: Array<{ message?: string }> }).issues;
    const message = issues[0]?.message || VALIDATION_FALLBACK;
    return {
      status: 400,
      payload: emptyResponse({
        success: false,
        type: "error",
        intent: "validation",
        message,
      }),
    };
  }

  return {
    status: 400,
    payload: emptyResponse({
      success: false,
      type: "error",
      intent: "validation",
      message: VALIDATION_FALLBACK,
    }),
  };
}

function runAvailability(
  stay: { checkIn: string; checkOut: string; guests: number },
  checkAvailability: AvailabilityFn,
  now: Date,
  preference: RoomPreference = null,
  maxBudget: number | null = null,
): ChatResponse {
  const result = searchAvailability(
    {
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      adults: stay.guests,
      preference,
      maxBudget,
    },
    now,
    checkAvailability,
  );

  if (result.status === "error") {
    logger.error("availability.tool_failed");
  }

  return emptyResponse(availabilitySearchToChatResponse(result));
}

function usableLiveReply(reply: string | undefined) {
  const liveReply = reply?.trim() ?? "";
  if (!liveReply) {
    return "";
  }
  if (/as an ai|language model/i.test(liveReply)) {
    return "";
  }
  return liveReply;
}

function mustUseGroundedFact(intent: Intent, message: string) {
  if (intent === "hotel_info" && /check-?in|check-?out|what time/i.test(message)) {
    return true;
  }
  if (intent === "amenity" && /pool|swimming/i.test(message)) {
    return true;
  }
  if (intent === "policy" && /cancel/i.test(message)) {
    return true;
  }
  if (intent === "room_info" && /\b(3|three)\b/i.test(message) && /guest/i.test(message)) {
    return true;
  }
  return false;
}

function factualReply(
  intent: Intent,
  message: string,
  understanding: AssistantUnderstanding,
) {
  const roomId = understanding.referencedRoomId;
  const guests = understanding.availability.guests;
  const liveReply = usableLiveReply(understanding.reply);

  if (intent === "unsupported") {
    return unsupportedAnswer(understanding.unsupportedTopic);
  }

  if (intent === "smalltalk" || isGreeting(message)) {
    if (liveReply && !/you can reach the team at|is in calangute/i.test(liveReply)) {
      return liveReply;
    }
    return greetingAnswer();
  }

  if (intent === "room_info" && /breakfast/i.test(message) && roomId) {
    return breakfastAnswer(roomId);
  }

  if (intent === "room_info" && typeof guests === "number" && !roomId) {
    return roomsForGuestCountAnswer(guests);
  }

  if (mustUseGroundedFact(intent, message)) {
    return groundedMessage(intent, message, roomId, guests);
  }

  if (liveReply) {
    return liveReply;
  }

  if (intent === "amenity" || intent === "policy" || intent === "hotel_info" || intent === "room_info") {
    return groundedMessage(intent, message, roomId, guests);
  }

  return understanding.reply;
}

export async function processChatRequest(
  body: unknown,
  deps: Partial<ChatDependencies> = {},
): Promise<{ status: number; payload: ChatResponse }> {
  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return processValidationError(parsed.error);
  }

  const request = parsed.data;
  const now = deps.now ?? defaultDependencies.now;
  const interpret = deps.interpretGuestMessage ?? defaultDependencies.interpretGuestMessage;
  const checkAvailability = deps.checkAvailability ?? defaultDependencies.checkAvailability;
  const persistSession = deps.persistSession ?? interpret === defaultInterpret;
  const session = getOrCreateSession(deps.sessionId ?? null);
  const sessionId = session.id;
  const prepared = prepareRequestWithSession(request, sessionId, now);
  const activeSession = prepared.session ?? session;
  const hydratedRequest = prepared.request;
  const useAgent =
    interpret === defaultInterpret && hasLiveLlm() && process.env.AGENT_MODE !== "false";
  const runtime = useAgent
    ? llmRuntime()
    : interpret === defaultInterpret
      ? llmRuntime()
      : { provider: "rules" as const, model: null };

  try {
    const actionResponse = handleChatAction(hydratedRequest, activeSession, now);
    if (actionResponse) {
      return {
        status: 200,
        payload: finalizeResponse(hydratedRequest, actionResponse, sessionId, persistSession),
      };
    }

    const liveSession = readSession(sessionId) ?? activeSession;
    if (liveSession.mode === "staff" && !hydratedRequest.action) {
      return {
        status: 200,
        payload: finalizeResponse(
          hydratedRequest,
          emptyResponse({
            success: true,
            type: "answer",
            intent: "hotel_info",
            message: "",
            mode: "staff",
          }),
          sessionId,
          persistSession,
        ),
      };
    }

    if (useAgent && hydratedRequest.source !== "availability_form") {
      const payload = await runAgentTurn({
        request: hydratedRequest,
        session: readSession(sessionId) ?? activeSession,
        now,
        sessionId,
      });
      return {
        status: 200,
        payload: finalizeResponse(hydratedRequest, payload, sessionId, persistSession),
      };
    }

    if (hydratedRequest.source === "availability_form") {
      logger.info("chat.intent", { intent: "availability", source: hydratedRequest.source });
      const stay = mergeStay(
        hydratedRequest.availability,
        {
          checkIn: null,
          checkOut: null,
          guests: null,
        },
        hydratedRequest.message,
        now,
        hydratedRequest.history,
      );
      const missing = missingStayFields(stay);
      if (missing.length > 0) {
        return {
          status: 200,
          payload: finalizeResponse(
            hydratedRequest,
            emptyResponse({
              success: true,
              type: "availability_request",
              intent: "availability",
              message: missingAvailabilityPrompt(missing),
              availabilityRequired: true,
              missingFields: missing,
              images: imagesForAnswer("availability", hydratedRequest.message),
              provider: runtime.provider,
              model: runtime.model,
              data: { missingFields: missing, ...stay },
            }),
            sessionId,
            persistSession,
          ),
        };
      }

      return {
        status: 200,
        payload: finalizeResponse(
          hydratedRequest,
          runAvailability(
            {
              checkIn: stay.checkIn as string,
              checkOut: stay.checkOut as string,
              guests: stay.guests as number,
            },
            checkAvailability,
            now,
            extractRoomPreference(hydratedRequest.message),
            stay.maxBudget ?? activeSession.stay.maxBudget,
          ),
          sessionId,
          persistSession,
        ),
      };
    }

    const understanding = await interpret({
      message: hydratedRequest.message,
      history: hydratedRequest.history,
      now,
    });

    const intent = resolveFollowUpIntent(
      hydratedRequest.message,
      hydratedRequest.history,
      understanding.intent,
    );

    logger.info("chat.intent", { intent, source: hydratedRequest.source });

    const stay = mergeStay(
      hydratedRequest.availability,
      understanding.availability,
      hydratedRequest.message,
      now,
      hydratedRequest.history,
    );
    const availabilityIntent =
      intent === "availability" ||
      looksLikeAvailability(hydratedRequest.message, hydratedRequest.source);

    if (availabilityIntent) {
      const missing = missingStayFields(stay);
      if (missing.length > 0) {
        return {
          status: 200,
          payload: finalizeResponse(
            hydratedRequest,
            emptyResponse({
              success: true,
              type: "availability_request",
              intent: "availability",
              message: missingAvailabilityPrompt(missing),
              availabilityRequired: true,
              missingFields: missing,
              images: imagesForAnswer("availability", hydratedRequest.message),
              provider: runtime.provider,
              model: runtime.model,
              data: { missingFields: missing, ...stay },
            }),
            sessionId,
            persistSession,
          ),
        };
      }

      return {
        status: 200,
        payload: finalizeResponse(
          hydratedRequest,
          runAvailability(
            {
              checkIn: stay.checkIn as string,
              checkOut: stay.checkOut as string,
              guests: stay.guests as number,
            },
            checkAvailability,
            now,
            extractRoomPreference(hydratedRequest.message),
            stay.maxBudget ?? activeSession.stay.maxBudget,
          ),
          sessionId,
          persistSession,
        ),
      };
    }

    const message = factualReply(intent, hydratedRequest.message, {
      ...understanding,
      intent,
    });
    const catalogRooms =
      intent === "room_info"
        ? buildCatalogRooms({
            roomId: understanding.referencedRoomId,
            guests: stay.guests,
            query: hydratedRequest.message,
          })
        : [];
    const displayMessage =
      catalogRooms.length > 1 && looksLikeRoomCatalogRequest(hydratedRequest.message)
        ? roomCatalogIntro(catalogRooms.length)
        : message;

    return {
      status: 200,
      payload: finalizeResponse(
        hydratedRequest,
        emptyResponse({
          success: true,
          type: intent === "unsupported" ? "fallback" : "answer",
          intent,
          message: displayMessage,
          rooms: catalogRooms,
          images: filterAnswerImages(
            imagesForAnswer(
              intent,
              hydratedRequest.message,
              understanding.referencedRoomId,
              stay.guests,
            ),
          ),
          provider: runtime.provider,
          model: runtime.model,
          data: {
            checkIn: stay.checkIn,
            checkOut: stay.checkOut,
            guests: stay.guests,
            catalog: catalogRooms.length > 0,
          },
        }),
        sessionId,
        persistSession,
      ),
    };
  } catch (error) {
    if (error instanceof AssistantModelError) {
      logger.error("ai.provider_failed");
      return {
        status: 200,
        payload: emptyResponse({
          success: false,
          type: "error",
          intent: "error",
          message: AI_FAILURE_MESSAGE,
        }),
      };
    }

    logger.error("chat.unexpected_exception", {
      name: error instanceof Error ? error.name : "unknown",
    });

    return {
      status: 200,
      payload: emptyResponse({
        success: false,
        type: "error",
        intent: "error",
        message: AI_FAILURE_MESSAGE,
      }),
    };
  }
}
