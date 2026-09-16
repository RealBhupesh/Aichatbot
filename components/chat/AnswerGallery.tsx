"use client";

import { filterAnswerImages } from "@/lib/media";
import type { AnswerImage } from "@/lib/media";

type Props = {
  images: AnswerImage[];
};

export function AnswerGallery({ images }: Props) {
  const visible = filterAnswerImages(images);

  if (visible.length === 0) {
    return null;
  }

  return (
    <div
      className={`grid gap-2 ${visible.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
      data-testid="answer-gallery"
    >
      {visible.map((image) => (
        <figure key={image.src} className="overflow-hidden rounded-xl border border-base-300">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.src}
            alt={image.alt}
            data-testid="answer-image"
            className="aspect-[4/3] w-full object-cover"
          />
          {image.caption ? (
            <figcaption className="px-2 py-1.5 text-xs text-base-content/60">
              {image.caption}
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}
