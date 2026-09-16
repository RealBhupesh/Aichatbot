import { describe, expect, it } from "vitest";
import { buildAgentChatResponse } from "@/lib/agent-response";

describe("buildAgentChatResponse", () => {
  it("maps a successful availability tool result to room cards", () => {
    const payload = buildAgentChatResponse({
      text: "I found a few options for tomorrow.",
      message: "rooms under 7k tomorrow",
      provider: "groq",
      model: "openai/gpt-oss-120b",
      trace: [
        {
          toolName: "checkAvailability",
          output: {
            status: "success",
            checkIn: "2026-09-17",
            checkOut: "2026-09-18",
            guests: 2,
            nights: 1,
            available: true,
            rooms: [
              {
                id: "standard-queen",
                name: "Standard Queen",
                description: "Compact room",
                maxGuests: 2,
                beds: "1 Queen",
                amenities: [],
                breakfastIncluded: false,
                pricePerNight: 6500,
                totalPrice: 6500,
                nights: 1,
                image: "/hotel/room-standard-queen.png",
              },
            ],
            message: "I found 1 option for 2 guests across 1 night: Standard Queen.",
            images: [],
          },
        },
      ],
    });

    expect(payload.type).toBe("availability_results");
    expect(payload.rooms[0]?.id).toBe("standard-queen");
    expect(payload.message).toContain("I found a few options");
    expect(payload.provider).toBe("groq");
    expect(payload.actions?.some((action) => action.type === "hold_room")).toBe(true);
  });

  it("maps a staff booking request without guest confirm buttons", () => {
    const payload = buildAgentChatResponse({
      text: "I've sent this to the front desk.",
      message: "book it for Asha",
      provider: "groq",
      model: "openai/gpt-oss-120b",
      sessionId: "session-1",
      trace: [
        {
          toolName: "prepareBookingHold",
          output: {
            status: "pending_staff",
            message: "I've sent this to the front desk.",
            hold: {
              token: "abc.def",
              roomId: "standard-queen",
              roomName: "Standard Queen",
              checkIn: "2026-09-20",
              checkOut: "2026-09-22",
              guests: 2,
              guestName: "Asha Patel",
              guestEmail: "asha@example.com",
              guestPhone: "+91 98765 43210",
              nights: 2,
              pricePerNight: 6500,
              totalPrice: 13000,
              createdAt: "2026-09-16T09:00:00.000Z",
              expiresAt: "2026-09-17T09:00:00.000Z",
              sessionId: "session-1",
              id: "abc",
              confirmationCode: "",
              status: "pending_staff",
              confirmedAt: null,
              specialRequests: null,
              cancelledAt: null,
              updatedAt: "2026-09-16T09:00:00.000Z",
            },
          },
        },
      ],
    });

    expect(payload.type).toBe("booking_requested");
    expect(payload.actions).toEqual([]);
    expect(payload.data?.guestPhone).toContain("98765");
  });

  it("maps informational tool output to an answer", () => {
    const payload = buildAgentChatResponse({
      text: "Check-in starts at 3:00 PM.",
      message: "What time is check-in?",
      provider: "groq",
      model: "openai/gpt-oss-120b",
      trace: [
        {
          toolName: "getHotelInfo",
          output: {
            status: "success",
            intent: "hotel_info",
            message: "Check-in at Asteria Grand Hotel begins at 3:00 PM.",
            images: [],
          },
        },
      ],
    });

    expect(payload.type).toBe("answer");
    expect(payload.intent).toBe("hotel_info");
    expect(payload.images).toEqual([]);
  });
});
