import { beforeEach, describe, expect, it } from "vitest";
import {
  confirmBookingHold,
  prepareBookingHold,
  resetBookingsCache,
  verifyHoldToken,
} from "@/lib/bookings";
import { resetOperationsForTests } from "@/lib/operations";
import { createSession, resetSessionsCache, updateSession } from "@/lib/sessions";
import { processChatRequest } from "@/lib/chat";

const NOW = new Date("2026-09-16T09:00:00.000Z");

describe("booking holds", () => {
  beforeEach(() => {
    resetOperationsForTests();
    resetSessionsCache();
  });

  it("prepares a hold that requires confirmation", () => {
    resetBookingsCache();
    const prepared = prepareBookingHold(
      {
        roomId: "standard-queen",
        checkIn: "2026-09-20",
        checkOut: "2026-09-22",
        guests: 2,
        guestName: "Asha Patel",
        guestEmail: "asha@example.com",
        guestPhone: "+91 98765 43210",
      },
      NOW,
    );

    expect(prepared.status).toBe("pending_confirmation");
    if (prepared.status !== "pending_confirmation") {
      return;
    }

    expect(verifyHoldToken(prepared.holdToken, prepared.pendingHold, NOW)).toBe(true);
    expect(prepared.pendingHold.roomName).toBe("Standard Queen");
  });

  it("confirms a hold and returns a confirmation code", () => {
    resetBookingsCache();
    const prepared = prepareBookingHold(
      {
        roomId: "standard-queen",
        checkIn: "2026-09-20",
        checkOut: "2026-09-22",
        guests: 2,
        guestName: "Asha Patel",
        guestEmail: "asha@example.com",
        guestPhone: "+91 98765 43210",
      },
      NOW,
    );

    if (prepared.status !== "pending_confirmation") {
      throw new Error("Expected pending hold");
    }

    const confirmed = confirmBookingHold(prepared.pendingHold, NOW);
    expect(confirmed.status).toBe("confirmed");
    if (confirmed.status === "confirmed") {
      expect(confirmed.hold.confirmationCode).toMatch(/^AST-/);
      expect(confirmed.message).toContain(confirmed.hold.confirmationCode);
    }
  });

  it("submits a booking request through the chat action path", async () => {
    resetBookingsCache();

    const session = createSession();
    const prepared = prepareBookingHold(
      {
        roomId: "standard-queen",
        checkIn: "2026-09-20",
        checkOut: "2026-09-22",
        guests: 2,
        guestName: "Asha Patel",
        guestEmail: "asha@example.com",
        guestPhone: "+91 98765 43210",
      },
      NOW,
    );

    if (prepared.status !== "pending_confirmation") {
      throw new Error("Expected pending hold");
    }

    updateSession(session.id, { pendingHold: prepared.pendingHold });

    const result = await processChatRequest(
      {
        message: "Confirm hold",
        action: {
          type: "confirm_hold",
          holdToken: prepared.holdToken,
        },
      },
      { now: NOW, sessionId: session.id, persistSession: false },
    );

    expect(result.payload.type).toBe("booking_requested");
    expect(result.payload.data?.confirmationCode).toBeFalsy();
    expect(result.payload.message).toMatch(/front desk/i);
    expect(result.payload.message).toContain("Standard Queen");
  });
});
