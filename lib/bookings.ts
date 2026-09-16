import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readJsonFile, resolveDataFile, writeJsonFile } from "@/lib/data-files";
import { searchAvailability } from "@/lib/availability-search";
import { getRoomById } from "@/lib/hotel";
import { logger } from "@/lib/logger";
import { getRoomOperations, readOperations, writeOperations } from "@/lib/operations";
import type { AvailableRoom } from "@/lib/schemas";

export type PendingHold = {
  token: string;
  roomId: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  nights: number;
  pricePerNight: number;
  totalPrice: number;
  createdAt: string;
  expiresAt: string;
  sessionId: string | null;
};

export type BookingHold = PendingHold & {
  id: string;
  confirmationCode: string;
  status: "pending_staff" | "confirmed" | "cancelled" | "declined";
  confirmedAt: string | null;
  specialRequests: string | null;
  cancelledAt: string | null;
  updatedAt: string;
};

export type PendingChange = {
  holdId: string;
  confirmationCode: string;
  checkIn: string;
  checkOut: string;
  roomId: string;
  roomName: string;
  guests: number;
  nights: number;
  pricePerNight: number;
  totalPrice: number;
  expiresAt: string;
};

export type FindHoldQuery = {
  holdId?: string | null;
  confirmationCode?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  sessionId?: string | null;
};

type BookingStore = {
  holds: BookingHold[];
};

const FILE = resolveDataFile("bookings.json");
const HOLD_TTL_MS = 30 * 60 * 1000;
const STAFF_REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

let cache: BookingStore | null = null;

function secret() {
  return process.env.STAFF_SECRET || process.env.STAFF_PASSWORD || "asteria-local-staff-secret";
}

function nowIso() {
  return new Date().toISOString();
}

function signHoldToken(holdId: string, expiresAt: string) {
  return createHmac("sha256", secret()).update(`${holdId}:${expiresAt}`).digest("hex");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function confirmationCode() {
  return `AST-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export function resetBookingsCache() {
  cache = { holds: [] };
}

export function readBookingStore(): BookingStore {
  if (cache) {
    return cache;
  }

  cache = readJsonFile(FILE, { holds: [] } as BookingStore);
  cache.holds ??= [];
  return cache;
}

function writeBookingStore(store: BookingStore) {
  cache = store;
  writeJsonFile(FILE, store);
}

function findRoomOffer(
  roomId: string,
  checkIn: string,
  checkOut: string,
  guests: number,
  now: Date,
): AvailableRoom | null {
  const result = searchAvailability(
    {
      checkIn,
      checkOut,
      adults: guests,
    },
    now,
  );

  if (result.status !== "success") {
    return null;
  }

  return result.rooms.find((room) => room.id === roomId) ?? null;
}

export type PrepareHoldInput = {
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  sessionId?: string | null;
};

export type PrepareHoldResult =
  | {
      status: "pending_confirmation";
      holdToken: string;
      pendingHold: PendingHold;
      message: string;
    }
  | {
      status: "pending_staff";
      hold: BookingHold;
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

export type SubmitBookingResult =
  | {
      status: "pending_staff";
      hold: BookingHold;
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

export function prepareBookingHold(input: PrepareHoldInput, now = new Date()): PrepareHoldResult {
  const room = getRoomById(input.roomId);
  if (!room) {
    return { status: "error", message: "I couldn't find that room type." };
  }

  const offer = findRoomOffer(input.roomId, input.checkIn, input.checkOut, input.guests, now);
  if (!offer) {
    return {
      status: "error",
      message: `The ${room.name} is not available for those dates. I can check other room types or nearby dates if you like.`,
    };
  }

  const holdId = randomBytes(8).toString("hex");
  const expiresAt = new Date(now.getTime() + HOLD_TTL_MS).toISOString();
  const holdToken = `${holdId}.${signHoldToken(holdId, expiresAt)}`;

  const pendingHold: PendingHold = {
    token: holdToken,
    roomId: offer.id,
    roomName: offer.name,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guests: input.guests,
    guestName: input.guestName.trim(),
    guestEmail: input.guestEmail?.trim() || null,
    guestPhone: input.guestPhone?.trim() || null,
    nights: offer.nights,
    pricePerNight: offer.pricePerNight,
    totalPrice: offer.totalPrice,
    createdAt: nowIso(),
    expiresAt,
    sessionId: input.sessionId ?? null,
  };

  return {
    status: "pending_confirmation",
    holdToken,
    pendingHold,
    message: `I can send the ${offer.name} from ${input.checkIn} to ${input.checkOut} to the front desk for ${input.guestName}. Estimated total ₹${offer.totalPrice.toLocaleString("en-IN")}.`,
  };
}

export function verifyHoldToken(token: string, pendingHold: PendingHold | null, now = new Date()) {
  if (!pendingHold || pendingHold.token !== token) {
    return false;
  }

  const [holdId, signature] = token.split(".");
  if (!holdId || !signature) {
    return false;
  }

  if (!safeEqual(signature, signHoldToken(holdId, pendingHold.expiresAt))) {
    return false;
  }

  if (new Date(pendingHold.expiresAt).getTime() < now.getTime()) {
    return false;
  }

  return true;
}

function incrementRoomInventory(roomId: string) {
  const ops = readOperations();
  const roomOps = ops.rooms[roomId];
  if (!roomOps) {
    return;
  }
  roomOps.inventory += 1;
  writeOperations(ops);
}

function findRoomOfferAllowingHeld(
  roomId: string,
  checkIn: string,
  checkOut: string,
  guests: number,
  now: Date,
  extraInventoryRoomId?: string,
) {
  const ops = extraInventoryRoomId ? readOperations() : null;
  const extraRoom = extraInventoryRoomId ? ops?.rooms[extraInventoryRoomId] : null;
  if (extraRoom) {
    extraRoom.inventory += 1;
  }
  try {
    return findRoomOffer(roomId, checkIn, checkOut, guests, now);
  } finally {
    if (extraRoom) {
      extraRoom.inventory -= 1;
    }
  }
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function preferConfirmed(holds: BookingHold[]) {
  const lookup = holds.filter(
    (hold) => hold.status === "confirmed" || hold.status === "cancelled",
  );
  return lookup.find((hold) => hold.status === "confirmed") ?? lookup[0] ?? null;
}

export function findHold(query: FindHoldQuery) {
  const holds = readBookingStore().holds;
  const code = query.confirmationCode?.trim().toUpperCase();
  if (code) {
    return preferConfirmed(
      holds.filter((hold) => hold.confirmationCode.toUpperCase() === code),
    );
  }

  if (query.holdId?.trim()) {
    return preferConfirmed(holds.filter((hold) => hold.id === query.holdId));
  }

  const email = query.guestEmail?.trim().toLowerCase();
  if (email) {
    return preferConfirmed(
      holds.filter((hold) => hold.guestEmail?.toLowerCase() === email),
    );
  }

  const phone = query.guestPhone ? normalizePhone(query.guestPhone) : "";
  if (phone.length >= 8) {
    return preferConfirmed(
      holds.filter((hold) => hold.guestPhone && normalizePhone(hold.guestPhone) === phone),
    );
  }

  if (query.sessionId) {
    return preferConfirmed(holds.filter((hold) => hold.sessionId === query.sessionId));
  }

  return null;
}

function holdSummary(hold: BookingHold) {
  return `${hold.confirmationCode} for the ${hold.roomName} (${hold.checkIn} to ${hold.checkOut}, ${hold.guests} guest${hold.guests === 1 ? "" : "s"})`;
}

export function lookupReservation(query: FindHoldQuery) {
  const hold = findHold(query);
  if (!hold) {
    return {
      status: "not_found" as const,
      message:
        "I couldn't find a hold with those details. Share the confirmation code (AST-xxxx) or the email or phone used at booking.",
    };
  }

  const special = hold.specialRequests ? ` Notes on file: ${hold.specialRequests}` : "";
  const state = hold.status === "cancelled" ? "cancelled" : "confirmed";
  return {
    status: "found" as const,
    hold,
    message: `I found a ${state} hold: ${holdSummary(hold)}. Estimated total ₹${hold.totalPrice.toLocaleString("en-IN")}.${special}`,
  };
}

export type ModifyHoldPatch = {
  checkIn?: string;
  checkOut?: string;
  roomId?: string;
  guests?: number;
};

export function prepareReservationChange(
  query: FindHoldQuery & ModifyHoldPatch,
  now = new Date(),
):
  | { status: "pending_change"; pendingChange: PendingChange; hold: BookingHold; message: string }
  | { status: "error"; message: string } {
  const hold = findHold(query);
  if (!hold || hold.status !== "confirmed") {
    return {
      status: "error",
      message: "I couldn't find an active hold to change. Share the confirmation code if you have it.",
    };
  }

  const checkIn = query.checkIn ?? hold.checkIn;
  const checkOut = query.checkOut ?? hold.checkOut;
  const roomId = query.roomId ?? hold.roomId;
  const guests = query.guests ?? hold.guests;
  const extraInventory = roomId === hold.roomId ? hold.roomId : undefined;
  const offer = findRoomOfferAllowingHeld(roomId, checkIn, checkOut, guests, now, extraInventory);
  if (!offer) {
    const room = getRoomById(roomId);
    return {
      status: "error",
      message: `The ${room?.name ?? "requested room"} is not available for those dates. I can check other rooms or dates if you like.`,
    };
  }

  const pendingChange: PendingChange = {
    holdId: hold.id,
    confirmationCode: hold.confirmationCode,
    checkIn,
    checkOut,
    roomId: offer.id,
    roomName: offer.name,
    guests,
    nights: offer.nights,
    pricePerNight: offer.pricePerNight,
    totalPrice: offer.totalPrice,
    expiresAt: new Date(now.getTime() + HOLD_TTL_MS).toISOString(),
  };

  return {
    status: "pending_change",
    pendingChange,
    hold,
    message: `I can move ${hold.confirmationCode} to the ${offer.name} from ${checkIn} to ${checkOut} for ${guests} guest${guests === 1 ? "" : "s"}. The estimated total is ₹${offer.totalPrice.toLocaleString("en-IN")}. Please confirm to apply the change.`,
  };
}

export function modifyConfirmedHold(
  holdId: string,
  patch: ModifyHoldPatch,
  now = new Date(),
):
  | { status: "modified"; hold: BookingHold; message: string }
  | { status: "error"; message: string } {
  const prepared = prepareReservationChange({ holdId, ...patch }, now);
  if (prepared.status === "error") {
    return prepared;
  }

  const store = readBookingStore();
  const hold = store.holds.find((entry) => entry.id === prepared.hold.id);
  if (!hold || hold.status !== "confirmed") {
    return { status: "error", message: "That hold is no longer active." };
  }

  const next = prepared.pendingChange;
  try {
    if (next.roomId !== hold.roomId) {
      const ops = readOperations();
      const nextOps = ops.rooms[next.roomId];
      if (!nextOps || nextOps.closed || nextOps.inventory <= 0) {
        return {
          status: "error",
          message: `Sorry — the ${next.roomName} just sold out for those dates.`,
        };
      }
      nextOps.inventory -= 1;
      const previous = ops.rooms[hold.roomId];
      if (previous) {
        previous.inventory += 1;
      }
      writeOperations(ops);
    }
  } catch (error) {
    logger.error("booking.modify_inventory_failed", {
      holdId: hold.id,
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      status: "error",
      message: "I couldn't update that hold right now. Please try again shortly.",
    };
  }

  hold.checkIn = next.checkIn;
  hold.checkOut = next.checkOut;
  hold.roomId = next.roomId;
  hold.roomName = next.roomName;
  hold.guests = next.guests;
  hold.nights = next.nights;
  hold.pricePerNight = next.pricePerNight;
  hold.totalPrice = next.totalPrice;
  hold.updatedAt = nowIso();
  writeBookingStore(store);

  return {
    status: "modified",
    hold,
    message: `Done — ${hold.confirmationCode} is now the ${hold.roomName} from ${hold.checkIn} to ${hold.checkOut}. Estimated total ₹${hold.totalPrice.toLocaleString("en-IN")}. This is still a demo hold, not a live PMS booking.`,
  };
}

export function cancelConfirmedHold(holdId: string):
  | { status: "cancelled"; hold: BookingHold; message: string }
  | { status: "error"; message: string } {
  const store = readBookingStore();
  const hold =
    store.holds.find((entry) => entry.id === holdId) ??
    store.holds.find((entry) => entry.confirmationCode.toUpperCase() === holdId.trim().toUpperCase());
  if (!hold) {
    return { status: "error", message: "I couldn't find that hold." };
  }
  if (hold.status === "cancelled") {
    return {
      status: "error",
      message: `${hold.confirmationCode} is already cancelled.`,
    };
  }

  incrementRoomInventory(hold.roomId);
  hold.status = "cancelled";
  hold.cancelledAt = nowIso();
  hold.updatedAt = nowIso();
  writeBookingStore(store);

  return {
    status: "cancelled",
    hold,
    message: `I've cancelled ${hold.confirmationCode} for the ${hold.roomName}. The room is back in inventory. This was a demo hold, not a live PMS booking.`,
  };
}

export function addHoldSpecialRequest(query: FindHoldQuery, request: string) {
  const hold = findHold(query);
  if (!hold || hold.status !== "confirmed") {
    return {
      status: "error" as const,
      message: "I couldn't find an active hold to add that request to. Share the confirmation code if you have it.",
    };
  }

  const note = request.trim();
  if (!note) {
    return { status: "error" as const, message: "Please tell me what to add to the hold." };
  }

  const store = readBookingStore();
  const stored = store.holds.find((entry) => entry.id === hold.id);
  if (!stored) {
    return { status: "error" as const, message: "I couldn't find that hold." };
  }

  stored.specialRequests = stored.specialRequests ? `${stored.specialRequests} ${note}` : note;
  stored.updatedAt = nowIso();
  writeBookingStore(store);

  const unfulfillable = /helicopter|private jet|yacht|unlimited alcohol/i.test(note);
  return {
    status: "success" as const,
    hold: stored,
    unfulfillable,
    message: unfulfillable
      ? `I've noted that on ${stored.confirmationCode}, but I can't confirm we can arrange it. I can flag the front desk if you'd like.`
      : `I've added that note to ${stored.confirmationCode}: ${stored.specialRequests}`,
  };
}

function decrementRoomInventory(roomId: string) {
  const ops = readOperations();
  const roomOps = ops.rooms[roomId];
  if (!roomOps || roomOps.inventory <= 0) {
    throw new Error("No inventory available for this room.");
  }

  roomOps.inventory -= 1;
  writeOperations(ops);
}

export type ConfirmHoldResult =
  | {
      status: "confirmed";
      hold: BookingHold;
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

function staffRequestMessage(hold: BookingHold) {
  const phone = hold.guestPhone?.trim();
  return `I've sent the ${hold.roomName} request to the front desk for ${hold.checkIn} to ${hold.checkOut}. They'll call you${phone ? ` at ${phone}` : ""} to confirm. This is not a booking until the desk confirms.`;
}

export function submitBookingRequest(pendingHold: PendingHold, now = new Date()): SubmitBookingResult {
  if (!pendingHold.guestPhone?.trim()) {
    return {
      status: "error",
      message: "I need a phone number so the front desk can call to confirm this booking.",
    };
  }

  const offer = findRoomOffer(
    pendingHold.roomId,
    pendingHold.checkIn,
    pendingHold.checkOut,
    pendingHold.guests,
    now,
  );
  if (!offer) {
    return {
      status: "error",
      message: `The ${pendingHold.roomName} is not available for those dates. I can check other room types or nearby dates if you like.`,
    };
  }

  const store = readBookingStore();
  const existing = store.holds.find(
    (hold) =>
      hold.status === "pending_staff" &&
      hold.sessionId &&
      hold.sessionId === pendingHold.sessionId &&
      hold.roomId === pendingHold.roomId &&
      hold.checkIn === pendingHold.checkIn &&
      hold.checkOut === pendingHold.checkOut,
  );
  if (existing) {
    return {
      status: "pending_staff",
      hold: existing,
      message: staffRequestMessage(existing),
    };
  }

  const stamp = nowIso();
  const hold: BookingHold = {
    ...pendingHold,
    expiresAt: new Date(now.getTime() + STAFF_REQUEST_TTL_MS).toISOString(),
    sessionId: pendingHold.sessionId ?? null,
    id: pendingHold.token.split(".")[0] ?? randomBytes(8).toString("hex"),
    confirmationCode: "",
    status: "pending_staff",
    confirmedAt: null,
    specialRequests: null,
    cancelledAt: null,
    updatedAt: stamp,
  };

  store.holds.push(hold);
  writeBookingStore(store);

  logger.info("booking.request_submitted", {
    holdId: hold.id,
    roomId: hold.roomId,
    sessionId: hold.sessionId,
  });

  return {
    status: "pending_staff",
    hold,
    message: staffRequestMessage(hold),
  };
}

export function confirmStaffBooking(holdId: string, now = new Date()): ConfirmHoldResult {
  const store = readBookingStore();
  const hold = store.holds.find((entry) => entry.id === holdId);
  if (!hold || hold.status !== "pending_staff") {
    return {
      status: "error",
      message: "That booking request is no longer waiting on the desk.",
    };
  }

  if (new Date(hold.expiresAt).getTime() < now.getTime()) {
    return {
      status: "error",
      message: "That booking request expired. The guest can send a new one.",
    };
  }

  const offer = findRoomOffer(hold.roomId, hold.checkIn, hold.checkOut, hold.guests, now);
  if (!offer) {
    return {
      status: "error",
      message: `Sorry — the ${hold.roomName} is no longer available for those dates.`,
    };
  }

  const ops = getRoomOperations(hold.roomId);
  if (ops.closed || ops.inventory <= 0) {
    return {
      status: "error",
      message: `Sorry — the ${hold.roomName} just sold out for those dates.`,
    };
  }

  try {
    decrementRoomInventory(hold.roomId);
  } catch (error) {
    logger.error("booking.inventory_failed", {
      roomId: hold.roomId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      status: "error",
      message: "I couldn't reserve that room right now. Please try again shortly.",
    };
  }

  const stamp = nowIso();
  hold.confirmationCode = confirmationCode();
  hold.status = "confirmed";
  hold.confirmedAt = stamp;
  hold.updatedAt = stamp;
  writeBookingStore(store);

  return {
    status: "confirmed",
    hold,
    message: `The front desk confirmed your stay under ${hold.confirmationCode} for the ${hold.roomName} (${hold.checkIn} to ${hold.checkOut}). Estimated total ₹${hold.totalPrice.toLocaleString("en-IN")}. This is a demo booking, not a live PMS reservation.`,
  };
}

export function declineStaffBooking(holdId: string, now = new Date()):
  | { status: "declined"; hold: BookingHold; message: string }
  | { status: "error"; message: string } {
  const store = readBookingStore();
  const hold = store.holds.find((entry) => entry.id === holdId);
  if (!hold || hold.status !== "pending_staff") {
    return {
      status: "error",
      message: "That booking request is no longer waiting on the desk.",
    };
  }

  hold.status = "declined";
  hold.updatedAt = nowIso();
  hold.cancelledAt = now.toISOString();
  writeBookingStore(store);

  return {
    status: "declined",
    hold,
    message: `The front desk couldn't confirm the ${hold.roomName} for ${hold.checkIn} to ${hold.checkOut}. Tell me if you'd like another room or different dates.`,
  };
}

export function confirmBookingHold(pendingHold: PendingHold, now = new Date()): ConfirmHoldResult {
  const submitted = submitBookingRequest(pendingHold, now);
  if (submitted.status === "error") {
    return submitted;
  }
  return confirmStaffBooking(submitted.hold.id, now);
}

export function listPendingStaffBookings(now = new Date()) {
  return readBookingStore()
    .holds.filter(
      (hold) =>
        hold.status === "pending_staff" && new Date(hold.expiresAt).getTime() >= now.getTime(),
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function listBookingHolds() {
  return readBookingStore().holds;
}

export function listHolds() {
  return listBookingHolds();
}
