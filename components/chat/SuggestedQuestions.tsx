"use client";

import {
  CalendarBlank,
  Clock,
  ForkKnife,
  UsersThree,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

type MenuItem = {
  label: string;
  question: string;
  icon: Icon;
  testId?: string;
};

export const SUGGESTED_QUESTIONS = [
  "Check room availability",
  "What time is check-in?",
  "Is breakfast included?",
  "Which rooms fit 3 guests?",
];

const MENU: MenuItem[] = [
  {
    label: "Check room availability",
    question: "Check room availability",
    icon: CalendarBlank,
    testId: "suggested-availability",
  },
  {
    label: "What time is check-in?",
    question: "What time is check-in?",
    icon: Clock,
  },
  {
    label: "Is breakfast included?",
    question: "Is breakfast included?",
    icon: ForkKnife,
  },
  {
    label: "Which rooms fit 3 guests?",
    question: "Which rooms fit 3 guests?",
    icon: UsersThree,
  },
];

type Props = {
  onSelect: (question: string) => void;
  disabled?: boolean;
};

export function SuggestedQuestions({ onSelect, disabled }: Props) {
  return (
    <div data-testid="suggested-questions">
      <p className="mb-3 text-[13px] font-medium text-[var(--color-muted)]">
        Popular with guests
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {MENU.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(item.question)}
              data-testid={item.testId}
              className="group flex items-center gap-3 rounded-[12px] bg-[var(--color-surface-soft)] px-3.5 py-2.5 text-left transition-transform duration-200 hover:bg-[#ebebeb] disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--color-ink)] ring-1 ring-[var(--color-hairline)]">
                <Icon size={18} weight="light" />
              </span>
              <span className="text-[14px] leading-5 font-medium text-[var(--color-ink)]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
