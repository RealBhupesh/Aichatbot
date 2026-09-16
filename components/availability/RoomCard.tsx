"use client";

import { formatInr } from "@/lib/hotel";
import type { AvailableRoom } from "@/lib/schemas";

type Props = {
  room: AvailableRoom;
  nights: number;
  onHold?: () => void;
  holdDisabled?: boolean;
};

export function RoomCard({ room, nights, onHold, holdDisabled }: Props) {
  return (
    <article
      className="overflow-hidden rounded-[12px] bg-white ring-1 ring-[var(--color-hairline)]"
      data-testid="room-card"
    >
      <div
        className="relative h-40 bg-[var(--color-surface-soft)] bg-cover bg-center"
        style={room.image ? { backgroundImage: `url(${room.image})` } : undefined}
      />
      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-[16px] font-semibold leading-5 text-[var(--color-ink)]">
            {room.name}
          </h3>
          <p className="mt-1 text-[14px] text-[var(--color-muted)]">
            Sleeps {room.maxGuests} · {room.beds}
          </p>
        </div>
        <p className="text-[14px] leading-5 text-[var(--color-body)]">{room.description}</p>
        <ul className="flex flex-wrap gap-1.5">
          {room.amenities.slice(0, 4).map((amenity) => (
            <li
              key={amenity}
              className="rounded-full bg-[var(--color-surface-soft)] px-2 py-1 text-[12px] text-[var(--color-body)]"
            >
              {amenity}
            </li>
          ))}
        </ul>
        <p className="text-[14px] text-[var(--color-ink)]">
          {room.breakfastIncluded ? "Breakfast included" : "Breakfast not included"}
        </p>
        <div className="flex items-end justify-between gap-3 border-t border-[var(--color-hairline)] pt-3">
          <div>
            <p className="text-[16px] font-semibold text-[var(--color-ink)]">
              {formatInr(room.pricePerNight)}
              <span className="text-[14px] font-normal text-[var(--color-muted)]">/night</span>
            </p>
            <p className="text-[13px] text-[var(--color-muted)]">
              {nights} {nights === 1 ? "night" : "nights"}
            </p>
          </div>
          <p className="text-right text-[16px] font-semibold text-[var(--color-ink)]">
            {formatInr(room.totalPrice)}
            <span className="block text-[12px] font-normal text-[var(--color-muted)]">
              estimated total
            </span>
          </p>
        </div>
        {onHold ? (
          <button
            type="button"
            className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-full bg-[var(--color-ink)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onHold}
            disabled={holdDisabled}
            data-testid="hold-room-button"
          >
            Book this room
          </button>
        ) : null}
      </div>
    </article>
  );
}
