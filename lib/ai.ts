import { createGroq } from "@ai-sdk/groq";
import { generateText, Output, createGateway } from "ai";
import { logger } from "@/lib/logger";
import { toIsoDate, utcToday } from "@/lib/dates";
import { INTERPRET_INSTRUCTIONS, SYSTEM_PROMPT } from "@/lib/prompts";
import {
  assistantUnderstandingSchema,
  type AssistantUnderstanding,
} from "@/lib/schemas";
import { ruleBasedInterpret } from "@/lib/interpreter";

export class AssistantModelError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AssistantModelError";
  }
}

export type InterpretInput = {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  now?: Date;
};

export type InterpretGuestMessage = (
  input: InterpretInput,
) => Promise<AssistantUnderstanding>;

const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
const DEFAULT_GATEWAY_MODEL = "openai/gpt-5.4-mini";

export function getGroqApiKey() {
  return process.env.GROQ_API_KEY?.trim() || "";
}

export function getGroqModel() {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
}

export function getLlmApiKey() {
  return getGroqApiKey() || process.env.AI_GATEWAY_API_KEY || process.env.LLM_API_KEY || "";
}

export function hasLiveLlm() {
  return Boolean(getLlmApiKey());
}

export function llmRuntime() {
  if (getGroqApiKey()) {
    return { provider: "groq" as const, model: getGroqModel() };
  }
  if (process.env.AI_GATEWAY_API_KEY || process.env.LLM_API_KEY) {
    return { provider: "gateway" as const, model: process.env.LLM_MODEL || DEFAULT_GATEWAY_MODEL };
  }
  return { provider: "rules" as const, model: null };
}

function groqFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const parsed = new URL(url);
  logger.info("ai.groq_request", {
    host: parsed.host,
    path: parsed.pathname,
    method: init?.method || "GET",
  });

  return fetch(input, init).then((response) => {
    logger.info("ai.groq_response", {
      host: parsed.host,
      path: parsed.pathname,
      status: response.status,
    });
    return response;
  });
}

function buildPrompt(input: InterpretInput) {
  const history = input.history
    .slice(-12)
    .map((item) => `${item.role === "user" ? "Guest" : "Assistant"}: ${item.content}`)
    .join("\n");

  return [
    INTERPRET_INSTRUCTIONS,
    `Current date: ${toIsoDate(utcToday(input.now ?? new Date()))}. Use this to resolve today, tomorrow, and other relative dates into YYYY-MM-DD.`,
    history ? `Recent conversation:\n${history}` : "Recent conversation: none",
    `Current guest message:\n${input.message}`,
  ].join("\n\n");
}

export function createChatModel() {
  const apiKey = getGroqApiKey();
  if (apiKey) {
    const groq = createGroq({
      apiKey,
      fetch: groqFetch,
    });
    return groq(getGroqModel());
  }

  const gateway = createGateway({
    apiKey: process.env.AI_GATEWAY_API_KEY || process.env.LLM_API_KEY || "",
  });
  return gateway(process.env.LLM_MODEL || DEFAULT_GATEWAY_MODEL);
}

function modelForRequest() {
  return createChatModel();
}

export async function interpretWithLlm(
  input: InterpretInput,
): Promise<AssistantUnderstanding> {
  if (!hasLiveLlm()) {
    throw new AssistantModelError("No LLM API key is configured.");
  }

  const runtime = llmRuntime();
  logger.info("ai.interpret_start", {
    provider: runtime.provider,
    model: runtime.model,
    hasGroqKey: Boolean(getGroqApiKey()),
  });

  try {
    const result = await generateText({
      model: modelForRequest(),
      output: Output.object({ schema: assistantUnderstandingSchema }),
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(input),
      maxOutputTokens: 1200,
      ...(runtime.provider === "groq"
        ? {
            providerOptions: {
              groq: {
                structuredOutputs: true,
                reasoningEffort: "low",
              },
            },
          }
        : {}),
    });

    if (!result.output) {
      throw new AssistantModelError("The model returned an empty structured response.");
    }

    logger.info("ai.interpret_ok", {
      provider: runtime.provider,
      model: runtime.model,
      intent: result.output.intent,
    });

    return assistantUnderstandingSchema.parse(result.output);
  } catch (error) {
    logger.error("ai.interpret_failed", {
      provider: runtime.provider,
      model: runtime.model,
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message.slice(0, 180) : "unknown",
    });

    if (error instanceof AssistantModelError) {
      throw error;
    }

    throw new AssistantModelError(
      "The language model could not complete this request.",
      { cause: error },
    );
  }
}

export const interpretGuestMessage: InterpretGuestMessage = async (input) => {
  if (!hasLiveLlm()) {
    logger.warn("ai.using_rules", {
      reason: "GROQ_API_KEY is empty. Add it to .env.local and restart next dev.",
    });
    return ruleBasedInterpret(input);
  }

  return interpretWithLlm(input);
};
