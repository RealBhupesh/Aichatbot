import { existsSync } from "node:fs";
import { readJsonFile, resolveDataFile, writeJsonFile } from "@/lib/data-files";
import { getRooms, type HotelRoom } from "@/lib/hotel";

export type RoomOperations = {
  inventory: number;
  pricePerNight: number;
  closed: boolean;
  blackouts: string[];
};

export type HotelOperations = {
  hotelClosedDates: string[];
  rooms: Record<string, RoomOperations>;
};

const FILE = resolveDataFile("operations.json");

let cache: HotelOperations | null = null;

export function seedOperationsFromHotel(): HotelOperations {
  const rooms: Record<string, RoomOperations> = {};
  for (const room of getRooms()) {
    rooms[room.id] = {
      inventory: room.inventory,
      pricePerNight: room.pricePerNight,
      closed: false,
      blackouts: [],
    };
  }
  return { hotelClosedDates: [], rooms };
}

function seedFromHotel() {
  return seedOperationsFromHotel();
}

export function resetOperationsForTests() {
  const seeded = seedOperationsFromHotel();
  replaceOperations(seeded);
  return seeded;
}

export function resetOperationsCache() {
  cache = null;
}

export function replaceOperations(next: HotelOperations) {
  cache = next;
}

export function readOperations(): HotelOperations {
  if (cache) {
    return cache;
  }

  if (!existsSync(FILE)) {
    cache = seedFromHotel();
    return cache;
  }

  const parsed = readJsonFile(FILE, seedFromHotel());
  cache = {
    hotelClosedDates: parsed.hotelClosedDates ?? [],
    rooms: parsed.rooms ?? {},
  };
  return cache;
}

export function writeOperations(next: HotelOperations) {
  cache = next;
  writeJsonFile(FILE, next);
}

export function getRoomOperations(roomId: string): RoomOperations {
  const ops = readOperations().rooms[roomId];
  const room = getRooms().find((item) => item.id === roomId);
  return {
    inventory: ops?.inventory ?? room?.inventory ?? 0,
    pricePerNight: ops?.pricePerNight ?? room?.pricePerNight ?? 0,
    closed: ops?.closed ?? false,
    blackouts: ops?.blackouts ?? [],
  };
}

export function getHotelClosedDates() {
  return readOperations().hotelClosedDates;
}

export type OperationalRoom = HotelRoom & {
  closed: boolean;
  blackouts: string[];
};

export function getOperationalRooms(): OperationalRoom[] {
  return getRooms().map((room) => {
    const ops = getRoomOperations(room.id);
    return {
      ...room,
      inventory: ops.inventory,
      pricePerNight: ops.pricePerNight,
      closed: ops.closed,
      blackouts: ops.blackouts,
    };
  });
}
