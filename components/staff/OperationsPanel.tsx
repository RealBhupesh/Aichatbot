"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatInr } from "@/lib/hotel";
import type { HotelOperations, OperationalRoom } from "@/lib/operations";

type Props = {
  initialOperations: HotelOperations;
  initialRooms: OperationalRoom[];
};

export function OperationsPanel({ initialOperations, initialRooms }: Props) {
  const [operations, setOperations] = useState(initialOperations);
  const [rooms, setRooms] = useState(initialRooms);
  const [closedDates, setClosedDates] = useState(initialOperations.hotelClosedDates.join(", "));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const catalog = useMemo(() => rooms, [rooms]);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const hotelClosedDates = closedDates
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const nextRooms: HotelOperations["rooms"] = {};
      for (const room of catalog) {
        nextRooms[room.id] = {
          inventory: room.inventory,
          pricePerNight: room.pricePerNight,
          closed: room.closed,
          blackouts: room.blackouts,
        };
      }

      const response = await fetch("/api/staff/operations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelClosedDates, rooms: nextRooms }),
      });
      const data = (await response.json()) as {
        message?: string;
        operations?: HotelOperations;
        rooms?: OperationalRoom[];
      };
      if (!response.ok) {
        setMessage(data.message || "Could not save.");
        return;
      }
      if (data.operations) {
        setOperations(data.operations);
      }
      if (data.rooms) {
        setRooms(data.rooms);
      }
      setMessage("Saved. The guest assistant will use these numbers on the next availability check.");
    } catch {
      setMessage("Could not save operations.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <section className="rounded-2xl bg-white p-5 ring-1 ring-[var(--color-hairline)]">
        <h2 className="text-[16px] font-semibold text-[var(--color-ink)]">Hotel closed dates</h2>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          Comma-separated YYYY-MM-DD values. Every room is treated as sold out on these nights.
        </p>
        <input
          value={closedDates}
          onChange={(event) => setClosedDates(event.target.value)}
          className="mt-3 h-12 w-full rounded-xl px-3 text-[15px] ring-1 ring-[var(--color-hairline)] outline-none focus:ring-2 focus:ring-[var(--color-ink)]"
        />
      </section>

      <div className="mt-6 grid gap-4">
        {catalog.map((room) => (
          <article
            key={room.id}
            className="grid gap-4 rounded-2xl bg-white p-4 ring-1 ring-[var(--color-hairline)] md:grid-cols-[180px_1fr]"
          >
            <div
              className="min-h-32 overflow-hidden rounded-xl bg-[var(--color-surface-soft)] bg-cover bg-center"
              style={{ backgroundImage: room.image ? `url(${room.image})` : undefined }}
            />
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-[18px] font-semibold text-[var(--color-ink)]">{room.name}</h2>
                  <p className="text-[13px] text-[var(--color-muted)]">
                    Sleeps {room.maxGuests} · {room.beds} · currently {formatInr(room.pricePerNight)}/night
                  </p>
                </div>
                <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--color-ink)]">
                  <input
                    type="checkbox"
                    checked={room.closed}
                    onChange={(event) =>
                      setRooms((current) =>
                        current.map((item) =>
                          item.id === room.id ? { ...item, closed: event.target.checked } : item,
                        ),
                      )
                    }
                  />
                  Closed
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-[12px] font-medium text-[var(--color-muted)]">
                  Inventory
                  <input
                    type="number"
                    min={0}
                    value={room.inventory}
                    onChange={(event) =>
                      setRooms((current) =>
                        current.map((item) =>
                          item.id === room.id
                            ? { ...item, inventory: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                    className="mt-1 h-11 w-full rounded-xl px-3 text-[15px] text-[var(--color-ink)] ring-1 ring-[var(--color-hairline)]"
                  />
                </label>
                <label className="text-[12px] font-medium text-[var(--color-muted)]">
                  Price / night (INR)
                  <input
                    type="number"
                    min={0}
                    value={room.pricePerNight}
                    onChange={(event) =>
                      setRooms((current) =>
                        current.map((item) =>
                          item.id === room.id
                            ? { ...item, pricePerNight: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                    className="mt-1 h-11 w-full rounded-xl px-3 text-[15px] text-[var(--color-ink)] ring-1 ring-[var(--color-hairline)]"
                  />
                </label>
                <label className="text-[12px] font-medium text-[var(--color-muted)] sm:col-span-1">
                  Blackout dates
                  <input
                    value={room.blackouts.join(", ")}
                    onChange={(event) =>
                      setRooms((current) =>
                        current.map((item) =>
                          item.id === room.id
                            ? {
                                ...item,
                                blackouts: event.target.value
                                  .split(",")
                                  .map((value) => value.trim())
                                  .filter(Boolean),
                              }
                            : item,
                        ),
                      )
                    }
                    className="mt-1 h-11 w-full rounded-xl px-3 text-[15px] text-[var(--color-ink)] ring-1 ring-[var(--color-hairline)]"
                  />
                </label>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="sticky bottom-4 mt-8 flex items-center justify-between gap-4 rounded-full bg-white px-4 py-3 shadow-[var(--shadow-card)] ring-1 ring-[var(--color-hairline)]">
        <p className="text-[13px] text-[var(--color-muted)]">
          {message ?? `${operations.hotelClosedDates.length} hotel-wide closed dates stored.`}
        </p>
        <Button type="button" onClick={() => void save()} disabled={busy} className="h-11 px-5">
          {busy ? "Saving…" : "Save operations"}
        </Button>
      </div>
    </div>
  );
}
