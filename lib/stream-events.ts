import type { ChatResponse } from "@/lib/schemas";

export type StreamEvent =
  | { type: "status"; label: string; toolName?: string }
  | { type: "tool-start"; toolName: string; label: string }
  | { type: "tool-end"; toolName: string; label: string }
  | { type: "text-delta"; delta: string }
  | { type: "complete"; payload: ChatResponse }
  | { type: "error"; message: string };

export function encodeStreamEvent(event: StreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function parseStreamChunk(block: string): StreamEvent | null {
  const line = block
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("data: "));

  if (!line) {
    return null;
  }

  try {
    return JSON.parse(line.slice(6)) as StreamEvent;
  } catch {
    return null;
  }
}

export function createEventStream(
  handler: (emit: (event: StreamEvent) => void) => Promise<void>,
) {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(encodeStreamEvent(event)));
      };

      try {
        await handler(emit);
      } catch {
        emit({
          type: "error",
          message: "I'm having trouble generating a response right now. Please try again.",
        });
      } finally {
        controller.close();
      }
    },
  });
}
