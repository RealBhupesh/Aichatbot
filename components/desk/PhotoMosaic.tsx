"use client";

import { Heart, ShareNetwork } from "@phosphor-icons/react";

const PHOTOS = [
  {
    src: "/hotel/reception-desk.png",
    alt: "Leela at the Asteria reception desk",
    className: "listing-photo listing-photo--hero",
  },
  {
    src: "/hotel/leela.png",
    alt: "Leela, the Asteria receptionist",
    className: "listing-photo listing-photo--tr",
  },
  {
    src: "/hotel/pool.png",
    alt: "Lagoon swimming pool",
    className: "listing-photo listing-photo--br",
  },
  {
    src: "/hotel/breakfast.png",
    alt: "Garden Room breakfast",
    className: "listing-photo listing-photo--bl",
  },
  {
    src: "/hotel/room-family.png",
    alt: "Family Room",
    className: "listing-photo listing-photo--bm",
  },
] as const;

export function PhotoMosaic() {
  return (
    <section className="relative" aria-label="Asteria photos">
      <div className="listing-mosaic overflow-hidden rounded-[12px]">
        {PHOTOS.map((photo) => (
          <div
            key={photo.src}
            className={photo.className}
            role="img"
            aria-label={photo.alt}
            style={{ backgroundImage: `url(${photo.src})` }}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-end gap-2 sm:inset-x-4 sm:top-4">
        <span className="pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-full bg-white/95 px-3 text-[12px] font-semibold text-[var(--color-ink)] shadow-[var(--shadow-pill)]">
          <ShareNetwork size={13} weight="bold" />
          Share
        </span>
        <span className="pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-full bg-white/95 px-3 text-[12px] font-semibold text-[var(--color-ink)] shadow-[var(--shadow-pill)]">
          <Heart size={13} weight="bold" />
          Save
        </span>
      </div>
    </section>
  );
}
