"use client";

import { useEffect, useRef, useState } from "react";
import { AgentStepTimeline, type AgentStep } from "@/components/chat/AgentStepTimeline";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatLoadingState } from "@/components/chat/ChatLoadingState";
import { MessageBubble, type ChatMessage } from "@/components/chat/MessageBubble";
import { SuggestedQuestions } from "@/components/chat/SuggestedQuestions";
import { Button } from "@/components/ui/Button";
import type { StayValues } from "@/components/forms/StaySearchForm";
import { readChatStream } from "@/lib/chat-stream-client";
import { resolveChatForm } from "@/lib/chat-forms";
import { extractGuestCount } from "@/lib/dates";
import {
  buildGuestContactChatMessage,
  buildGuestHoldMessage,
  guestContactIntro,
  type GuestContactValues,
} from "@/lib/guest-contact";
import { isDirectAvailabilityRequest } from "@/lib/availability-intent";
import { hydrateGuestMessages, mergePolledGuestMessages } from "@/lib/guest-poll";
import type { ChatResponse } from "@/lib/schemas";

type ChatAction = NonNullable<ChatResponse["actions"]>[number];

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  type: "answer",
  content:
    "Good afternoon. I'm Leela at the Asteria desk.\nI can help with rooms, amenities, hotel policies, and availability. What would you like to know?",
};

type HistoryItem = {
  role: "user" | "assistant";
  content: string;
};

function toHistory(messages: ChatMessage[]): HistoryItem[] {
  return messages
    .filter((message) => message.id !== "welcome")
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-12)
    .map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: message.content,
    }));
}

type PollPayload = {
  mode?: "ai" | "staff";
  assignedTo?: string | null;
  messages?: Array<{
    role: "user" | "assistant" | "staff";
    content: string;
    at: string;
    authorName?: string;
  }>;
};

type Props = {
  onBusyChange?: (busy: boolean) => void;
  onNewConversation?: () => void;
};

export function ChatWindow({ onBusyChange, onNewConversation }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [stay, setStay] = useState<Partial<StayValues>>({});
  const [guestContact, setGuestContact] = useState<GuestContactValues | null>(null);
  const [pendingHoldAction, setPendingHoldAction] = useState<ChatAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingVariant, setLoadingVariant] = useState<"message" | "rooms" | "form">("message");
  const [statusLabel, setStatusLabel] = useState("Leela is looking that up");
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [activeFormMessageId, setActiveFormMessageId] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<{
    message: string;
    source: "chat" | "availability_form";
    availability?: StayValues;
  } | null>(null);
  const [deskMode, setDeskMode] = useState<"ai" | "staff">("ai");
  const [deskName, setDeskName] = useState("Front desk");
  const bottom = useRef<HTMLDivElement>(null);
  const lastPollAt = useRef<string | null>(null);
  const hydratedFromServer = useRef(false);
  const streamingContent = useRef("");

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    streamingContent.current = streamingMessage?.content ?? "";
  }, [streamingMessage]);

  useEffect(() => {
    if (messages.length <= 1 && !busy) {
      return;
    }
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, streamingMessage, agentSteps, pendingHoldAction, deskMode]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const params = lastPollAt.current ? `?after=${encodeURIComponent(lastPollAt.current)}` : "";
        const response = await fetch(`/api/chat/poll${params}`);
        if (!response.ok || cancelled) {
          return;
        }
        const data = (await response.json()) as PollPayload;
        if (cancelled) {
          return;
        }
        if (data.mode === "staff" || data.mode === "ai") {
          setDeskMode(data.mode);
        }
        if (data.assignedTo) {
          setDeskName(data.assignedTo);
        }
        const incoming = data.messages ?? [];
        if (incoming.length > 0) {
          lastPollAt.current = incoming.at(-1)?.at ?? lastPollAt.current;
        }

        setMessages((current) => {
          if (!hydratedFromServer.current) {
            hydratedFromServer.current = true;
            if (current.length <= 1 && incoming.length > 0) {
              return hydrateGuestMessages(incoming);
            }
          }
          return mergePolledGuestMessages(current, incoming, [streamingContent.current]);
        });
      } catch {
        // Ignore polling errors and try again on the next interval.
      }
    }

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  function applyResponseState(
    data: ChatResponse,
    payload: {
      source: "chat" | "availability_form";
      availability?: StayValues;
    },
  ) {
    if (data.type === "availability_request") {
      setStay((current) => ({
        ...current,
        checkIn: data.data?.checkIn || current.checkIn,
        checkOut: data.data?.checkOut || current.checkOut,
        guests: data.data?.guests || current.guests,
        maxBudget: data.data?.maxBudget ?? current.maxBudget,
        checkInTime: data.data?.checkInTime ?? current.checkInTime,
        checkOutTime: data.data?.checkOutTime ?? current.checkOutTime,
      }));
    }

    if (data.type === "availability_results") {
      setStay({
        checkIn: data.data?.checkIn || payload.availability?.checkIn,
        checkOut: data.data?.checkOut || payload.availability?.checkOut,
        guests: data.data?.guests || payload.availability?.guests,
        maxBudget: payload.availability?.maxBudget ?? stay.maxBudget,
        checkInTime: payload.availability?.checkInTime ?? stay.checkInTime,
        checkOutTime: payload.availability?.checkOutTime ?? stay.checkOutTime,
      });
    }

    if (typeof data.data?.guests === "number") {
      setStay((current) => ({
        ...current,
        guests: data.data?.guests ?? current.guests,
        checkIn: data.data?.checkIn ?? current.checkIn,
        checkOut: data.data?.checkOut ?? current.checkOut,
      }));
    }

    if (data.mode === "staff" || data.mode === "ai") {
      setDeskMode(data.mode);
    }
  }

  function buildAssistantMessage(data: ChatResponse): ChatMessage {
    const form = resolveChatForm(data);
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: data.message,
      type: data.type,
      intent: data.intent,
      catalog: data.data?.catalog ?? data.intent === "room_info",
      rooms: data.rooms,
      images: data.images ?? [],
      actions: data.actions ?? [],
      suggestions: data.suggestions ?? [],
      nights: data.data?.nights ?? undefined,
      retryable: data.type === "error" || data.success === false,
      form,
    };
  }

  function openAvailabilityCalendar(userMessage: string) {
    const userEntry: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
    };
    const assistantEntry: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "Pick your check-in and check-out on the calendar below. You can set arrival times and guest count before searching.",
      type: "availability_request",
      intent: "availability",
      form: {
        type: "stay_search",
        missingFields: ["checkIn", "checkOut", "guests"],
        initial: {
          checkInTime: stay.checkInTime ?? "15:00",
          checkOutTime: stay.checkOutTime ?? "11:00",
          guests: stay.guests ?? null,
          checkIn: stay.checkIn ?? null,
          checkOut: stay.checkOut ?? null,
        },
      },
    };
    setActiveFormMessageId(assistantEntry.id);
    setMessages((current) => [...current, userEntry, assistantEntry]);
  }

  function markFormSubmitted(messageId: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, formSubmitted: true } : message,
      ),
    );
  }

  async function send(
    payload: {
      message: string;
      source?: "chat" | "availability_form";
      availability?: StayValues;
      historyOverride?: ChatMessage[];
      action?: ChatAction;
    },
    options?: { appendUser?: boolean },
  ) {
    const source = payload.source ?? "chat";

    if (source === "chat" && !payload.action && isDirectAvailabilityRequest(payload.message)) {
      openAvailabilityCalendar(payload.message);
      return;
    }
    const historyMessages = payload.historyOverride ?? messages;
    const appendUser = options?.appendUser ?? true;
    const userMessage: ChatMessage =
      source === "availability_form"
        ? {
            id: crypto.randomUUID(),
            role: "user",
            content: `Check availability from ${payload.availability?.checkIn} to ${payload.availability?.checkOut} for ${payload.availability?.guests} guests.`,
          }
        : payload.action?.type === "confirm_hold"
          ? {
              id: crypto.randomUUID(),
              role: "user",
              content: "Confirm hold",
            }
          : payload.action?.type === "cancel_hold"
            ? {
                id: crypto.randomUUID(),
                role: "user",
                content: "Not now",
              }
            : payload.action?.type === "confirm_modify"
              ? {
                  id: crypto.randomUUID(),
                  role: "user",
                  content: "Confirm change",
                }
              : payload.action?.type === "cancel_modify"
                ? {
                    id: crypto.randomUUID(),
                    role: "user",
                    content: "Keep current stay",
                  }
                : payload.action?.type === "confirm_cancel"
                  ? {
                      id: crypto.randomUUID(),
                      role: "user",
                      content: "Cancel this hold",
                    }
                  : payload.action?.type === "keep_reservation"
                    ? {
                        id: crypto.randomUUID(),
                        role: "user",
                        content: "Keep it",
                      }
            : payload.action?.type === "hold_room" || payload.action?.type === "select_room"
              ? {
                  id: crypto.randomUUID(),
                  role: "user",
                  content: payload.message || `Hold the ${payload.action.roomId ?? "room"}.`,
                }
              : {
                  id: crypto.randomUUID(),
                  role: "user",
                  content: payload.message,
                };

    const nextMessages = appendUser
      ? [...historyMessages, userMessage]
      : historyMessages;
    setMessages(nextMessages);

    if (appendUser && source === "chat") {
      const inferredGuests = extractGuestCount(payload.message);
      if (typeof inferredGuests === "number") {
        setStay((current) => ({ ...current, guests: inferredGuests }));
      }
    }
    setLastRequest({
      message: payload.message,
      source,
      availability: payload.availability,
    });
    setBusy(true);
    setLoadingVariant(source === "availability_form" ? "rooms" : "message");
    setStatusLabel(
      deskMode === "staff"
        ? "Sending to the front desk"
        : source === "availability_form"
          ? "Checking room availability"
          : "Leela is looking that up",
    );
    setStreamingMessage(null);
    setAgentSteps([]);
    setActiveFormMessageId(null);

    const requestBody = {
      message: payload.message,
      history: toHistory(historyMessages),
      availability: payload.availability ?? {
        checkIn: stay.checkIn ?? null,
        checkOut: stay.checkOut ?? null,
        guests: stay.guests ?? null,
        maxBudget: stay.maxBudget ?? null,
      },
      source,
      action: payload.action,
    };

    const useStreaming = source === "chat" && !payload.action && deskMode !== "staff";

    try {
      const response = await fetch(useStreaming ? "/api/chat/stream" : "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const data =
        contentType.includes("text/event-stream")
          ? await readChatStream(response, {
              onStatus: (label) => setStatusLabel(label),
              onToolStart: (toolName, label) => {
                setStatusLabel(label);
                setAgentSteps((current) => {
                  const next = current.map((step) =>
                    step.status === "active" ? { ...step, status: "done" as const } : step,
                  );
                  return [
                    ...next,
                    {
                      id: `${toolName}-${next.length}`,
                      toolName,
                      label,
                      status: "active",
                    },
                  ];
                });
              },
              onToolEnd: (toolName, label) => {
                setAgentSteps((current) =>
                  current.map((step) =>
                    step.toolName === toolName && step.label === label
                      ? { ...step, status: "done" as const }
                      : step,
                  ),
                );
              },
              onTextDelta: (text) => {
                setStreamingMessage({
                  id: "streaming",
                  role: "assistant",
                  content: text,
                  type: "answer",
                });
              },
            })
          : (await response.json()) as ChatResponse;

      if (!response.ok && !data?.message) {
        throw new Error("network");
      }

      applyResponseState(data, { source, availability: payload.availability });
      setStreamingMessage(null);
      setAgentSteps([]);
      if (data.mode === "staff" && !data.message?.trim()) {
        setMessages(nextMessages);
      } else {
        const assistantMessage = buildAssistantMessage(data);
        setMessages([...nextMessages, assistantMessage]);
        if (assistantMessage.form) {
          setActiveFormMessageId(assistantMessage.id);
        }
      }
    } catch {
      setStreamingMessage(null);
      setAgentSteps([]);
      setMessages([
        ...nextMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          type: "error",
          retryable: true,
          content: "Something went wrong while contacting the assistant.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function requestGuestDetailsForHold(action: ChatAction) {
    const guestCount = stay.guests ?? 1;
    setPendingHoldAction(action);
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        type: "answer",
        content: guestContactIntro(guestCount),
        form: {
          type: "guest_contact",
          missingFields: ["guestName", "guestContact"],
          initial: {
            guests: guestCount,
            guestNames: guestContact?.guestNames,
            guestEmail: guestContact?.guestEmail,
            guestPhone: guestContact?.guestPhone,
          },
        },
      },
    ]);
  }

  function runAction(action: ChatAction) {
    if (busy) {
      return;
    }

    if (action.type === "confirm_hold") {
      void send({
        message: "Confirm hold",
        action: {
          type: "confirm_hold",
          label: action.label,
          holdToken: action.holdToken,
        },
      });
      return;
    }

    if (action.type === "cancel_hold") {
      void send({
        message: "Not now",
        action: {
          type: "cancel_hold",
          label: action.label,
        },
      });
      return;
    }

    if (action.type === "confirm_modify") {
      void send({
        message: "Confirm change",
        action: {
          type: "confirm_modify",
          label: action.label,
          holdId: action.holdId,
        },
      });
      return;
    }

    if (action.type === "cancel_modify") {
      void send({
        message: "Keep current stay",
        action: {
          type: "cancel_modify",
          label: action.label,
        },
      });
      return;
    }

    if (action.type === "confirm_cancel") {
      void send({
        message: "Cancel this hold",
        action: {
          type: "confirm_cancel",
          label: action.label,
          holdId: action.holdId,
        },
      });
      return;
    }

    if (action.type === "keep_reservation") {
      void send({
        message: "Keep it",
        action: {
          type: "keep_reservation",
          label: action.label,
        },
      });
      return;
    }

    if (action.type === "hold_room" || action.type === "select_room") {
      if (!guestContact?.guestPhone?.trim()) {
        requestGuestDetailsForHold(action);
        return;
      }

      void send({
        message: buildGuestHoldMessage(guestContact, action.roomId),
        action: {
          type: "hold_room",
          label: action.label,
          roomId: action.roomId,
        },
      });
    }
  }

  function handleStaySubmit(values: StayValues) {
    if (activeFormMessageId) {
      markFormSubmitted(activeFormMessageId);
    }
    setStay(values);
    void send({
      message: values.maxBudget
        ? `Please check rooms under ₹${values.maxBudget.toLocaleString("en-IN")} per night for these dates.`
        : "Please check availability for these dates.",
      source: "availability_form",
      availability: values,
    });
  }

  function handleGuestSubmit(values: GuestContactValues) {
    setGuestContact(values);
    const guestFormMessage = messages.findLast(
      (message) => message.form?.type === "guest_contact" && !message.formSubmitted,
    );
    if (guestFormMessage) {
      markFormSubmitted(guestFormMessage.id);
    }

    if (pendingHoldAction) {
      void send({
        message: buildGuestHoldMessage(values, pendingHoldAction.roomId),
        action: {
          type: "hold_room",
          label: pendingHoldAction.label,
          roomId: pendingHoldAction.roomId,
        },
      });
      setPendingHoldAction(null);
      return;
    }

    void send({
      message: buildGuestContactChatMessage(values),
    });
  }

  function retry() {
    if (!lastRequest || busy) {
      return;
    }

    const withoutError = messages.filter((message) => message.type !== "error");
    const withoutLastUser =
      withoutError.at(-1)?.role === "user" ? withoutError.slice(0, -1) : withoutError;
    void send(
      {
        ...lastRequest,
        historyOverride: withoutLastUser,
      },
      { appendUser: true },
    );
  }

  async function startNewConversation() {
    let cleared = false;
    try {
      const response = await fetch("/api/chat/new", { method: "POST" });
      cleared = response.ok;
    } catch {
      cleared = false;
    }

    lastPollAt.current = null;
    hydratedFromServer.current = true;
    setMessages([WELCOME]);
    setStay({});
    setGuestContact(null);
    setPendingHoldAction(null);
    setLastRequest(null);
    setActiveFormMessageId(null);
    setDeskMode("ai");
    setStreamingMessage(null);
    setAgentSteps([]);

    if (cleared) {
      onNewConversation?.();
    }
  }

  return (
    <section
      className="flex h-full flex-col overflow-hidden bg-base-100"
      data-theme="asteria"
      aria-label="Asteria guest assistant"
    >
      {messages.length > 1 ? (
        <header className="flex items-center justify-end px-4 pt-1 pb-2">
          <Button
            type="button"
            variant="tertiary"
            className="h-9 text-[13px] text-base-content/60"
            onClick={() => void startNewConversation()}
            data-testid="new-conversation"
          >
            New conversation
          </Button>
        </header>
      ) : null}

      {deskMode === "staff" ? (
        <div
          className="mx-4 mt-2 rounded-full bg-primary/10 px-4 py-2 text-center text-[13px] font-medium text-primary"
          data-testid="staff-takeover-banner"
        >
          You&apos;re connected to {deskName}. Leela is paused until the desk hands you back.
        </div>
      ) : null}

      <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-3 ${messages.length > 1 ? "" : "pt-1"}`}>
        <div aria-live="polite" className="space-y-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              defaultGuestCount={stay.guests ?? undefined}
              onRetry={message.retryable ? retry : undefined}
              onAction={message.role === "assistant" ? runAction : undefined}
              onSuggestion={(suggestion) => {
                if (isDirectAvailabilityRequest(suggestion)) {
                  openAvailabilityCalendar(suggestion);
                  return;
                }
                void send({ message: suggestion });
              }}
              onStaySubmit={handleStaySubmit}
              onGuestSubmit={handleGuestSubmit}
              stayFormLoading={busy && loadingVariant === "rooms"}
              guestFormLoading={busy && Boolean(pendingHoldAction)}
              actionsDisabled={busy}
            />
          ))}
          {agentSteps.length > 0 ? <AgentStepTimeline steps={agentSteps} /> : null}
          {streamingMessage ? (
            <MessageBubble message={streamingMessage} actionsDisabled={busy} />
          ) : null}
          {busy && deskMode !== "staff" && !streamingMessage && agentSteps.length === 0 ? (
            <ChatLoadingState label={statusLabel} variant={loadingVariant} />
          ) : null}
        </div>
        {messages.length <= 1 ? (
          <SuggestedQuestions
            disabled={busy}
            onSelect={(question) => {
              if (isDirectAvailabilityRequest(question)) {
                openAvailabilityCalendar(question);
                return;
              }
              void send({ message: question });
            }}
          />
        ) : null}
        <div ref={bottom} />
      </div>
      <ChatInput disabled={busy} onSend={(message) => void send({ message })} />
    </section>
  );
}
