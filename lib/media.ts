import { getAmenity, getRoomById, getRooms } from "@/lib/hotel";
import type { Intent } from "@/lib/schemas";

export type AnswerImage = {
  src: string;
  alt: string;
  caption?: string;
};

const BLOCKED_IMAGE_PATHS = new Set([
  "/hotel/reception-desk.png",
  "/hotel/leela.png",
]);

export function filterAnswerImages(images: AnswerImage[]) {
  return images.filter((image) => !BLOCKED_IMAGE_PATHS.has(image.src));
}

function unique(images: AnswerImage[]) {
  const seen = new Set<string>();
  return images.filter((image) => {
    if (seen.has(image.src) || BLOCKED_IMAGE_PATHS.has(image.src)) {
      return false;
    }
    seen.add(image.src);
    return true;
  });
}

function roomImage(roomId: string | null | undefined): AnswerImage | null {
  const room = getRoomById(roomId);
  if (!room?.image) {
    return null;
  }
  return {
    src: room.image,
    alt: room.name,
    caption: room.name,
  };
}

export function imagesForAnswer(
  intent: Intent | string,
  query: string,
  roomId?: string | null,
  guests?: number | null,
): AnswerImage[] {
  const lower = query.toLowerCase();

  if (
    intent === "unsupported" ||
    intent === "error" ||
    intent === "validation" ||
    intent === "smalltalk" ||
    intent === "availability" ||
    intent === "policy"
  ) {
    return [];
  }

  if (/check-?in|check-?out|front desk|reception|what time/i.test(lower) || intent === "hotel_info") {
    if (/pool|swimming/.test(lower)) {
      const pool = getAmenity("pool");
      return pool?.image
        ? [{ src: pool.image, alt: pool.name, caption: pool.name }]
        : [];
    }
    return [];
  }

  if (intent === "amenity" || /pool|breakfast|restaurant|wifi|gym|fitness/.test(lower)) {
    if (/pool|swimming/.test(lower)) {
      const pool = getAmenity("pool");
      return pool?.image
        ? [{ src: pool.image, alt: "Lagoon swimming pool", caption: "Pool deck" }]
        : [];
    }
    if (/breakfast|restaurant|dinner|lunch/.test(lower)) {
      const breakfast = getAmenity("breakfast");
      return breakfast?.image
        ? [{ src: breakfast.image, alt: "Garden Room breakfast", caption: "Garden Room" }]
        : [];
    }
    const pool = getAmenity("pool");
    const breakfast = getAmenity("breakfast");
    return unique(
      [pool, breakfast]
        .filter((item): item is NonNullable<typeof item> => Boolean(item?.image))
        .map((item) => ({ src: item.image as string, alt: item.name, caption: item.name })),
    );
  }

  if (intent === "room_info") {
    const specific = roomImage(roomId);
    if (specific) {
      return [specific];
    }
    const matches =
      typeof guests === "number"
        ? getRooms().filter((room) => room.maxGuests >= guests)
        : getRooms();
    return unique(
      matches
        .filter((room) => room.image)
        .slice(0, 4)
        .map((room) => ({
          src: room.image as string,
          alt: room.name,
          caption: `${room.name} · sleeps ${room.maxGuests}`,
        })),
    );
  }

  return [];
}

export function welcomeImages(): AnswerImage[] {
  return [];
}
