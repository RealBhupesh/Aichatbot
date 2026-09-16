import {
  AvailabilityValidationError,
  checkAvailability as defaultCheckAvailability,
  type AvailabilityInput,
} from "@/lib/availability";

export type AvailabilityFn = typeof defaultCheckAvailability;
import {
  applyBudgetFilter,
  applyRoomPreference,
  preferenceMessage,
} from "@/lib/stay-filters";
import { missingAvailabilityPrompt } from "@/lib/answers";
import { attachFollowUpSuggestions } from "@/lib/follow-up-suggestions";
import { imagesForAnswer, type AnswerImage } from "@/lib/media";
import type { AvailableRoom, ChatResponse } from "@/lib/schemas";
import type { RoomPreference } from "@/lib/dates";

export type AvailabilitySearchInput = AvailabilityInput & {
  preference?: RoomPreference;
  maxBudget?: number | null;
};

export type AvailabilitySearchSuccess = {
  status: "success";
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  available: boolean;
  rooms: AvailableRoom[];
  message: string;
  images: AnswerImage[];
};

export type AvailabilitySearchMissing = {
  status: "missing_fields";
  missingFields: string[];
  checkIn: string | null;
  checkOut: string | null;
  guests: number | null;
  message: string;
};

export type AvailabilitySearchError = {
  status: "error";
  message: string;
  availabilityRequired: boolean;
};

export type AvailabilitySearchResult =
  | AvailabilitySearchSuccess
  | AvailabilitySearchMissing
  | AvailabilitySearchError;

export function missingStayFields(stay: {
  checkIn: string | null | undefined;
  checkOut: string | null | undefined;
  guests: number | null | undefined;
}) {
  const missing: string[] = [];
  if (!stay.checkIn) missing.push("checkIn");
  if (!stay.checkOut) missing.push("checkOut");
  if (typeof stay.guests !== "number") missing.push("guests");
  return missing;
}

export function searchAvailability(
  input: AvailabilitySearchInput,
  now = new Date(),
  checkAvailability: AvailabilityFn = defaultCheckAvailability,
): AvailabilitySearchResult {
  const missing = missingStayFields({
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guests: input.adults,
  });

  if (missing.length > 0) {
    return {
      status: "missing_fields",
      missingFields: missing,
      checkIn: input.checkIn ?? null,
      checkOut: input.checkOut ?? null,
      guests: typeof input.adults === "number" ? input.adults : null,
      message: missingAvailabilityPrompt(missing),
    };
  }

  try {
    const result = checkAvailability(
      {
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        adults: input.adults,
      },
      now,
    );

    const preferred = applyRoomPreference(result.rooms, input.preference ?? null);
    const rooms = applyBudgetFilter(preferred, input.maxBudget ?? null);
    const message = preferenceMessage(
      rooms,
      input.preference ?? null,
      input.maxBudget ?? null,
      result.rooms,
      result.message ?? "Here is what I found.",
    );

    const images: AnswerImage[] = rooms
      .filter((room) => room.image)
      .map((room) => ({
        src: room.image as string,
        alt: room.name,
        caption: room.name,
      }));

    return {
      status: "success",
      checkIn: result.checkIn,
      checkOut: result.checkOut,
      guests: result.guests,
      nights: result.nights,
      available: rooms.length > 0,
      rooms,
      message,
      images: images.length > 0 ? images : imagesForAnswer("availability", ""),
    };
  } catch (error) {
    if (error instanceof AvailabilityValidationError) {
      return {
        status: "error",
        message: error.message,
        availabilityRequired: true,
      };
    }

    return {
      status: "error",
      message: "I couldn't check room availability right now. Please try again shortly.",
      availabilityRequired: true,
    };
  }
}

export function availabilitySearchToChatResponse(result: AvailabilitySearchResult): ChatResponse {
  return attachFollowUpSuggestions(availabilitySearchToChatResponseBody(result));
}

function availabilitySearchToChatResponseBody(result: AvailabilitySearchResult): ChatResponse {
  if (result.status === "missing_fields") {
    return {
      success: true,
      type: "availability_request",
      intent: "availability",
      message: result.message,
      availabilityRequired: true,
      missingFields: result.missingFields,
      rooms: [],
      images: imagesForAnswer("availability", ""),
      actions: [],
      suggestions: [],
      data: {
        missingFields: result.missingFields,
        checkIn: result.checkIn,
        checkOut: result.checkOut,
        guests: result.guests,
        checkInTime: "15:00",
        checkOutTime: "11:00",
      },
    };
  }

  if (result.status === "error") {
    return {
      success: false,
      type: "error",
      intent: "availability",
      message: result.message,
      availabilityRequired: result.availabilityRequired,
      missingFields: [],
      rooms: [],
      images: [],
      actions: [],
      suggestions: [],
      data: null,
    };
  }

  return {
    success: true,
    type: "availability_results",
    intent: "availability",
    message: result.message,
    availabilityRequired: false,
    missingFields: [],
    rooms: result.rooms,
    images: result.images,
    actions: result.rooms.map((room) => ({
      type: "hold_room" as const,
      label: `Book ${room.name}`,
      roomId: room.id as "standard-queen" | "deluxe-king" | "family-room" | "executive-suite",
    })),
    suggestions: [],
    data: {
      checkIn: result.checkIn,
      checkOut: result.checkOut,
      guests: result.guests,
      nights: result.nights,
      available: result.available,
      rooms: result.rooms,
    },
  };
}
