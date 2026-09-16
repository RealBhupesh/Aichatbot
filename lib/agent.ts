import { generateText, isStepCount } from "ai";
import { AssistantModelError, createChatModel } from "@/lib/ai";
import { buildAgentChatResponse } from "@/lib/agent-response";
import { createAgentRun } from "@/lib/agent-run";
import { logger } from "@/lib/logger";
import type { ChatRequest, ChatResponse } from "@/lib/schemas";
import type { GuestSession } from "@/lib/sessions";

export type AgentInput = {
  request: ChatRequest;
  session: GuestSession;
  now?: Date;
  sessionId?: string | null;
};

export async function runAgentTurn(input: AgentInput): Promise<ChatResponse> {
  const now = input.now ?? new Date();
  const run = createAgentRun({
    request: input.request,
    session: input.session,
    now,
    sessionId: input.sessionId ?? input.session.id,
  });

  logger.info("agent.turn_start", {
    provider: run.runtime.provider,
    model: run.runtime.model,
    messageLength: input.request.message.length,
  });

  try {
    const result = await generateText({
      model: createChatModel(),
      system: run.system,
      messages: run.messages,
      tools: run.tools,
      stopWhen: isStepCount(5),
      maxOutputTokens: 1200,
      ...(run.providerOptions ? { providerOptions: run.providerOptions } : {}),
      onStepEnd({ stepNumber, finishReason, toolCalls }) {
        logger.info("agent.step_end", {
          stepNumber,
          finishReason,
          tools: toolCalls.map((call) => call.toolName),
        });
      },
    });

    const payload = buildAgentChatResponse({
      text: result.text,
      trace: run.trace,
      message: input.request.message,
      provider: run.runtime.provider,
      model: run.runtime.model,
      sessionId: input.sessionId,
    });

    logger.info("agent.turn_ok", {
      provider: run.runtime.provider,
      model: run.runtime.model,
      type: payload.type,
      tools: run.trace.map((entry) => entry.toolName),
    });

    return payload;
  } catch (error) {
    logger.error("agent.turn_failed", {
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
