import { parseStreamChunk } from "@/lib/stream-events";
import type { ChatResponse } from "@/lib/schemas";

export type StreamHandlers = {
  onStatus?: (label: string) => void;
  onTextDelta?: (text: string) => void;
  onToolStart?: (toolName: string, label: string) => void;
  onToolEnd?: (toolName: string, label: string) => void;
};

export async function readChatStream(
  response: Response,
  handlers: StreamHandlers = {},
): Promise<ChatResponse> {
  if (!response.body) {
    throw new Error("Missing response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let complete: ChatResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const event = parseStreamChunk(block);
      if (!event) {
        continue;
      }

      if (event.type === "status") {
        handlers.onStatus?.(event.label);
      }

      if (event.type === "tool-start") {
        handlers.onToolStart?.(event.toolName, event.label);
      }

      if (event.type === "tool-end") {
        handlers.onToolEnd?.(event.toolName, event.label);
      }

      if (event.type === "text-delta") {
        text += event.delta;
        handlers.onTextDelta?.(text);
      }

      if (event.type === "complete") {
        complete = event.payload;
      }

      if (event.type === "error") {
        throw new Error(event.message);
      }
    }
  }

  if (!complete) {
    throw new Error("The assistant stream ended before a final response arrived.");
  }

  return {
    ...complete,
    message: text.trim() || complete.message,
  };
}
