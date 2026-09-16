import { describe, expect, it } from "vitest";
import { toolStatusLabel } from "@/lib/tool-labels";

describe("tool labels", () => {
  it("returns a friendly label for known tools", () => {
    expect(toolStatusLabel("checkAvailability")).toBe("Checking room availability");
    expect(toolStatusLabel("escalateToStaff")).toBe("Connecting you with the team");
  });
});
