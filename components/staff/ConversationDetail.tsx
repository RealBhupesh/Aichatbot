"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { EscalationTicket } from "@/lib/escalations";
import { formatInr } from "@/lib/hotel";
import type { GuestSession, SessionMessage } from "@/lib/sessions";

type ConversationPayload = {
  session: GuestSession;
  escalation: EscalationTicket | null;
};

type Props = {
  sessionId: string;
};

function speakerLabel(message: SessionMessage) {
  if (message.role === "user") {
    return "Guest";
  }
  if (message.role === "staff") {
    return message.authorName || "Front desk";
  }
  return "Leela";
}

export function ConversationDetail({ sessionId }: Props) {
  const [payload, setPayload] = useState<ConversationPayload | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const thread = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/staff/sessions/${sessionId}`);
        if (!response.ok || cancelled) {
          return;
        }
        const data = (await response.json()) as ConversationPayload;
        if (!cancelled) {
          setPayload(data);
        }
      } catch {
        // Ignore polling errors.
      }
    }

    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [sessionId]);

  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight });
  }, [payload?.session.messages.length]);

  async function post(path: string, body?: unknown) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await response.json()) as { session?: GuestSession; message?: string };
      if (!response.ok) {
        setMessage(data.message || "Could not update this conversation.");
        return;
      }
      if (data.session) {
        setPayload((current) =>
          current ? { ...current, session: data.session as GuestSession } : current,
        );
      }
    } catch {
      setMessage("Could not reach the staff API.");
    } finally {
      setBusy(false);
    }
  }

  if (!payload) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-2xl bg-white p-6 text-[14px] text-[var(--color-muted)] ring-1 ring-[var(--color-hairline)]">
        Loading conversation…
      </div>
    );
  }

  const { session, escalation } = payload;
  const live = session.mode === "staff";

  return (
    <div className="grid h-full min-h-0 overflow-hidden rounded-2xl bg-white ring-1 ring-[var(--color-hairline)] lg:grid-cols-[1fr_220px]">
      <div className="flex min-h-0 flex-col">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[var(--color-hairline)] px-4 py-3">
          <div>
            <p className="text-[16px] font-semibold text-[var(--color-ink)]">
              {session.guest.name || "Guest"}
            </p>
            <p className="text-[13px] text-[var(--color-muted)]">
              {live ? `Taken over by ${session.assignedTo || "Front desk"}` : "Leela is handling this chat"}
            </p>
          </div>
          <div className="flex gap-2">
            {live ? (
              <Button
                type="button"
                variant="secondary"
                className="h-10 px-3 text-[13px]"
                disabled={busy}
                onClick={() => void post(`/api/staff/sessions/${session.id}/handback`)}
              >
                Hand back to Leela
              </Button>
            ) : (
              <Button
                type="button"
                className="h-10 px-3 text-[13px]"
                disabled={busy}
                onClick={() => void post(`/api/staff/sessions/${session.id}/takeover`)}
              >
                Take over
              </Button>
            )}
          </div>
        </div>

        <div ref={thread} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {session.messages.map((entry, index) => (
            <div
              key={`${entry.at}-${index}`}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-[14px] leading-5 ${
                entry.role === "user"
                  ? "ml-auto bg-[var(--color-ink)] text-white"
                  : entry.role === "staff"
                    ? "bg-primary/10 text-[var(--color-ink)]"
                    : "bg-[var(--color-surface-soft)] text-[var(--color-ink)]"
              }`}
            >
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                {speakerLabel(entry)}
              </p>
              <p className="whitespace-pre-wrap">{entry.content}</p>
            </div>
          ))}
        </div>

        {message ? <p className="px-4 text-[13px] text-[var(--color-error)]">{message}</p> : null}

        <form
          className="shrink-0 border-t border-[var(--color-hairline)] p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const content = draft.trim();
            if (!content) {
              return;
            }
            setDraft("");
            void post(`/api/staff/sessions/${session.id}/messages`, { content });
          }}
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={live ? "Reply as the front desk" : "Take over to reply as the front desk"}
            rows={2}
            className="w-full resize-none rounded-xl px-3 py-2 text-[14px] ring-1 ring-[var(--color-hairline)] outline-none focus:ring-2 focus:ring-[var(--color-ink)]"
          />
          <div className="mt-2 flex justify-end">
            <Button type="submit" disabled={busy || !draft.trim()} className="h-9 px-4 text-[13px]">
              {busy ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      </div>

      <aside className="min-h-0 space-y-4 overflow-y-auto border-t border-[var(--color-hairline)] p-4 lg:border-t-0 lg:border-l">
        <section>
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Guest
          </h3>
          <p className="mt-1 text-[14px] text-[var(--color-ink)]">{session.guest.name || "Unknown"}</p>
          <p className="text-[13px] text-[var(--color-muted)]">{session.guest.email || "No email"}</p>
          <p className="text-[13px] text-[var(--color-muted)]">{session.guest.phone || "No phone"}</p>
        </section>
        <section>
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Stay
          </h3>
          <p className="mt-1 text-[13px] text-[var(--color-body)]">
            {session.stay.checkIn || "—"} → {session.stay.checkOut || "—"}
          </p>
          <p className="text-[13px] text-[var(--color-body)]">
            {typeof session.stay.guests === "number" ? `${session.stay.guests} guests` : "Guest count unknown"}
          </p>
          <p className="text-[13px] text-[var(--color-body)]">
            {session.stay.maxBudget
              ? `Budget ${formatInr(session.stay.maxBudget)}`
              : "No budget captured"}
          </p>
        </section>
        {session.pendingHold ? (
          <section>
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Booking request
            </h3>
            <p className="mt-1 text-[13px] text-[var(--color-body)]">{session.pendingHold.roomName}</p>
            <p className="text-[13px] text-[var(--color-body)]">
              {session.pendingHold.checkIn} to {session.pendingHold.checkOut}
            </p>
            <p className="text-[13px] text-[var(--color-body)]">
              {formatInr(session.pendingHold.totalPrice)}
            </p>
            {session.pendingHold.guestPhone ? (
              <a
                href={`tel:${session.pendingHold.guestPhone.replace(/[^\d+]/g, "")}`}
                className="mt-1 inline-block text-[13px] font-semibold text-[var(--color-primary)]"
              >
                {session.pendingHold.guestPhone}
              </a>
            ) : (
              <p className="text-[13px] text-[var(--color-muted)]">No phone</p>
            )}
          </section>
        ) : null}
        {escalation ? (
          <section>
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Open escalation
            </h3>
            <p className="mt-1 text-[13px] font-medium text-[var(--color-ink)]">{escalation.reason}</p>
            <p className="text-[13px] text-[var(--color-body)]">{escalation.summary}</p>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
