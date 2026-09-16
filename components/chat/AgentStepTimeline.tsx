"use client";

import { HotelConciergeLoader } from "@/components/chat/HotelConciergeLoader";

export type AgentStep = {
  id: string;
  toolName: string;
  label: string;
  status: "active" | "done";
};

type Props = {
  steps: AgentStep[];
};

export function AgentStepTimeline({ steps }: Props) {
  if (steps.length === 0) {
    return null;
  }

  const activeStep = steps.find((step) => step.status === "active");

  return (
    <div
      className="hotel-agent-timeline"
      data-testid="agent-step-timeline"
      aria-live="polite"
    >
      <HotelConciergeLoader
        label={activeStep?.label ?? "Preparing your answer"}
        compact
      />
      <ol className="hotel-agent-timeline__steps">
        {steps.map((step) => (
          <li
            key={step.id}
            className={`hotel-agent-timeline__step ${
              step.status === "done" ? "hotel-agent-timeline__step--done" : ""
            } ${step.status === "active" ? "hotel-agent-timeline__step--active" : ""}`}
          >
            <span className="hotel-agent-timeline__marker" aria-hidden="true">
              {step.status === "done" ? "✓" : ""}
            </span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
