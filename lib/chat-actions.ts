import { cancelConfirmedHold, modifyConfirmedHold, prepareBookingHold, submitBookingRequest, verifyHoldToken } from "@/lib/bookings";
import { getRoomById } from "@/lib/hotel";
import { filterAnswerImages, imagesForAnswer } from "@/lib/media";
import { notifyStaffBookingRequest } from "@/lib/notifications";
import {
  hydrateSessionHistory,
  syncConversationContextFromMessage,
} from "@/lib/conversation-context";
import {
  appendSessionMessages,
  readSession,
  syncStayFromResponse,
  updateSession,
  type GuestSession,
} from "@/lib/sessions";
import type { ChatRequest, ChatResponse } from "@/lib/schemas";

function emptyResponse(
  partial: Omit<
    ChatResponse,
    "rooms" | "missingFields" | "availabilityRequired" | "data" | "images" | "actions" | "suggestions"
  > &
    Partial<
      Pick<
        ChatResponse,
        "rooms" | "missingFields" | "availabilityRequired" | "data" | "images" | "actions" | "suggestions"
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

export function handleChatAction(
  request: ChatRequest,
  session: GuestSession,
  now = new Date(),
): ChatResponse | null {
  if (!request.action) {
    return null;
  }

  switch (request.action.type) {
    case "confirm_hold":
      return handleConfirmHold(request, session, now);
    case "cancel_hold":
      return handleCancelHold(session);
    case "select_room":
    case "hold_room":
      return handleSelectRoom(request, session, now);
    case "confirm_modify":
      return handleConfirmModify(request, session, now);
    case "cancel_modify":
      return handleCancelModify(session);
    case "confirm_cancel":
      return handleConfirmCancel(request, session);
    case "keep_reservation":
      return handleKeepReservation(session);
    default:
      return null;
  }
}

function listedContact(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || /^(n\/a|not provided)$/i.test(trimmed)) {
    return null;
  }
  return trimmed.replace(/\.$/, "");
}

function parseContactFromMessage(message: string) {
  const email = listedContact(message.match(/Email:\s*([^\n]+)/i)?.[1]);
  const phone = listedContact(message.match(/Phone:\s*([^\n]+)/i)?.[1]);
  const guestName = message.match(/for (.+?)\. Email:/i)?.[1]?.trim() ?? null;
  return { email, phone, guestName };
}

function bookingRequestedResponse(sessionId: string, hold: {
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  roomName: string;
  roomId: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  totalPrice: number;
  id: string;
}, message: string): ChatResponse {
  return emptyResponse({
    success: true,
    type: "booking_requested",
    intent: "availability",
    message,
    images: filterAnswerImages(imagesForAnswer("room_info", hold.roomName, hold.roomId, hold.guests)),
    sessionId,
    data: {
      checkIn: hold.checkIn,
      checkOut: hold.checkOut,
      guests: hold.guests,
      nights: hold.nights,
      roomName: hold.roomName,
      guestName: hold.guestName,
      guestEmail: hold.guestEmail,
      guestPhone: hold.guestPhone,
      totalPrice: hold.totalPrice,
      selectedRoomId: hold.roomId,
      holdId: hold.id,
    },
  });
}

function handleConfirmHold(request: ChatRequest, session: GuestSession, now: Date): ChatResponse {
  const holdToken = request.action?.holdToken ?? session.pendingHold?.token;
  const pendingHold = session.pendingHold
    ? { ...session.pendingHold, sessionId: session.pendingHold.sessionId ?? session.id }
    : null;
  if (!holdToken || !pendingHold || !verifyHoldToken(holdToken, pendingHold, now)) {
    updateSession(session.id, { pendingHold: null });
    return emptyResponse({
      success: false,
      type: "error",
      intent: "availability",
      message: "That booking request is no longer valid. I can send a new one to the desk if you still want the room.",
      sessionId: session.id,
    });
  }

  const result = submitBookingRequest(pendingHold, now);
  if (result.status === "error") {
    return emptyResponse({
      success: false,
      type: "error",
      intent: "availability",
      message: result.message,
      sessionId: session.id,
    });
  }

  updateSession(session.id, {
    pendingHold,
    guest: {
      name: pendingHold.guestName,
      email: pendingHold.guestEmail,
      phone: pendingHold.guestPhone,
    },
  });
  void notifyStaffBookingRequest(result.hold);

  return bookingRequestedResponse(session.id, result.hold, result.message);
}

function handleCancelHold(session: GuestSession): ChatResponse {
  updateSession(session.id, { pendingHold: null });
  const message = "No problem — I cancelled that hold. Tell me if you'd like to check another room or date.";

  return emptyResponse({
    success: true,
    type: "answer",
    intent: "availability",
    message,
    sessionId: session.id,
  });
}

function handleConfirmModify(request: ChatRequest, session: GuestSession, now: Date): ChatResponse {
  const pendingChange = session.pendingChange;
  if (!pendingChange || new Date(pendingChange.expiresAt).getTime() < now.getTime()) {
    updateSession(session.id, { pendingChange: null });
    return emptyResponse({
      success: false,
      type: "error",
      intent: "availability",
      message: "That change request expired. Tell me the new dates or room and I'll prepare it again.",
      sessionId: session.id,
    });
  }

  const result = modifyConfirmedHold(
    pendingChange.holdId,
    {
      checkIn: pendingChange.checkIn,
      checkOut: pendingChange.checkOut,
      roomId: pendingChange.roomId,
      guests: pendingChange.guests,
    },
    now,
  );

  if (result.status === "error") {
    return emptyResponse({
      success: false,
      type: "error",
      intent: "availability",
      message: result.message,
      sessionId: session.id,
    });
  }

  updateSession(session.id, {
    pendingChange: null,
    lastConfirmationCode: result.hold.confirmationCode,
    stay: {
      checkIn: result.hold.checkIn,
      checkOut: result.hold.checkOut,
      guests: result.hold.guests,
      selectedRoomId: result.hold.roomId,
      maxBudget: session.stay.maxBudget,
    },
  });

  return emptyResponse({
    success: true,
    type: "booking_modified",
    intent: "availability",
    message: result.message,
    images: filterAnswerImages(
      imagesForAnswer("room_info", result.hold.roomName, result.hold.roomId, result.hold.guests),
    ),
    sessionId: session.id,
    data: {
      checkIn: result.hold.checkIn,
      checkOut: result.hold.checkOut,
      guests: result.hold.guests,
      nights: result.hold.nights,
      confirmationCode: result.hold.confirmationCode,
      roomName: result.hold.roomName,
      guestName: result.hold.guestName,
      totalPrice: result.hold.totalPrice,
      selectedRoomId: result.hold.roomId,
      holdId: result.hold.id,
    },
  });
}

function handleCancelModify(session: GuestSession): ChatResponse {
  updateSession(session.id, { pendingChange: null });
  return emptyResponse({
    success: true,
    type: "answer",
    intent: "availability",
    message: "No problem — I left the hold as it is.",
    sessionId: session.id,
  });
}

function handleConfirmCancel(request: ChatRequest, session: GuestSession): ChatResponse {
  const holdId = request.action?.holdId;
  const result = cancelConfirmedHold(holdId || session.lastConfirmationCode || "");
  if (result.status === "error") {
    return emptyResponse({
      success: false,
      type: "error",
      intent: "availability",
      message: result.message,
      sessionId: session.id,
    });
  }

  updateSession(session.id, {
    pendingChange: null,
    lastConfirmationCode: result.hold.confirmationCode,
  });

  return emptyResponse({
    success: true,
    type: "booking_cancelled",
    intent: "availability",
    message: result.message,
    sessionId: session.id,
    data: {
      confirmationCode: result.hold.confirmationCode,
      roomName: result.hold.roomName,
      guestName: result.hold.guestName,
      holdId: result.hold.id,
      selectedRoomId: result.hold.roomId,
    },
  });
}

function handleKeepReservation(session: GuestSession): ChatResponse {
  return emptyResponse({
    success: true,
    type: "answer",
    intent: "availability",
    message: "All set — I'll keep that hold as it is. Tell me if you want to change dates, switch rooms, or add a note.",
    sessionId: session.id,
  });
}

function handleSelectRoom(request: ChatRequest, session: GuestSession, now: Date): ChatResponse {
  const roomId = request.action?.roomId;
  const room = getRoomById(roomId);
  if (!room) {
    return emptyResponse({
      success: false,
      type: "error",
      intent: "room_info",
      message: "I couldn't identify that room.",
      sessionId: session.id,
    });
  }

  const next = syncStayFromResponse(session, { selectedRoomId: room.id });
  const stay = next?.stay ?? session.stay;
  const parsed = parseContactFromMessage(request.message);
  const guestName = parsed.guestName || session.guest.name;
  const guestEmail = parsed.email || session.guest.email;
  const guestPhone = parsed.phone || session.guest.phone;

  if (!stay.checkIn || !stay.checkOut || typeof stay.guests !== "number") {
    return emptyResponse({
      success: true,
      type: "answer",
      intent: "room_info",
      message: `Great choice — the ${room.name}. What dates and guest count should I use?`,
      images: filterAnswerImages(imagesForAnswer("room_info", room.name, room.id, stay.guests)),
      sessionId: session.id,
      data: {
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        guests: stay.guests,
        selectedRoomId: room.id,
      },
    });
  }

  if (!guestName || !guestPhone) {
    return emptyResponse({
      success: true,
      type: "answer",
      intent: "room_info",
      message: `Great choice — the ${room.name}. Share the guest name and a phone number so the front desk can call to confirm ${stay.checkIn} to ${stay.checkOut}.`,
      images: filterAnswerImages(imagesForAnswer("room_info", room.name, room.id, stay.guests)),
      sessionId: session.id,
      data: {
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        guests: stay.guests,
        selectedRoomId: room.id,
        guestName,
        guestEmail,
        guestPhone,
      },
    });
  }

  const prepared = prepareBookingHold(
    {
      roomId: room.id,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      guests: stay.guests,
      guestName,
      guestEmail,
      guestPhone,
      sessionId: session.id,
    },
    now,
  );
  if (prepared.status !== "pending_confirmation") {
    return emptyResponse({
      success: false,
      type: "error",
      intent: "availability",
      message: prepared.message,
      sessionId: session.id,
    });
  }

  const submitted = submitBookingRequest(prepared.pendingHold, now);
  if (submitted.status === "error") {
    return emptyResponse({
      success: false,
      type: "error",
      intent: "availability",
      message: submitted.message,
      sessionId: session.id,
    });
  }

  updateSession(session.id, {
    pendingHold: prepared.pendingHold,
    guest: {
      name: guestName,
      email: guestEmail,
      phone: guestPhone,
    },
    stay: {
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      guests: stay.guests,
      maxBudget: stay.maxBudget,
      selectedRoomId: room.id,
    },
  });
  void notifyStaffBookingRequest(submitted.hold);

  return bookingRequestedResponse(session.id, submitted.hold, submitted.message);
}

export function hydrateRequestFromSession(request: ChatRequest, session: GuestSession): ChatRequest {
  const history = hydrateSessionHistory(session);
  const availability = {
    checkIn: request.availability?.checkIn ?? session.stay.checkIn,
    checkOut: request.availability?.checkOut ?? session.stay.checkOut,
    guests:
      typeof request.availability?.guests === "number"
        ? request.availability.guests
        : session.stay.guests,
    maxBudget: request.availability?.maxBudget ?? session.stay.maxBudget,
  };

  return {
    ...request,
    history: history.length > 0 ? history : request.history,
    availability,
  };
}

export function prepareRequestWithSession(
  request: ChatRequest,
  sessionId: string,
  now = new Date(),
) {
  const session = readSession(sessionId);
  if (!session) {
    return {
      session: null,
      request,
    };
  }

  syncConversationContextFromMessage(sessionId, request.message, request.history, now);
  const refreshed = readSession(sessionId) ?? session;

  return {
    session: refreshed,
    request: hydrateRequestFromSession(request, refreshed),
  };
}

export function persistChatTurn(
  sessionId: string,
  request: ChatRequest,
  response: ChatResponse,
) {
  const session = readSession(sessionId);
  if (!session) {
    return;
  }

  const userContent =
    request.action?.type === "confirm_hold"
      ? request.message || "Confirm hold"
      : request.action?.type === "cancel_hold"
        ? "Cancel hold"
        : request.action?.type === "confirm_modify"
          ? request.message || "Confirm change"
          : request.action?.type === "cancel_modify"
            ? "Keep current stay"
            : request.action?.type === "confirm_cancel"
              ? request.message || "Cancel this hold"
              : request.action?.type === "keep_reservation"
                ? "Keep it"
                  : request.action?.type === "select_room" || request.action?.type === "hold_room"
                  ? request.message || "Book this room"
                  : request.message;

  if (userContent) {
    appendSessionMessages(sessionId, [{ role: "user", content: userContent }]);
  }

  if (response.message.trim()) {
    appendSessionMessages(sessionId, [{ role: "assistant", content: response.message }]);
  }

  const latest = readSession(sessionId) ?? session;

  syncStayFromResponse(latest, {
    checkIn: response.data?.checkIn ?? request.availability?.checkIn ?? latest.stay.checkIn,
    checkOut: response.data?.checkOut ?? request.availability?.checkOut ?? latest.stay.checkOut,
    guests: response.data?.guests ?? request.availability?.guests ?? latest.stay.guests,
    maxBudget: latest.stay.maxBudget,
    selectedRoomId: response.data?.selectedRoomId ?? latest.stay.selectedRoomId,
  });

  const guestName = response.data?.guestName;
  const guestEmail = latest.guest.email;
  const guestPhone = latest.guest.phone;

  if (guestName || guestEmail || guestPhone) {
    updateSession(sessionId, {
      guest: {
        ...latest.guest,
        name: guestName ?? latest.guest.name,
        email: guestEmail,
        phone: guestPhone,
      },
    });
  }
}
