import {
  addDays,
  extractGuestCount,
  extractIsoDates,
  extractMaxBudget,
  extractNightCount,
  parseIsoDate,
  toIsoDate,
} from "@/lib/dates";
import { findRoomByName, getRoomById } from "@/lib/hotel";
import { resolveRoomFromText } from "@/lib/interpreter";
import { llmSessionHistory, readSession, updateSession, type GuestSession } from "@/lib/sessions";

function looksLikeRoomFollowUp(message: string) {
  return /^(that one|this one|book it|hold it|the cheaper|the other|does it|is it|what about that)\b/i.test(
    message.trim(),
  ) || /\b(family room|deluxe|suite|standard queen|executive suite)\b/i.test(message);
}

const NON_NAME_WORDS = new Set([
  "tomorrow",
  "today",
  "tonight",
  "next",
  "the",
  "a",
  "an",
  "this",
  "that",
  "my",
  "our",
  "your",
]);

function normalizeGuestName(value: string) {
  return value
    .replace(/\s+(and|with|at|on|for)\b.*$/i, "")
    .trim();
}

function extractGuestName(message: string) {
  const directPatterns = [
    /(?:my name is|i am|i'm|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i,
    /(?:guest name|name is)\s*[:\-]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i,
  ];

  for (const pattern of directPatterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return normalizeGuestName(match[1]);
    }
  }

  const bookingMatch = message.match(
    /(?:book(?:ing)?|reserve|hold).{0,40}?\bfor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})(?:\s+for|\s+on|\.|,|$)/i,
  );
  const candidate = bookingMatch?.[1]?.trim();
  if (candidate && !NON_NAME_WORDS.has(candidate.toLowerCase())) {
    return normalizeGuestName(candidate);
  }

  return null;
}

function extractExplicitStayFromMessage(message: string, now = new Date()) {
  const dates = extractIsoDates(message, now);
  const nights = extractNightCount(message) ?? 1;
  const checkIn = dates[0] ?? null;
  let checkOut = dates[1] ?? null;

  if (checkIn && !checkOut) {
    const start = parseIsoDate(checkIn);
    if (start) {
      checkOut = toIsoDate(addDays(start, nights));
    }
  }

  return {
    checkIn,
    checkOut,
    guests: extractGuestCount(message),
    maxBudget: extractMaxBudget(message),
  };
}

function extractEmail(message: string) {
  return message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
}

function extractPhone(message: string) {
  const match = message.match(/(?:\+?\d[\d\s-]{8,}\d)/);
  return match?.[0]?.trim() ?? null;
}

export function syncConversationContextFromMessage(
  sessionId: string,
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  now = new Date(),
) {
  const session = readSession(sessionId);
  if (!session) {
    return null;
  }

  const inferred = extractExplicitStayFromMessage(message, now);
  const room =
    findRoomByName(message) ??
    (looksLikeRoomFollowUp(message) ? resolveRoomFromText(message, history) : undefined);

  return updateSession(sessionId, {
    stay: {
      checkIn: inferred.checkIn ?? session.stay.checkIn,
      checkOut: inferred.checkOut ?? session.stay.checkOut,
      guests: typeof inferred.guests === "number" ? inferred.guests : session.stay.guests,
      maxBudget: inferred.maxBudget ?? session.stay.maxBudget,
      selectedRoomId: room?.id ?? session.stay.selectedRoomId,
    },
    guest: {
      name: extractGuestName(message) ?? session.guest.name,
      email: extractEmail(message) ?? session.guest.email,
      phone: extractPhone(message) ?? session.guest.phone,
    },
  });
}

export function buildSessionContextBlock(session: GuestSession) {
  const lines: string[] = [];

  if (session.stay.checkIn) {
    lines.push(`Known check-in: ${session.stay.checkIn}`);
  }
  if (session.stay.checkOut) {
    lines.push(`Known check-out: ${session.stay.checkOut}`);
  }
  if (typeof session.stay.guests === "number") {
    lines.push(`Known guest count: ${session.stay.guests}`);
  }
  if (session.stay.maxBudget) {
    lines.push(`Known nightly budget: ₹${session.stay.maxBudget.toLocaleString("en-IN")}`);
  }
  if (session.stay.selectedRoomId) {
    const room = getRoomById(session.stay.selectedRoomId);
    lines.push(`Room in focus: ${room?.name ?? session.stay.selectedRoomId}`);
  }
  if (session.guest.name) {
    lines.push(`Guest name: ${session.guest.name}`);
  }
  if (session.guest.email) {
    lines.push(`Guest email: ${session.guest.email}`);
  }
  if (session.guest.phone) {
    lines.push(`Guest phone: ${session.guest.phone}`);
  }
  if (session.pendingHold) {
    lines.push(
      `Pending hold: ${session.pendingHold.roomName}, ${session.pendingHold.checkIn} to ${session.pendingHold.checkOut}, awaiting guest confirmation`,
    );
  }
  if (session.lastConfirmationCode) {
    lines.push(`Confirmed hold code: ${session.lastConfirmationCode}`);
  }
  if (session.pendingChange) {
    lines.push(
      `Pending reservation change: ${session.pendingChange.confirmationCode} to ${session.pendingChange.roomName}, ${session.pendingChange.checkIn} to ${session.pendingChange.checkOut}, awaiting guest confirmation`,
    );
  }

  const recent = session.messages
    .slice(-6)
    .map((message) => {
      const speaker =
        message.role === "user"
          ? "Guest"
          : message.role === "staff"
            ? message.authorName || "Front desk"
            : "Leela";
      return `${speaker}: ${message.content}`;
    })
    .join("\n");

  if (lines.length === 0 && !recent) {
    return "No prior stay details captured yet in this conversation.";
  }

  return [
    lines.length > 0 ? `Captured stay details:\n${lines.map((line) => `- ${line}`).join("\n")}` : null,
    recent ? `Recent conversation:\n${recent}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function hydrateSessionHistory(session: GuestSession) {
  return llmSessionHistory(session);
}
