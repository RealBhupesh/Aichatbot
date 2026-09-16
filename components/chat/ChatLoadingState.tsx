"use client";

import { HotelConciergeLoader } from "@/components/chat/HotelConciergeLoader";

type Props = {
  label?: string;
  variant?: "message" | "rooms" | "form";
};

export function ChatLoadingState({
  label = "Leela is looking that up",
  variant = "message",
}: Props) {
  if (variant === "rooms") {
    return (
      <div className="w-full space-y-4" data-testid="room-loading-skeleton" role="status" aria-live="polite">
        <HotelConciergeLoader label={label} compact />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((item) => (
            <div key={item} className="hotel-room-skeleton">
              <div className="hotel-room-skeleton__image" />
              <div className="hotel-room-skeleton__body">
                <div className="hotel-room-skeleton__line hotel-room-skeleton__line--title" />
                <div className="hotel-room-skeleton__line" />
                <div className="hotel-room-skeleton__line hotel-room-skeleton__line--short" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div className="hotel-form-skeleton" role="status" aria-live="polite">
        <HotelConciergeLoader label={label} compact />
        <div className="hotel-form-skeleton__fields">
          <div className="hotel-form-skeleton__field" />
          <div className="hotel-form-skeleton__row">
            <div className="hotel-form-skeleton__field" />
            <div className="hotel-form-skeleton__field" />
          </div>
          <div className="hotel-form-skeleton__button" />
        </div>
      </div>
    );
  }

  return <HotelConciergeLoader label={label} />;
}
