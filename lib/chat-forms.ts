import { looksLikeAvailabilityDatePrompt } from "@/lib/availability-intent";
import type { ChatResponse } from "@/lib/schemas";

export type ChatFormType = "stay_search" | "guest_contact";

export type ChatFormConfig = {
  type: ChatFormType;
  missingFields: string[];
  initial?: {
    checkIn?: string | null;
    checkOut?: string | null;
    guests?: number | null;
    maxBudget?: number | null;
    checkInTime?: string | null;
    checkOutTime?: string | null;
    guestName?: string | null;
    guestNames?: string[] | null;
    guestEmail?: string | null;
    guestPhone?: string | null;
  };
};

function staySearchFormConfig(response: ChatResponse): ChatFormConfig {
  return {
    type: "stay_search",
    missingFields: response.missingFields.length > 0
      ? response.missingFields
      : ["checkIn", "checkOut", "guests"],
    initial: {
      checkIn: response.data?.checkIn ?? null,
      checkOut: response.data?.checkOut ?? null,
      guests: response.data?.guests ?? null,
      maxBudget: response.data?.maxBudget ?? null,
      checkInTime: response.data?.checkInTime ?? "15:00",
      checkOutTime: response.data?.checkOutTime ?? "11:00",
    },
  };
}

export function resolveChatForm(response: ChatResponse): ChatFormConfig | null {
  if (response.type === "availability_request") {
    return staySearchFormConfig(response);
  }

  if (
    response.type === "answer" &&
    (response.intent === "availability" || response.availabilityRequired) &&
    looksLikeAvailabilityDatePrompt(response.message)
  ) {
    return staySearchFormConfig({
      ...response,
      type: "availability_request",
      missingFields: response.missingFields.length > 0
        ? response.missingFields
        : ["checkIn", "checkOut", "guests"],
    });
  }

  const guestFields = response.missingFields.filter((field) =>
    ["guestName", "guestEmail", "guestPhone", "guestContact"].includes(field),
  );

  if (guestFields.length > 0) {
    return {
      type: "guest_contact",
      missingFields: guestFields,
      initial: {
        guests: response.data?.guests ?? null,
        guestName: response.data?.guestName ?? null,
        guestEmail: response.data?.guestEmail ?? null,
        guestPhone: response.data?.guestPhone ?? null,
      },
    };
  }

  if (
    response.type === "answer" &&
    /share.*(guest name|your name|email|phone|contact)/i.test(response.message) &&
    !response.actions?.some((action) => action.type === "confirm_hold")
  ) {
    return {
      type: "guest_contact",
      missingFields: ["guestName", "guestContact"],
      initial: {
        guests: response.data?.guests ?? null,
        guestName: response.data?.guestName ?? null,
        guestEmail: response.data?.guestEmail ?? null,
        guestPhone: response.data?.guestPhone ?? null,
      },
    };
  }

  return null;
}
