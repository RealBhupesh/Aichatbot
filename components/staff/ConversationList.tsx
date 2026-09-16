"use client";

import { useEffect, useState } from "react";
import type { SessionListFilter, SessionSummary } from "@/lib/sessions";

type Props = {
  initialSessions: SessionSummary[];
  selectedId: string | null;
  onSelect: (sessionId: string) => void;
};

const FILTERS: Array<{ id: SessionListFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "takeover", label: "Live desk" },
  { id: "escalated", label: "Escalated" },
];

function formatTime(value: string | null) {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ConversationList({ initialSessions, selectedId, onSelect }: Props) {
  const [sessions, setSessions] = useState(initialSessions);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SessionListFilter>("all");

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const params = new URLSearchParams();
        if (query.trim()) {
          params.set("q", query.trim());
        }
        if (filter !== "all") {
          params.set("filter", filter);
        }
        const response = await fetch(`/api/staff/sessions?${params.toString()}`);
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { sessions?: SessionSummary[] };
        if (data.sessions) {
          setSessions(data.sessions);
        }
      } catch {
        // Ignore polling errors.
      }
    }, 8000);

    return () => window.clearInterval(interval);
  }, [filter, query]);

  useEffect(() => {
    const handle = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (query.trim()) {
          params.set("q", query.trim());
        }
        if (filter !== "all") {
          params.set("filter", filter);
        }
        const response = await fetch(`/api/staff/sessions?${params.toString()}`);
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { sessions?: SessionSummary[] };
        if (data.sessions) {
          setSessions(data.sessions);
        }
      } catch {
        // Ignore search errors.
      }
    }, 250);

    return () => window.clearTimeout(handle);
  }, [filter, query]);

  return (
    <div className="flex h-full min-h-[28rem] flex-col rounded-2xl bg-white ring-1 ring-[var(--color-hairline)]">
      <div className="border-b border-[var(--color-hairline)] p-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search guests, emails, or messages"
          className="h-11 w-full rounded-xl px-3 text-[14px] ring-1 ring-[var(--color-hairline)] outline-none focus:ring-2 focus:ring-[var(--color-ink)]"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                filter === item.id
                  ? "bg-[var(--color-ink)] text-white"
                  : "bg-[var(--color-surface-soft)] text-[var(--color-ink)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <p className="p-4 text-[14px] text-[var(--color-muted)]">No guest conversations yet.</p>
        ) : (
          sessions.map((session) => {
            const selected = session.id === selectedId;
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelect(session.id)}
                className={`block w-full border-b border-[var(--color-hairline)] px-4 py-3 text-left ${
                  selected ? "bg-[var(--color-surface-soft)]" : "bg-white hover:bg-[var(--color-surface-soft)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--color-ink)]">
                      {session.guestName || "Guest"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[13px] text-[var(--color-muted)]">
                      {session.lastMessagePreview || "No messages yet"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[11px] text-[var(--color-muted)]">
                      {formatTime(session.lastMessageAt ?? session.updatedAt)}
                    </span>
                    {session.unread ? (
                      <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {session.mode === "staff" ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      Desk live
                    </span>
                  ) : null}
                  {session.hasOpenEscalation ? (
                    <span className="rounded-full bg-[var(--color-surface-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-ink)]">
                      Escalated
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
