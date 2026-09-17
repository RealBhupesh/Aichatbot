import {
  availabilitySearchToChatResponse,
  missingStayFields,
  type AvailabilitySearchResult,
} from "@/lib/availability-search";
import { looksLikeAvailabilityIntent } from "@/lib/availability-intent";
import { greetingAnswer } from "@/lib/answers";
import { attachFollowUpSuggestions } from "@/lib/follow-up-suggestions";
import { filterAnswerImages, imagesForAnswer } from "@/lib/media";
import {
  buildCatalogRooms,
  looksLikeRoomCatalogRequest,
  roomCatalogIntro,
  stripMarkdownTables,
} from "@/lib/room-catalog";
import type { PrepareHoldResult, PendingChange, BookingHold } from "@/lib/bookings";
import type { ChatResponse, Intent } from "@/lib/schemas";
import type { ToolTrace } from "@/lib/tools";

type ToolSuccess = {
  status: "success";
  intent?: Intent | string;
  message: string;
  images?: Array<{ src: string; alt: string; caption?: string }>;
  roomId?: string | null;
  guests?: number | null;
};

type ToolNotFound = {
  status: "not_found";
  intent?: Intent | string;
  message: string;
  images?: Array<{ src: string; alt: string; caption?: string }>;
};

function isAvailabilityResult(output: unknown): output is AvailabilitySearchResult {
  if (!output || typeof output !== "object" || !("status" in output)) {
    return false;
  }

  const status = (output as { status: string }).status;
  return status === "success" || status === "missing_fields" || status === "error";
}

function isToolSuccess(output: unknown): output is ToolSuccess {
  return Boolean(output) && typeof output === "object" && (output as ToolSuccess).status === "success";
}

function isToolNotFound(output: unknown): output is ToolNotFound {
  return Boolean(output) && typeof output === "object" && (output as ToolNotFound).status === "not_found";
}

function latestTrace(trace: ToolTrace[], toolName: string) {
  return [...trace].reverse().find((entry) => entry.toolName === toolName);
}

function isPrepareHoldResult(output: unknown): output is PrepareHoldResult {
  if (!output || typeof output !== "object" || !("status" in output)) {
    return false;
  }

  const status = (output as { status: string }).status;
  return status === "pending_confirmation" || status === "pending_staff" || status === "error";
}

function isLookupResult(
  output: unknown,
): output is { status: "found"; hold: BookingHold; message: string } | { status: "not_found"; message: string } {
  if (!output || typeof output !== "object" || !("status" in output)) {
    return false;
  }
  const status = (output as { status: string }).status;
  return status === "found" || status === "not_found";
}

function isPendingChangeResult(
  output: unknown,
): output is
  | { status: "pending_change"; pendingChange: PendingChange; hold: BookingHold; message: string }
  | { status: "error"; message: string } {
  if (!output || typeof output !== "object" || !("status" in output)) {
    return false;
  }
  const status = (output as { status: string }).status;
  return status === "pending_change" || status === "error";
}

function holdActionData(hold: { checkIn: string; checkOut: string; guests: number; roomName: string; guestName: string; totalPrice: number; roomId: string; confirmationCode?: string; id?: string; nights?: number }) {
  return {
    checkIn: hold.checkIn,
    checkOut: hold.checkOut,
    guests: hold.guests,
    nights: hold.nights ?? null,
    roomName: hold.roomName,
    guestName: hold.guestName,
    totalPrice: hold.totalPrice,
    selectedRoomId: hold.roomId,
    confirmationCode: hold.confirmationCode ?? null,
    holdId: hold.id ?? null,
  };
}

export function buildAgentChatResponse({
  text,
  trace,
  message,
  provider,
  model,
  sessionId,
}: {
  text: string;
  trace: ToolTrace[];
  message: string;
  provider: string;
  model: string | null;
  sessionId?: string | null;
}): ChatResponse {
  return attachFollowUpSuggestions(buildAgentChatResponseBody({
    text,
    trace,
    message,
    provider,
    model,
    sessionId,
  }));
}

function buildAgentChatResponseBody({
  text,
  trace,
  message,
  provider,
  model,
  sessionId,
}: {
  text: string;
  trace: ToolTrace[];
  message: string;
  provider: string;
  model: string | null;
  sessionId?: string | null;
}): ChatResponse {
  const holdTrace = latestTrace(trace, "prepareBookingHold");
  if (holdTrace && isPrepareHoldResult(holdTrace.output)) {
    if (holdTrace.output.status === "pending_staff") {
      const hold = holdTrace.output.hold;
      return {
        success: true,
        type: "booking_requested",
        intent: "availability",
        message: text.trim() || holdTrace.output.message,
        availabilityRequired: false,
        missingFields: [],
        rooms: [],
        images: filterAnswerImages(
          imagesForAnswer("room_info", hold.roomName, hold.roomId, hold.guests),
        ),
        actions: [],
        suggestions: [],
        sessionId: sessionId ?? undefined,
        provider,
        model,
        data: {
          checkIn: hold.checkIn,
          checkOut: hold.checkOut,
          guests: hold.guests,
          nights: hold.nights,
          roomName: hold.roomName,
          guestName: hold.guestName,
          guestPhone: hold.guestPhone,
          totalPrice: hold.totalPrice,
          selectedRoomId: hold.roomId,
          holdId: hold.id,
        },
      };
    }

    if (holdTrace.output.status === "pending_confirmation") {
      const hold = holdTrace.output.pendingHold;
      return {
        success: true,
        type: "booking_hold",
        intent: "availability",
        message: text.trim() || holdTrace.output.message,
        availabilityRequired: false,
        missingFields: [],
        rooms: [],
        images: filterAnswerImages(
          imagesForAnswer("room_info", hold.roomName, hold.roomId, hold.guests),
        ),
        actions: [],
        suggestions: [],
        sessionId: sessionId ?? undefined,
        provider,
        model,
        data: {
          checkIn: hold.checkIn,
          checkOut: hold.checkOut,
          guests: hold.guests,
          nights: hold.nights,
          holdToken: holdTrace.output.holdToken,
          roomName: hold.roomName,
          guestName: hold.guestName,
          totalPrice: hold.totalPrice,
          selectedRoomId: hold.roomId,
        },
      };
    }

    return {
      success: false,
      type: "error",
      intent: "availability",
      message: text.trim() || holdTrace.output.message,
      availabilityRequired: false,
      missingFields: [],
      rooms: [],
      images: [],
      actions: [],
      suggestions: [],
      sessionId: sessionId ?? undefined,
      provider,
      model,
      data: null,
    };
  }

  const changeTrace = latestTrace(trace, "prepareReservationChange");
  if (changeTrace && isPendingChangeResult(changeTrace.output)) {
    if (changeTrace.output.status === "pending_change") {
      const change = changeTrace.output.pendingChange;
      return {
        success: true,
        type: "answer",
        intent: "availability",
        message: text.trim() || changeTrace.output.message,
        availabilityRequired: false,
        missingFields: [],
        rooms: [],
        images: filterAnswerImages(
          imagesForAnswer("room_info", change.roomName, change.roomId, change.guests),
        ),
        actions: [
          {
            type: "confirm_modify",
            label: "Confirm change",
            holdId: change.holdId,
          },
          {
            type: "cancel_modify",
            label: "Keep current stay",
          },
        ],
        suggestions: [],
        sessionId: sessionId ?? undefined,
        provider,
        model,
        data: {
          checkIn: change.checkIn,
          checkOut: change.checkOut,
          guests: change.guests,
          nights: change.nights,
          roomName: change.roomName,
          totalPrice: change.totalPrice,
          selectedRoomId: change.roomId,
          confirmationCode: change.confirmationCode,
          holdId: change.holdId,
        },
      };
    }

    return {
      success: false,
      type: "error",
      intent: "availability",
      message: text.trim() || changeTrace.output.message,
      availabilityRequired: false,
      missingFields: [],
      rooms: [],
      images: [],
      actions: [],
      suggestions: [],
      sessionId: sessionId ?? undefined,
      provider,
      model,
      data: null,
    };
  }

  const lookupTrace = latestTrace(trace, "lookupReservation");
  if (lookupTrace && isLookupResult(lookupTrace.output)) {
    if (lookupTrace.output.status === "found") {
      const hold = lookupTrace.output.hold;
      const cancelable = hold.status === "confirmed";
      return {
        success: true,
        type: "answer",
        intent: "availability",
        message: text.trim() || lookupTrace.output.message,
        availabilityRequired: false,
        missingFields: [],
        rooms: [],
        images: filterAnswerImages(
          imagesForAnswer("room_info", hold.roomName, hold.roomId, hold.guests),
        ),
        actions: cancelable
          ? [
              {
                type: "confirm_cancel",
                label: "Cancel this hold",
                holdId: hold.id,
              },
              {
                type: "keep_reservation",
                label: "Keep it",
              },
            ]
          : [],
        suggestions: [],
        sessionId: sessionId ?? undefined,
        provider,
        model,
        data: {
          ...holdActionData(hold),
          specialRequests: hold.specialRequests,
        },
      };
    }

    return {
      success: true,
      type: "answer",
      intent: "availability",
      message: text.trim() || lookupTrace.output.message,
      availabilityRequired: false,
      missingFields: [],
      rooms: [],
      images: [],
      actions: [],
      suggestions: [],
      sessionId: sessionId ?? undefined,
      provider,
      model,
      data: null,
    };
  }

  const availabilityTrace = latestTrace(trace, "checkAvailability");
  if (availabilityTrace && isAvailabilityResult(availabilityTrace.output)) {
    const payload = availabilitySearchToChatResponse(availabilityTrace.output);
    return {
      ...payload,
      message: text.trim() || payload.message,
      actions: payload.actions ?? [],
      suggestions: payload.suggestions ?? [],
      sessionId: sessionId ?? undefined,
      provider,
      model,
    };
  }

  const informationalTools = [
    "addSpecialRequest",
    "escalateToStaff",
    "getHotelInfo",
    "getRoomDetails",
    "getPolicy",
    "getAmenityInfo",
    "searchFaqs",
  ] as const;
  for (const toolName of informationalTools) {
    const entry = latestTrace(trace, toolName);
    if (!entry) {
      continue;
    }

    if (isToolNotFound(entry.output)) {
      return {
        success: true,
        type: "fallback",
        intent: "unsupported",
        message: text.trim() || entry.output.message,
        availabilityRequired: false,
        missingFields: [],
        rooms: [],
        images: filterAnswerImages(entry.output.images ?? []),
        provider,
        model,
        actions: [],
        suggestions: [],
        sessionId: sessionId ?? undefined,
        data: null,
      };
    }

    if (isToolSuccess(entry.output)) {
      const intent = (entry.output.intent as Intent) || inferIntentFromTool(toolName);
      const catalogRooms =
        intent === "room_info"
          ? buildCatalogRooms({
              roomId: entry.output.roomId,
              guests: entry.output.guests,
              query: message,
            })
          : [];
      const rawMessage = text.trim() || entry.output.message;
      const displayMessage =
        catalogRooms.length > 1 && looksLikeRoomCatalogRequest(message)
          ? roomCatalogIntro(catalogRooms.length)
          : catalogRooms.length > 1 && /\|.+\|/.test(rawMessage)
            ? stripMarkdownTables(rawMessage) || roomCatalogIntro(catalogRooms.length)
            : rawMessage;

      return {
        success: true,
        type: "answer",
        intent,
        message: displayMessage,
        availabilityRequired: false,
        missingFields: [],
        rooms: catalogRooms,
        images: filterAnswerImages(
          entry.output.images ??
            imagesForAnswer(intent, message, entry.output.roomId, entry.output.guests),
        ),
        actions: [],
        suggestions: [],
        sessionId: sessionId ?? undefined,
        provider,
        model,
        data: {
          checkIn: null,
          checkOut: null,
          guests: entry.output.guests ?? null,
          catalog: catalogRooms.length > 0,
        },
      };
    }
  }

  if (looksLikeAvailabilityIntent(message)) {
    const missing = missingStayFields({
      checkIn: null,
      checkOut: null,
      guests: null,
    });
    const payload = availabilitySearchToChatResponse({
      status: "missing_fields",
      missingFields: missing,
      checkIn: null,
      checkOut: null,
      guests: null,
      message: "Pick your check-in and check-out on the calendar below, then choose guest count and times.",
    });
    return {
      ...payload,
      sessionId: sessionId ?? undefined,
      provider,
      model,
    };
  }

  const lower = message.toLowerCase();
  const intent: Intent =
    /^(hi+|hey+|hello+|how'?s it going|good (morning|afternoon|evening))/i.test(message.trim())
      ? "smalltalk"
      : "hotel_info";

  return {
    success: true,
    type: "answer",
    intent,
    message: text.trim() || greetingAnswer(),
    availabilityRequired: false,
    missingFields: [],
    rooms: [],
    images: filterAnswerImages(imagesForAnswer(intent, lower)),
    actions: [],
    suggestions: [],
    sessionId: sessionId ?? undefined,
    provider,
    model,
    data: null,
  };
}

function inferIntentFromTool(toolName: string): Intent {
  switch (toolName) {
    case "getRoomDetails":
      return "room_info";
    case "getPolicy":
      return "policy";
    case "getAmenityInfo":
      return "amenity";
    default:
      return "hotel_info";
  }
}
