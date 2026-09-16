import { describe, expect, it } from "vitest";
import { getAmenity, getHotel, getRoomById, roomsForGuests } from "@/lib/hotel";
import hotelJson from "@/data/hotel.json";

describe("hotel knowledge base", () => {
  it("exposes the published check-in time", () => {
    expect(getHotel().checkIn).toBe("3:00 PM");
    expect(getHotel().checkOut).toBe("11:00 AM");
  });

  it("confirms the swimming pool amenity", () => {
    const pool = getAmenity("pool");
    expect(pool?.available).toBe(true);
    expect(pool?.details.toLowerCase()).toContain("pool");
  });

  it("only suggests rooms that sleep three guests", () => {
    const matches = roomsForGuests(3);
    expect(matches.every((room) => room.maxGuests >= 3)).toBe(true);
    expect(matches.map((room) => room.id)).toEqual([
      "family-room",
      "executive-suite",
    ]);
    expect(matches.find((room) => room.id === "deluxe-king")).toBeUndefined();
  });

  it("keeps cancellation policy in the dataset", () => {
    expect(hotelJson.policies.cancellation).toMatch(/24 hours/i);
  });

  it("does not list helicopter transfers", () => {
    const names = hotelJson.amenities.map((amenity) => amenity.name.toLowerCase()).join(" ");
    expect(names).not.toContain("helicopter");
  });

  it("marks breakfast included only on selected rooms", () => {
    expect(getRoomById("deluxe-king")?.breakfastIncluded).toBe(true);
    expect(getRoomById("standard-queen")?.breakfastIncluded).toBe(false);
  });
});
