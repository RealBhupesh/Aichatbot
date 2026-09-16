"use client";

import { Check, Star, X } from "@phosphor-icons/react";
import { useEffect, useId, useState } from "react";
import { formatInr } from "@/lib/hotel";
import { getRoomDetailFromAvailability } from "@/lib/room-details";
import type { AvailableRoom } from "@/lib/schemas";

type Props = {
  room: AvailableRoom | null;
  nights: number;
  open: boolean;
  onClose: () => void;
  onHold?: () => void;
  holdDisabled?: boolean;
};

export function RoomDetailModal({ room, nights, open, onClose, onHold, holdDisabled }: Props) {
  const titleId = useId();
  const [activeImage, setActiveImage] = useState(0);
  const detail = room ? getRoomDetailFromAvailability(room) : null;

  useEffect(() => {
    if (open) {
      setActiveImage(0);
    }
  }, [open, room?.id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [open, onClose]);

  if (!open || !room || !detail) {
    return null;
  }

  const hero = detail.images[activeImage] ?? detail.images[0];

  return (
    <dialog className="modal modal-open" data-testid="room-detail-modal" aria-labelledby={titleId}>
      <div className="modal-box max-h-[92dvh] w-11/12 max-w-3xl overflow-y-auto p-0">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-base-300 bg-base-100 px-4 py-3">
          <div>
            <h3 id={titleId} className="text-lg font-semibold">{room.name}</h3>
            <p className="flex items-center gap-1 text-sm text-base-content/60">
              <Star size={14} weight="fill" className="text-primary" />
              {detail.rating.toFixed(2)} · {detail.reviewCount} guest reviews
            </p>
          </div>
          <button type="button" className="btn btn-circle btn-ghost btn-sm" onClick={onClose} aria-label="Close room details">
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          <div className="space-y-3">
            <div
              className="h-52 w-full rounded-xl bg-base-200 bg-cover bg-center sm:h-64"
              style={{ backgroundImage: `url(${hero?.src})` }}
              role="img"
              aria-label={hero?.alt}
            />
            {detail.images.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {detail.images.map((image, index) => (
                  <button
                    key={image.src}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    className={`h-16 w-24 shrink-0 rounded-lg bg-cover bg-center ring-2 ${
                      index === activeImage ? "ring-primary" : "ring-transparent"
                    }`}
                    style={{ backgroundImage: `url(${image.src})` }}
                    aria-label={`View ${image.alt}`}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 text-sm text-base-content/70">
            <span className="badge badge-outline">Sleeps {room.maxGuests}</span>
            <span className="badge badge-outline">{room.beds}</span>
            <span className="badge badge-outline">{detail.sizeSqFt} sq ft</span>
            <span className="badge badge-outline">
              {room.breakfastIncluded ? "Breakfast included" : "Breakfast add-on"}
            </span>
          </div>

          <p className="text-sm leading-6 text-base-content/80">{room.description}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold">Included</p>
              <ul className="space-y-1.5">
                {detail.included.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-base-content/80">
                    <Check size={14} weight="bold" className="mt-0.5 shrink-0 text-success" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Not included</p>
              <ul className="space-y-1.5">
                {detail.notIncluded.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-base-content/60">
                    <X size={14} weight="bold" className="mt-0.5 shrink-0 text-base-content/40" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Recent guest reviews</p>
            <div className="space-y-3">
              {detail.reviews.map((review) => (
                <article key={review.id} className="rounded-xl border border-base-300 bg-base-200/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{review.author}</p>
                    <p className="text-xs text-base-content/50">{review.date}</p>
                  </div>
                  <div className="mt-1 flex items-center gap-0.5 text-primary">
                    {Array.from({ length: review.rating }).map((_, index) => (
                      <Star key={index} size={12} weight="fill" />
                    ))}
                  </div>
                  <p className="mt-2 text-sm leading-5 text-base-content/75">{review.text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-base-300 bg-base-200/50 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xl font-semibold">
                  {formatInr(room.pricePerNight)}
                  <span className="text-sm font-normal text-base-content/60">/night</span>
                </p>
                <p className="text-sm text-base-content/60">
                  {nights} {nights === 1 ? "night" : "nights"} · estimated stay
                </p>
              </div>
              <p className="text-right text-xl font-semibold text-primary">{formatInr(room.totalPrice)}</p>
            </div>
            {onHold ? (
              <button
                type="button"
                data-testid="hold-room-button"
                className="btn btn-primary mt-4 w-full rounded-full"
                onClick={onHold}
                disabled={holdDisabled}
              >
                Book this room
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
