import { toIsoDate, utcToday } from "@/lib/dates";
import { llmRuntime } from "@/lib/ai";
import { buildSessionContextBlock } from "@/lib/conversation-context";
import { AGENT_SYSTEM_PROMPT } from "@/lib/prompts";
import type { ChatRequest } from "@/lib/schemas";
import type { GuestSession } from "@/lib/sessions";
import { createHotelTools, type ToolTrace } from "@/lib/tools";

export function buildAgentMessages(request: ChatRequest) {
  const history = request.history
    .slice(-12)
    .map((item) => ({
      role: item.role,
      content: item.content,
    }));

  const trimmedMessage = request.message.trim();
  const lastHistory = history.at(-1);
  const alreadyIncludesCurrentMessage =
    lastHistory?.role === "user" && lastHistory.content.trim() === trimmedMessage;

  if (alreadyIncludesCurrentMessage) {
    return history;
  }

  return [
    ...history,
    {
      role: "user" as const,
      content: trimmedMessage,
    },
  ];
}

export function createAgentRun(input: {
  request: ChatRequest;
  session: GuestSession;
  now: Date;
  sessionId?: string | null;
}) {
  const trace: ToolTrace[] = [];
  const runtime = llmRuntime();
  const sessionContext = buildSessionContextBlock(input.session);

  return {
    trace,
    runtime,
    tools: createHotelTools({
      now: input.now,
      trace,
      sessionId: input.sessionId ?? input.session.id,
    }),
    system: [
      AGENT_SYSTEM_PROMPT,
      `Current date: ${toIsoDate(utcToday(input.now))}. Resolve today, tomorrow, and other relative dates against this date.`,
      `Active guest conversation context:\n${sessionContext}`,
    ].join("\n\n"),
    messages: buildAgentMessages(input.request),
    providerOptions:
      runtime.provider === "groq"
        ? {
            groq: {
              reasoningEffort: "low",
            },
          }
        : undefined,
  };
}
