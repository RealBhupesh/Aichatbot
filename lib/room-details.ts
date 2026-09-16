import { getRoomById, hotelData } from "@/lib/hotel";
import type { AvailableRoom } from "@/lib/schemas";

export type RoomReview = {
  id: string;
  author: string;
  rating: number;
  date: string;
  text: string;
};

export type RoomDetail = {
  id: string;
  name: string;
  description: string;
  maxGuests: number;
  beds: string;
  sizeSqFt: number;
  breakfastIncluded: boolean;
  rating: number;
  reviewCount: number;
  images: Array<{ src: string; alt: string }>;
  included: string[];
  notIncluded: string[];
  reviews: RoomReview[];
};

const ROOM_GALLERY: Record<string, string[]> = {
  "standard-queen": ["/hotel/room-standard-queen.png", "/hotel/reception-desk.png"],
  "deluxe-king": ["/hotel/room-deluxe-king.png", "/hotel/breakfast.png"],
  "family-room": ["/hotel/room-family.png", "/hotel/pool.png"],
  "executive-suite": [
    "/hotel/room-executive-suite.png",
    "/hotel/pool.png",
    "/hotel/reception-desk.png",
  ],
};

const ROOM_REVIEWS: Record<string, RoomReview[]> = {
  "standard-queen": [
    {
      id: "sq-1",
      author: "Meera K.",
      rating: 5,
      date: "Aug 2026",
      text: "Compact but spotless. Loved the garden-facing window and the rain shower after the beach.",
    },
    {
      id: "sq-2",
      author: "Daniel R.",
      rating: 4,
      date: "Jul 2026",
      text: "Great value for a short Goa trip. Desk staff helped us add breakfast on arrival.",
    },
  ],
  "deluxe-king": [
    {
      id: "dk-1",
      author: "Anita S.",
      rating: 5,
      date: "Sep 2026",
      text: "Breakfast included every morning was a win. The sitting nook made it feel much larger.",
    },
    {
      id: "dk-2",
      author: "James L.",
      rating: 5,
      date: "Jun 2026",
      text: "Quiet room, strong Wi-Fi, and a proper king bed. Would book again.",
    },
  ],
  "family-room": [
    {
      id: "fr-1",
      author: "Priya & Rahul",
      rating: 5,
      date: "Aug 2026",
      text: "Perfect for our family of four. Sofa bed worked well for the kids after pool time.",
    },
    {
      id: "fr-2",
      author: "Chris M.",
      rating: 4,
      date: "May 2026",
      text: "Spacious and practical. Blackout curtains helped with early mornings.",
    },
  ],
  "executive-suite": [
    {
      id: "es-1",
      author: "Sofia V.",
      rating: 5,
      date: "Sep 2026",
      text: "The partial sea view from the living room was stunning. Felt like a proper suite, not a hotel box.",
    },
    {
      id: "es-2",
      author: "Arjun P.",
      rating: 5,
      date: "Jul 2026",
      text: "Worth it for a special weekend. Separate living space made working remotely easy.",
    },
  ],
};

const BASE_INCLUDED = ["Free Wi-Fi", "Air conditioning", "Daily housekeeping", "24-hour front desk"];
const BASE_NOT_INCLUDED = ["Airport transfer", "Spa treatments", "Laundry service"];

function amenityLists(room: NonNullable<ReturnType<typeof getRoomById>>) {
  const included = [...BASE_INCLUDED, ...room.amenities];
  const notIncluded = [...BASE_NOT_INCLUDED];

  if (!room.breakfastIncluded) {
    notIncluded.push("Breakfast (add-on available)");
  }

  if (!room.amenities.some((item) => /sea view/i.test(item))) {
    notIncluded.push("Sea view");
  }

  if (!room.amenities.some((item) => /living room/i.test(item))) {
    notIncluded.push("Separate living room");
  }

  return { included, notIncluded };
}

export function getRoomDetail(roomId: string): RoomDetail | null {
  const room = getRoomById(roomId);
  if (!room) {
    return null;
  }

  const gallery = ROOM_GALLERY[room.id] ?? (room.image ? [room.image] : []);
  const { included, notIncluded } = amenityLists(room);

  return {
    id: room.id,
    name: room.name,
    description: room.description,
    maxGuests: room.maxGuests,
    beds: room.beds,
    sizeSqFt: room.sizeSqFt,
    breakfastIncluded: room.breakfastIncluded,
    rating: hotelData.hotel.rating,
    reviewCount: ROOM_REVIEWS[room.id]?.length ?? 0,
    images: gallery.map((src, index) => ({
      src,
      alt: index === 0 ? room.name : `${room.name} photo ${index + 1}`,
    })),
    included,
    notIncluded,
    reviews: ROOM_REVIEWS[room.id] ?? [],
  };
}

export function getRoomDetailFromAvailability(room: AvailableRoom): RoomDetail | null {
  const detail = getRoomDetail(room.id);
  if (!detail) {
    return null;
  }

  if (room.image) {
    detail.images = [{ src: room.image, alt: room.name }, ...detail.images.slice(1)];
  }

  return detail;
}
