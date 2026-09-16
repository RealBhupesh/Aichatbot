import { eachNight, nightsBetween, parseIsoDate, utcToday } from "@/lib/dates";
import { formatInr, type HotelRoom } from "@/lib/hotel";
import { getHotelClosedDates, getOperationalRooms } from "@/lib/operations";
import type { AvailabilityResult, AvailableRoom } from "@/lib/schemas";

export type AvailabilityInput = {
  checkIn: string;
  checkOut: string;
  adults: number;
};

export class AvailabilityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvailabilityValidationError";
  }
}

function remainingInventory(room: HotelRoom & { closed?: boolean; blackouts?: string[] }, night: string) {
  if (room.closed) {
    return 0;
  }

  if (getHotelClosedDates().includes(night)) {
    return 0;
  }

  if (room.blackouts?.includes(night)) {
    return 0;
  }

  const day = Number(night.slice(-2));
  const occupied = (day + room.id.length) % Math.max(1, room.inventory - 1);
  return room.inventory - occupied;
}

export const MIN_GUESTS = 1;
export const MAX_GUESTS = 8;

export function isRoomAvailableForStay(room: HotelRoom, nights: string[]) {
  return nights.every((night) => remainingInventory(room, night) > 0);
}

export function validateStay(
  input: AvailabilityInput,
  now = new Date(),
): { checkIn: string; checkOut: string; guests: number; nights: number } {
  const checkInDate = parseIsoDate(input.checkIn);
  const checkOutDate = parseIsoDate(input.checkOut);

  if (!checkInDate) {
    throw new AvailabilityValidationError(
      "Please use a valid check-in date in YYYY-MM-DD format.",
    );
  }

  if (!checkOutDate) {
    throw new AvailabilityValidationError(
      "Please use a valid check-out date in YYYY-MM-DD format.",
    );
  }

  const nights = nightsBetween(input.checkIn, input.checkOut);
  if (nights === null || nights <= 0) {
    throw new AvailabilityValidationError(
      "Check-out must be after check-in.",
    );
  }

  const today = utcToday(now);
  if (checkInDate.getTime() < today.getTime()) {
    throw new AvailabilityValidationError(
      "Check-in must be today or a future date.",
    );
  }

  if (!Number.isInteger(input.adults) || input.adults < MIN_GUESTS) {
    throw new AvailabilityValidationError(
      `Please enter at least ${MIN_GUESTS} guest.`,
    );
  }

  if (input.adults > MAX_GUESTS) {
    throw new AvailabilityValidationError(
      `This assistant can search stays for up to ${MAX_GUESTS} guests. For larger groups, please contact the hotel directly.`,
    );
  }

  return {
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guests: input.adults,
    nights,
  };
}

function toAvailableRoom(
  room: HotelRoom,
  nights: number,
): AvailableRoom {
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    maxGuests: room.maxGuests,
    beds: room.beds,
    amenities: room.amenities,
    breakfastIncluded: room.breakfastIncluded,
    pricePerNight: room.pricePerNight,
    totalPrice: room.pricePerNight * nights,
    nights,
    image: room.image,
  };
}

export function formatAvailabilityMessage(result: AvailabilityResult) {
  if (!result.available || result.rooms.length === 0) {
    return `I couldn't find a room that fits ${result.guests} guest${result.guests === 1 ? "" : "s"} from ${result.checkIn} to ${result.checkOut}. Nearby dates, a different guest count, or the front desk at the hotel may have another option.`;
  }

  const names = result.rooms.map((room) => room.name);
  const listed =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

  return `I found ${result.rooms.length} option${result.rooms.length === 1 ? "" : "s"} for ${result.guests} guest${result.guests === 1 ? "" : "s"} across ${result.nights} night${result.nights === 1 ? "" : "s"}: ${listed}. Prices below are estimates in INR and are not a booking.`;
}

export function checkAvailability(
  input: AvailabilityInput,
  now = new Date(),
): AvailabilityResult {
  const stay = validateStay(input, now);
  const nights = eachNight(stay.checkIn, stay.checkOut);

  const rooms = getOperationalRooms()
    .filter((room) => !room.closed)
    .filter((room) => room.maxGuests >= stay.guests)
    .filter((room) => isRoomAvailableForStay(room, nights))
    .map((room) => toAvailableRoom(room, stay.nights));

  const result: AvailabilityResult = {
    available: rooms.length > 0,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    nights: stay.nights,
    guests: stay.guests,
    rooms,
  };

  result.message = formatAvailabilityMessage(result);
  return result;
}

export function summarizeStayPrice(pricePerNight: number, nights: number) {
  return `${formatInr(pricePerNight)}/night · ${nights} night${nights === 1 ? "" : "s"} · ${formatInr(pricePerNight * nights)} total`;
}
