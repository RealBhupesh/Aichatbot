"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConversationDetail } from "@/components/staff/ConversationDetail";
import { ConversationList } from "@/components/staff/ConversationList";
import { EscalationQueue } from "@/components/staff/EscalationQueue";
import { OperationsPanel } from "@/components/staff/OperationsPanel";
import { OverviewPanel } from "@/components/staff/OverviewPanel";
import { Button } from "@/components/ui/Button";
import type { BookingHold } from "@/lib/bookings";
import type { EscalationTicket } from "@/lib/escalations";
import type { HotelOperations, OperationalRoom } from "@/lib/operations";
import type { SessionSummary } from "@/lib/sessions";

type Tab = "overview" | "conversations" | "escalations" | "operations";

type Props = {
  initialOperations: HotelOperations;
  initialRooms: OperationalRoom[];
  initialEscalations: EscalationTicket[];
  initialSessions: SessionSummary[];
  initialHolds: BookingHold[];
  initialPendingBookings: BookingHold[];
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "conversations", label: "Conversations" },
  { id: "escalations", label: "Escalations" },
  { id: "operations", label: "Operations" },
];

export function StaffDashboard({
  initialOperations,
  initialRooms,
  initialEscalations,
  initialSessions,
  initialHolds,
  initialPendingBookings,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    initialSessions[0]?.id ?? null,
  );

  function openConversation(sessionId: string) {
    setSelectedSessionId(sessionId);
    setTab("conversations");
  }

  return (
    <main className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden px-6 py-5">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold tracking-tight text-[var(--color-primary)]">asteria</p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-[var(--color-ink)]">
            Front desk
          </h1>
          <p className="mt-1 max-w-xl text-[14px] text-[var(--color-muted)]">
            Read guest chats, take over live conversations, and keep room inventory in sync with Leela.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-full px-4 text-[14px] font-medium text-[var(--color-ink)] ring-1 ring-[var(--color-hairline)]"
          >
            Guest site
          </Link>
          <Button
            type="button"
            variant="secondary"
            className="h-11 px-4 text-[14px]"
            onClick={async () => {
              await fetch("/api/staff/logout", { method: "POST" });
              router.push("/staff/login");
              router.refresh();
            }}
          >
            Sign out
          </Button>
        </div>
      </header>

      <nav className="mt-4 flex shrink-0 flex-wrap gap-2" aria-label="Staff desk sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-2 text-[14px] font-semibold ${
              tab === item.id
                ? "bg-[var(--color-ink)] text-white"
                : "bg-white text-[var(--color-ink)] ring-1 ring-[var(--color-hairline)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div
        className={`mt-4 min-h-0 flex-1 ${
          tab === "conversations" ? "overflow-hidden" : "overflow-y-auto"
        }`}
      >
        {tab === "overview" ? (
          <OverviewPanel
            sessions={initialSessions}
            escalations={initialEscalations}
            holds={initialHolds}
            pendingBookings={initialPendingBookings}
            onOpenConversation={openConversation}
          />
        ) : null}

        {tab === "conversations" ? (
          <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[300px_1fr]">
            <ConversationList
              initialSessions={initialSessions}
              selectedId={selectedSessionId}
              onSelect={setSelectedSessionId}
            />
            {selectedSessionId ? (
              <ConversationDetail key={selectedSessionId} sessionId={selectedSessionId} />
            ) : (
              <div className="flex h-full min-h-0 items-center justify-center rounded-2xl bg-white p-6 text-[14px] text-[var(--color-muted)] ring-1 ring-[var(--color-hairline)]">
                Select a conversation to read the full guest thread.
              </div>
            )}
          </div>
        ) : null}

        {tab === "escalations" ? (
          <EscalationQueue
            initialTickets={initialEscalations}
            onViewConversation={openConversation}
          />
        ) : null}

        {tab === "operations" ? (
          <div>
            <h2 className="mb-4 text-[22px] font-semibold tracking-tight text-[var(--color-ink)]">
              Room operations
            </h2>
            <OperationsPanel initialOperations={initialOperations} initialRooms={initialRooms} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
