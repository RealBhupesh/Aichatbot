import { beforeEach, describe, expect, it } from "vitest";
import {
  confirmStaffBooking,
  declineStaffBooking,
  listPendingStaffBookings,
  prepareBookingHold,
  resetBookingsCache,
  submitBookingRequest,
} from "@/lib/bookings";
import { handleChatAction } from "@/lib/chat-actions";
import { getRoomOperations, resetOperationsForTests } from "@/lib/operations";
import { confirmGuestBooking, declineGuestBooking } from "@/lib/staff-console";
import { createSession, readSession, resetSessionsCache, updateSession } from "@/lib/sessions";

const NOW = new Date("2026-09-16T09:00:00.000Z");

function prepareQueen(sessionId?: string) {
  const prepared = prepareBookingHold(
    {
      roomId: "standard-queen",
      checkIn: "2026-09-20",
      checkOut: "2026-09-22",
      guests: 2,
      guestName: "Asha Patel",
      guestEmail: "asha@example.com",
      guestPhone: "+91 98765 43210",
      sessionId: sessionId ?? null,
    },
    NOW,
  );
  if (prepared.status !== "pending_confirmation") {
    throw new Error("Expected pending hold");
  }
  return prepared;
}

describe("staff-confirmed booking requests", () => {
  beforeEach(() => {
    resetOperationsForTests();
    resetBookingsCache();
    resetSessionsCache();
  });

  it("submits a request without taking inventory or issuing a code", () => {
    const inventoryBefore = getRoomOperations("standard-queen").inventory;
    const prepared = prepareQueen();
    const submitted = submitBookingRequest(prepared.pendingHold, NOW);

    expect(submitted.status).toBe("pending_staff");
    if (submitted.status !== "pending_staff") {
      return;
    }
    expect(submitted.hold.confirmationCode).toBe("");
    expect(submitted.message).toMatch(/front desk/i);
    expect(submitted.message).not.toMatch(/AST-/);
    expect(getRoomOperations("standard-queen").inventory).toBe(inventoryBefore);
    expect(listPendingStaffBookings(NOW)).toHaveLength(1);
  });

  it("lets staff confirm later, then issues a code and decrements inventory", () => {
    const inventoryBefore = getRoomOperations("standard-queen").inventory;
    const prepared = prepareQueen();
    const submitted = submitBookingRequest(prepared.pendingHold, NOW);
    if (submitted.status !== "pending_staff") {
      throw new Error("Expected staff request");
    }

    const confirmed = confirmStaffBooking(submitted.hold.id, NOW);
    expect(confirmed.status).toBe("confirmed");
    if (confirmed.status !== "confirmed") {
      return;
    }
    expect(confirmed.hold.confirmationCode).toMatch(/^AST-/);
    expect(getRoomOperations("standard-queen").inventory).toBe(inventoryBefore - 1);
    expect(listPendingStaffBookings(NOW)).toHaveLength(0);
  });

  it("lets staff decline without changing inventory", () => {
    const inventoryBefore = getRoomOperations("standard-queen").inventory;
    const prepared = prepareQueen();
    const submitted = submitBookingRequest(prepared.pendingHold, NOW);
    if (submitted.status !== "pending_staff") {
      throw new Error("Expected staff request");
    }

    const declined = declineStaffBooking(submitted.hold.id, NOW);
    expect(declined.status).toBe("declined");
    expect(getRoomOperations("standard-queen").inventory).toBe(inventoryBefore);
    expect(listPendingStaffBookings(NOW)).toHaveLength(0);
  });

  it("sends a Book the room action to the staff queue with the guest phone", () => {
    const session = createSession();
    updateSession(session.id, {
      stay: {
        checkIn: "2026-09-20",
        checkOut: "2026-09-22",
        guests: 2,
        maxBudget: null,
        selectedRoomId: "standard-queen",
      },
    });

    const result = handleChatAction(
      {
        message:
          "Please book the standard-queen for Asha Patel. Email: asha@example.com. Phone: +91 98765 43210.",
        history: [],
        availability: {
          checkIn: "2026-09-20",
          checkOut: "2026-09-22",
          guests: 2,
        },
        source: "chat",
        action: { type: "hold_room", roomId: "standard-queen" },
      },
      readSession(session.id) ?? session,
      NOW,
    );

    expect(result?.type).toBe("booking_requested");
    expect(result?.data?.guestPhone).toContain("98765");
    expect(result?.message).toMatch(/call you/i);
    expect(listPendingStaffBookings(NOW)[0]?.guestPhone).toContain("98765");
  });

  it("posts a confirmation into the guest chat when staff confirm", () => {
    const session = createSession();
    const prepared = prepareQueen(session.id);
    const submitted = submitBookingRequest(prepared.pendingHold, NOW);
    if (submitted.status !== "pending_staff") {
      throw new Error("Expected staff request");
    }

    const result = confirmGuestBooking(submitted.hold.id);
    expect(result.status).toBe("confirmed");
    const messages = readSession(session.id)?.messages ?? [];
    expect(messages.at(-1)?.content).toMatch(/AST-/);
  });

  it("posts a decline into the guest chat when staff decline", () => {
    const session = createSession();
    const prepared = prepareQueen(session.id);
    const submitted = submitBookingRequest(prepared.pendingHold, NOW);
    if (submitted.status !== "pending_staff") {
      throw new Error("Expected staff request");
    }

    const result = declineGuestBooking(submitted.hold.id);
    expect(result.status).toBe("declined");
    const messages = readSession(session.id)?.messages ?? [];
    expect(messages.at(-1)?.content).toMatch(/couldn't confirm/i);
  });
});
