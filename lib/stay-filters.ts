import { formatInr } from "@/lib/hotel";
import type { RoomPreference } from "@/lib/dates";
import type { AvailableRoom } from "@/lib/schemas";

export function applyRoomPreference(rooms: AvailableRoom[], preference: RoomPreference) {
  if (!preference || rooms.length === 0) {
    return rooms;
  }

  if (preference === "cheapest") {
    return [...rooms].sort((left, right) => left.pricePerNight - right.pricePerNight);
  }

  const wanted =
    preference === "deluxe"
      ? "deluxe-king"
      : preference === "family"
        ? "family-room"
        : preference === "suite"
          ? "executive-suite"
          : null;

  if (!wanted) {
    return rooms;
  }

  const match = rooms.filter((room) => room.id === wanted);
  if (match.length === 0) {
    return rooms;
  }

  return [...match, ...rooms.filter((room) => room.id !== wanted)];
}

export function applyBudgetFilter(rooms: AvailableRoom[], maxBudget: number | null) {
  if (!maxBudget) {
    return rooms;
  }
  return rooms.filter((room) => room.pricePerNight <= maxBudget);
}

export function preferenceMessage(
  rooms: AvailableRoom[],
  preference: RoomPreference,
  maxBudget: number | null,
  allRooms: AvailableRoom[],
  fallback: string,
) {
  if (maxBudget) {
    if (rooms.length === 0) {
      const cheapest = [...allRooms].sort((left, right) => left.pricePerNight - right.pricePerNight)[0];
      if (cheapest) {
        return `I couldn't find anything under ${formatInr(maxBudget)}/night for those dates. The lowest available option is the ${cheapest.name} at ${formatInr(cheapest.pricePerNight)}/night.`;
      }
      return `I couldn't find anything under ${formatInr(maxBudget)}/night for those dates.`;
    }
    return `Here ${rooms.length === 1 ? "is the room" : `are ${rooms.length} rooms`} under ${formatInr(maxBudget)}/night. ${fallback}`;
  }

  if (preference === "cheapest" && rooms[0]) {
    return `The cheapest available room is the ${rooms[0].name} at ${formatInr(rooms[0].pricePerNight)}/night. ${fallback}`;
  }
  if (preference && rooms[0] && rooms[0].id.includes(preference === "suite" ? "suite" : preference)) {
    return `I checked for the ${rooms[0].name}. ${fallback}`;
  }
  return fallback;
}
