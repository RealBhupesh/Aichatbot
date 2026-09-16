import { describe, expect, it } from "vitest";
import {
  buildGuestContactChatMessage,
  buildGuestHoldMessage,
  formatGuestNamesForHold,
  guestContactIntro,
} from "@/lib/guest-contact";

describe("guest contact helpers", () => {
  it("formats one or two guest names naturally", () => {
    expect(formatGuestNamesForHold(["Priya Sharma"])).toBe("Priya Sharma");
    expect(formatGuestNamesForHold(["Priya Sharma", "Rahul Mehta"])).toBe(
      "Priya Sharma and Rahul Mehta",
    );
  });

  it("builds hold and chat messages with all guest names", () => {
    const values = {
      guestNames: ["Priya Sharma", "Rahul Mehta"],
      guestEmail: "priya@example.com",
      guestPhone: "",
    };

    expect(buildGuestHoldMessage(values, "standard-queen")).toBe(
      "Please book the standard-queen for Priya Sharma and Rahul Mehta. Email: priya@example.com. Phone: n/a.",
    );
    expect(buildGuestContactChatMessage(values)).toBe(
      "Guest names: Priya Sharma and Rahul Mehta. Email: priya@example.com. Phone: not provided.",
    );
  });

  it("uses plural intro copy for multi-guest holds", () => {
    expect(guestContactIntro(2)).toContain("all 2 guests");
    expect(guestContactIntro(1)).toContain("guest name");
  });
});
