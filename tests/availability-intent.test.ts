import { describe, expect, it } from "vitest";
import {
  isDirectAvailabilityRequest,
  looksLikeAvailabilityDatePrompt,
  looksLikeAvailabilityIntent,
} from "@/lib/availability-intent";

describe("availability intent helpers", () => {
  it("detects direct availability menu requests", () => {
    expect(isDirectAvailabilityRequest("Check room availability")).toBe(true);
    expect(isDirectAvailabilityRequest("check availability")).toBe(true);
    expect(isDirectAvailabilityRequest("What time is check-in?")).toBe(false);
  });

  it("detects availability date prompts from the assistant", () => {
    expect(
      looksLikeAvailabilityDatePrompt(
        "Could you let me know the check-in and check-out dates you have in mind?",
      ),
    ).toBe(true);
    expect(looksLikeAvailabilityDatePrompt("Check-in is at 3:00 PM.")).toBe(true);
  });

  it("detects general availability intent without check-in time questions", () => {
    expect(looksLikeAvailabilityIntent("Do you have rooms available?")).toBe(true);
    expect(looksLikeAvailabilityIntent("What time is check-in?")).toBe(false);
  });
});
