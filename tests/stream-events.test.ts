import { describe, expect, it } from "vitest";
import { encodeStreamEvent, parseStreamChunk } from "@/lib/stream-events";

describe("stream events", () => {
  it("round-trips an SSE payload", () => {
    const encoded = encodeStreamEvent({
      type: "status",
      label: "Checking room availability",
      toolName: "checkAvailability",
    });

    const parsed = parseStreamChunk(encoded.trim());
    expect(parsed).toEqual({
      type: "status",
      label: "Checking room availability",
      toolName: "checkAvailability",
    });
  });
});
