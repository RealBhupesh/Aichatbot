import { formatInr, getAmenity, getHotel, getRoomById, getRooms, hotelData, roomsForGuests } from "@/lib/hotel";
import type { Intent } from "@/lib/schemas";

export function greetingAnswer() {
  return "I'm well, thank you. I'm Leela at the Asteria desk — rooms, check-in, breakfast, or dates, what can I help with?";
}

export function hotelOverviewAnswer() {
  const hotel = getHotel();
  return `${hotel.name} is in ${hotel.location}. Check-in is at ${hotel.checkIn} and check-out is at ${hotel.checkOut}. The front desk is open ${hotel.frontDesk}. You can reach the team at ${hotel.phone} or ${hotel.email}.`;
}

export function checkInAnswer() {
  const hotel = getHotel();
  return `Check-in at ${hotel.name} begins at ${hotel.checkIn}. Check-out is at ${hotel.checkOut}. The front desk is open ${hotel.frontDesk} if you need an early arrival.`;
}

export function breakfastAnswer(roomId?: string | null) {
  const room = getRoomById(roomId);
  const amenity = getAmenity("breakfast");

  if (room) {
    return room.breakfastIncluded
      ? `Yes — breakfast is included with the ${room.name}. It is served from 7:00 AM to 10:30 AM in the Garden Room.`
      : `Breakfast is not included with the ${room.name}. You can add it for ₹950 per adult per morning, served from 7:00 AM to 10:30 AM in the Garden Room.`;
  }

  return amenity?.details ?? "Breakfast is served daily from 7:00 AM to 10:30 AM in the Garden Room.";
}

export function amenityAnswer(query: string) {
  const hotel = getHotel();
  const lower = query.toLowerCase();

  if (lower.includes("pool") || lower.includes("swimming")) {
    const pool = getAmenity("pool");
    return `Yes. ${hotel.name} has a swimming pool. ${pool?.details}`;
  }

  if (lower.includes("wifi") || lower.includes("wi-fi") || lower.includes("internet")) {
    return getAmenity("wifi")?.details ?? "Complimentary Wi-Fi is available throughout the hotel.";
  }

  if (lower.includes("park")) {
    return getAmenity("parking")?.details ?? "Complimentary on-site parking is available for guests.";
  }

  if (lower.includes("gym") || lower.includes("fitness")) {
    return getAmenity("fitness")?.details ?? "A 24-hour fitness center is available on site.";
  }

  if (lower.includes("restaurant") || lower.includes("dinner") || lower.includes("lunch")) {
    return getAmenity("restaurant")?.details ?? "";
  }

  if (lower.includes("airport") || lower.includes("transfer") || lower.includes("shuttle")) {
    return getAmenity("airport-transfer")?.details ?? "";
  }

  if (lower.includes("breakfast")) {
    return breakfastAnswer();
  }

  const names = hotelData.amenities
    .filter((amenity) => amenity.available)
    .map((amenity) => amenity.name.toLowerCase());

  return `${hotel.name} offers ${names.join(", ")}. If you are looking for something specific, ask about that amenity and I will check the hotel information.`;
}

export function policyAnswer(query: string) {
  const policies = hotelData.policies;
  const lower = query.toLowerCase();

  if (lower.includes("cancel")) {
    return policies.cancellation;
  }

  if (lower.includes("pet") || lower.includes("dog") || lower.includes("cat")) {
    return policies.pets;
  }

  if (lower.includes("smok")) {
    return policies.smoking;
  }

  if (lower.includes("child") || lower.includes("kid") || lower.includes("infant") || lower.includes("crib")) {
    return policies.children;
  }

  return `A few policies guests ask about most: cancellation — ${policies.cancellation} Pets — ${policies.pets} Smoking — ${policies.smoking}`;
}

export function roomAnswer(roomId: string | null | undefined, query = "") {
  const room = getRoomById(roomId);
  const lower = query.toLowerCase();

  if (!room) {
    return `We have four room types: ${getRooms()
      .map((item) => `${item.name} (sleeps ${item.maxGuests})`)
      .join(", ")}. Which one would you like to know more about?`;
  }

  if (lower.includes("breakfast")) {
    return breakfastAnswer(room.id);
  }

  if (lower.includes("price") || lower.includes("cost") || lower.includes("how much") || lower.includes("rate")) {
    return `The ${room.name} is ${formatInr(room.pricePerNight)} per night and sleeps up to ${room.maxGuests} guests. Taxes are not included in this estimate.`;
  }

  return `The ${room.name} sleeps up to ${room.maxGuests} guests with ${room.beds.toLowerCase()}. ${room.description} It is ${formatInr(room.pricePerNight)} per night. Breakfast is ${room.breakfastIncluded ? "included" : "not included"}.`;
}

export function roomsForGuestCountAnswer(guests: number) {
  const matches = roomsForGuests(guests);

  if (matches.length === 0) {
    return `None of our published rooms sleep ${guests} guests. The Family Room sleeps 4, which is our highest occupancy. For a larger group, please contact the hotel at ${getHotel().phone}.`;
  }

  const list = matches
    .map(
      (room) =>
        `${room.name} (sleeps ${room.maxGuests}, ${room.beds}, ${formatInr(room.pricePerNight)}/night)`,
    )
    .join("; ");

  return `For ${guests} guests, these rooms fit: ${list}.`;
}

export function unsupportedAnswer(topic?: string | null) {
  const hotel = getHotel();
  const label = topic?.trim() || "that";

  return `I don't have reliable information about ${label}. I won't guess, because it isn't listed in the hotel details I have. Please contact ${hotel.name} directly at ${hotel.phone} or ${hotel.email} for confirmation.`;
}

export function missingAvailabilityPrompt(missing: string[]) {
  if (missing.includes("checkIn") && missing.includes("checkOut") && missing.includes("guests")) {
    return "I can check availability. What check-in date, check-out date, and number of guests should I use?";
  }

  if (missing.includes("checkIn") && missing.includes("checkOut")) {
    return "I can look that up. What dates are you planning to stay?";
  }

  if (missing.includes("checkIn")) {
    return "What check-in date should I use?";
  }

  if (missing.includes("checkOut")) {
    return "What check-out date should I use?";
  }

  if (missing.includes("guests")) {
    return "How many guests will be staying?";
  }

  return "I can check availability once I have the remaining stay details.";
}

export function groundedMessage(intent: Intent, query: string, roomId?: string | null, guests?: number | null) {
  switch (intent) {
    case "amenity":
      return amenityAnswer(query);
    case "policy":
      return policyAnswer(query);
    case "room_info":
      if (typeof guests === "number" && guests > 0 && !roomId) {
        return roomsForGuestCountAnswer(guests);
      }
      return roomAnswer(roomId, query);
    case "unsupported":
      return unsupportedAnswer();
    case "smalltalk":
      return greetingAnswer();
    case "hotel_info":
    default:
      if (/check-?in|check-?out|arrival|what time/i.test(query)) {
        return checkInAnswer();
      }
      if (/breakfast/i.test(query)) {
        return breakfastAnswer(roomId);
      }
      return hotelOverviewAnswer();
  }
}
