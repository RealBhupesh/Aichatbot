import { beforeEach, describe, expect, it } from "vitest";
import {
  addHoldSpecialRequest,
  cancelConfirmedHold,
  confirmBookingHold,
  findHold,
  lookupReservation,
  modifyConfirmedHold,
  prepareBookingHold,
  resetBookingsCache,
} from "@/lib/bookings";
import { processChatRequest } from "@/lib/chat";
import { getRoomOperations, resetOperationsForTests } from "@/lib/operations";
import { createSession, resetSessionsCache, updateSession } from "@/lib/sessions";

const NOW = new Date("2026-09-16T09:00:00.000Z");

function confirmStandardQueen(sessionId?: string) {
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
  const confirmed = confirmBookingHold(prepared.pendingHold, NOW);
  if (confirmed.status !== "confirmed") {
    throw new Error("Expected confirmed hold");
  }
  return confirmed.hold;
}

describe("reservation lifecycle", () => {
  beforeEach(() => {
    resetOperationsForTests();
    resetBookingsCache();
    resetSessionsCache();
  });

  it("looks up a hold by confirmation code and by email", () => {
    const hold = confirmStandardQueen();
    expect(findHold({ confirmationCode: hold.confirmationCode.toLowerCase() })?.id).toBe(hold.id);
    expect(lookupReservation({ guestEmail: "asha@example.com" }).status).toBe("found");
  });

  it("cancels a confirmed hold and restores inventory", () => {
    const before = getRoomOperations("standard-queen").inventory;
    const hold = confirmStandardQueen();
    expect(getRoomOperations("standard-queen").inventory).toBe(before - 1);

    const cancelled = cancelConfirmedHold(hold.id);
    expect(cancelled.status).toBe("cancelled");
    expect(getRoomOperations("standard-queen").inventory).toBe(before);
    expect(findHold({ confirmationCode: hold.confirmationCode })?.status).toBe("cancelled");
  });

  it("modifies a hold to another available room and swaps inventory", () => {
    const queenBefore = getRoomOperations("standard-queen").inventory;
    const deluxeBefore = getRoomOperations("deluxe-king").inventory;
    const hold = confirmStandardQueen();

    const modified = modifyConfirmedHold(
      hold.id,
      {
        roomId: "deluxe-king",
        checkIn: "2026-09-20",
        checkOut: "2026-09-22",
        guests: 2,
      },
      NOW,
    );

    expect(modified.status).toBe("modified");
    if (modified.status === "modified") {
      expect(modified.hold.roomId).toBe("deluxe-king");
    }
    expect(getRoomOperations("standard-queen").inventory).toBe(queenBefore);
    expect(getRoomOperations("deluxe-king").inventory).toBe(deluxeBefore - 1);
  });

  it("rejects a modify when the requested room is not available", () => {
    const hold = confirmStandardQueen();
    const result = modifyConfirmedHold(
      hold.id,
      {
        roomId: "standard-queen",
        checkIn: "2010-01-01",
        checkOut: "2010-01-02",
      },
      NOW,
    );
    expect(result.status).toBe("error");
  });

  it("stores a special request on the hold", () => {
    const hold = confirmStandardQueen();
    const result = addHoldSpecialRequest(
      { confirmationCode: hold.confirmationCode },
      "Late arrival around 10pm",
    );
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.hold.specialRequests).toContain("Late arrival");
    }
  });

  it("cancels a hold through the chat action path", async () => {
    const session = createSession();
    const hold = confirmStandardQueen(session.id);
    updateSession(session.id, { lastConfirmationCode: hold.confirmationCode });

    const result = await processChatRequest(
      {
        message: "Cancel this hold",
        action: {
          type: "confirm_cancel",
          holdId: hold.id,
        },
      },
      { now: NOW, sessionId: session.id, persistSession: false },
    );

    expect(result.payload.type).toBe("booking_cancelled");
    expect(result.payload.message).toContain(hold.confirmationCode);
  });

  it("applies a reservation change through the chat action path", async () => {
    const session = createSession();
    const hold = confirmStandardQueen(session.id);
    updateSession(session.id, {
      lastConfirmationCode: hold.confirmationCode,
      pendingChange: {
        holdId: hold.id,
        confirmationCode: hold.confirmationCode,
        checkIn: "2026-09-21",
        checkOut: "2026-09-23",
        roomId: "standard-queen",
        roomName: "Standard Queen",
        guests: 2,
        nights: 2,
        pricePerNight: 6500,
        totalPrice: 13000,
        expiresAt: "2026-09-16T09:30:00.000Z",
      },
    });

    const result = await processChatRequest(
      {
        message: "Confirm change",
        action: { type: "confirm_modify", holdId: hold.id },
      },
      { now: NOW, sessionId: session.id, persistSession: false },
    );

    expect(result.payload.type).toBe("booking_modified");
    expect(result.payload.data?.checkIn).toBe("2026-09-21");
    expect(result.payload.data?.checkOut).toBe("2026-09-23");
  });
});
