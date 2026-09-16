import { beforeEach, describe, expect, it } from "vitest";
import {
  AvailabilityValidationError,
  checkAvailability,
  validateStay,
} from "@/lib/availability";
import { readOperations, replaceOperations, resetOperationsForTests } from "@/lib/operations";

const NOW = new Date("2026-09-16T09:00:00.000Z");

describe("checkAvailability", () => {
  beforeEach(() => {
    resetOperationsForTests();
  });
  it("returns compatible rooms for a valid three-guest stay", () => {
    const result = checkAvailability(
      {
        checkIn: "2026-09-20",
        checkOut: "2026-09-22",
        adults: 3,
      },
      NOW,
    );

    expect(result.available).toBe(true);
    expect(result.nights).toBe(2);
    expect(result.guests).toBe(3);
    expect(result.rooms.length).toBeGreaterThan(0);
    expect(result.rooms.every((room) => room.maxGuests >= 3)).toBe(true);
    expect(result.rooms.map((room) => room.id)).toContain("family-room");
    expect(result.rooms.find((room) => room.id === "family-room")?.totalPrice).toBe(
      17000,
    );
    expect(result.rooms.find((room) => room.id === "standard-queen")).toBeUndefined();
  });

  it("rejects check-out before check-in", () => {
    expect(() =>
      validateStay(
        {
          checkIn: "2026-09-22",
          checkOut: "2026-09-20",
          adults: 2,
        },
        NOW,
      ),
    ).toThrow(AvailabilityValidationError);

    expect(() =>
      checkAvailability(
        {
          checkIn: "2026-09-22",
          checkOut: "2026-09-20",
          adults: 2,
        },
        NOW,
      ),
    ).toThrow(/check-out must be after check-in/i);
  });

  it("rejects past check-in dates", () => {
    expect(() =>
      checkAvailability(
        {
          checkIn: "2026-09-10",
          checkOut: "2026-09-12",
          adults: 2,
        },
        NOW,
      ),
    ).toThrow(/today or a future date/i);
  });

  it("rejects guest counts outside the accepted range", () => {
    expect(() =>
      checkAvailability(
        {
          checkIn: "2026-09-20",
          checkOut: "2026-09-22",
          adults: 0,
        },
        NOW,
      ),
    ).toThrow(/at least 1 guest/i);

    expect(() =>
      checkAvailability(
        {
          checkIn: "2026-09-20",
          checkOut: "2026-09-22",
          adults: 20,
        },
        NOW,
      ),
    ).toThrow(/up to 8 guests/i);
  });

  it("returns no rooms when inventory is blacked out", () => {
    replaceOperations({
      ...readOperations(),
      hotelClosedDates: ["2026-12-24", "2026-12-25"],
    });

    const result = checkAvailability(
      {
        checkIn: "2026-12-24",
        checkOut: "2026-12-26",
        adults: 2,
      },
      NOW,
    );

    expect(result.available).toBe(false);
    expect(result.rooms).toEqual([]);
  });

  it("returns no matching rooms when capacity is too high", () => {
    const result = checkAvailability(
      {
        checkIn: "2026-09-20",
        checkOut: "2026-09-22",
        adults: 5,
      },
      NOW,
    );

    expect(result.available).toBe(false);
    expect(result.rooms).toEqual([]);
  });
});
