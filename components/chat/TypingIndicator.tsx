export function TypingIndicator({ label = "Leela is looking that up" }: { label?: string }) {
  return (
    <div
      className="flex max-w-[85%] items-center gap-2 rounded-[18px] bg-[var(--color-surface-soft)] px-4 py-3"
      role="status"
      aria-live="polite"
      data-testid="typing-indicator"
    >
      <span className="sr-only">{label}</span>
      <span className="flex gap-1" aria-hidden="true">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-muted)] [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-muted)] [animation-delay:120ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-muted)] [animation-delay:240ms]" />
      </span>
      <span className="text-[13px] text-[var(--color-muted)]">{label}</span>
    </div>
  );
}
