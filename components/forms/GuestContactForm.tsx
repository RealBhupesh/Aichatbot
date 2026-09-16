"use client";

import { useMemo, useState } from "react";
import { ChatFormPanel } from "@/components/chat/ChatFormPanel";
import type { GuestContactValues } from "@/lib/guest-contact";

export type { GuestContactValues } from "@/lib/guest-contact";

type Props = {
  guestCount?: number;
  initial?: Partial<GuestContactValues> & { guestName?: string };
  loading?: boolean;
  onSubmit: (values: GuestContactValues) => void;
};

function clampGuestCount(value?: number | null) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return 1;
  }
  return Math.min(8, Math.max(1, value));
}

export function GuestContactForm({ guestCount = 1, initial, loading, onSubmit }: Props) {
  const count = clampGuestCount(guestCount);
  const seededNames = useMemo(() => {
    if (initial?.guestNames?.length) {
      return initial.guestNames.slice(0, count);
    }
    if (initial?.guestName) {
      return [initial.guestName];
    }
    return [];
  }, [count, initial?.guestName, initial?.guestNames]);

  const [guestNames, setGuestNames] = useState<string[]>(
    Array.from({ length: count }, (_, index) => seededNames[index] ?? ""),
  );
  const [guestEmail, setGuestEmail] = useState(initial?.guestEmail ?? "");
  const [guestPhone, setGuestPhone] = useState(initial?.guestPhone ?? "");
  const [error, setError] = useState<string | null>(null);

  function updateGuestName(index: number, value: string) {
    setGuestNames((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  function validate() {
    const missingIndex = guestNames.findIndex((name) => !name.trim());
    if (missingIndex >= 0) {
      return count > 1
        ? `Please enter the full name for guest ${missingIndex + 1}.`
        : "Please enter the guest name.";
    }
    if (!guestPhone.trim()) {
      return "Please add a phone number so the front desk can call to confirm.";
    }
    if (guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      return "Please enter a valid email address.";
    }
    return null;
  }

  return (
    <ChatFormPanel
      title={count > 1 ? `Guest details (${count} guests)` : "Guest details"}
      description={
        count > 1
          ? `Add each guest's name below, plus a phone number the desk can call — email is optional.`
          : "Add the name and a phone number so the front desk can call to confirm."
      }
      testId="guest-contact-form"
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const nextError = validate();
          setError(nextError);
          if (nextError) {
            return;
          }
          onSubmit({
            guestNames: guestNames.map((name) => name.trim()),
            guestEmail: guestEmail.trim(),
            guestPhone: guestPhone.trim(),
          });
        }}
      >
        <div className="space-y-3">
          {guestNames.map((name, index) => (
            <div key={index} className="form-control">
              <label className="label py-1" htmlFor={`guest-name-${index}`}>
                <span className="label-text font-medium">
                  {count > 1 ? `Guest ${index + 1} — full name` : "Full name"}
                </span>
              </label>
              <input
                id={`guest-name-${index}`}
                data-testid={index === 0 ? "guest-name" : `guest-name-${index + 1}`}
                type="text"
                autoComplete={index === 0 ? "name" : "off"}
                placeholder={index === 0 ? "Priya Sharma" : "Rahul Mehta"}
                value={name}
                onChange={(event) => updateGuestName(index, event.target.value)}
                className="input input-bordered w-full bg-base-100"
              />
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="form-control">
            <label className="label py-1" htmlFor="guest-email">
              <span className="label-text font-medium">Email</span>
            </label>
            <input
              id="guest-email"
              data-testid="guest-email"
              type="email"
              autoComplete="email"
              placeholder="priya@example.com"
              value={guestEmail}
              onChange={(event) => setGuestEmail(event.target.value)}
              className="input input-bordered w-full bg-base-100"
            />
          </div>
          <div className="form-control">
            <label className="label py-1" htmlFor="guest-phone">
              <span className="label-text font-medium">Phone</span>
            </label>
            <input
              id="guest-phone"
              data-testid="guest-phone"
              type="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={guestPhone}
              onChange={(event) => setGuestPhone(event.target.value)}
              className="input input-bordered w-full bg-base-100"
            />
          </div>
        </div>

        {error ? (
          <div className="alert alert-error py-2 text-sm" role="alert">
            <span>{error}</span>
          </div>
        ) : null}

        <button
          type="submit"
          data-testid="submit-guest-contact"
          disabled={loading}
          className="btn btn-primary w-full rounded-full"
        >
          {loading ? (
            <>
              <span className="loading loading-spinner loading-sm" />
              Saving details…
            </>
          ) : (
            "Continue with these details"
          )}
        </button>
      </form>
    </ChatFormPanel>
  );
}
