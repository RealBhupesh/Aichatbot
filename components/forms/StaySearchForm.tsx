"use client";

import { useMemo, useState } from "react";
import { ChatFormPanel } from "@/components/chat/ChatFormPanel";
import { StayCalendarPicker } from "@/components/forms/StayCalendarPicker";

export type StayValues = {
  checkIn: string;
  checkOut: string;
  guests: number;
  maxBudget?: number | null;
  checkInTime?: string;
  checkOutTime?: string;
};

type Props = {
  initial?: Partial<StayValues>;
  missingFields?: string[];
  loading?: boolean;
  onSubmit: (values: StayValues) => void;
};

function localIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultStay(): StayValues {
  const today = new Date();
  const checkIn = new Date(today);
  checkIn.setDate(today.getDate() + 4);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkIn.getDate() + 2);
  return {
    checkIn: localIso(checkIn),
    checkOut: localIso(checkOut),
    guests: 2,
    maxBudget: null,
    checkInTime: "15:00",
    checkOutTime: "11:00",
  };
}

export function StaySearchForm({ initial, missingFields = [], loading, onSubmit }: Props) {
  const defaults = useMemo(() => defaultStay(), []);
  const [checkIn, setCheckIn] = useState(initial?.checkIn || "");
  const [checkOut, setCheckOut] = useState(initial?.checkOut || "");
  const [guests, setGuests] = useState(initial?.guests || defaults.guests);
  const [maxBudget, setMaxBudget] = useState(
    typeof initial?.maxBudget === "number" ? String(initial.maxBudget) : "",
  );
  const [checkInTime, setCheckInTime] = useState(initial?.checkInTime || defaults.checkInTime);
  const [checkOutTime, setCheckOutTime] = useState(initial?.checkOutTime || defaults.checkOutTime);
  const [error, setError] = useState<string | null>(null);

  const minDate = localIso(new Date());
  const needs = new Set(missingFields);

  function validate() {
    if (!checkIn || !checkOut) {
      return "Please choose both check-in and check-out on the calendar.";
    }
    if (checkOut <= checkIn) {
      return "Check-out must be after check-in.";
    }
    if (!Number.isInteger(guests) || guests < 1 || guests > 8) {
      return "Guests must be between 1 and 8.";
    }
    if (maxBudget && (Number.isNaN(Number(maxBudget)) || Number(maxBudget) <= 0)) {
      return "Budget must be a positive amount in INR.";
    }
    return null;
  }

  return (
    <ChatFormPanel
      title="Choose your stay dates"
      description="Tap check-in, then check-out on the calendar. Add arrival times and guest count below."
      testId="availability-form"
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const nextError = validate();
          setError(nextError);
          if (nextError) {
            return;
          }
          onSubmit({
            checkIn,
            checkOut,
            guests,
            maxBudget: maxBudget ? Number(maxBudget) : null,
            checkInTime,
            checkOutTime,
          });
        }}
      >
        <StayCalendarPicker
          checkIn={checkIn}
          checkOut={checkOut}
          minDate={minDate}
          onChange={(nextCheckIn, nextCheckOut) => {
            setCheckIn(nextCheckIn);
            setCheckOut(nextCheckOut);
            setError(null);
          }}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="form-control">
            <label className="label py-1" htmlFor="check-in-time">
              <span className="label-text font-medium">Arrival time</span>
            </label>
            <input
              id="check-in-time"
              data-testid="check-in-time"
              type="time"
              value={checkInTime}
              onChange={(event) => setCheckInTime(event.target.value)}
              className="input input-bordered w-full bg-base-100"
            />
          </div>
          <div className="form-control">
            <label className="label py-1" htmlFor="check-out-time">
              <span className="label-text font-medium">Departure time</span>
            </label>
            <input
              id="check-out-time"
              data-testid="check-out-time"
              type="time"
              value={checkOutTime}
              onChange={(event) => setCheckOutTime(event.target.value)}
              className="input input-bordered w-full bg-base-100"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="form-control">
            <label className="label py-1" htmlFor="guests">
              <span className="label-text font-medium">Guests</span>
              {needs.has("guests") ? <span className="badge badge-primary badge-xs">Needed</span> : null}
            </label>
            <div className="join w-full">
              <button
                type="button"
                className="btn btn-outline join-item"
                onClick={() => setGuests((value) => Math.max(1, value - 1))}
                aria-label="Decrease guests"
              >
                −
              </button>
              <input
                id="guests"
                data-testid="guests"
                type="number"
                min={1}
                max={8}
                value={guests}
                onChange={(event) => setGuests(Number(event.target.value))}
                className={`input join-item w-full text-center ${needs.has("guests") ? "input-error" : "input-bordered"}`}
              />
              <button
                type="button"
                className="btn btn-outline join-item"
                onClick={() => setGuests((value) => Math.min(8, value + 1))}
                aria-label="Increase guests"
              >
                +
              </button>
            </div>
          </div>
          <div className="form-control">
            <label className="label py-1" htmlFor="max-budget">
              <span className="label-text font-medium">Nightly budget (INR)</span>
              <span className="label-text-alt">Optional</span>
            </label>
            <input
              id="max-budget"
              data-testid="max-budget"
              type="number"
              min={1000}
              step={500}
              placeholder="e.g. 7000"
              value={maxBudget}
              onChange={(event) => setMaxBudget(event.target.value)}
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
          data-testid="check-availability"
          disabled={loading}
          className="btn btn-primary w-full rounded-full"
        >
          {loading ? (
            <>
              <span className="loading loading-spinner loading-sm" />
              Checking rooms…
            </>
          ) : (
            "Search available rooms"
          )}
        </button>
      </form>
    </ChatFormPanel>
  );
}
