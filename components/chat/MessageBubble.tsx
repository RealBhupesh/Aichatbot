"use client";

import { useState } from "react";
import { ActionButtons } from "@/components/chat/ActionButtons";
import { AnswerGallery } from "@/components/chat/AnswerGallery";
import { AssistantMessageContent } from "@/components/chat/AssistantMessageContent";
import { FollowUpSuggestions } from "@/components/chat/FollowUpSuggestions";
import { GuestContactForm, type GuestContactValues } from "@/components/forms/GuestContactForm";
import { StaySearchForm, type StayValues } from "@/components/forms/StaySearchForm";
import { RoomBrowseCard } from "@/components/rooms/RoomBrowseCard";
import { RoomCatalogPanel } from "@/components/rooms/RoomCatalogPanel";
import { RoomDetailModal } from "@/components/rooms/RoomDetailModal";
import { Button } from "@/components/ui/Button";
import type { ChatFormConfig } from "@/lib/chat-forms";
import type { AnswerImage } from "@/lib/media";
import type { AvailableRoom, ChatResponse } from "@/lib/schemas";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "staff";
  content: string;
  authorName?: string;
  type?: ChatResponse["type"];
  intent?: string;
  catalog?: boolean;
  rooms?: AvailableRoom[];
  images?: AnswerImage[];
  actions?: ChatResponse["actions"];
  suggestions?: ChatResponse["suggestions"];
  nights?: number;
  retryable?: boolean;
  form?: ChatFormConfig | null;
  formSubmitted?: boolean;
};

type Props = {
  message: ChatMessage;
  defaultGuestCount?: number;
  onRetry?: () => void;
  onAction?: (action: NonNullable<ChatResponse["actions"]>[number]) => void;
  onSuggestion?: (message: string) => void;
  onStaySubmit?: (values: StayValues) => void;
  onGuestSubmit?: (values: GuestContactValues) => void;
  stayFormLoading?: boolean;
  guestFormLoading?: boolean;
  actionsDisabled?: boolean;
};

export function MessageBubble({
  message,
  defaultGuestCount,
  onRetry,
  onAction,
  onSuggestion,
  onStaySubmit,
  onGuestSubmit,
  stayFormLoading,
  guestFormLoading,
  actionsDisabled,
}: Props) {
  const isUser = message.role === "user";
  const isStaff = message.role === "staff";
  const images = message.images ?? [];
  const [selectedRoom, setSelectedRoom] = useState<AvailableRoom | null>(null);
  const showAvailabilityResults =
    message.type === "availability_results" && Boolean(message.rooms?.length);
  const showCatalog =
    !showAvailabilityResults &&
    Boolean(message.rooms?.length) &&
    (message.catalog || message.intent === "room_info");

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[95%] space-y-3 ${isUser ? "" : "w-full sm:w-auto sm:min-w-[300px]"}`}
        data-testid={isUser ? "user-message" : isStaff ? "staff-message" : "assistant-message"}
      >
        <div
          className={
            isUser
              ? "rounded-2xl rounded-br-md bg-neutral px-4 py-3 text-[15px] leading-6 text-neutral-content"
              : isStaff
                ? "rounded-2xl rounded-bl-md border border-primary/20 bg-primary/5 px-4 py-3"
                : "rounded-2xl rounded-bl-md border border-base-300 bg-base-200 px-4 py-3"
          }
        >
          {isStaff ? (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              {message.authorName || "Front desk"}
            </p>
          ) : null}
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <AssistantMessageContent content={message.content} />
          )}
        </div>

        {!isUser ? <AnswerGallery images={images} /> : null}

        {!isUser && message.form && !message.formSubmitted ? (
          message.form.type === "stay_search" && onStaySubmit ? (
            <StaySearchForm
              initial={{
                checkIn: message.form.initial?.checkIn ?? undefined,
                checkOut: message.form.initial?.checkOut ?? undefined,
                guests: message.form.initial?.guests ?? undefined,
                maxBudget: message.form.initial?.maxBudget ?? undefined,
                checkInTime: message.form.initial?.checkInTime ?? undefined,
                checkOutTime: message.form.initial?.checkOutTime ?? undefined,
              }}
              missingFields={message.form.missingFields}
              loading={stayFormLoading}
              onSubmit={onStaySubmit}
            />
          ) : message.form.type === "guest_contact" && onGuestSubmit ? (
            <GuestContactForm
              guestCount={message.form.initial?.guests ?? defaultGuestCount ?? 1}
              initial={{
                guestNames: message.form.initial?.guestNames ?? undefined,
                guestName: message.form.initial?.guestName ?? undefined,
                guestEmail: message.form.initial?.guestEmail ?? undefined,
                guestPhone: message.form.initial?.guestPhone ?? undefined,
              }}
              loading={guestFormLoading}
              onSubmit={onGuestSubmit}
            />
          ) : null
        ) : null}

        {message.retryable && onRetry ? (
          <Button type="button" variant="secondary" className="h-10 px-4 text-sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}

        {message.actions && message.actions.length > 0 && onAction ? (
          <ActionButtons
            actions={message.actions}
            disabled={actionsDisabled}
            onAction={onAction}
          />
        ) : null}

        {message.suggestions && message.suggestions.length > 0 && onSuggestion ? (
          <FollowUpSuggestions
            suggestions={message.suggestions}
            disabled={actionsDisabled}
            onSelect={onSuggestion}
          />
        ) : null}

        {showCatalog && message.rooms ? (
          <RoomCatalogPanel rooms={message.rooms} onOpenRoom={setSelectedRoom} />
        ) : null}

        {showAvailabilityResults && message.rooms ? (
          <div className="space-y-3" data-testid="room-results">
            <p className="text-sm font-medium text-base-content/70">
              {message.rooms.length} room{message.rooms.length === 1 ? "" : "s"} match your search
            </p>
            <div className="grid gap-3">
              {message.rooms.map((room) => (
                <RoomBrowseCard
                  key={room.id}
                  room={room}
                  nights={message.nights || room.nights}
                  onOpen={() => setSelectedRoom(room)}
                />
              ))}
            </div>
          </div>
        ) : null}

        <RoomDetailModal
          room={selectedRoom}
          nights={message.nights || selectedRoom?.nights || 1}
          open={Boolean(selectedRoom)}
          onClose={() => setSelectedRoom(null)}
          onHold={
            onAction && selectedRoom
              ? () => {
                  onAction({
                    type: "hold_room",
                    label: `Book ${selectedRoom.name}`,
                    roomId: selectedRoom.id as NonNullable<ChatResponse["actions"]>[number]["roomId"],
                  });
                  setSelectedRoom(null);
                }
              : undefined
          }
          holdDisabled={actionsDisabled}
        />
      </div>
    </div>
  );
}
