import { isStepCount, streamText } from "ai";
import { AssistantModelError, createChatModel } from "@/lib/ai";
import { buildAgentChatResponse } from "@/lib/agent-response";
import { createAgentRun } from "@/lib/agent-run";
import { logger } from "@/lib/logger";
import type { StreamEvent } from "@/lib/stream-events";
import { toolStatusLabel } from "@/lib/tool-labels";
import type { ChatRequest, ChatResponse } from "@/lib/schemas";
import type { GuestSession } from "@/lib/sessions";

export type AgentStreamInput = {
  request: ChatRequest;
  session: GuestSession;
  now?: Date;
  sessionId?: string | null;
  onEvent: (event: StreamEvent) => void;
};

export async function runAgentStream(input: AgentStreamInput): Promise<ChatResponse> {
  const now = input.now ?? new Date();
  const run = createAgentRun({
    request: input.request,
    session: input.session,
    now,
    sessionId: input.sessionId ?? input.session.id,
  });

  logger.info("agent.stream_start", {
    provider: run.runtime.provider,
    model: run.runtime.model,
    messageLength: input.request.message.length,
  });

  try {
    const result = streamText({
      model: createChatModel(),
      system: run.system,
      messages: run.messages,
      tools: run.tools,
      stopWhen: isStepCount(5),
      maxOutputTokens: 1200,
      ...(run.providerOptions ? { providerOptions: run.providerOptions } : {}),
      onToolExecutionStart({ toolCall }) {
        const label = toolStatusLabel(toolCall.toolName);
        input.onEvent({
          type: "status",
          label,
          toolName: toolCall.toolName,
        });
        input.onEvent({
          type: "tool-start",
          toolName: toolCall.toolName,
          label,
        });
      },
      onToolExecutionEnd({ toolCall }) {
        input.onEvent({
          type: "tool-end",
          toolName: toolCall.toolName,
          label: toolStatusLabel(toolCall.toolName),
        });
      },
      onStepEnd({ stepNumber, finishReason, toolCalls }) {
        logger.info("agent.stream_step_end", {
          stepNumber,
          finishReason,
          tools: toolCalls.map((call) => call.toolName),
        });
      },
    });

    let text = "";
    for await (const delta of result.textStream) {
      text += delta;
      input.onEvent({ type: "text-delta", delta });
    }

    const payload = buildAgentChatResponse({
      text,
      trace: run.trace,
      message: input.request.message,
      provider: run.runtime.provider,
      model: run.runtime.model,
      sessionId: input.sessionId,
    });

    logger.info("agent.stream_ok", {
      provider: run.runtime.provider,
      model: run.runtime.model,
      type: payload.type,
      tools: run.trace.map((entry) => entry.toolName),
    });

    input.onEvent({ type: "complete", payload });
    return payload;
  } catch (error) {
    logger.error("agent.stream_failed", {
      provider: run.runtime.provider,
      model: run.runtime.model,
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message.slice(0, 180) : "unknown",
    });

    throw new AssistantModelError("The language model could not complete this request.", {
      cause: error,
    });
  }
}
