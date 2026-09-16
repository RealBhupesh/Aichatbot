import { logger } from "@/lib/logger";
import type { EscalationTicket } from "@/lib/escalations";
import type { BookingHold } from "@/lib/bookings";
import { getHotel } from "@/lib/hotel";

async function postStaffWebhook(text: string, extra: Record<string, unknown>) {
  const webhook = process.env.STAFF_ALERT_WEBHOOK?.trim();
  if (!webhook) {
    return { delivered: false, channel: "log" as const };
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        ...extra,
      }),
    });

    if (!response.ok) {
      logger.warn("staff.webhook_failed", {
        status: response.status,
      });
      return { delivered: false, channel: "webhook" as const };
    }

    return { delivered: true, channel: "webhook" as const };
  } catch (error) {
    logger.warn("staff.webhook_error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { delivered: false, channel: "webhook" as const };
  }
}

export async function notifyStaffEscalation(ticket: EscalationTicket) {
  const hotel = getHotel();
  const summary = [
    `New guest escalation at ${hotel.name}`,
    `Reason: ${ticket.reason}`,
    `Summary: ${ticket.summary}`,
    ticket.guestName ? `Guest: ${ticket.guestName}` : null,
    ticket.guestEmail ? `Email: ${ticket.guestEmail}` : null,
    ticket.guestPhone ? `Phone: ${ticket.guestPhone}` : null,
    `Ticket: ${ticket.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  logger.info("staff.escalation_created", {
    ticketId: ticket.id,
    reason: ticket.reason,
  });

  return postStaffWebhook(summary, { ticket });
}

export async function notifyStaffTakeover(input: {
  sessionId: string;
  assignedTo: string;
  guestName: string | null;
}) {
  const hotel = getHotel();
  const summary = [
    `Staff takeover at ${hotel.name}`,
    `Agent: ${input.assignedTo}`,
    input.guestName ? `Guest: ${input.guestName}` : null,
    `Session: ${input.sessionId}`,
  ]
    .filter(Boolean)
    .join("\n");

  logger.info("staff.takeover_notified", {
    sessionId: input.sessionId,
    assignedTo: input.assignedTo,
  });

  return postStaffWebhook(summary, { takeover: input });
}

export async function notifyStaffBookingRequest(hold: BookingHold) {
  const hotel = getHotel();
  const summary = [
    `New booking request at ${hotel.name}`,
    `Room: ${hold.roomName}`,
    `Stay: ${hold.checkIn} to ${hold.checkOut} · ${hold.guests} guest${hold.guests === 1 ? "" : "s"}`,
    hold.guestName ? `Guest: ${hold.guestName}` : null,
    hold.guestPhone ? `Phone: ${hold.guestPhone}` : null,
    hold.guestEmail ? `Email: ${hold.guestEmail}` : null,
    `Request: ${hold.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  logger.info("staff.booking_request", {
    holdId: hold.id,
    roomId: hold.roomId,
    sessionId: hold.sessionId,
  });

  return postStaffWebhook(summary, { bookingRequest: hold });
}
