"use client";

import { useMemo, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

type Props = {
  checkIn: string;
  checkOut: string;
  minDate: string;
  onChange: (checkIn: string, checkOut: string) => void;
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function localIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function buildMonthDays(month: Date, minDate: string) {
  const first = startOfMonth(month);
  const startPad = first.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<{ iso: string; day: number; disabled: boolean } | null> = [];

  for (let index = 0; index < startPad; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const current = new Date(month.getFullYear(), month.getMonth(), day);
    const iso = localIso(current);
    cells.push({
      iso,
      day,
      disabled: iso < minDate,
    });
  }

  return cells;
}

function isBetween(iso: string, start: string, end: string) {
  return iso > start && iso < end;
}

export function StayCalendarPicker({ checkIn, checkOut, minDate, onChange }: Props) {
  const initialMonth = checkIn ? parseLocalDate(checkIn) : parseLocalDate(minDate);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(initialMonth));
  const [selectingCheckout, setSelectingCheckout] = useState(Boolean(checkIn && !checkOut));

  const days = useMemo(() => buildMonthDays(visibleMonth, minDate), [visibleMonth, minDate]);

  function handleDayClick(iso: string) {
    if (!checkIn || (checkIn && checkOut) || iso < checkIn) {
      onChange(iso, "");
      setSelectingCheckout(true);
      return;
    }

    if (selectingCheckout || checkIn) {
      if (iso <= checkIn) {
        onChange(iso, "");
        setSelectingCheckout(true);
        return;
      }
      onChange(checkIn, iso);
      setSelectingCheckout(false);
    }
  }

  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-circle"
          aria-label="Previous month"
          onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
        >
          <CaretLeft size={18} />
        </button>
        <p className="text-sm font-semibold text-base-content">{monthLabel(visibleMonth)}</p>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-circle"
          aria-label="Next month"
          onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
        >
          <CaretRight size={18} />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-base-content/50">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((cell, index) => {
          if (!cell) {
            return <span key={`empty-${index}`} />;
          }

          const isCheckIn = cell.iso === checkIn;
          const isCheckOut = cell.iso === checkOut;
          const inRange =
            checkIn && checkOut ? isBetween(cell.iso, checkIn, checkOut) || isCheckIn || isCheckOut : false;
          const selected = isCheckIn || isCheckOut;

          return (
            <button
              key={cell.iso}
              type="button"
              data-testid={`calendar-day-${cell.iso}`}
              disabled={cell.disabled}
              onClick={() => handleDayClick(cell.iso)}
              className={`flex h-9 w-full items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                cell.disabled
                  ? "cursor-not-allowed text-base-content/25"
                  : selected
                    ? "bg-neutral text-neutral-content"
                    : inRange
                      ? "bg-neutral/10 text-base-content"
                      : "text-base-content hover:bg-base-200"
              }`}
              aria-label={`${cell.day}${isCheckIn ? ", check-in" : ""}${isCheckOut ? ", check-out" : ""}`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-2 text-[13px] text-base-content/70 sm:grid-cols-2">
        <p>
          <span className="font-medium text-base-content">Check-in:</span>{" "}
          {checkIn ? parseLocalDate(checkIn).toLocaleDateString(undefined, { dateStyle: "medium" }) : "Select a date"}
        </p>
        <p>
          <span className="font-medium text-base-content">Check-out:</span>{" "}
          {checkOut
            ? parseLocalDate(checkOut).toLocaleDateString(undefined, { dateStyle: "medium" })
            : checkIn
              ? "Select a date"
              : "—"}
        </p>
      </div>

      <input type="hidden" data-testid="check-in" value={checkIn} readOnly />
      <input type="hidden" data-testid="check-out" value={checkOut} readOnly />
    </div>
  );
}
