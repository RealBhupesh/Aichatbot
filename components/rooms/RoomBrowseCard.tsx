"use client";

import { Star } from "@phosphor-icons/react";
import { formatInr } from "@/lib/hotel";
import { getRoomDetailFromAvailability } from "@/lib/room-details";
import type { AvailableRoom } from "@/lib/schemas";

type Props = {
  room: AvailableRoom;
  nights: number;
  onOpen: () => void;
};

export function RoomBrowseCard({ room, nights, onOpen }: Props) {
  const detail = getRoomDetailFromAvailability(room);

  return (
    <button
      type="button"
      data-testid="room-card"
      onClick={onOpen}
      className="card card-side w-full overflow-hidden border border-base-300 bg-base-100 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <figure className="h-28 w-28 shrink-0 sm:h-32 sm:w-36">
        <div
          className="h-full w-full bg-base-200 bg-cover bg-center"
          style={{ backgroundImage: `url(${room.image ?? detail?.images[0]?.src})` }}
        />
      </figure>
      <div className="card-body min-w-0 gap-1 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-base-content">{room.name}</h3>
            <p className="text-xs text-base-content/60">
              Sleeps {room.maxGuests} · {room.beds}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-base-content/70">
            <Star size={12} weight="fill" className="text-primary" />
            <span>{detail?.rating.toFixed(2) ?? "4.91"}</span>
          </div>
        </div>
        <p className="line-clamp-2 text-sm text-base-content/70">{room.description}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {room.amenities.slice(0, 3).map((amenity) => (
            <span key={amenity} className="badge badge-ghost badge-sm">
              {amenity}
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-end justify-between gap-2">
          <p className="text-sm font-semibold text-base-content">
            {formatInr(room.pricePerNight)}
            <span className="font-normal text-base-content/60">/night</span>
          </p>
          <p className="text-sm font-semibold text-primary">{formatInr(room.totalPrice)} total</p>
        </div>
        <p className="text-xs text-primary">Tap to view photos, reviews & details →</p>
      </div>
    </button>
  );
}
