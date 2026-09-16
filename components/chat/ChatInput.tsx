"use client";

import { PaperPlaneTilt } from "@phosphor-icons/react";
import { useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  onSend: (message: string) => void;
};

export function ChatInput({ disabled, onSend }: Props) {
  const [empty, setEmpty] = useState(true);
  const field = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const next = field.current?.value.trim() ?? "";
    if (!next || disabled) {
      return;
    }
    onSend(next);
    if (field.current) {
      field.current.value = "";
    }
    setEmpty(true);
  }

  return (
    <form
      className="shrink-0 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label htmlFor="guest-message" className="sr-only">
        Message the Asteria desk
      </label>
      <div className="flex items-end gap-2 rounded-full border border-base-300 bg-base-200 p-1.5 focus-within:border-primary">
        <textarea
          id="guest-message"
          ref={field}
          data-testid="chat-input"
          name="message"
          rows={1}
          disabled={disabled}
          placeholder="Ask about rooms, amenities, or availability"
          className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-4 py-2.5 text-[16px] leading-6 text-base-content outline-none placeholder:text-base-content/50 disabled:cursor-not-allowed"
          onInput={(event) => setEmpty(event.currentTarget.value.trim().length === 0)}
          onChange={(event) => setEmpty(event.currentTarget.value.trim().length === 0)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="submit"
          data-testid="send-button"
          disabled={disabled || empty}
          aria-label="Send message"
          className="btn btn-primary btn-circle h-11 w-11 shrink-0 min-h-11 rounded-full"
        >
          <PaperPlaneTilt size={16} weight="bold" />
        </button>
      </div>
      <p className="mt-2 px-3 text-[12px] text-[var(--color-muted)]">
        Press Enter to send, Shift+Enter for a new line.
      </p>
    </form>
  );
}
