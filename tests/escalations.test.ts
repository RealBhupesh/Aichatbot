import { describe, expect, it } from "vitest";
import {
  createEscalation,
  listEscalations,
  resetEscalationsCache,
  resolveEscalation,
} from "@/lib/escalations";

describe("escalations", () => {
  it("creates and resolves a staff ticket", () => {
    resetEscalationsCache();
    const ticket = createEscalation({
      sessionId: "session-1",
      reason: "Guest wants a callback",
      summary: "Guest asked to speak with the manager about a late checkout.",
      guestName: "Asha Patel",
      guestEmail: "asha@example.com",
    });

    expect(listEscalations("open").some((entry) => entry.id === ticket.id)).toBe(true);

    const resolved = resolveEscalation(ticket.id);
    expect(resolved?.status).toBe("resolved");
    expect(listEscalations("open").some((entry) => entry.id === ticket.id)).toBe(false);
  });
});
