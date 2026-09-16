import { describe, expect, it } from "vitest";
import { processChatRequest } from "@/lib/chat";
import { createEscalation, resetEscalationsCache } from "@/lib/escalations";
import { ruleBasedInterpret } from "@/lib/interpreter";
import {
  appendSessionMessages,
  appendStaffMessage,
  createSession,
  listSessions,
  readSession,
  resetSessionsCache,
  setSessionMode,
  updateSession,
} from "@/lib/sessions";
import { handbackConversation, sendStaffReply } from "@/lib/staff-console";

const NOW = new Date("2026-09-16T09:00:00.000Z");

function seedConversation(label: string) {
  const session = createSession();
  appendSessionMessages(session.id, [
    { role: "user", content: `Hello from ${label}` },
    { role: "assistant", content: `Leela reply for ${label}` },
  ]);
  updateSession(session.id, {
    guest: { name: label, email: `${label.replace(/\s+/g, "").toLowerCase()}@example.com`, phone: null },
  });
  return session.id;
}

describe("staff console session store", () => {
  it("lists conversations with search, takeover, and escalation filters", () => {
    resetSessionsCache();
    resetEscalationsCache();
    const unique = `Priya-${Date.now()}`;
    const sessionId = seedConversation(unique);
    setSessionMode(sessionId, "staff", "Asha");
    createEscalation({
      sessionId,
      reason: "Guest asked for a human",
      summary: "Needs a callback",
      guestName: unique,
    });

    const searched = listSessions({ query: unique });
    expect(searched).toHaveLength(1);
    expect(searched[0]?.mode).toBe("staff");
    expect(searched[0]?.hasOpenEscalation).toBe(true);
    expect(searched[0]?.assignedTo).toBe("Asha");

    const takeovers = listSessions({ filter: "takeover", query: unique });
    expect(takeovers.map((item) => item.id)).toEqual([sessionId]);

    const escalated = listSessions({ filter: "escalated", query: unique });
    expect(escalated.map((item) => item.id)).toEqual([sessionId]);
  });

  it("sets takeover mode and records staff replies", () => {
    resetSessionsCache();
    const sessionId = seedConversation(`Rahul-${Date.now()}`);
    const taken = setSessionMode(sessionId, "staff", "Meera");
    expect(taken?.mode).toBe("staff");
    expect(taken?.assignedTo).toBe("Meera");
    expect(taken?.takenOverAt).toBeTruthy();

    const withReply = appendStaffMessage(sessionId, "We can hold that room.", "Meera");
    expect(withReply?.messages.at(-1)?.role).toBe("staff");
    expect(withReply?.messages.at(-1)?.content).toBe("We can hold that room.");
    expect(withReply?.messages.at(-1)?.authorName).toBe("Meera");
  });
});

describe("staff takeover chat loop", () => {
  it("skips Leela and persists the guest message while the desk is live", async () => {
    resetSessionsCache();
    const sessionId = seedConversation(`DeskLive-${Date.now()}`);
    setSessionMode(sessionId, "staff", "Front desk");

    const result = await processChatRequest(
      { message: "Can someone confirm the late checkout?" },
      {
        now: NOW,
        sessionId,
        persistSession: true,
        interpretGuestMessage: async (input) => ruleBasedInterpret(input),
      },
    );

    expect(result.status).toBe(200);
    expect(result.payload.mode).toBe("staff");
    expect(result.payload.message).toBe("");
    const saved = readSession(sessionId);
    expect(saved?.messages.at(-1)?.role).toBe("user");
    expect(saved?.messages.at(-1)?.content).toContain("late checkout");
    expect(saved?.messages.some((message) => message.content === "")).toBe(false);
  });

  it("hands the conversation back to Leela with a desk notice", async () => {
    resetSessionsCache();
    const sessionId = seedConversation(`Handback-${Date.now()}`);
    await sendStaffReply(sessionId, "I can look that up for you.", "Neha");
    const handed = await handbackConversation(sessionId, "Neha");
    expect(handed?.mode).toBe("ai");
    expect(handed?.messages.at(-1)?.role).toBe("assistant");
    expect(handed?.messages.at(-1)?.content).toMatch(/back with Leela/i);
  });
});
