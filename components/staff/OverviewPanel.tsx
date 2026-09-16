"use client";

import { useEffect, useState } from "react";
import { formatInr } from "@/lib/hotel";
import type { BookingHold } from "@/lib/bookings";
import type { EscalationTicket } from "@/lib/escalations";
import type { SessionSummary } from "@/lib/sessions";

type Props = {
  sessions: SessionSummary[];
  escalations: EscalationTicket[];
  holds: BookingHold[];
  pendingBookings: BookingHold[];
  onOpenConversation: (sessionId: string) => void;
};

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function OverviewPanel({
  sessions,
  escalations,
  holds: initialHolds,
  pendingBookings: initialPending,
  onOpenConversation,
}: Props) {
  const [holds, setHolds] = useState(initialHolds);
  const [pendingBookings, setPendingBookings] = useState(initialPending);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch("/api/staff/bookings");
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as {
          pending?: BookingHold[];
          holds?: BookingHold[];
        };
        setPendingBookings(data.pending ?? []);
        setHolds(data.holds ?? []);
      } catch {
        // Keep the last known desk snapshot.
      }
    }, 8000);
    return () => window.clearInterval(interval);
  }, []);

  const takeovers = sessions.filter((session) => session.mode === "staff").length;
  const conversationsToday = sessions.filter((session) =>
    session.updatedAt.startsWith(todayStamp()),
  ).length;
  const recentHolds = holds
    .filter((hold) => hold.status === "confirmed" || hold.status === "cancelled")
    .slice(-5)
    .reverse();

  const stats = [
    { label: "Open escalations", value: escalations.length },
    { label: "Live takeovers", value: takeovers },
    { label: "Conversations today", value: conversationsToday },
    { label: "Booking requests", value: pendingBookings.length },
  ];

  async function decide(holdId: string, action: "confirm" | "decline") {
    setBusyId(holdId);
    setError(null);
    try {
      const response = await fetch(`/api/staff/bookings/${holdId}/${action}`, {
        method: "POST",
      });
      const data = (await response.json()) as { message?: string; hold?: BookingHold };
      if (!response.ok) {
        setError(data.message || "Could not update that booking request.");
        return;
      }
      const refresh = await fetch("/api/staff/bookings");
      if (refresh.ok) {
        const next = (await refresh.json()) as {
          pending?: BookingHold[];
          holds?: BookingHold[];
        };
        setPendingBookings(next.pending ?? []);
        setHolds(next.holds ?? []);
      }
    } catch {
      setError("Could not reach the desk booking API.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <article key={stat.label} className="rounded-2xl bg-white p-4 ring-1 ring-[var(--color-hairline)]">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              {stat.label}
            </p>
            <p className="mt-2 text-[28px] font-semibold tracking-tight text-[var(--color-ink)]">
              {stat.value}
            </p>
          </article>
        ))}
      </div>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-[var(--color-hairline)]">
        <h2 className="text-[16px] font-semibold text-[var(--color-ink)]">Booking requests</h2>
        {error ? <p className="mt-2 text-[13px] text-red-600">{error}</p> : null}
        {pendingBookings.length === 0 ? (
          <p className="mt-3 text-[14px] text-[var(--color-muted)]">No booking requests right now.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {pendingBookings.map((hold) => (
              <article
                key={hold.id}
                className="rounded-xl bg-[var(--color-surface-soft)] p-4"
                data-testid="booking-request-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--color-ink)]">{hold.roomName}</p>
                    <p className="mt-1 text-[13px] text-[var(--color-body)]">
                      {hold.checkIn} to {hold.checkOut} · {hold.guests} guest
                      {hold.guests === 1 ? "" : "s"} · {formatInr(hold.totalPrice)}
                    </p>
                    <p className="mt-1 text-[13px] text-[var(--color-ink)]">{hold.guestName}</p>
                    {hold.guestPhone ? (
                      <a
                        href={phoneHref(hold.guestPhone)}
                        className="mt-1 inline-block text-[13px] font-semibold text-[var(--color-primary)]"
                      >
                        {hold.guestPhone}
                      </a>
                    ) : (
                      <p className="mt-1 text-[13px] text-[var(--color-muted)]">No phone</p>
                    )}
                    {hold.guestEmail ? (
                      <p className="text-[13px] text-[var(--color-muted)]">{hold.guestEmail}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {hold.sessionId ? (
                      <button
                        type="button"
                        className="text-[13px] font-semibold text-[var(--color-primary)]"
                        onClick={() => onOpenConversation(hold.sessionId as string)}
                      >
                        View conversation
                      </button>
                    ) : null}
                    <button
                      type="button"
                      data-testid="confirm-booking"
                      className="rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50"
                      disabled={busyId === hold.id}
                      onClick={() => void decide(hold.id, "confirm")}
                    >
                      Confirm booking
                    </button>
                    <button
                      type="button"
                      data-testid="decline-booking"
                      className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--color-ink)] ring-1 ring-[var(--color-hairline)] disabled:opacity-50"
                      disabled={busyId === hold.id}
                      onClick={() => void decide(hold.id, "decline")}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-[var(--color-hairline)]">
        <h2 className="text-[16px] font-semibold text-[var(--color-ink)]">Confirmed bookings</h2>
        {recentHolds.length === 0 ? (
          <p className="mt-3 text-[14px] text-[var(--color-muted)]">No confirmed bookings stored yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {recentHolds.map((hold) => (
              <article key={hold.id} className="rounded-xl bg-[var(--color-surface-soft)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--color-ink)]">
                      {hold.confirmationCode} · {hold.roomName}
                    </p>
                    <p className="mt-1 text-[13px] text-[var(--color-body)]">
                      {hold.status === "cancelled" ? "Cancelled" : "Confirmed"} · {hold.checkIn} to{" "}
                      {hold.checkOut} · {hold.guestName} · {formatInr(hold.totalPrice)}
                    </p>
                    {hold.guestPhone ? (
                      <a
                        href={phoneHref(hold.guestPhone)}
                        className="mt-1 inline-block text-[13px] font-semibold text-[var(--color-primary)]"
                      >
                        {hold.guestPhone}
                      </a>
                    ) : null}
                    {hold.specialRequests ? (
                      <p className="mt-1 text-[13px] text-[var(--color-muted)]">
                        Requests: {hold.specialRequests}
                      </p>
                    ) : null}
                  </div>
                  {hold.sessionId ? (
                    <button
                      type="button"
                      className="text-[13px] font-semibold text-[var(--color-primary)]"
                      onClick={() => onOpenConversation(hold.sessionId as string)}
                    >
                      View conversation
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
