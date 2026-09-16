"use client";

import type { ChatSuggestion } from "@/lib/follow-up-suggestions";

type Props = {
  suggestions: ChatSuggestion[];
  disabled?: boolean;
  onSelect: (message: string) => void;
};

export function FollowUpSuggestions({ suggestions, disabled, onSelect }: Props) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2" data-testid="follow-up-suggestions">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.label}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(suggestion.message)}
          className="btn btn-outline btn-sm rounded-full"
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}
