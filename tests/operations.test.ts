import { afterEach, describe, expect, it } from "vitest";
import { checkAvailability } from "@/lib/availability";
import {
  readOperations,
  replaceOperations,
  resetOperationsCache,
} from "@/lib/operations";

const NOW = new Date("2026-09-16T09:00:00.000Z");

afterEach(() => {
  resetOperationsCache();
});

describe("staff operations store", () => {
  it("lets staff close a room so availability no longer returns it", () => {
    const current = readOperations();
    replaceOperations({
      ...current,
      rooms: {
        ...current.rooms,
        "family-room": {
          ...current.rooms["family-room"],
          closed: true,
        },
      },
    });

    const result = checkAvailability(
      {
        checkIn: "2026-09-20",
        checkOut: "2026-09-22",
        adults: 3,
      },
      NOW,
    );

    expect(result.rooms.map((room) => room.id)).not.toContain("family-room");
    expect(result.rooms.map((room) => room.id)).toContain("executive-suite");
  });

  it("uses staff nightly rates in availability totals", () => {
    const current = readOperations();
    replaceOperations({
      ...current,
      rooms: {
        ...current.rooms,
        "family-room": {
          ...current.rooms["family-room"],
          pricePerNight: 9000,
        },
      },
    });

    const result = checkAvailability(
      {
        checkIn: "2026-09-20",
        checkOut: "2026-09-22",
        adults: 3,
      },
      NOW,
    );

    expect(result.rooms.find((room) => room.id === "family-room")?.totalPrice).toBe(18000);
  });
});
