import { describe, expect, it } from "vitest";
import { processChatRequest } from "@/lib/chat";
import { ruleBasedInterpret } from "@/lib/interpreter";
import {
  appendSessionMessages,
  createSession,
  readSession,
  resetSessionsCache,
  updateSession,
} from "@/lib/sessions";

const NOW = new Date("2026-09-16T09:00:00.000Z");

describe("guest sessions", () => {
  it("persists conversation history on the server", async () => {
    resetSessionsCache();
    const session = createSession();

    await processChatRequest(
      { message: "What time is check-in?" },
      {
        now: NOW,
        sessionId: session.id,
        persistSession: true,
        interpretGuestMessage: async (input) => ruleBasedInterpret(input),
      },
    );

    const saved = readSession(session.id);
    expect(saved?.messages.length).toBeGreaterThanOrEqual(2);
    expect(saved?.messages.at(-1)?.content).toContain("3:00 PM");
  });

  it("reuses stay context from the session on follow-up turns", async () => {
    resetSessionsCache();
    const session = createSession();
    appendSessionMessages(session.id, [
      { role: "user", content: "Check room availability for 2026-09-20 to 2026-09-22 for 2 guests" },
      { role: "assistant", content: "Here are the available rooms." },
    ]);
    updateSession(session.id, {
      stay: {
        checkIn: "2026-09-20",
        checkOut: "2026-09-22",
        guests: 2,
        maxBudget: null,
        selectedRoomId: null,
      },
    });

    const result = await processChatRequest(
      { message: "show me rooms under 7k" },
      {
        now: NOW,
        sessionId: session.id,
        persistSession: true,
        interpretGuestMessage: async (input) => ruleBasedInterpret(input),
      },
    );

    expect(result.payload.type).toBe("availability_results");
    expect(result.payload.data?.checkIn).toBe("2026-09-20");
    expect(result.payload.data?.checkOut).toBe("2026-09-22");
  });
});
