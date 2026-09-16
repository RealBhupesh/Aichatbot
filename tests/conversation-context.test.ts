import { beforeEach, describe, expect, it } from "vitest";
import { resetOperationsForTests } from "@/lib/operations";
import {
  buildSessionContextBlock,
  hydrateSessionHistory,
  syncConversationContextFromMessage,
} from "@/lib/conversation-context";
import {
  appendSessionMessages,
  createSession,
  readSession,
  resetSessionsCache,
  updateSession,
} from "@/lib/sessions";

const NOW = new Date("2026-09-16T09:00:00.000Z");

describe("conversation context", () => {
  beforeEach(() => {
    resetOperationsForTests();
    resetSessionsCache();
  });

  it("captures stay details and guest contact from the latest message", () => {
    resetSessionsCache();
    const session = createSession();

    syncConversationContextFromMessage(
      session.id,
      "Book the Family Room for tomorrow for 3 guests. My name is Priya Sharma and email priya@example.com",
      [],
      NOW,
    );

    const saved = readSession(session.id);
    expect(saved?.stay.checkIn).toBe("2026-09-17");
    expect(saved?.stay.checkOut).toBe("2026-09-18");
    expect(saved?.stay.guests).toBe(3);
    expect(saved?.stay.selectedRoomId).toBe("family-room");
    expect(saved?.guest.name).toBe("Priya Sharma");
    expect(saved?.guest.email).toBe("priya@example.com");
  });

  it("keeps prior stay details when a follow-up only adds budget", () => {
    resetSessionsCache();
    const session = createSession();
    updateSession(session.id, {
      stay: {
        checkIn: "2026-09-20",
        checkOut: "2026-09-22",
        guests: 2,
        maxBudget: null,
        selectedRoomId: "deluxe-king",
      },
    });

    syncConversationContextFromMessage(session.id, "anything under 5k?", [], NOW);

    const saved = readSession(session.id);
    expect(saved?.stay.checkIn).toBe("2026-09-20");
    expect(saved?.stay.checkOut).toBe("2026-09-22");
    expect(saved?.stay.guests).toBe(2);
    expect(saved?.stay.maxBudget).toBe(5000);
    expect(saved?.stay.selectedRoomId).toBe("deluxe-king");
  });

  it("builds a session context block for the agent prompt", () => {
    resetSessionsCache();
    const session = createSession();
    updateSession(session.id, {
      stay: {
        checkIn: "2026-09-20",
        checkOut: "2026-09-22",
        guests: 2,
        maxBudget: 7000,
        selectedRoomId: "family-room",
      },
      guest: {
        name: "Rahul Mehta",
        email: "rahul@example.com",
        phone: null,
      },
    });
    appendSessionMessages(session.id, [
      { role: "user", content: "Do you have a family room?" },
      { role: "assistant", content: "Yes, we have the Family Room available." },
    ]);

    const block = buildSessionContextBlock(readSession(session.id)!);
    expect(block).toContain("Known check-in: 2026-09-20");
    expect(block).toContain("Room in focus: Family Room");
    expect(block).toContain("Guest name: Rahul Mehta");
    expect(block).toContain("Guest: Do you have a family room?");
  });

  it("hydrates recent session history for follow-up turns", () => {
    resetSessionsCache();
    const session = createSession();
    appendSessionMessages(session.id, [
      { role: "user", content: "Tell me about the Deluxe King" },
      { role: "assistant", content: "The Deluxe King has a sea view." },
      { role: "user", content: "Does it include breakfast?" },
      { role: "assistant", content: "Breakfast is included." },
    ]);

    const history = hydrateSessionHistory(readSession(session.id)!);
    expect(history.some((item) => /breakfast/i.test(item.content))).toBe(true);
    expect(history.length).toBeLessThanOrEqual(12);
  });
});
