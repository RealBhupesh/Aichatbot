"use client";

import { ChatCircleDots, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { PhotoMosaic } from "@/components/desk/PhotoMosaic";

export function ReceptionExperience() {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const talkRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const didOpen = useRef(false);
  const titleId = useId();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      didOpen.current = true;
      panelRef.current?.focus();
      return;
    }
    if (didOpen.current) {
      talkRef.current?.focus();
    }
  }, [open]);

  return (
    <div className="min-h-[100dvh] bg-white text-[var(--color-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-hairline)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-5 md:h-20 md:px-6">
          <p className="text-[18px] font-semibold tracking-tight text-[var(--color-primary)]">
            asteria
          </p>
          <nav className="flex items-center gap-4 text-[14px] font-medium">
            <a
              href="tel:+918325550142"
              className="hidden text-[var(--color-ink)] hover:underline sm:inline"
            >
              Call the desk
            </a>
            <Link
              href="/staff"
              className="rounded-full px-3 py-2 text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
            >
              Staff
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-5 pb-28 pt-6 md:px-6 md:pt-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.02em] text-[var(--color-ink)] md:text-[32px] md:leading-10">
              Asteria Grand Hotel
            </h1>
            <p className="mt-1 text-[15px] text-[var(--color-muted)]">
              4.91 · 312 reviews · Calangute, North Goa
            </p>
          </div>
        </div>

        <PhotoMosaic />

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <div className="flex items-start justify-between gap-4 border-b border-[var(--color-hairline)] pb-6">
              <div>
                <h2 className="text-[22px] font-semibold tracking-[-0.02em]">
                  Front desk hosted by Leela
                </h2>
                <p className="mt-1 text-[15px] text-[var(--color-muted)]">
                  24-hour reception · Check-in 3:00 PM · Check-out 11:00 AM
                </p>
              </div>
              <div
                className="h-14 w-14 shrink-0 rounded-full bg-cover bg-center ring-1 ring-black/10"
                style={{ backgroundImage: "url(/hotel/leela.png)" }}
                aria-hidden="true"
              />
            </div>
            <p className="mt-6 max-w-xl text-[16px] leading-7 text-[var(--color-body)]">
              The desk is open. Ask Leela about rooms, check-in, breakfast, or dates.
              She answers with photos of the hotel so you can see the stay, not just
              read about it.
            </p>
            <p className="mt-8 text-[11px] text-[var(--color-muted)]">
              Assignment demo. Availability is simulated and is not a booking.
            </p>
          </div>

          <aside className="listing-card sticky top-24 hidden h-fit rounded-[12px] p-6 lg:block">
            <p className="text-[22px] font-semibold tracking-tight">
              Talk with the desk
            </p>
            <p className="mt-1 text-[14px] text-[var(--color-muted)]">
              Rooms, policies, and live inventory from the staff dashboard.
            </p>
            <button
              ref={talkRef}
              type="button"
              data-testid="talk-button"
              aria-expanded={open}
              aria-controls="desk-talk-panel"
              onClick={() => setOpen(true)}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] text-[16px] font-semibold text-white transition-transform duration-200 hover:bg-[var(--color-primary-active)] active:scale-[0.99]"
            >
              <ChatCircleDots size={18} weight="bold" />
              Talk
            </button>
          </aside>
        </div>
      </main>

      <div className={`fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-hairline)] bg-white p-3 lg:hidden ${open ? "hidden" : ""}`}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="desk-talk-panel"
          onClick={() => setOpen(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] text-[16px] font-semibold text-white"
        >
          <ChatCircleDots size={18} weight="bold" />
          Talk
        </button>
      </div>

      <aside
        id="desk-talk-panel"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        inert={!open ? true : undefined}
        aria-hidden={!open}
        className={`talk-panel fixed inset-x-0 bottom-0 z-50 flex h-[90dvh] flex-col rounded-t-[16px] bg-[#ffffff] shadow-[0_-8px_40px_rgb(0_0_0/0.18)] transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] md:inset-y-4 md:right-4 md:left-auto md:h-auto md:w-[min(42rem,46vw)] md:rounded-[16px] md:shadow-[0_8px_40px_rgb(0_0_0/0.16)] ${
          open
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-[110%] opacity-0 md:translate-x-[108%] md:translate-y-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              className="h-11 w-11 rounded-full bg-cover bg-center ring-1 ring-black/10"
              style={{ backgroundImage: "url(/hotel/leela.png)" }}
              aria-hidden="true"
            />
            <div>
              <h2 id={titleId} className="text-[16px] font-semibold text-[var(--color-ink)]">
                Leela
              </h2>
              <p className="flex items-center gap-2 text-[13px] text-[var(--color-muted)]">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    listening ? "bg-[var(--color-primary)]" : "bg-[#00a699]"
                  }`}
                  aria-hidden="true"
                />
                {listening ? "Looking that up" : "Front desk · usually replies instantly"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
            aria-label="Close the desk conversation"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ChatWindow
            key={chatKey}
            onBusyChange={setListening}
            onNewConversation={() => {
              setOpen(true);
              setChatKey((current) => current + 1);
            }}
          />
        </div>
      </aside>
    </div>
  );
}
