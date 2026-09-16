import type { ChatResponse } from "@/lib/schemas";

export type ChatSuggestion = {
  label: string;
  message: string;
};

export function buildFollowUpSuggestions(response: ChatResponse): ChatSuggestion[] {
  if (response.type === "availability_results" && response.rooms.length > 0) {
    const cheapest = [...response.rooms].sort(
      (left, right) => left.pricePerNight - right.pricePerNight,
    )[0];
    const suggestions: ChatSuggestion[] = [];

    if (cheapest) {
      suggestions.push({
        label: `Book ${cheapest.name}`,
        message: `I'd like to book the ${cheapest.name} for our stay.`,
      });
    }

    if (response.rooms.length > 1) {
      suggestions.push({
        label: "Show cheapest option",
        message: "Which is the cheapest room available for these dates?",
      });
    }

    suggestions.push({
      label: "Ask about breakfast",
      message: "Does the cheapest room include breakfast?",
    });

    return suggestions.slice(0, 3);
  }

  if (response.type === "availability_results" && response.rooms.length === 0) {
    return [
      {
        label: "Try different dates",
        message: "Can you check availability for next weekend instead?",
      },
      {
        label: "Speak to the desk",
        message: "Can I speak with someone at the front desk?",
      },
    ];
  }

  if (response.type === "booking_hold") {
    return [
      {
        label: "Change room",
        message: "Can you show me other room options for the same dates?",
      },
    ];
  }

  if (response.type === "booking_confirmed") {
    return [
      {
        label: "Check-in time",
        message: "What time is check-in?",
      },
      {
        label: "Parking info",
        message: "Do you have parking for guests?",
      },
    ];
  }

  if (response.type === "fallback" || response.intent === "unsupported") {
    return [
      {
        label: "Speak to the desk",
        message: "Can I speak with someone at the front desk?",
      },
    ];
  }

  if (response.type === "answer" && response.intent === "room_info") {
    return [
      {
        label: "Check availability",
        message: "Can you check availability for those room types?",
      },
    ];
  }

  return [];
}

export function attachFollowUpSuggestions(response: ChatResponse): ChatResponse {
  const suggestions = buildFollowUpSuggestions(response);
  if (suggestions.length === 0) {
    return response;
  }

  return {
    ...response,
    suggestions,
  };
}
