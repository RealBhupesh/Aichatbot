import { breakfastAnswer, greetingAnswer, groundedMessage, unsupportedAnswer } from "@/lib/answers";
import { inferStayFromMessage } from "@/lib/dates";
import { findRoomByName } from "@/lib/hotel";
import type { AssistantUnderstanding, Intent } from "@/lib/schemas";

const UNSUPPORTED_TOPICS: Array<{ pattern: RegExp; topic: string }> = [
  { pattern: /helicopter|helipad|heli\b/i, topic: "helicopter transfers" },
  { pattern: /\bspa\b|massage|sauna|hammam/i, topic: "spa services" },
  { pattern: /casino|gambling/i, topic: "a casino" },
  { pattern: /kids club|childcare|babysit/i, topic: "a kids club or childcare" },
  { pattern: /yacht|private jet|limousine/i, topic: "that private transport request" },
];

function lastUserAndAssistant(history: Array<{ role: string; content: string }>) {
  const user = [...history].reverse().find((item) => item.role === "user")?.content ?? "";
  const assistant =
    [...history].reverse().find((item) => item.role === "assistant")?.content ?? "";
  return { user, assistant };
}

export function resolveRoomFromText(
  text: string,
  history: Array<{ role: string; content: string }> = [],
) {
  const direct = findRoomByName(text);
  if (direct) {
    return direct;
  }

  const combined = `${history.map((item) => item.content).join("\n")}\n${text}`;
  return findRoomByName(combined);
}

export function isGreeting(text: string) {
  return /^(hi+|hey+|hello+|howdy|yo|what'?s up|how'?s it going|hows it going|how are you|how are things|good (morning|afternoon|evening)|namaste)[\s!?.]*$/i.test(
    text.trim(),
  );
}

function looksLikeFollowUp(text: string) {
  return /^(what about|and that|that one|does it|is it|how much|the price|breakfast included|and the)\b/i.test(
    text.trim(),
  );
}

function detectUnsupported(text: string) {
  return UNSUPPORTED_TOPICS.find((entry) => entry.pattern.test(text));
}

export function detectIntent(
  message: string,
  history: Array<{ role: string; content: string }> = [],
): Intent {
  if (isGreeting(message)) {
    return "smalltalk";
  }

  if (detectUnsupported(message)) {
    return "unsupported";
  }

  if (
    /available|availability|any rooms|vacanc|book|reserve|cheapest|this weekend|next weekend|check-in date|wanna check in|want to check in|checking in|need a room|from \d|nights?|check.*rooms?|rooms? under|under\s+\d|below\s+\d|less than|budget|within.*budget/i.test(
      message,
    ) &&
    !/what time is check-?in|check-?in time/i.test(message)
  ) {
    return "availability";
  }

  if (/cancel|pet|smoking|child|kid policy|refund/i.test(message)) {
    return "policy";
  }

  if (
    /pool|wifi|wi-fi|parking|gym|fitness|breakfast|restaurant|airport|transfer|amenit/i.test(
      message,
    ) &&
    !/which room|deluxe|family room|suite|standard queen/i.test(message)
  ) {
    if (
      /does it include breakfast|is breakfast included/i.test(message) &&
      resolveRoomFromText(message, history)
    ) {
      return "room_info";
    }
    return "amenity";
  }

  if (
    /room|sleep|suitable|guests|deluxe|family room|suite|queen|king|how much is it/i.test(
      message,
    )
  ) {
    return "room_info";
  }

  if (looksLikeFollowUp(message) && history.length > 0) {
    return "follow_up";
  }

  if (/check-?in|check-?out|address|phone|contact|where is|front desk|what time/i.test(message)) {
    return "hotel_info";
  }

  if (looksLikeFollowUp(message)) {
    return "follow_up";
  }

  return "hotel_info";
}

export function resolveFollowUpIntent(
  message: string,
  history: Array<{ role: string; content: string }>,
  current: Intent,
): Intent {
  if (current !== "follow_up") {
    return current;
  }

  const { user, assistant } = lastUserAndAssistant(history);
  const prior = `${user} ${assistant}`;

  if (/available|availability|date|weekend|night/i.test(message) || /available/i.test(prior)) {
    return "availability";
  }

  if (/cancel|pet|smok|child/i.test(message) || /cancel|pet|smok/i.test(prior)) {
    return "policy";
  }

  if (/pool|wifi|parking|gym|breakfast|restaurant|airport/i.test(message)) {
    if (resolveRoomFromText(message, history) && /breakfast|price|how much/i.test(message)) {
      return "room_info";
    }
    return "amenity";
  }

  if (resolveRoomFromText(message, history) || /room|price|breakfast|sleep/i.test(prior)) {
    return "room_info";
  }

  return "hotel_info";
}

export function ruleBasedInterpret(input: {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  now?: Date;
}): AssistantUnderstanding {
  const { message, history, now = new Date() } = input;
  const unsupported = detectUnsupported(message);
  const rawIntent = detectIntent(message, history);
  const intent = resolveFollowUpIntent(message, history, rawIntent);
  const room = resolveRoomFromText(message, history);
  const inferred = inferStayFromMessage(message, now);

  const availability = {
    checkIn: inferred.checkIn,
    checkOut: inferred.checkOut,
    guests: inferred.guests,
  };

  if (unsupported) {
    return {
      intent: "unsupported",
      reply: unsupportedAnswer(unsupported.topic),
      referencedRoomId: asRoomId(room?.id),
      availability,
      unsupportedTopic: unsupported.topic,
    };
  }

  if (intent === "smalltalk") {
    return {
      intent,
      reply: greetingAnswer(),
      referencedRoomId: asRoomId(room?.id),
      availability,
      unsupportedTopic: null,
    };
  }

  if (intent === "room_info" && /breakfast/i.test(message) && room) {
    return {
      intent,
      reply: breakfastAnswer(room.id),
      referencedRoomId: asRoomId(room.id),
      availability,
      unsupportedTopic: null,
    };
  }

  const referencedRoomId = asRoomId(room?.id);

  return {
    intent,
    reply: groundedMessage(intent, message, referencedRoomId, inferred.guests),
    referencedRoomId,
    availability,
    unsupportedTopic: null,
  };
}

function asRoomId(id: string | undefined): AssistantUnderstanding["referencedRoomId"] {
  if (
    id === "standard-queen" ||
    id === "deluxe-king" ||
    id === "family-room" ||
    id === "executive-suite"
  ) {
    return id;
  }

  return null;
}
