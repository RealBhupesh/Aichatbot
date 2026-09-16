import { getRoomById, getRooms, roomsForGuests, type HotelRoom } from "@/lib/hotel";
import type { AvailableRoom } from "@/lib/schemas";

function hotelRoomToAvailable(room: HotelRoom, nights = 1): AvailableRoom {
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

export function looksLikeRoomCatalogRequest(query = "") {
  return /all rooms?|room types?|their pics?|show me rooms?|which rooms?|rooms and (their )?pics?|photos? of (the )?rooms?|list (of )?rooms?/i.test(
    query,
  );
}

export function buildCatalogRooms(input: {
  roomId?: string | null;
  guests?: number | null;
  query?: string;
  nights?: number;
}) {
  const nights = input.nights ?? 1;
  let rooms = getRooms();

  if (input.roomId) {
    const room = getRoomById(input.roomId);
    return room ? [hotelRoomToAvailable(room, nights)] : [];
  }

  if (typeof input.guests === "number" && input.guests > 0) {
    rooms = roomsForGuests(input.guests);
  } else if (!looksLikeRoomCatalogRequest(input.query ?? "")) {
    const lower = (input.query ?? "").toLowerCase();
    const mentionsRoomType = getRooms().some((room) => lower.includes(room.name.toLowerCase()));
    if (mentionsRoomType) {
      const match = getRooms().find((room) => lower.includes(room.name.toLowerCase()));
      return match ? [hotelRoomToAvailable(match, nights)] : [];
    }
    return [];
  }

  return rooms.map((room) => hotelRoomToAvailable(room, nights));
}

export function roomCatalogIntro(count: number) {
  if (count === 1) {
    return "Here are the details for this room. Tap the card below for photos, reviews, and amenities.";
  }
  return `Here’s a quick look at our ${count} room types. Compare them below, then tap any card for photos, reviews, and full details.`;
}

export function stripMarkdownTables(content: string) {
  return content
    .replace(/^\s*\|.*\|\s*$/gm, "")
    .replace(/^\s*\|?[-:|\s]+\|?\s*$/gm, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
