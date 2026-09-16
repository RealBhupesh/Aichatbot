"use client";

type Props = {
  label?: string;
  compact?: boolean;
};

export function HotelConciergeLoader({
  label = "Leela is looking that up",
  compact = false,
}: Props) {
  return (
    <div
      className={`hotel-concierge-loader ${compact ? "hotel-concierge-loader--compact" : ""}`}
      role="status"
      aria-live="polite"
      data-testid="typing-indicator"
    >
      <span className="sr-only">{label}</span>
      <div className="hotel-concierge-loader__orbs" aria-hidden="true">
        <span className="hotel-concierge-loader__orb" />
        <span className="hotel-concierge-loader__orb" />
        <span className="hotel-concierge-loader__orb" />
      </div>
      <div className="hotel-concierge-loader__line" aria-hidden="true">
        <span className="hotel-concierge-loader__line-fill" />
      </div>
      <p className="hotel-concierge-loader__label">{label}</p>
    </div>
  );
}
