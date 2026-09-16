import { tool } from "ai";
import { z } from "zod";
import {
  amenityAnswer,
  breakfastAnswer,
  checkInAnswer,
  groundedMessage,
  hotelOverviewAnswer,
  policyAnswer,
  roomAnswer,
  roomsForGuestCountAnswer,
  unsupportedAnswer,
} from "@/lib/answers";
import {
  addHoldSpecialRequest,
  lookupReservation,
  prepareBookingHold,
  prepareReservationChange,
  submitBookingRequest,
} from "@/lib/bookings";
import { createEscalation } from "@/lib/escalations";
import { notifyStaffBookingRequest, notifyStaffEscalation } from "@/lib/notifications";
import { searchAvailability } from "@/lib/availability-search";
import { hotelData, getHotel } from "@/lib/hotel";
import { imagesForAnswer } from "@/lib/media";
import { readSession, updateSession } from "@/lib/sessions";
import type { Intent } from "@/lib/schemas";

export type ToolTrace = {
  toolName: string;
  output: unknown;
};

export type AgentToolContext = {
  now: Date;
  trace: ToolTrace[];
  sessionId?: string | null;
};

const roomIdSchema = z.enum([
  "standard-queen",
  "deluxe-king",
  "family-room",
  "executive-suite",
]);

const roomPreferenceSchema = z.enum(["cheapest", "deluxe", "family", "suite"]).nullable();

function recordTrace(context: AgentToolContext, toolName: string, output: unknown) {
  context.trace.push({ toolName, output });
}

export function createHotelTools(context: AgentToolContext) {
  return {
    checkAvailability: tool({
      description:
        "Check which rooms are available for specific stay dates and guest count. Use this whenever the guest wants to book, reserve, compare prices, filter by budget, or see what is open. Resolve relative dates like today and tomorrow against the current date.",
      inputSchema: z.object({
        checkIn: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("Check-in date in YYYY-MM-DD format."),
        checkOut: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("Check-out date in YYYY-MM-DD format."),
        guests: z.number().int().min(1).max(8).describe("Number of guests staying."),
        roomPreference: roomPreferenceSchema
          .optional()
          .describe("Optional room preference such as cheapest, deluxe, family, or suite."),
        maxBudget: z
          .number()
          .int()
          .positive()
          .nullable()
          .optional()
          .describe("Optional maximum nightly budget in INR, e.g. 5000 for under 5k."),
      }),
      execute: async (input) => {
        const result = searchAvailability(
          {
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            adults: input.guests,
            preference: input.roomPreference ?? null,
            maxBudget: input.maxBudget ?? null,
          },
          context.now,
        );
        recordTrace(context, "checkAvailability", result);
        return result;
      },
    }),

    getHotelInfo: tool({
      description:
        "Get factual hotel information such as check-in time, check-out time, address, contact details, or a short property overview.",
      inputSchema: z.object({
        topic: z
          .enum(["overview", "check_in", "contact", "location"])
          .optional()
          .describe("Which hotel fact to retrieve."),
        query: z
          .string()
          .optional()
          .describe("The guest's original wording, used to pick the most relevant fact."),
      }),
      execute: async ({ topic, query = "" }) => {
        const lower = query.toLowerCase();
        let message = hotelOverviewAnswer();
        const intent: Intent = "hotel_info";

        if (topic === "check_in" || /check-?in|check-?out|arrival|what time/i.test(lower)) {
          message = checkInAnswer();
        } else if (topic === "contact" || /phone|email|reach|contact/i.test(lower)) {
          const hotel = getHotel();
          message = `You can reach ${hotel.name} at ${hotel.phone} or ${hotel.email}. The front desk is open ${hotel.frontDesk}.`;
        } else if (topic === "location" || /where|address|located/i.test(lower)) {
          const hotel = getHotel();
          message = `${hotel.name} is at ${hotel.address}, in ${hotel.location}.`;
        }

        const output = {
          status: "success" as const,
          intent,
          message,
          images: imagesForAnswer(intent, query),
        };
        recordTrace(context, "getHotelInfo", output);
        return output;
      },
    }),

    getRoomDetails: tool({
      description:
        "Get details about a specific room type or which rooms fit a guest count. Use for room descriptions, prices, breakfast inclusion, and occupancy.",
      inputSchema: z.object({
        roomId: roomIdSchema.nullable().optional(),
        guests: z.number().int().min(1).max(8).nullable().optional(),
        query: z.string().optional().describe("Guest wording, e.g. Family Room or rooms for 3 guests."),
      }),
      execute: async ({ roomId = null, guests = null, query = "" }) => {
        let message = roomAnswer(roomId, query);
        const intent: Intent = "room_info";

        if (/breakfast/i.test(query) && roomId) {
          message = breakfastAnswer(roomId);
        } else if (typeof guests === "number" && guests > 0 && !roomId) {
          message = roomsForGuestCountAnswer(guests);
        } else if (!roomId && /all rooms?|room types?|their pics?|show me rooms?|photos? of (the )?rooms?/i.test(query)) {
          message = "Here’s a quick look at our room types — tap any card for photos, reviews, and full details.";
        } else if (!roomId) {
          message = groundedMessage("room_info", query, roomId, guests);
        }

        const output = {
          status: "success" as const,
          intent,
          message,
          roomId,
          guests,
          images: imagesForAnswer(intent, query, roomId, guests),
        };
        recordTrace(context, "getRoomDetails", output);
        return output;
      },
    }),

    getPolicy: tool({
      description:
        "Get hotel policies such as cancellation, pets, smoking, children, extra beds, or early check-in.",
      inputSchema: z.object({
        topic: z
          .enum(["cancellation", "pets", "smoking", "children", "extra_bed", "early_check_in", "general"])
          .optional(),
        query: z.string().optional(),
      }),
      execute: async ({ topic, query = "" }) => {
        const lower = query.toLowerCase();
        let message = policyAnswer(query);

        if (topic === "cancellation" || /cancel|refund/i.test(lower)) {
          message = hotelData.policies.cancellation;
        } else if (topic === "pets" || /pet|dog|cat/i.test(lower)) {
          message = hotelData.policies.pets;
        } else if (topic === "smoking" || /smok/i.test(lower)) {
          message = hotelData.policies.smoking;
        } else if (topic === "children" || /child|kid|crib/i.test(lower)) {
          message = hotelData.policies.children;
        } else if (topic === "extra_bed") {
          message = hotelData.policies.extraBed;
        } else if (topic === "early_check_in") {
          message = hotelData.policies.earlyCheckIn;
        }

        const output = {
          status: "success" as const,
          intent: "policy" as const,
          message,
          images: imagesForAnswer("policy", query),
        };
        recordTrace(context, "getPolicy", output);
        return output;
      },
    }),

    getAmenityInfo: tool({
      description:
        "Get amenity details such as pool, Wi-Fi, parking, fitness center, breakfast, restaurant, or airport transfer.",
      inputSchema: z.object({
        query: z.string().describe("What amenity the guest is asking about."),
      }),
      execute: async ({ query }) => {
        const output = {
          status: "success" as const,
          intent: "amenity" as const,
          message: amenityAnswer(query),
          images: imagesForAnswer("amenity", query),
        };
        recordTrace(context, "getAmenityInfo", output);
        return output;
      },
    }),

    prepareBookingHold: tool({
      description:
        "Send a booking request to the front desk once you have room, dates, guest count, guest name, and a phone number. The desk must confirm before it is a booking.",
      inputSchema: z.object({
        roomId: roomIdSchema,
        checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        guests: z.number().int().min(1).max(8),
        guestName: z.string().min(2).max(120),
        guestEmail: z.string().email().nullable().optional(),
        guestPhone: z.string().min(8).max(40),
      }),
      execute: async (input) => {
        if (!input.guestPhone) {
          const output = {
            status: "error" as const,
            message: "I need a phone number so the front desk can call to confirm.",
          };
          recordTrace(context, "prepareBookingHold", output);
          return output;
        }

        const prepared = prepareBookingHold(
          {
            roomId: input.roomId,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            guests: input.guests,
            guestName: input.guestName,
            guestEmail: input.guestEmail,
            guestPhone: input.guestPhone,
            sessionId: context.sessionId,
          },
          context.now,
        );

        if (prepared.status !== "pending_confirmation") {
          recordTrace(context, "prepareBookingHold", prepared);
          return prepared;
        }

        const result = submitBookingRequest(prepared.pendingHold, context.now);

        if (result.status === "pending_staff" && context.sessionId) {
          updateSession(context.sessionId, {
            pendingHold: prepared.pendingHold,
            guest: {
              name: input.guestName,
              email: input.guestEmail ?? null,
              phone: input.guestPhone,
            },
            stay: {
              checkIn: input.checkIn,
              checkOut: input.checkOut,
              guests: input.guests,
              maxBudget: null,
              selectedRoomId: input.roomId,
            },
          });
          void notifyStaffBookingRequest(result.hold);
        }

        recordTrace(context, "prepareBookingHold", result);
        return result;
      },
    }),

    lookupReservation: tool({
      description:
        "Look up an existing demo hold by confirmation code, email, or phone. Use this when the guest asks about their booking, wants to change it, cancel it, or add a special request.",
      inputSchema: z.object({
        confirmationCode: z.string().min(3).max(40).nullable().optional(),
        guestEmail: z.string().email().nullable().optional(),
        guestPhone: z.string().min(8).max(40).nullable().optional(),
      }),
      execute: async (input) => {
        const session = context.sessionId ? readSession(context.sessionId) : null;
        const result = lookupReservation({
          confirmationCode: input.confirmationCode,
          guestEmail: input.guestEmail ?? session?.guest.email,
          guestPhone: input.guestPhone ?? session?.guest.phone,
          sessionId: context.sessionId,
        });

        if (result.status === "found" && context.sessionId) {
          updateSession(context.sessionId, {
            lastConfirmationCode: result.hold.confirmationCode,
            stay: {
              checkIn: result.hold.checkIn,
              checkOut: result.hold.checkOut,
              guests: result.hold.guests,
              selectedRoomId: result.hold.roomId,
              maxBudget: null,
            },
            guest: {
              name: result.hold.guestName,
              email: result.hold.guestEmail,
              phone: result.hold.guestPhone,
            },
          });
        }

        recordTrace(context, "lookupReservation", result);
        return result;
      },
    }),

    prepareReservationChange: tool({
      description:
        "Prepare a change to an existing confirmed hold (dates, room, or guest count). Does not apply the change until the guest confirms in the UI.",
      inputSchema: z.object({
        confirmationCode: z.string().min(3).max(40).nullable().optional(),
        holdId: z.string().min(4).max(80).nullable().optional(),
        checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        roomId: roomIdSchema.nullable().optional(),
        guests: z.number().int().min(1).max(8).nullable().optional(),
      }),
      execute: async (input) => {
        const session = context.sessionId ? readSession(context.sessionId) : null;
        const result = prepareReservationChange(
          {
            confirmationCode: input.confirmationCode ?? session?.lastConfirmationCode,
            holdId: input.holdId,
            guestEmail: session?.guest.email,
            guestPhone: session?.guest.phone,
            sessionId: context.sessionId,
            checkIn: input.checkIn ?? undefined,
            checkOut: input.checkOut ?? undefined,
            roomId: input.roomId ?? undefined,
            guests: input.guests ?? undefined,
          },
          context.now,
        );

        if (result.status === "pending_change" && context.sessionId) {
          updateSession(context.sessionId, {
            pendingChange: result.pendingChange,
            lastConfirmationCode: result.hold.confirmationCode,
          });
        }

        recordTrace(context, "prepareReservationChange", result);
        return result;
      },
    }),

    addSpecialRequest: tool({
      description:
        "Add a special request note to a confirmed hold, such as extra towels, a late arrival, or a birthday note. Does not change inventory or promise services the hotel cannot provide.",
      inputSchema: z.object({
        confirmationCode: z.string().min(3).max(40).nullable().optional(),
        request: z.string().min(3).max(500),
      }),
      execute: async (input) => {
        const session = context.sessionId ? readSession(context.sessionId) : null;
        const result = addHoldSpecialRequest(
          {
            confirmationCode: input.confirmationCode ?? session?.lastConfirmationCode,
            guestEmail: session?.guest.email,
            guestPhone: session?.guest.phone,
            sessionId: context.sessionId,
          },
          input.request,
        );
        recordTrace(context, "addSpecialRequest", result);
        return result;
      },
    }),

    escalateToStaff: tool({
      description:
        "Escalate the conversation to a human staff member when the guest asks to speak with someone, needs help you cannot provide, or wants a callback.",
      inputSchema: z.object({
        reason: z.string().min(3).max(200),
        summary: z.string().min(3).max(1000),
        guestName: z.string().min(2).max(120).nullable().optional(),
        guestEmail: z.string().email().nullable().optional(),
        guestPhone: z.string().min(8).max(40).nullable().optional(),
      }),
      execute: async (input) => {
        if (!context.sessionId) {
          const output = {
            status: "error" as const,
            message: "I couldn't open a staff ticket right now. Please call the front desk directly.",
          };
          recordTrace(context, "escalateToStaff", output);
          return output;
        }

        const ticket = createEscalation({
          sessionId: context.sessionId,
          reason: input.reason,
          summary: input.summary,
          guestName: input.guestName,
          guestEmail: input.guestEmail,
          guestPhone: input.guestPhone,
        });
        await notifyStaffEscalation(ticket);

        const hotel = getHotel();
        const output = {
          status: "success" as const,
          intent: "hotel_info" as const,
          ticketId: ticket.id,
          message: `I've flagged this for the front desk. A team member will follow up soon. If it's urgent, call ${hotel.phone} and mention ticket ${ticket.id.slice(0, 8).toUpperCase()}.`,
          images: imagesForAnswer("hotel_info", "front desk"),
        };
        recordTrace(context, "escalateToStaff", output);
        return output;
      },
    }),

    searchFaqs: tool({
      description:
        "Search the hotel FAQ list for a direct answer. Use when the guest asks a common front-desk question.",
      inputSchema: z.object({
        query: z.string().describe("Question or keywords to search in the FAQ list."),
      }),
      execute: async ({ query }) => {
        const lower = query.toLowerCase();
        const match = hotelData.faqs.find((faq) => {
          const question = faq.question.toLowerCase();
          const answer = faq.answer.toLowerCase();
          return (
            lower.includes(question) ||
            question.includes(lower) ||
            lower.split(/\s+/).some((token) => token.length > 3 && answer.includes(token))
          );
        });

        const output = match
          ? {
              status: "success" as const,
              intent: "hotel_info" as const,
              message: match.answer,
              images: imagesForAnswer("hotel_info", query),
            }
          : {
              status: "not_found" as const,
              intent: "unsupported" as const,
              message: unsupportedAnswer(query),
              images: [],
            };

        recordTrace(context, "searchFaqs", output);
        return output;
      },
    }),
  };
}

export type HotelTools = ReturnType<typeof createHotelTools>;
