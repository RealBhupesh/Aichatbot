export type PollSessionMessage = {
  role: "user" | "assistant" | "staff";
  content: string;
  at: string;
  authorName?: string;
};

export type PolledGuestMessage = {
  id: string;
  role: "user" | "assistant" | "staff";
  content: string;
  authorName?: string;
  type: "answer";
};

function normalizeContent(content: string) {
  return content.replace(/\s+/g, " ").trim();
}

export function pollMessageId(message: {
  role: string;
  content: string;
  at: string;
}) {
  return `${message.role}-${message.at}-${message.content.slice(0, 32)}`;
}

function toPolledMessage(message: PollSessionMessage): PolledGuestMessage {
  return {
    id: pollMessageId(message),
    role: message.role,
    content: message.content,
    authorName: message.authorName,
    type: "answer",
  };
}

export function hydrateGuestMessages(incoming: PollSessionMessage[]): PolledGuestMessage[] {
  return incoming.map(toPolledMessage);
}

export function mergePolledGuestMessages<T extends { id: string; role: string; content: string }>(
  current: T[],
  incoming: PollSessionMessage[],
  extraAssistantContent: string[] = [],
): T[] {
  const keys = new Set(current.map((message) => message.id));
  const seenAssistant = new Set(
    [
      ...current.filter((message) => message.role === "assistant").map((message) => message.content),
      ...extraAssistantContent,
    ].map(normalizeContent),
  );

  const next = incoming
    .filter((message) => message.role !== "user")
    .map(toPolledMessage)
    .filter((message) => {
      if (keys.has(message.id)) {
        return false;
      }
      if (message.role === "assistant") {
        const key = normalizeContent(message.content);
        if (seenAssistant.has(key)) {
          return false;
        }
        seenAssistant.add(key);
      }
      return true;
    });

  return next.length > 0 ? [...current, ...(next as unknown as T[])] : current;
}
