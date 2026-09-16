import { describe, expect, it } from "vitest";
import {
  buildCatalogRooms,
  looksLikeRoomCatalogRequest,
  stripMarkdownTables,
} from "@/lib/room-catalog";

describe("room catalog", () => {
  it("detects room catalog requests", () => {
    expect(looksLikeRoomCatalogRequest("show me rooms and their pics")).toBe(true);
    expect(looksLikeRoomCatalogRequest("what time is check-in")).toBe(false);
  });

  it("builds all room types for a catalog request", () => {
    const rooms = buildCatalogRooms({ query: "show me all room types" });
    expect(rooms.length).toBe(4);
    expect(rooms[0]?.image).toBeTruthy();
  });

  it("strips markdown tables from assistant text", () => {
    const cleaned = stripMarkdownTables(
      "Here are the rooms\n| Room | Price |\n| --- | --- |\n| Deluxe | 8200 |\nTap one for details.",
    );
    expect(cleaned).not.toContain("| Room |");
    expect(cleaned).toContain("Tap one for details.");
  });
});
