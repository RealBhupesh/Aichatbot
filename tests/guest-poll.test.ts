import { describe, expect, it } from "vitest";
import { hydrateGuestMessages, mergePolledGuestMessages, pollMessageId } from "@/lib/guest-poll";

const liveAssistant = {
  id: "live-1",
  role: "assistant" as const,
  content: "Sure! Could you let me know the check-in and check-out dates?",
};

describe("mergePolledGuestMessages", () => {
  it("does not append a persisted Leela reply that the live send already showed", () => {
    const incoming = [
      {
        role: "assistant" as const,
        content: liveAssistant.content,
        at: "2026-09-16T10:40:00.000Z",
      },
    ];

    const merged = mergePolledGuestMessages([liveAssistant], incoming);

    expect(merged).toEqual([liveAssistant]);
  });

  it("still appends a new staff takeover message", () => {
    const staff = {
      role: "staff" as const,
      content: "Hi, this is the front desk.",
      at: "2026-09-16T10:41:00.000Z",
      authorName: "Amara",
    };

    const merged = mergePolledGuestMessages([liveAssistant], [staff]);

    expect(merged).toEqual([
      liveAssistant,
      {
        id: pollMessageId(staff),
        role: "staff",
        content: staff.content,
        authorName: "Amara",
        type: "answer",
      },
    ]);
  });

  it("still appends a new Leela handback that is not already on screen", () => {
    const handback = {
      role: "assistant" as const,
      content: "You're back with Leela at the Asteria desk. How else can I help?",
      at: "2026-09-16T10:42:00.000Z",
    };

    const merged = mergePolledGuestMessages([liveAssistant], [handback]);

    expect(merged).toHaveLength(2);
    expect(merged[1]?.content).toBe(handback.content);
  });

  it("skips a poll copy of the in-flight streamed reply", () => {
    const incoming = [
      {
        role: "assistant" as const,
        content: liveAssistant.content,
        at: "2026-09-16T10:40:00.000Z",
      },
    ];

    const merged = mergePolledGuestMessages([], incoming, [liveAssistant.content]);

    expect(merged).toEqual([]);
  });

  it("hydrates both guest and Leela messages on reload", () => {
    const incoming = [
      {
        role: "user" as const,
        content: "Check room availability",
        at: "2026-09-16T10:39:00.000Z",
      },
      {
        role: "assistant" as const,
        content: liveAssistant.content,
        at: "2026-09-16T10:40:00.000Z",
      },
    ];

    const hydrated = hydrateGuestMessages(incoming);

    expect(hydrated.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(hydrated[0]?.content).toBe("Check room availability");
  });
});
