"use client";

import { Button } from "@/components/ui/Button";
import type { ChatResponse } from "@/lib/schemas";

type ChatAction = NonNullable<ChatResponse["actions"]>[number];

type Props = {
  actions: ChatAction[];
  disabled?: boolean;
  onAction: (action: ChatAction) => void;
};

export function ActionButtons({ actions, disabled, onAction }: Props) {
  if (!actions.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2" data-testid="chat-actions">
      {actions.map((action) => (
        <Button
          key={`${action.type}-${action.holdToken ?? action.holdId ?? action.roomId ?? action.label}`}
          type="button"
          variant={
            action.type === "confirm_hold" || action.type === "confirm_modify" ? "primary" : "secondary"
          }
          className="h-10 px-4 text-sm"
          disabled={disabled}
          onClick={() => onAction(action)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
