"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { EscalationTicket } from "@/lib/escalations";

type Props = {
  initialTickets: EscalationTicket[];
  onViewConversation?: (sessionId: string) => void;
};

export function EscalationQueue({ initialTickets, onViewConversation }: Props) {
  const [tickets, setTickets] = useState(initialTickets);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch("/api/staff/escalations");
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { tickets?: EscalationTicket[] };
        if (data.tickets) {
          setTickets(data.tickets);
        }
      } catch {
        // Ignore polling errors and try again on the next interval.
      }
    }, 20_000);

    return () => window.clearInterval(interval);
  }, []);

  async function resolveTicket(ticketId: string) {
    setBusyId(ticketId);
    setMessage(null);
    try {
      const response = await fetch("/api/staff/escalations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId }),
      });
      const data = (await response.json()) as { message?: string; ticket?: EscalationTicket };
      if (!response.ok) {
        setMessage(data.message || "Could not resolve ticket.");
        return;
      }
      setTickets((current) => current.filter((ticket) => ticket.id !== ticketId));
      setMessage("Ticket marked resolved.");
    } catch {
      setMessage("Could not resolve ticket.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-[var(--color-hairline)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--color-ink)]">Guest escalations</h2>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            Requests flagged by Leela when a guest asks for a human or needs help beyond the assistant.
          </p>
        </div>
        <span className="rounded-full bg-[var(--color-surface-soft)] px-3 py-1 text-[12px] font-semibold text-[var(--color-ink)]">
          {tickets.length} open
        </span>
      </div>

      {message ? <p className="mt-3 text-[13px] text-[var(--color-muted)]">{message}</p> : null}

      {tickets.length === 0 ? (
        <p className="mt-4 text-[14px] text-[var(--color-muted)]">No open escalations right now.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {tickets.map((ticket) => (
            <article
              key={ticket.id}
              className="rounded-xl bg-[var(--color-surface-soft)] p-4"
              data-testid="escalation-ticket"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold text-[var(--color-ink)]">{ticket.reason}</p>
                  <p className="mt-1 text-[13px] text-[var(--color-body)]">{ticket.summary}</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 px-3 text-[13px]"
                  disabled={busyId === ticket.id}
                  onClick={() => void resolveTicket(ticket.id)}
                >
                  {busyId === ticket.id ? "Saving…" : "Mark resolved"}
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-[var(--color-muted)]">
                <span>Ticket {ticket.id.slice(0, 8).toUpperCase()}</span>
                {ticket.guestName ? <span>{ticket.guestName}</span> : null}
                {ticket.guestEmail ? <span>{ticket.guestEmail}</span> : null}
                {ticket.guestPhone ? <span>{ticket.guestPhone}</span> : null}
                <span>{new Date(ticket.createdAt).toLocaleString()}</span>
                {onViewConversation ? (
                  <button
                    type="button"
                    className="font-semibold text-[var(--color-primary)]"
                    onClick={() => onViewConversation(ticket.sessionId)}
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
  );
}
