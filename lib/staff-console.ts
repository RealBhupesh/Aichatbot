import { logger } from "@/lib/logger";
import { notifyStaffTakeover } from "@/lib/notifications";
import { getOpenEscalationForSession } from "@/lib/escalations";
import {
  confirmStaffBooking,
  declineStaffBooking,
  listPendingStaffBookings,
  type BookingHold,
} from "@/lib/bookings";
import {
  appendSessionMessages,
  appendStaffMessage,
  listSessions,
  markSessionRead,
  readSession,
  setSessionMode,
  updateSession,
  type SessionListFilter,
} from "@/lib/sessions";

export async function takeoverConversation(sessionId: string, assignedTo: string) {
  const session = readSession(sessionId);
  if (!session) {
    return null;
  }

  const next = setSessionMode(sessionId, "staff", assignedTo);
  if (!next) {
    return null;
  }

  logger.info("staff.takeover", {
    sessionId,
    assignedTo: next.assignedTo,
  });
  await notifyStaffTakeover({
    sessionId,
    assignedTo: next.assignedTo ?? assignedTo,
    guestName: next.guest.name,
  });
  return next;
}

export async function handbackConversation(sessionId: string, assignedTo: string) {
  const session = readSession(sessionId);
  if (!session) {
    return null;
  }

  const next = setSessionMode(sessionId, "ai");
  if (!next) {
    return null;
  }

  appendSessionMessages(sessionId, [
    {
      role: "assistant",
      content: "You're back with Leela at the Asteria desk. How else can I help?",
    },
  ]);

  logger.info("staff.handback", {
    sessionId,
    assignedTo,
  });
  return readSession(sessionId);
}

export async function sendStaffReply(sessionId: string, content: string, assignedTo: string) {
  const session = readSession(sessionId);
  if (!session) {
    return null;
  }

  if (session.mode !== "staff") {
    await takeoverConversation(sessionId, assignedTo);
  }

  const next = appendStaffMessage(sessionId, content, assignedTo);
  logger.info("staff.reply", {
    sessionId,
    assignedTo,
    length: content.trim().length,
  });
  return next;
}

export function listConversations(options?: { filter?: SessionListFilter; query?: string }) {
  return listSessions(options);
}

export function getConversation(sessionId: string) {
  const session = readSession(sessionId);
  if (!session) {
    return null;
  }

  markSessionRead(sessionId);
  const refreshed = readSession(sessionId) ?? session;
  return {
    session: refreshed,
    escalation: getOpenEscalationForSession(sessionId),
    pendingBooking:
      listPendingStaffBookings().find((hold) => hold.sessionId === sessionId) ?? null,
  };
}

function applyHoldToGuestChat(hold: BookingHold, message: string) {
  if (!hold.sessionId) {
    return;
  }
  appendSessionMessages(hold.sessionId, [{ role: "assistant", content: message }]);
  updateSession(hold.sessionId, {
    pendingHold: null,
    lastConfirmationCode: hold.confirmationCode || null,
  });
}

export function confirmGuestBooking(holdId: string) {
  const result = confirmStaffBooking(holdId);
  if (result.status === "confirmed") {
    applyHoldToGuestChat(result.hold, result.message);
    logger.info("staff.booking_confirmed", {
      holdId: result.hold.id,
      confirmationCode: result.hold.confirmationCode,
    });
  }
  return result;
}

export function declineGuestBooking(holdId: string) {
  const result = declineStaffBooking(holdId);
  if (result.status === "declined") {
    applyHoldToGuestChat(result.hold, result.message);
    logger.info("staff.booking_declined", { holdId: result.hold.id });
  }
  return result;
}
