import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantModelError } from "@/lib/ai";
import { processChatRequest } from "@/lib/chat";
import { ruleBasedInterpret } from "@/lib/interpreter";
import { resetOperationsForTests } from "@/lib/operations";
import { resetSessionsCache } from "@/lib/sessions";

const NOW = new Date("2026-09-16T09:00:00.000Z");

async function ask(message: string, history: Array<{ role: "user" | "assistant"; content: string }> = []) {
  return processChatRequest(
    { message, history },
    {
      now: NOW,
      interpretGuestMessage: async (input) => ruleBasedInterpret(input),
      persistSession: false,
    },
  );
}

describe("POST /api/chat orchestration", () => {
  beforeEach(() => {
    resetOperationsForTests();
    resetSessionsCache();
  });

  it("answers check-in from hotel data", async () => {
    const result = await ask("What time is check-in?");
    expect(result.status).toBe(200);
    expect(result.payload.success).toBe(true);
    expect(result.payload.type).toBe("answer");
    expect(result.payload.message).toContain("3:00 PM");
    expect(result.payload.intent).toBe("hotel_info");
    expect(result.payload.images).toEqual([]);
  });

  it("answers the swimming pool question from amenities", async () => {
    const result = await ask("Does the hotel have a swimming pool?");
    expect(result.payload.message.toLowerCase()).toContain("swimming pool");
    expect(result.payload.intent).toBe("amenity");
    expect(result.payload.type).toBe("answer");
    expect(result.payload.images[0]?.src).toBe("/hotel/pool.png");
  });

  it("suggests only rooms that fit three guests", async () => {
    const result = await ask("Which room is suitable for three guests?");
    expect(result.payload.intent).toBe("room_info");
    expect(result.payload.rooms?.map((room) => room.id)).toContain("family-room");
    expect(result.payload.rooms?.map((room) => room.id)).toContain("executive-suite");
    expect(result.payload.rooms?.map((room) => room.id)).not.toContain("standard-queen");
  });

  it("returns the cancellation policy from hotel data", async () => {
    const result = await ask("What is the cancellation policy?");
    expect(result.payload.message).toMatch(/24 hours/);
    expect(result.payload.intent).toBe("policy");
  });

  it("gives a safe fallback for helicopter transfers", async () => {
    const result = await ask("Do you have helicopter transfers?");
    expect(result.payload.type).toBe("fallback");
    expect(result.payload.message).toMatch(/don't have reliable information/i);
    expect(result.payload.message.toLowerCase()).toContain("helicopter");
    expect(result.payload.message).not.toMatch(/yes,? we (offer|have)/i);
  });

  it("requests missing dates for an availability question", async () => {
    const result = await ask("Do you have rooms available?");
    expect(result.payload.type).toBe("availability_request");
    expect(result.payload.availabilityRequired).toBe(true);
    expect(result.payload.missingFields).toEqual(
      expect.arrayContaining(["checkIn", "checkOut", "guests"]),
    );
    expect(result.payload.message.toLowerCase()).toMatch(/date|guest/);
  });

  it("runs checkAvailability for a complete valid stay", async () => {
    const result = await processChatRequest(
      {
        message: "Please check availability for these dates.",
        history: [],
        availability: {
          checkIn: "2026-09-20",
          checkOut: "2026-09-22",
          guests: 3,
        },
        source: "availability_form",
      },
      { now: NOW, persistSession: false },
    );

    expect(result.payload.type).toBe("availability_results");
    expect(result.payload.rooms.length).toBeGreaterThan(0);
    expect(result.payload.rooms.every((room) => room.maxGuests >= 3)).toBe(true);
    expect(result.payload.data?.nights).toBe(2);
    expect(result.payload.rooms.map((room) => room.id)).toContain("family-room");
    expect(result.payload.rooms.find((room) => room.id === "family-room")?.image).toBe(
      "/hotel/room-family.png",
    );
    expect(result.payload.images.some((image) => image.src === "/hotel/room-family.png")).toBe(
      true,
    );
  });

  it("returns a helpful error when check-out is before check-in", async () => {
    const result = await processChatRequest(
      {
        message: "Please check availability for these dates.",
        history: [],
        availability: {
          checkIn: "2026-09-22",
          checkOut: "2026-09-20",
          guests: 2,
        },
        source: "availability_form",
      },
      { now: NOW, persistSession: false },
    );

    expect(result.payload.success).toBe(false);
    expect(result.payload.type).toBe("error");
    expect(result.payload.message).toMatch(/check-out must be after check-in/i);
  });

  it("resolves a breakfast follow-up to the Family Room", async () => {
    const result = await ask("Does it include breakfast?", [
      {
        role: "user",
        content: "Tell me about the Family Room.",
      },
      {
        role: "assistant",
        content:
          "The Family Room sleeps up to 4 guests with 1 king + sofa bed. Breakfast is included.",
      },
    ]);

    expect(result.payload.intent).toBe("room_info");
    expect(result.payload.message).toMatch(/Family Room/);
    expect(result.payload.message.toLowerCase()).toContain("included");
  });

  it("returns a safe fallback when the AI provider throws", async () => {
    const interpretGuestMessage = vi.fn(async () => {
      throw new AssistantModelError("upstream timeout");
    });

    const result = await processChatRequest(
      { message: "What time is check-in?", history: [] },
      { now: NOW, interpretGuestMessage, persistSession: false },
    );

    expect(result.status).toBe(200);
    expect(result.payload.success).toBe(false);
    expect(result.payload.type).toBe("error");
    expect(result.payload.message).toBe(
      "I'm having trouble generating a response right now. Please try again.",
    );
    expect(result.payload.message).not.toMatch(/stack|timeout|api key/i);
  });

  it("returns a useful message when availability fails", async () => {
    const result = await processChatRequest(
      {
        message: "Please check availability for these dates.",
        history: [],
        availability: {
          checkIn: "2026-09-20",
          checkOut: "2026-09-22",
          guests: 2,
        },
        source: "availability_form",
      },
      {
        now: NOW,
        checkAvailability: () => {
          throw new Error("inventory service down");
        },
      },
    );

    expect(result.payload.success).toBe(false);
    expect(result.payload.message).toBe(
      "I couldn't check room availability right now. Please try again shortly.",
    );
  });

  it("rejects an empty message", async () => {
    const result = await processChatRequest({ message: "   ", history: [] });
    expect(result.status).toBe(400);
    expect(result.payload.success).toBe(false);
  });

  it("answers a greeting instead of dumping hotel facts", async () => {
    const result = await ask("how's it going");
    expect(result.payload.success).toBe(true);
    expect(result.payload.intent).toBe("smalltalk");
    expect(result.payload.message.toLowerCase()).toMatch(/leela|desk|help/);
    expect(result.payload.message).not.toMatch(/You can reach the team at/);
  });

  it("checks the cheapest room for tomorrow without asking the form again", async () => {
    const result = await ask("like I wanna check in tomorrow book the cheapest room");
    expect(result.payload.type).toBe("availability_results");
    expect(result.payload.data?.checkIn).toBe("2026-09-17");
    expect(result.payload.data?.checkOut).toBe("2026-09-18");
    expect(result.payload.data?.guests).toBe(2);
    expect(result.payload.rooms[0]?.id).toBe("standard-queen");
    expect(result.payload.message.toLowerCase()).toContain("cheapest");
  });

  it("filters rooms by a nightly budget", async () => {
    const result = await ask("hey can you check the rooms under 5k budget");
    expect(result.payload.type).toBe("availability_results");
    expect(result.payload.rooms.every((room) => room.pricePerNight <= 5000)).toBe(true);
    expect(result.payload.message.toLowerCase()).toMatch(/under|₹5,000|5000/);
  });

  it("keeps budget filtering on a follow-up after an availability search", async () => {
    const first = await ask("Check room availability for 2026-09-20 to 2026-09-22 for 2 guests");
    expect(first.payload.type).toBe("availability_results");

    const result = await processChatRequest(
      {
        message: "show me rooms under 7k",
        history: [
          { role: "user", content: "Check room availability for 2026-09-20 to 2026-09-22 for 2 guests" },
          { role: "assistant", content: first.payload.message },
        ],
        availability: {
          checkIn: "2026-09-20",
          checkOut: "2026-09-22",
          guests: 2,
        },
      },
      {
        now: NOW,
        interpretGuestMessage: async (input) => ruleBasedInterpret(input),
        persistSession: false,
      },
    );

    expect(result.payload.type).toBe("availability_results");
    expect(result.payload.rooms.every((room) => room.pricePerNight <= 7000)).toBe(true);
    expect(result.payload.rooms.map((room) => room.id)).toContain("standard-queen");
    expect(result.payload.rooms.map((room) => room.id)).not.toContain("family-room");
  });
});
