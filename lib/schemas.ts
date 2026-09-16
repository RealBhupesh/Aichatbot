import { z } from "zod";

export const intentSchema = z.enum([
  "smalltalk",
  "hotel_info",
  "room_info",
  "amenity",
  "policy",
  "availability",
  "follow_up",
  "unsupported",
]);

export type Intent = z.infer<typeof intentSchema>;

export const staySnapshotSchema = z.object({
  checkIn: z.string().nullable().optional(),
  checkOut: z.string().nullable().optional(),
  guests: z.number().int().nullable().optional(),
  maxBudget: z.number().int().positive().nullable().optional(),
  checkInTime: z.string().nullable().optional(),
  checkOutTime: z.string().nullable().optional(),
});

export const historyMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const roomIdSchema = z.enum([
  "standard-queen",
  "deluxe-king",
  "family-room",
  "executive-suite",
]);

export const chatActionSchema = z.object({
  type: z.enum([
    "confirm_hold",
    "cancel_hold",
    "select_room",
    "hold_room",
    "confirm_modify",
    "cancel_modify",
    "confirm_cancel",
    "keep_reservation",
  ]),
  holdToken: z.string().optional(),
  roomId: roomIdSchema.optional(),
  holdId: z.string().optional(),
});

export const chatRequestSchema = z
  .object({
    message: z.string().trim().max(2000).optional().default(""),
    history: z.array(historyMessageSchema).max(12).optional().default([]),
    availability: staySnapshotSchema.optional(),
    source: z.enum(["chat", "availability_form"]).optional().default("chat"),
    action: chatActionSchema.optional(),
  })
  .strict()
  .refine((value) => value.message.length > 0 || value.action, {
    message: "Please enter a message.",
    path: ["message"],
  });

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const assistantUnderstandingSchema = z.object({
  intent: intentSchema,
  reply: z.string().min(1).max(2000),
  referencedRoomId: z
    .enum([
      "standard-queen",
      "deluxe-king",
      "family-room",
      "executive-suite",
    ])
    .nullable(),
  availability: z.object({
    checkIn: z.string().nullable(),
    checkOut: z.string().nullable(),
    guests: z.number().int().min(1).max(8).nullable(),
  }),
  unsupportedTopic: z.string().nullable(),
});

export type AssistantUnderstanding = z.infer<
  typeof assistantUnderstandingSchema
>;

export const availableRoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  maxGuests: z.number().int(),
  beds: z.string(),
  amenities: z.array(z.string()),
  breakfastIncluded: z.boolean(),
  pricePerNight: z.number(),
  totalPrice: z.number(),
  nights: z.number().int(),
  image: z.string().optional(),
});

export const answerImageSchema = z.object({
  src: z.string(),
  alt: z.string(),
  caption: z.string().optional(),
});

export const availabilityResultSchema = z.object({
  available: z.boolean(),
  checkIn: z.string(),
  checkOut: z.string(),
  nights: z.number().int(),
  guests: z.number().int(),
  rooms: z.array(availableRoomSchema),
  message: z.string().optional(),
});

export type AvailableRoom = z.infer<typeof availableRoomSchema>;
export type AvailabilityResult = z.infer<typeof availabilityResultSchema>;

export const chatResponseActionSchema = z.object({
  type: z.enum([
    "confirm_hold",
    "cancel_hold",
    "select_room",
    "hold_room",
    "confirm_modify",
    "cancel_modify",
    "confirm_cancel",
    "keep_reservation",
  ]),
  label: z.string(),
  holdToken: z.string().optional(),
  roomId: roomIdSchema.optional(),
  holdId: z.string().optional(),
});

export const chatSuggestionSchema = z.object({
  label: z.string(),
  message: z.string(),
});

export const responseTypeSchema = z.enum([
  "answer",
  "availability_request",
  "availability_results",
  "booking_hold",
  "booking_requested",
  "booking_confirmed",
  "booking_modified",
  "booking_cancelled",
  "fallback",
  "error",
]);

export const chatResponseSchema = z.object({
  success: z.boolean(),
  type: responseTypeSchema,
  message: z.string(),
  intent: z.string(),
  availabilityRequired: z.boolean(),
  missingFields: z.array(z.string()),
  rooms: z.array(availableRoomSchema),
  images: z.array(answerImageSchema).default([]),
  actions: z.array(chatResponseActionSchema).optional().default([]),
  suggestions: z.array(chatSuggestionSchema).optional().default([]),
  sessionId: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().nullable().optional(),
  mode: z.enum(["ai", "staff"]).optional(),
  data: z
    .object({
      checkIn: z.string().nullable().optional(),
      checkOut: z.string().nullable().optional(),
      guests: z.number().nullable().optional(),
      nights: z.number().nullable().optional(),
      available: z.boolean().optional(),
      missingFields: z.array(z.string()).optional(),
      rooms: z.array(availableRoomSchema).optional(),
      selectedRoomId: z.string().nullable().optional(),
      holdToken: z.string().nullable().optional(),
      confirmationCode: z.string().nullable().optional(),
      roomName: z.string().nullable().optional(),
      guestName: z.string().nullable().optional(),
      guestEmail: z.string().nullable().optional(),
      guestPhone: z.string().nullable().optional(),
      maxBudget: z.number().nullable().optional(),
      checkInTime: z.string().nullable().optional(),
      checkOutTime: z.string().nullable().optional(),
      catalog: z.boolean().optional(),
      totalPrice: z.number().nullable().optional(),
      holdId: z.string().nullable().optional(),
      specialRequests: z.string().nullable().optional(),
    })
    .nullable(),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format.");
