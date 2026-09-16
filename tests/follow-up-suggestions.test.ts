import { describe, expect, it } from "vitest";
import { buildFollowUpSuggestions } from "@/lib/follow-up-suggestions";
import type { ChatResponse } from "@/lib/schemas";

describe("follow-up suggestions", () => {
  it("suggests holding the cheapest room after availability results", () => {
    const response: ChatResponse = {
      success: true,
      type: "availability_results",
      intent: "availability",
      message: "Here are your options.",
      availabilityRequired: false,
      missingFields: [],
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
          totalPrice: 13000,
          nights: 2,
        },
        {
          id: "deluxe-king",
          name: "Deluxe King",
          description: "King room",
          maxGuests: 2,
          beds: "1 King",
          amenities: [],
          breakfastIncluded: true,
          pricePerNight: 8200,
          totalPrice: 16400,
          nights: 2,
        },
      ],
      images: [],
      actions: [],
      suggestions: [],
      data: null,
    };

    const suggestions = buildFollowUpSuggestions(response);
    expect(suggestions[0]?.label).toContain("Standard Queen");
    expect(suggestions.some((item) => item.label.includes("cheapest"))).toBe(true);
  });

  it("suggests speaking to the desk after unsupported answers", () => {
    const suggestions = buildFollowUpSuggestions({
      success: true,
      type: "fallback",
      intent: "unsupported",
      message: "I don't have that information.",
      availabilityRequired: false,
      missingFields: [],
      rooms: [],
      images: [],
      actions: [],
      suggestions: [],
      data: null,
    });

    expect(suggestions[0]?.label).toBe("Speak to the desk");
  });
});
