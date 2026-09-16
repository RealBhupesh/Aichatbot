import hotelJson from "@/data/hotel.json";

export type HotelAmenity = {
  id: string;
  name: string;
  available: boolean;
  details: string;
  image?: string;
};

export type HotelRoom = {
  id: string;
  name: string;
  description: string;
  maxGuests: number;
  beds: string;
  sizeSqFt: number;
  pricePerNight: number;
  breakfastIncluded: boolean;
  inventory: number;
  amenities: string[];
  image?: string;
};

export type HotelData = {
  hotel: {
    name: string;
    tagline: string;
    description: string;
    address: string;
    location: string;
    phone: string;
    email: string;
    checkIn: string;
    checkOut: string;
    frontDesk: string;
    currency: string;
    rating: number;
    reviewCount: number;
    image?: string;
  };
  amenities: HotelAmenity[];
  policies: {
    cancellation: string;
    pets: string;
    smoking: string;
    children: string;
    extraBed: string;
    earlyCheckIn: string;
  };
  rooms: HotelRoom[];
  faqs: Array<{ question: string; answer: string }>;
};

export const hotelData = hotelJson as HotelData;

export const ROOM_IDS = hotelData.rooms.map((room) => room.id);

export function getHotel() {
  return hotelData.hotel;
}

export function getRooms() {
  return hotelData.rooms;
}

export function getRoomById(id: string | null | undefined) {
  if (!id) {
    return undefined;
  }

  return hotelData.rooms.find((room) => room.id === id);
}

export function findRoomByName(text: string) {
  const haystack = text.toLowerCase();
  const stopWords = new Set(["room", "with", "the", "and"]);

  const ranked = hotelData.rooms
    .map((room) => {
      const name = room.name.toLowerCase();
      if (haystack.includes(name)) {
        return { room, score: 3 };
      }

      const tokens = name
        .split(" ")
        .filter((token) => token.length > 3 && !stopWords.has(token));
      const hits = tokens.filter((token) => haystack.includes(token)).length;
      return { room, score: hits };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.room;
}

export function roomsForGuests(guests: number) {
  return hotelData.rooms.filter((room) => room.maxGuests >= guests);
}

export function getAmenity(idOrName: string) {
  const needle = idOrName.toLowerCase();
  return hotelData.amenities.find(
    (amenity) =>
      amenity.id === needle ||
      amenity.name.toLowerCase() === needle ||
      amenity.name.toLowerCase().includes(needle),
  );
}

export function hasAmenityNamed(query: string) {
  const needle = query.toLowerCase();
  return hotelData.amenities.some(
    (amenity) =>
      amenity.available &&
      (needle.includes(amenity.id) || needle.includes(amenity.name.toLowerCase())),
  );
}

export function hotelContextForModel() {
  return JSON.stringify(
    {
      hotel: hotelData.hotel,
      amenities: hotelData.amenities,
      policies: hotelData.policies,
      rooms: hotelData.rooms.map((room) => ({
        id: room.id,
        name: room.name,
        description: room.description,
        maxGuests: room.maxGuests,
        beds: room.beds,
        pricePerNight: room.pricePerNight,
        breakfastIncluded: room.breakfastIncluded,
        amenities: room.amenities,
      })),
      faqs: hotelData.faqs,
      notOffered: [
        "helicopter transfers",
        "helipad",
        "casino",
        "kids club",
        "spa",
        "pets except trained service animals",
      ],
    },
    null,
    2,
  );
}

export function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
